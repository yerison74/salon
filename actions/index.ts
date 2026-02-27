"use server"

import { supabase } from "@/lib/supabase"
import type {
  Transaccion, GastoImprevisto, ResumenDiario, Empleada,
  Participacion, ParticipanteForm, ComisionEmpleada
} from "@/lib/supabase"
import { getPorcentaje } from "@/lib/supabase"
import { todayISO, nowTimeISO, calcularComisionesPorEmpleada } from "@/lib/utils"

// ─────────────────────────────────────────────
// DATOS INICIALES
// ─────────────────────────────────────────────
export async function getInitialData(fecha?: string) {
  try {
    const targetDate = fecha || todayISO()

    const [txRes, gastoRes, empleadasRes, resumenRes, partRes] = await Promise.all([
      supabase.from("transacciones").select("*").eq("fecha", targetDate).order("created_at", { ascending: true }),
      supabase.from("gastos_imprevistos").select("*").eq("fecha", targetDate).order("created_at", { ascending: true }),
      supabase.from("empleadas").select("*").eq("activa", true).order("nombre"),
      supabase.from("resumen_diario").select("*").eq("fecha", targetDate).single(),
      supabase.from("participaciones_empleadas").select("*").eq("fecha", targetDate),
    ])

    const transactions: Transaccion[] = txRes.data || []
    const expenses: GastoImprevisto[] = gastoRes.data || []
    const empleadas: Empleada[] = empleadasRes.data || []
    const participaciones: Participacion[] = partRes.data || []

    // Asociar participaciones a cada transacción
    const txConPart = transactions.map(t => ({
      ...t,
      participaciones: participaciones.filter(p => p.transaccion_id === t.id)
    }))

    let resumen: ResumenDiario = resumenRes.data || {
      fecha: targetDate, monto_inicial: 0, total_efectivo: 0,
      total_transferencias: 0, total_devuelto: 0,
      total_gastos_imprevistos: 0, saldo_final: 0, total_general: 0,
    }
    resumen = recalcularResumen(resumen.monto_inicial, transactions, expenses, targetDate)
    await supabase.from("resumen_diario").upsert(resumen, { onConflict: "fecha" })

    // Calcular comisiones por empleada
    const comisiones = calcularComisionesPorEmpleada(participaciones, empleadas)

    return { transactions: txConPart, expenses, empleadas, resumen, participaciones, comisiones, error: null }
  } catch (error) {
    console.error("getInitialData error:", error)
    return {
      transactions: [], expenses: [], empleadas: [],
      resumen: defaultResumen(fecha), participaciones: [], comisiones: [],
      error: "Error al cargar datos",
    }
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function recalcularResumen(
  montoInicial: number, transactions: Transaccion[],
  expenses: GastoImprevisto[], fecha: string
): ResumenDiario {
  const total_efectivo = transactions.filter(t => t.metodo_pago === "efectivo").reduce((s, t) => s + (t.monto_recibido ?? 0), 0)
  const total_transferencias = transactions.filter(t => t.metodo_pago !== "efectivo").reduce((s, t) => s + (t.monto_recibido ?? 0), 0)
  const total_devuelto = transactions.reduce((s, t) => s + (t.cambio_entregado ?? 0), 0)
  const total_gastos_imprevistos = expenses.reduce((s, e) => s + (e.monto ?? 0), 0)
  const saldo_final = montoInicial + total_efectivo - total_devuelto - total_gastos_imprevistos
  const total_general = saldo_final + total_transferencias
  return { fecha, monto_inicial: montoInicial, total_efectivo, total_transferencias, total_devuelto, total_gastos_imprevistos, saldo_final, total_general }
}

function defaultResumen(fecha?: string): ResumenDiario {
  return { fecha: fecha || todayISO(), monto_inicial: 0, total_efectivo: 0, total_transferencias: 0, total_devuelto: 0, total_gastos_imprevistos: 0, saldo_final: 0, total_general: 0 }
}


// ─────────────────────────────────────────────
// TRANSACCIONES + PARTICIPACIONES
// ─────────────────────────────────────────────
export async function addTransactionAction(data: {
  cliente: string
  metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia'
  monto_recibido: number
  monto_servicio: number
  cambio_entregado: number
  observaciones: string
  participantes: ParticipanteForm[]
}) {
  try {
    const today = todayISO()
    const now = nowTimeISO()
    const { participantes, ...txData } = data

    // 1. Insertar transacción (sin quien_atendio — ahora es many-to-many)
    const { data: inserted, error: txError } = await supabase
      .from("transacciones")
      .insert({ ...txData, fecha: today, hora: now })
      .select()
      .single()

    if (txError) throw txError

    // 2. Calcular y guardar participaciones
    // Regla: monto_base = monto_servicio / cantidad_participantes
    // comision = monto_base * porcentaje / 100
    if (participantes.length > 0) {
      const montoBase = data.monto_servicio / participantes.length
      const parts = participantes.map(p => ({
        transaccion_id: inserted.id,
        empleada_nombre: p.empleada_nombre,
        servicio: p.servicio,
        porcentaje: getPorcentaje(p.servicio),
        monto_base: montoBase,
        comision: montoBase * getPorcentaje(p.servicio) / 100,
        fecha: today,
      }))
      const { error: partError } = await supabase.from("participaciones_empleadas").insert(parts)
      if (partError) throw partError
    }

    await recalcularYGuardar(today)
    return { success: true, transaction: inserted }
  } catch (error: any) {
    console.error("addTransactionAction error:", error)
    return { success: false, error: error?.message || "Error al agregar transacción" }
  }
}

export async function deleteTransactionAction(id: string) {
  try {
    const { data: tx } = await supabase.from("transacciones").select("fecha").eq("id", id).single()
    // participaciones se borran en cascada (ON DELETE CASCADE)
    const { error } = await supabase.from("transacciones").delete().eq("id", id)
    if (error) throw error
    await recalcularYGuardar(tx?.fecha || todayISO())
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al eliminar transacción" }
  }
}

// ─────────────────────────────────────────────
// GASTOS
// ─────────────────────────────────────────────
export async function addExpenseAction(data: { monto: number; descripcion: string }) {
  try {
    const today = todayISO()
    const { data: inserted, error } = await supabase
      .from("gastos_imprevistos")
      .insert({ ...data, fecha: today, hora: nowTimeISO() })
      .select().single()
    if (error) throw error
    await recalcularYGuardar(today)
    return { success: true, expense: inserted }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al agregar gasto" }
  }
}

export async function deleteExpenseAction(id: string) {
  try {
    const { data: exp } = await supabase.from("gastos_imprevistos").select("fecha").eq("id", id).single()
    const { error } = await supabase.from("gastos_imprevistos").delete().eq("id", id)
    if (error) throw error
    await recalcularYGuardar(exp?.fecha || todayISO())
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al eliminar gasto" }
  }
}

// ─────────────────────────────────────────────
// EMPLEADAS
// ─────────────────────────────────────────────
export async function addEmpleadaAction(nombre: string) {
  try {
    const { data, error } = await supabase
      .from("empleadas")
      .insert({ nombre: nombre.trim(), fecha_registro: todayISO() })
      .select().single()
    if (error) throw error
    return { success: true, empleada: data }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al agregar empleada" }
  }
}

export async function deleteEmpleadaAction(id: string) {
  try {
    const { error } = await supabase.from("empleadas").update({ activa: false }).eq("id", id)
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al eliminar empleada" }
  }
}

// ─────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────
export async function updateInitialAmountAction(amount: number) {
  try {
    const today = todayISO()
    await supabase.from("resumen_diario").upsert({ fecha: today, monto_inicial: amount }, { onConflict: "fecha" })
    await recalcularYGuardar(today)
    const { data } = await supabase.from("resumen_diario").select("*").eq("fecha", today).single()
    return { success: true, resumen: data }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al actualizar monto inicial" }
  }
}

// ─────────────────────────────────────────────
// FECHAS CON ACTIVIDAD
// ─────────────────────────────────────────────
export async function getDatesWithActivity() {
  try {
    const [txDates, gastoDates] = await Promise.all([
      supabase.from("transacciones").select("fecha"),
      supabase.from("gastos_imprevistos").select("fecha"),
    ])
    const all = [
      ...(txDates.data || []).map(r => r.fecha),
      ...(gastoDates.data || []).map(r => r.fecha),
    ]
    return { success: true, dates: Array.from(new Set(all)) }
  } catch (error: any) {
    return { success: false, dates: [], error: error?.message }
  }
}

// ─────────────────────────────────────────────
// PRIVATE HELPER
// ─────────────────────────────────────────────
async function recalcularYGuardar(fecha: string) {
  const [txRes, gastoRes, resumenRes] = await Promise.all([
    supabase.from("transacciones").select("*").eq("fecha", fecha),
    supabase.from("gastos_imprevistos").select("*").eq("fecha", fecha),
    supabase.from("resumen_diario").select("monto_inicial").eq("fecha", fecha).single(),
  ])
  const montoInicial = resumenRes.data?.monto_inicial ?? 0
  const resumen = recalcularResumen(montoInicial, txRes.data || [], gastoRes.data || [], fecha)
  await supabase.from("resumen_diario").upsert(resumen, { onConflict: "fecha" })
}
