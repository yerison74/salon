"use server"

import { supabase } from "@/lib/supabase"
import type {
  Transaccion, GastoImprevisto, ResumenDiario, Empleada,
  Participacion, ParticipanteForm, ComisionEmpleada, PagoComision,
  Fiado, AbonoFiado
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
  metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia' | 'fiado'
  banco_transferencia?: string | null
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

    // Validar banco obligatorio para transferencias
    if (data.metodo_pago === 'transferencia' && !data.banco_transferencia?.trim()) {
      return { success: false, error: "El banco de destino es obligatorio para transferencias" }
    }

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

// ─────────────────────────────────────────────
// COMISIONES QUINCENALES
// ─────────────────────────────────────────────

/**
 * Obtiene las comisiones acumuladas por empleada en un rango de fechas.
 * Excluye los días que ya tienen pago registrado para esa empleada dentro del rango.
 */
export async function getComisionesQuincenalesAction(fechaDesde: string, fechaHasta: string) {
  try {
    const [partRes, empleadasRes, pagosRes, txRes] = await Promise.all([
      supabase
        .from("participaciones_empleadas")
        .select("*")
        .gte("fecha", fechaDesde)
        .lte("fecha", fechaHasta)
        .order("fecha", { ascending: true }),
      supabase.from("empleadas").select("*").eq("activa", true).order("nombre"),
      supabase
        .from("pagos_comisiones")
        .select("*")
        .order("fecha_pago", { ascending: false }),
      supabase
        .from("transacciones")
        .select("id, cliente, fecha")
        .gte("fecha", fechaDesde)
        .lte("fecha", fechaHasta),
    ])

    const participaciones: Participacion[] = partRes.data || []
    const empleadas: Empleada[] = empleadasRes.data || []
    const pagos: PagoComision[] = pagosRes.data || []
    const txMap: Record<string, string> = {}
    ;(txRes.data || []).forEach((t: any) => { txMap[t.id] = t.cliente })

    // Enriquecer participaciones con nombre del cliente
    const partsConCliente = participaciones.map(p => ({
      ...p,
      cliente: txMap[p.transaccion_id] || "—",
    }))

    // Para cada empleada, calcular acumulado en el rango
    const resumen = empleadas.map(e => {
      const parts = partsConCliente.filter(p => p.empleada_nombre === e.nombre)
      const total = parts.reduce((s, p) => s + (p.comision ?? 0), 0)
      const ultimoPago = pagos.find(pg => pg.empleada_nombre === e.nombre)
      return {
        nombre: e.nombre,
        total,
        participaciones: parts,
        ultimo_pago: ultimoPago?.fecha_pago,
        ultimo_periodo: ultimoPago ? `${ultimoPago.fecha_desde} → ${ultimoPago.fecha_hasta}` : undefined,
      }
    })

    return { success: true, comisiones: resumen, pagos }
  } catch (error: any) {
    return { success: false, comisiones: [], pagos: [], error: error?.message }
  }
}

/** Registra el pago de comisión a una empleada */
export async function registrarPagoComisionAction(data: {
  empleada_nombre: string
  fecha_desde: string
  fecha_hasta: string
  monto_total: number
  notas?: string
}) {
  try {
    const { error } = await supabase.from("pagos_comisiones").insert({
      ...data,
      notas: data.notas || "",
      fecha_pago: todayISO(),
    })
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al registrar pago" }
  }
}

/** Registra el pago de comisión a múltiples empleadas en lote */
export async function registrarPagoTodosAction(pagos: {
  empleada_nombre: string
  fecha_desde: string
  fecha_hasta: string
  monto_total: number
}[]) {
  try {
    const rows = pagos.map(p => ({ ...p, notas: "", fecha_pago: todayISO() }))
    const { error } = await supabase.from("pagos_comisiones").insert(rows)
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al registrar pagos" }
  }
}

/** Obtiene el historial completo de pagos */
export async function getHistorialPagosAction() {
  try {
    const { data, error } = await supabase
      .from("pagos_comisiones")
      .select("*")
      .order("fecha_pago", { ascending: false })
      .limit(100)
    if (error) throw error
    return { success: true, pagos: (data || []) as PagoComision[] }
  } catch (error: any) {
    return { success: false, pagos: [], error: error?.message }
  }
}

// ─────────────────────────────────────────────
// FIADOS
// ─────────────────────────────────────────────

export async function getFiadosAction() {
  try {
    const [fiadosRes, abonosRes] = await Promise.all([
      supabase.from("fiados").select("*").order("created_at", { ascending: false }),
      supabase.from("abonos_fiados").select("*").order("fecha", { ascending: true }),
    ])
    const fiados: Fiado[] = (fiadosRes.data || []).map((f: any) => ({
      ...f,
      abonos: (abonosRes.data || []).filter((a: any) => a.fiado_id === f.id),
    }))
    return { success: true, fiados }
  } catch (error: any) {
    return { success: false, fiados: [], error: error?.message }
  }
}

export async function addFiadoAction(data: {
  cliente_nombre: string
  descripcion: string
  monto_total: number
  notas?: string
}) {
  try {
    const { error } = await supabase.from("fiados").insert({
      ...data,
      notas: data.notas || "",
      fecha: todayISO(),
    })
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al registrar fiado" }
  }
}

export async function addAbonoAction(data: {
  fiado_id: string
  monto: number
  monto_total: number
  monto_pagado_actual: number
  notas?: string
}) {
  try {
    const nuevo_pagado = data.monto_pagado_actual + data.monto
    const saldado = nuevo_pagado >= data.monto_total
    // Insertar abono
    const { error: abonoErr } = await supabase.from("abonos_fiados").insert({
      fiado_id: data.fiado_id,
      monto: data.monto,
      fecha: todayISO(),
      notas: data.notas || "",
    })
    if (abonoErr) throw abonoErr
    // Actualizar fiado
    const update: any = { monto_pagado: nuevo_pagado, saldado }
    if (saldado) update.fecha_saldado = todayISO()
    const { error: fiadoErr } = await supabase.from("fiados").update(update).eq("id", data.fiado_id)
    if (fiadoErr) throw fiadoErr
    return { success: true, saldado }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al registrar abono" }
  }
}

export async function marcarSaldadoAction(fiado_id: string) {
  try {
    const { data: fiado } = await supabase.from("fiados").select("monto_total").eq("id", fiado_id).single()
    const { error } = await supabase.from("fiados").update({
      saldado: true,
      monto_pagado: fiado?.monto_total ?? 0,
      fecha_saldado: todayISO(),
    }).eq("id", fiado_id)
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al marcar como saldado" }
  }
}

/** Acumula monto adicional a un fiado existente */
/** Obtiene todas las transacciones de un cliente específico con sus participaciones */
export async function getTransaccionesClienteAction(cliente_nombre: string, fecha_desde?: string, created_at_desde?: string) {
  try {
    let query = supabase
      .from("transacciones")
      .select("*")
      .ilike("cliente", cliente_nombre)
      .order("fecha", { ascending: false })

    if (fecha_desde) query = query.gte("fecha", fecha_desde)

    const { data: txs, error: txErr } = await query
    if (txErr) throw txErr

    // Si hay timestamp exacto del fiado, filtrar solo transacciones >= ese momento
    let filtradas = txs || []
    if (created_at_desde) {
      const limite = new Date(created_at_desde).getTime()
      filtradas = filtradas.filter((t: any) => {
        const tTime = new Date(t.created_at || `${t.fecha}T${t.hora || "00:00:00"}`).getTime()
        return tTime >= limite
      })
    }

    const ids = filtradas.map((t: any) => t.id)
    let parts: Participacion[] = []
    if (ids.length > 0) {
      const { data: partData } = await supabase
        .from("participaciones_empleadas")
        .select("*")
        .in("transaccion_id", ids)
      parts = partData || []
    }

    const result = filtradas.map((t: any) => ({
      ...t,
      participaciones: parts.filter((p: any) => p.transaccion_id === t.id),
    }))
    return { success: true, transacciones: result as Transaccion[] }
  } catch (error: any) {
    return { success: false, transacciones: [], error: error?.message }
  }
}

export async function acumularFiadoAction(fiado_id: string, monto_adicional: number, descripcion_extra?: string) {
  try {
    const { data: fiado, error: getErr } = await supabase
      .from("fiados").select("monto_total, descripcion").eq("id", fiado_id).single()
    if (getErr) throw getErr
    const nuevo_total = (fiado?.monto_total ?? 0) + monto_adicional
    const nueva_descripcion = descripcion_extra
      ? `${fiado?.descripcion || ""} + ${descripcion_extra}`.trim()
      : fiado?.descripcion
    const { error } = await supabase.from("fiados").update({
      monto_total: nuevo_total,
      descripcion: nueva_descripcion,
      saldado: false,
    }).eq("id", fiado_id)
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al acumular fiado" }
  }
}

export async function deleteFiadoAction(fiado_id: string) {
  try {
    const { error } = await supabase.from("fiados").delete().eq("id", fiado_id)
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al eliminar fiado" }
  }
}
