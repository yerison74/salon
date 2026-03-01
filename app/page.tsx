"use client"

import { useState, useEffect, useCallback } from "react"
import { format, parseISO, isValid, isToday } from "date-fns"
import { es } from "date-fns/locale"
import {
  LayoutDashboard, Plus, Receipt, BarChart3, Settings, Menu, X,
  UserPlus, DollarSign, Banknote, CreditCard, ArrowDownLeft,
  Users, Clock, Wallet, Trash2, MinusCircle, TrendingUp,
  Sparkles, Download, FileSpreadsheet, ChevronRight,
  AlertCircle, CheckCircle2, Scissors, Award, ChevronDown, ChevronUp,
  Tag, Search, PlusCircle
} from "lucide-react"
import { cn, formatCurrency, formatTime, todayISO } from "@/lib/utils"
import { SERVICIOS, getPorcentaje } from "@/lib/supabase"
import type {
  Transaccion, GastoImprevisto, ResumenDiario, Empleada,
  Participacion, ParticipanteForm, ComisionEmpleada, ServicioTipo
} from "@/lib/supabase"
import {
  getInitialData, addTransactionAction, deleteTransactionAction,
  addEmpleadaAction, deleteEmpleadaAction, updateInitialAmountAction,
  addExpenseAction, deleteExpenseAction, getDatesWithActivity,
  getComisionesQuincenalesAction, registrarPagoComisionAction,
  registrarPagoTodosAction, getFiadosAction, addFiadoAction,
  addAbonoAction, marcarSaldadoAction, deleteFiadoAction,
} from "@/actions"
import type { PagoComision, Fiado, AbonoFiado } from "@/lib/supabase"

type Section = "dashboard" | "nueva-transaccion" | "transacciones" | "gastos" | "estadisticas" | "comisiones" | "comisiones-quincenales" | "empleadas" | "servicios" | "fiados" | "configuracion"

// ─── LISTA DE PRECIOS ────────────────────────────────────
export interface PrecioServicio {
  id: string
  nombre: string
  precio: number | null // null = precio variable
  categoria: string
}

const PRECIOS_INICIALES: PrecioServicio[] = [
  // Depilación con cera
  { id: "dep_axila",    nombre: "Axila",            precio: 250,  categoria: "Depilación con cera" },
  { id: "dep_cejas",    nombre: "Cejas",             precio: 100,  categoria: "Depilación con cera" },
  { id: "dep_bigote",   nombre: "Bigote",            precio: 100,  categoria: "Depilación con cera" },
  { id: "dep_pierna",   nombre: "Pierna",            precio: 500,  categoria: "Depilación con cera" },
  // Manos y pies
  { id: "mp_manicura",  nombre: "Manicura",          precio: 300,  categoria: "Manos y pies" },
  { id: "mp_pedicura",  nombre: "Pedicura",          precio: 400,  categoria: "Manos y pies" },
  { id: "mp_gel",       nombre: "Pintura en gel",    precio: 400,  categoria: "Manos y pies" },
  { id: "mp_normal",    nombre: "Pintura normal",    precio: 150,  categoria: "Manos y pies" },
  // Tratamientos
  { id: "tr_oleo",      nombre: "Óleo regenerador",  precio: 400,  categoria: "Tratamientos" },
  { id: "tr_botox",     nombre: "Botox",             precio: 300,  categoria: "Tratamientos" },
  { id: "tr_cirugia",   nombre: "Cirugía onz",       precio: 1500, categoria: "Tratamientos" },
  { id: "tr_keratina",  nombre: "Keratina onz",      precio: 1500, categoria: "Tratamientos" },
  { id: "tr_amp_ker",   nombre: "Ampollas keratin sho", precio: 2500, categoria: "Tratamientos" },
  { id: "tr_amp_len",   nombre: "Ampollas lendal",   precio: 1500, categoria: "Tratamientos" },
  { id: "tr_amp_ant",   nombre: "Ampollas anticaída bloo", precio: 400, categoria: "Tratamientos" },
  { id: "tr_amp_sal",   nombre: "Ampollas saler placenta vegetal", precio: 300, categoria: "Tratamientos" },
  // Procesos químicos
  { id: "pq_retoque",   nombre: "Retoques de tinte", precio: 2000, categoria: "Procesos químicos" },
  { id: "pq_cambio",    nombre: "Cambio de color",   precio: 3500, categoria: "Procesos químicos" },
  { id: "pq_mechas_f",  nombre: "Mechas frontales",  precio: 4000, categoria: "Procesos químicos" },
  { id: "pq_mechas_c",  nombre: "Mechas completas",  precio: 8000, categoria: "Procesos químicos" },
  { id: "pq_desrizado", nombre: "Desrizado",         precio: 15000,categoria: "Procesos químicos" },
  { id: "pq_celofen",   nombre: "Celofen",           precio: 700,  categoria: "Procesos químicos" },
  // Servicios
  { id: "sv_lav_rolo",  nombre: "Lavado + secado a rolo",    precio: 450,  categoria: "Servicios" },
  { id: "sv_lav_dir",   nombre: "Lavado + secado directo",   precio: 550,  categoria: "Servicios" },
  { id: "sv_lav_lin",   nombre: "Lavado con línea + secado", precio: 800,  categoria: "Servicios" },
  { id: "sv_plancha",   nombre: "Plancha",           precio: 300,  categoria: "Servicios" },
  { id: "sv_ondas",     nombre: "Ondas",             precio: 400,  categoria: "Servicios" },
  { id: "sv_corte_p",   nombre: "Corte de puntas",   precio: 800,  categoria: "Servicios" },
  { id: "sv_corte_f",   nombre: "Corte con forma",   precio: 1200, categoria: "Servicios" },
]

const MENU_ITEMS = [
  { id: "dashboard",         label: "Dashboard",       icon: LayoutDashboard },
  { id: "nueva-transaccion", label: "Nueva Venta",      icon: Plus },
  { id: "transacciones",     label: "Transacciones",   icon: Receipt },
  { id: "gastos",            label: "Gastos",           icon: MinusCircle },
  { id: "estadisticas",      label: "Estadísticas",    icon: BarChart3 },
  { id: "comisiones",             label: "Comisiones Diarias", icon: Award },
  { id: "comisiones-quincenales", label: "Quincena",           icon: TrendingUp },
  { id: "empleadas",         label: "Empleadas",        icon: UserPlus },
  { id: "servicios",         label: "Servicios",        icon: Tag },
  { id: "fiados",            label: "Fiados",           icon: Wallet },
  { id: "configuracion",     label: "Configuración",   icon: Settings },
] as const

const PAYMENT_COLORS = {
  efectivo:      { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  tarjeta:       { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200",     dot: "bg-sky-500"     },
  transferencia: { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200",  dot: "bg-violet-500"  },
  fiado:         { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500"   },
}

// ─── Formulario vacío de participante ────────────────────
const emptyParticipante = (): ParticipanteForm => ({ empleada_nombre: "", servicio: "todo" })

export default function SalonPOS() {
  const [transactions,  setTransactions]  = useState<Transaccion[]>([])
  const [expenses,      setExpenses]      = useState<GastoImprevisto[]>([])
  const [empleadas,     setEmpleadas]     = useState<Empleada[]>([])
  const [resumen,       setResumen]       = useState<ResumenDiario>({
    fecha: todayISO(), monto_inicial: 0, total_efectivo: 0,
    total_transferencias: 0, total_devuelto: 0,
    total_gastos_imprevistos: 0, saldo_final: 0, total_general: 0,
  })
  const [comisiones,    setComisiones]    = useState<ComisionEmpleada[]>([])
  const [selectedDate,  setSelectedDate]  = useState<string>(todayISO())
  const [section,       setSection]       = useState<Section>("dashboard")

  // ── Quincena ──────────────────────────────────────────
  const getDefaultQuincena = () => {
    const hoy = new Date()
    const dia = hoy.getDate()
    const y = hoy.getFullYear()
    const m = String(hoy.getMonth() + 1).padStart(2, "0")
    if (dia <= 15) {
      return { desde: `${y}-${m}-01`, hasta: `${y}-${m}-15` }
    } else {
      const ultimo = new Date(y, hoy.getMonth() + 1, 0).getDate()
      return { desde: `${y}-${m}-16`, hasta: `${y}-${m}-${ultimo}` }
    }
  }
  const defQ = getDefaultQuincena()
  const [qDesde,         setQDesde]         = useState(defQ.desde)
  const [qHasta,         setQHasta]         = useState(defQ.hasta)
  const [qComisiones,    setQComisiones]    = useState<any[]>([])
  const [qPagos,         setQPagos]         = useState<PagoComision[]>([])
  const [qLoading,       setQLoading]       = useState(false)
  const [qBusqueda,      setQBusqueda]      = useState("")
  const [qCargado,       setQCargado]       = useState(false)
  const [confirmPagoTodos, setConfirmPagoTodos] = useState(false)

  const cargarQuincena = async (desde: string, hasta: string) => {
    setQLoading(true)
    const res = await getComisionesQuincenalesAction(desde, hasta)
    if (res.success) { setQComisiones(res.comisiones); setQPagos(res.pagos); setQCargado(true) }
    else showToast("Error al cargar quincena", "err")
    setQLoading(false)
  }

  const handlePagarComision = async (nombre: string, total: number) => {
    if (!confirm(`¿Marcar como pagada la comisión de ${nombre} (${formatCurrency(total)}) para el período ${qDesde} → ${qHasta}?`)) return
    setSaving(true)
    const res = await registrarPagoComisionAction({ empleada_nombre: nombre, fecha_desde: qDesde, fecha_hasta: qHasta, monto_total: total })
    setSaving(false)
    if (res.success) { showToast(`Pago de ${nombre} registrado ✓`); cargarQuincena(qDesde, qHasta) }
    else showToast(res.error || "Error", "err")
  }

  const handlePagarTodas = async () => {
    const conSaldo = qComisiones.filter(c => c.total > 0)
    if (conSaldo.length === 0) return showToast("No hay comisiones pendientes", "err")
    setSaving(true)
    const res = await registrarPagoTodosAction(conSaldo.map(c => ({
      empleada_nombre: c.nombre, fecha_desde: qDesde, fecha_hasta: qHasta, monto_total: c.total
    })))
    setSaving(false)
    if (res.success) { showToast("Pagos de todas las empleadas registrados ✓"); setConfirmPagoTodos(false); cargarQuincena(qDesde, qHasta) }
    else showToast(res.error || "Error", "err")
  }

  // ── Fiados ────────────────────────────────────────────
  const [fiados,          setFiados]          = useState<Fiado[]>([])
  const [fiadosBusqueda,  setFiadosBusqueda]  = useState("")
  const [fiadosFiltro,    setFiadosFiltro]    = useState<"todos"|"pendientes"|"saldados">("pendientes")
  const [expandedFiado,   setExpandedFiado]   = useState<string|null>(null)
  const [nuevoFiado,      setNuevoFiado]      = useState({ cliente_nombre: "", descripcion: "", monto_total: "", notas: "" })
  const [abonoModal,      setAbonoModal]      = useState<Fiado|null>(null)
  const [abonoMonto,      setAbonoMonto]      = useState("")
  const [abonoNotas,      setAbonoNotas]      = useState("")
  const [fiadosLoaded,    setFiadosLoaded]    = useState(false)

  const cargarFiados = async () => {
    const res = await getFiadosAction()
    if (res.success) { setFiados(res.fiados); setFiadosLoaded(true) }
    else showToast("Error al cargar fiados", "err")
  }

  const handleAddFiado = async () => {
    if (!nuevoFiado.cliente_nombre.trim()) return showToast("Nombre del cliente requerido", "err")
    if (!nuevoFiado.monto_total || parseFloat(nuevoFiado.monto_total) <= 0) return showToast("Ingresa el monto del fiado", "err")
    setSaving(true)
    const res = await addFiadoAction({
      cliente_nombre: nuevoFiado.cliente_nombre.trim(),
      descripcion: nuevoFiado.descripcion.trim(),
      monto_total: parseFloat(nuevoFiado.monto_total),
      notas: nuevoFiado.notas.trim(),
    })
    setSaving(false)
    if (res.success) { showToast("Fiado registrado ✓"); setNuevoFiado({ cliente_nombre: "", descripcion: "", monto_total: "", notas: "" }); cargarFiados() }
    else showToast(res.error || "Error", "err")
  }

  const handleAddAbono = async () => {
    if (!abonoModal) return
    const monto = parseFloat(abonoMonto)
    if (!monto || monto <= 0) return showToast("Ingresa un monto válido", "err")
    const pendiente = abonoModal.monto_total - abonoModal.monto_pagado
    if (monto > pendiente) return showToast(`El abono no puede ser mayor al saldo pendiente (${formatCurrency(pendiente)})`, "err")
    setSaving(true)
    const res = await addAbonoAction({
      fiado_id: abonoModal.id,
      monto,
      monto_total: abonoModal.monto_total,
      monto_pagado_actual: abonoModal.monto_pagado,
      notas: abonoNotas.trim(),
    })
    setSaving(false)
    if (res.success) {
      showToast(res.saldado ? "¡Fiado saldado completamente! ✓" : "Abono registrado ✓")
      setAbonoModal(null); setAbonoMonto(""); setAbonoNotas("")
      cargarFiados()
    } else showToast(res.error || "Error", "err")
  }

  const handleMarcarSaldado = async (f: Fiado) => {
    if (!confirm(`¿Marcar el fiado de ${f.cliente_nombre} como completamente saldado?`)) return
    setSaving(true)
    const res = await marcarSaldadoAction(f.id)
    setSaving(false)
    if (res.success) { showToast("Fiado marcado como saldado ✓"); cargarFiados() }
    else showToast(res.error || "Error", "err")
  }

  const handleDeleteFiado = async (id: string) => {
    if (!confirm("¿Eliminar este fiado y todos sus abonos?")) return
    setSaving(true)
    const res = await deleteFiadoAction(id)
    setSaving(false)
    if (res.success) { showToast("Fiado eliminado"); cargarFiados() }
    else showToast(res.error || "Error", "err")
  }

  const exportFiadosPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf")
      const { default: autoTable } = await import("jspdf-autotable")
      const doc = new jsPDF()
      doc.setFontSize(18); doc.setFont("helvetica", "bold")
      doc.text("Reporte de Fiados", 20, 20)
      doc.setFontSize(10); doc.setFont("helvetica", "normal")
      doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 20, 30)
      const pendientes = fiados.filter(f => !f.saldado)
      const totalPendiente = pendientes.reduce((s, f) => s + (f.monto_total - f.monto_pagado), 0)
      doc.text(`Total pendiente por cobrar: RD$${totalPendiente.toLocaleString()}`, 20, 37)
      autoTable(doc, {
        startY: 48,
        head: [["Cliente", "Descripción", "Total", "Pagado", "Pendiente", "Fecha", "Estado"]],
        body: fiados.map(f => [
          f.cliente_nombre, f.descripcion,
          formatCurrency(f.monto_total), formatCurrency(f.monto_pagado),
          formatCurrency(f.monto_total - f.monto_pagado),
          f.fecha, f.saldado ? "✓ Saldado" : "Pendiente",
        ]),
        theme: "striped", styles: { fontSize: 9 },
        headStyles: { fillColor: [139, 92, 246] },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 6) {
            if (data.cell.raw === "✓ Saldado") {
              data.cell.styles.textColor = [6, 95, 70]
              data.cell.styles.fontStyle = "bold"
            } else {
              data.cell.styles.textColor = [185, 28, 28]
              data.cell.styles.fontStyle = "bold"
            }
          }
        },
      })
      // Desglose de abonos por cliente
      fiados.filter(f => (f.abonos || []).length > 0).forEach(f => {
        const y = (doc as any).lastAutoTable.finalY + 12
        if (y > 260) doc.addPage()
        doc.setFontSize(10); doc.setFont("helvetica", "bold")
        doc.text(`Abonos de ${f.cliente_nombre}`, 20, y > 260 ? 20 : y)
        autoTable(doc, {
          startY: (y > 260 ? 20 : y) + 4,
          head: [["Fecha", "Monto", "Notas"]],
          body: (f.abonos || []).map(a => [a.fecha, formatCurrency(a.monto), a.notas || "—"]),
          theme: "striped", styles: { fontSize: 8 },
          headStyles: { fillColor: [107, 114, 128] },
        })
      })
      doc.save(`fiados-${todayISO()}.pdf`)
    } catch { showToast("Error al generar PDF", "err") }
  }

  const exportFiadosExcel = async () => {
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["REPORTE DE FIADOS — SALÓN DE BELLEZA"],
        [`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`], [],
        ["Cliente", "Descripción", "Total", "Pagado", "Pendiente", "Fecha", "Estado"],
        ...fiados.map(f => [
          f.cliente_nombre, f.descripcion, f.monto_total, f.monto_pagado,
          f.monto_total - f.monto_pagado, f.fecha, f.saldado ? "Saldado" : "Pendiente",
        ]),
      ]), "Fiados")
      fiados.filter(f => (f.abonos || []).length > 0).forEach(f => {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
          [`Abonos de ${f.cliente_nombre}`], [],
          ["Fecha", "Monto", "Notas"],
          ...(f.abonos || []).map(a => [a.fecha, a.monto, a.notas || ""]),
        ]), f.cliente_nombre.substring(0, 31))
      })
      XLSX.writeFile(wb, `fiados-${todayISO()}.xlsx`)
    } catch { showToast("Error al generar Excel", "err") }
  }
  const [menuOpen,      setMenuOpen]      = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [toast,         setToast]         = useState<{ msg: string; type: "ok"|"err" }|null>(null)
  const [showObs,       setShowObs]       = useState<string|null>(null)
  const [editingInicial,setEditingInicial]= useState(false)
  const [tempInicial,   setTempInicial]   = useState(0)
  const [expandedTx,    setExpandedTx]    = useState<string|null>(null)

  // ── Lista de precios ──────────────────────────────────
  const [precios, setPrecios] = useState<PrecioServicio[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("salon_precios")
        if (stored) return JSON.parse(stored)
      } catch {}
    }
    return PRECIOS_INICIALES
  })
  const [editandoPrecio, setEditandoPrecio] = useState<string|null>(null)
  const [tempPrecio, setTempPrecio] = useState<string>("")
  const [editandoNombre, setEditandoNombre] = useState<string|null>(null)
  const [tempNombre, setTempNombre] = useState<string>("")
  const [busquedaServicio, setBusquedaServicio] = useState("")
  const [nuevoServicio, setNuevoServicio] = useState({ nombre: "", precio: "", categoria: "" })
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<PrecioServicio[]>([])
  const [busquedaNuevaVenta, setBusquedaNuevaVenta] = useState("")

  const guardarPrecios = (nuevos: PrecioServicio[]) => {
    setPrecios(nuevos)
    if (typeof window !== "undefined") {
      localStorage.setItem("salon_precios", JSON.stringify(nuevos))
    }
  }

  const categoriasPrecios = Array.from(new Set(precios.map(p => p.categoria)))

  // ── Formulario nueva transacción ──────────────────────
  const [newTx, setNewTx] = useState({
    cliente: "", metodo_pago: "efectivo" as Transaccion["metodo_pago"],
    monto_recibido: 0, monto_servicio: 0, cambio_entregado: 0, observaciones: "",
  })
  const [bancoSeleccionado, setBancoSeleccionado] = useState("")
  const [numParticipantes, setNumParticipantes] = useState(1)
  const [participantes, setParticipantes] = useState<ParticipanteForm[]>([emptyParticipante()])

  const [newExpense,  setNewExpense]  = useState({ monto: 0, descripcion: "" })
  const [newEmpleada, setNewEmpleada] = useState("")

  const showToast = (msg: string, type: "ok"|"err" = "ok") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async (date: string) => {
    setLoading(true)
    const data = await getInitialData(date)
    setTransactions(data.transactions)
    setExpenses(data.expenses)
    setEmpleadas(data.empleadas)
    setResumen(data.resumen)
    setComisiones(data.comisiones)
    setTempInicial(data.resumen.monto_inicial)
    setLoading(false)
  }, [])

  useEffect(() => { loadData(selectedDate) }, [selectedDate, loadData])

  // Cargar fiados al entrar a la sección
  useEffect(() => { if (section === "fiados" && !fiadosLoaded) cargarFiados() }, [section])

  // Cuando cambia la cantidad de participantes, ajustar el array
  useEffect(() => {
    setParticipantes(prev => {
      const next = [...prev]
      while (next.length < numParticipantes) next.push(emptyParticipante())
      return next.slice(0, numParticipantes)
    })
  }, [numParticipantes])

  // Computed
  const isHoy = selectedDate === todayISO()
  const _selDate = parseISO(selectedDate)
  const dateFormatted = isValid(_selDate) ? format(_selDate, "EEEE d 'de' MMMM, yyyy", { locale: es }) : selectedDate
  const montoACobrar = newTx.metodo_pago === "tarjeta" ? newTx.monto_servicio * 1.05 : newTx.monto_servicio
  const cambioCalc = newTx.metodo_pago === "efectivo" ? Math.max(0, newTx.monto_recibido - newTx.monto_servicio) : 0

  // Preview de comisiones en el formulario
  const comisionPreview = participantes.map(p => {
    if (!p.empleada_nombre || !newTx.monto_servicio) return null
    const base = newTx.monto_servicio / numParticipantes
    const pct = getPorcentaje(p.servicio)
    return { nombre: p.empleada_nombre, servicio: p.servicio, pct, base, comision: base * pct / 100 }
  }).filter(Boolean)

  // ─────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────
  const handleAddTransaction = async () => {
    if (!newTx.cliente.trim()) return showToast("Nombre del cliente requerido", "err")
    if (newTx.monto_servicio <= 0) return showToast("Ingresa el monto del servicio", "err")
    if (newTx.metodo_pago === "efectivo" && newTx.monto_recibido <= 0) return showToast("Ingresa el monto recibido", "err")
    if (newTx.metodo_pago === "transferencia" && !bancoSeleccionado) return showToast("Selecciona el banco de destino", "err")

    setSaving(true)
    const res = await addTransactionAction({
      ...newTx,
      banco_transferencia: newTx.metodo_pago === "transferencia" ? bancoSeleccionado : "",
      monto_recibido: newTx.metodo_pago === "tarjeta" ? montoACobrar :
                      newTx.metodo_pago === "transferencia" ? newTx.monto_servicio :
                      newTx.metodo_pago === "fiado" ? 0 : newTx.monto_recibido,
      cambio_entregado: cambioCalc,
      participantes: participantes.filter(p => p.empleada_nombre.trim() !== ""),
    })

    // Si es fiado, también registrarlo en la tabla de fiados
    if (res.success && newTx.metodo_pago === "fiado") {
      await addFiadoAction({
        cliente_nombre: newTx.cliente.trim(),
        descripcion: newTx.observaciones.trim() || (serviciosSeleccionados.map(s => s.nombre).join(", ")) || "Servicio",
        monto_total: newTx.monto_servicio,
        notas: "",
      })
    }

    setSaving(false)
    if (res.success) {
      showToast(newTx.metodo_pago === "fiado" ? "Venta registrada y fiado creado ✓" : "Venta registrada ✓")
      setNewTx({ cliente: "", metodo_pago: "efectivo", monto_recibido: 0, monto_servicio: 0, cambio_entregado: 0, observaciones: "" })
      setBancoSeleccionado("")
      setNumParticipantes(1)
      setParticipantes([emptyParticipante()])
      setServiciosSeleccionados([])
      setBusquedaNuevaVenta("")
      setFiadosLoaded(false) // forzar recarga de fiados
      loadData(todayISO())
      setSection("transacciones")
    } else showToast(res.error || "Error", "err")
  }

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm("¿Eliminar esta transacción?")) return
    const res = await deleteTransactionAction(id)
    if (res.success) { showToast("Eliminada ✓"); loadData(selectedDate) }
    else showToast(res.error || "Error", "err")
  }

  const handleAddExpense = async () => {
    if (newExpense.monto <= 0 || !newExpense.descripcion.trim())
      return showToast("Monto y descripción requeridos", "err")
    setSaving(true)
    const res = await addExpenseAction(newExpense)
    setSaving(false)
    if (res.success) { showToast("Gasto registrado ✓"); setNewExpense({ monto: 0, descripcion: "" }); loadData(todayISO()) }
    else showToast(res.error || "Error", "err")
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("¿Eliminar este gasto?")) return
    const res = await deleteExpenseAction(id)
    if (res.success) { showToast("Eliminado ✓"); loadData(selectedDate) }
    else showToast(res.error || "Error", "err")
  }

  const handleAddEmpleada = async () => {
    if (!newEmpleada.trim()) return showToast("Nombre requerido", "err")
    setSaving(true)
    const res = await addEmpleadaAction(newEmpleada)
    setSaving(false)
    if (res.success) { showToast("Empleada agregada ✓"); setNewEmpleada(""); loadData(selectedDate) }
    else showToast(res.error || "Error", "err")
  }

  const handleDeleteEmpleada = async (id: string) => {
    if (!confirm("¿Dar de baja a esta empleada?")) return
    const res = await deleteEmpleadaAction(id)
    if (res.success) { showToast("Empleada desactivada ✓"); loadData(selectedDate) }
    else showToast(res.error || "Error", "err")
  }

  const handleUpdateInicial = async () => {
    const res = await updateInitialAmountAction(tempInicial)
    if (res.success) { showToast("Monto inicial actualizado ✓"); setEditingInicial(false); loadData(selectedDate) }
    else showToast(res.error || "Error", "err")
  }

  // Stats
  const ventasPorMetodo = {
    efectivo:      transactions.filter(t => t.metodo_pago === "efectivo").length,
    tarjeta:       transactions.filter(t => t.metodo_pago === "tarjeta").length,
    transferencia: transactions.filter(t => t.metodo_pago === "transferencia").length,
    fiado:         transactions.filter(t => t.metodo_pago === "fiado").length,
  }

  // ─────────────────────────────────────────────────────
  // RENDER SECTIONS
  // ─────────────────────────────────────────────────────
  const renderContent = () => {
    switch (section) {

      // ── DASHBOARD ─────────────────────────────────────
      case "dashboard":
        const totalComisiones = comisiones.reduce((s, c) => s + c.comision_total, 0)
        return (
          <div className="space-y-6">
            {/* Hero */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-400 via-pink-500 to-fuchsia-600 p-8 text-white shadow-2xl">
              <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
              <div className="absolute -bottom-12 -right-4 h-56 w-56 rounded-full bg-white/5" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="h-5 w-5 text-pink-100" />
                  <span className="text-pink-100 text-sm font-medium uppercase tracking-widest">Total en Caja</span>
                </div>
                <div className="text-5xl font-black tracking-tight mt-2">{formatCurrency(resumen.saldo_final)}</div>
                <p className="text-pink-100 text-sm mt-3">Inicial + Efectivo − Cambios − Gastos</p>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    { label: "Total General", val: formatCurrency(resumen.total_general) },
                    { label: "Ventas", val: transactions.length },
                    { label: "Gastos", val: formatCurrency(resumen.total_gastos_imprevistos) },
                    { label: "Comisiones", val: formatCurrency(totalComisiones) },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-xl bg-white/20 backdrop-blur px-3 py-2 text-center">
                      <div className="text-xs text-pink-100">{label}</div>
                      <div className="font-bold text-sm">{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Monto Inicial",     value: formatCurrency(resumen.monto_inicial),        icon: DollarSign,    color: "violet" },
                { label: "Efectivo",           value: formatCurrency(resumen.total_efectivo),        icon: Banknote,      color: "emerald" },
                { label: "Transferencias",     value: formatCurrency(resumen.total_transferencias),  icon: CreditCard,    color: "sky" },
                { label: "Cambios",            value: formatCurrency(resumen.total_devuelto),        icon: ArrowDownLeft, color: "amber" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={cn("rounded-2xl border p-5",
                  color==="violet" && "border-violet-100 bg-violet-50",
                  color==="emerald" && "border-emerald-100 bg-emerald-50",
                  color==="sky" && "border-sky-100 bg-sky-50",
                  color==="amber" && "border-amber-100 bg-amber-50",
                )}>
                  <Icon className={cn("h-5 w-5 mb-3",
                    color==="violet" && "text-violet-500",
                    color==="emerald" && "text-emerald-500",
                    color==="sky" && "text-sky-500",
                    color==="amber" && "text-amber-500",
                  )} />
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
                  <div className="text-xl font-bold text-gray-800 mt-1">{value}</div>
                </div>
              ))}
            </div>

            {/* Ganancia Neta del Día */}
            {(() => {
              const gananciaNeta = resumen.total_general - totalComisiones
              return (
                <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-5 w-5 text-emerald-500" />
                        <span className="text-sm font-bold text-emerald-700 uppercase tracking-wide">Ganancia Neta del Día</span>
                      </div>
                      <div className="text-4xl font-black text-emerald-700 mt-1">{formatCurrency(gananciaNeta)}</div>
                      <p className="text-xs text-emerald-500 mt-2">Total ventas − Comisiones</p>
                    </div>
                    <div className="text-right space-y-2">
                      <div className="rounded-xl bg-white/70 px-4 py-2 text-right">
                        <div className="text-xs text-gray-400">Ventas brutas</div>
                        <div className="font-bold text-gray-700">{formatCurrency(resumen.total_general)}</div>
                      </div>
                      <div className="rounded-xl bg-white/70 px-4 py-2 text-right">
                        <div className="text-xs text-rose-400">− Comisiones</div>
                        <div className="font-bold text-rose-500">−{formatCurrency(totalComisiones)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Comisiones del día — resumen rápido */}
            {comisiones.filter(c => c.comision_total > 0).length > 0 && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-rose-100">
                  <h3 className="font-semibold text-rose-800 flex items-center gap-2">
                    <Award className="h-4 w-4" /> Comisiones del día
                  </h3>
                  <button onClick={() => setSection("comisiones")} className="text-sm text-rose-500 hover:text-rose-700 font-medium flex items-center gap-1">
                    Ver detalle <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="divide-y divide-rose-100">
                  {comisiones.filter(c => c.comision_total > 0).map(c => (
                    <div key={c.nombre} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-rose-300 to-pink-400 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{c.nombre.charAt(0)}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-800 text-sm">{c.nombre}</span>
                          <span className="text-xs text-gray-400 ml-2">{c.clientes} cliente{c.clientes !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                      <span className="font-bold text-rose-600">{formatCurrency(c.comision_total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Últimas ventas */}
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                <h3 className="font-semibold text-gray-800">Últimas ventas</h3>
                <button onClick={() => setSection("transacciones")} className="text-sm text-pink-500 hover:text-pink-600 font-medium flex items-center gap-1">
                  Ver todas <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {transactions.slice(-5).reverse().map(t => {
                  const c = PAYMENT_COLORS[t.metodo_pago]
                  const nombres = t.participaciones?.map(p => p.empleada_nombre).join(", ") || "—"
                  return (
                    <div key={t.id} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-2 w-2 rounded-full", c.dot)} />
                        <div>
                          <div className="font-medium text-gray-800 text-sm">{t.cliente}</div>
                          <div className="text-xs text-gray-400">{nombres} · {formatTime(t.hora)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-800 text-sm">{formatCurrency(t.monto_servicio)}</div>
                        <div className={cn("text-xs rounded-full px-2 py-0.5 inline-block", c.bg, c.text)}>
                          {t.metodo_pago}{t.banco_transferencia ? ` · ${t.banco_transferencia}` : ""}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {transactions.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Scissors className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No hay ventas para {isHoy ? "hoy" : "este día"}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Exportar */}
            <div className="grid grid-cols-2 gap-4">
              <button onClick={exportPDF} className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-all">
                <Download className="h-4 w-4 text-pink-500" /> Exportar PDF
              </button>
              <button onClick={exportExcel} className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-all">
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Exportar Excel
              </button>
            </div>
          </div>
        )

      // ── NUEVA VENTA ────────────────────────────────────
      case "nueva-transaccion":
        return (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-5">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-pink-400" /> Nueva Venta
              </h3>

              {/* Método de pago */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Método de Pago</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["efectivo","tarjeta","transferencia","fiado"] as const).map(m => {
                    const c = PAYMENT_COLORS[m]
                    const labels = { efectivo: "💵 Efectivo", tarjeta: "💳 Tarjeta", transferencia: "📱 Transfer.", fiado: "📋 Fiado" }
                    return (
                      <button key={m} onClick={() => { setNewTx({ ...newTx, metodo_pago: m }); setBancoSeleccionado("") }}
                        className={cn("rounded-xl border-2 py-3 text-sm font-medium transition-all",
                          newTx.metodo_pago === m ? `${c.border} ${c.bg} ${c.text}` : "border-gray-100 text-gray-500 hover:border-gray-200"
                        )}>
                        {labels[m]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── SELECTOR MÚLTIPLE DE SERVICIOS ──────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicios</label>
                  {serviciosSeleccionados.length > 0 && (
                    <button onClick={() => { setServiciosSeleccionados([]); setNewTx(prev => ({ ...prev, monto_servicio: 0 })) }}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors">
                      Limpiar todo
                    </button>
                  )}
                </div>

                {/* Chips de servicios seleccionados */}
                {serviciosSeleccionados.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-pink-50 border border-pink-100">
                    {serviciosSeleccionados.map(s => (
                      <div key={s.id} className="flex items-center gap-1.5 rounded-full bg-white border border-pink-200 text-pink-700 text-xs font-medium px-3 py-1.5 shadow-sm">
                        <span>{s.nombre}</span>
                        {s.precio !== null && <span className="text-pink-400">RD${s.precio.toLocaleString()}</span>}
                        <button onClick={() => {
                          const next = serviciosSeleccionados.filter(x => x.id !== s.id)
                          setServiciosSeleccionados(next)
                          setNewTx(prev => ({ ...prev, monto_servicio: next.reduce((sum, x) => sum + (x.precio ?? 0), 0) }))
                        }} className="ml-0.5 text-pink-300 hover:text-red-400 transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <div className="ml-auto flex items-center gap-1 text-sm font-bold text-pink-700 pl-2 border-l border-pink-200">
                      Total: {formatCurrency(serviciosSeleccionados.reduce((s, x) => s + (x.precio ?? 0), 0))}
                    </div>
                  </div>
                )}

                {/* Búsqueda */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    value={busquedaNuevaVenta}
                    onChange={e => setBusquedaNuevaVenta(e.target.value)}
                    placeholder="Buscar servicio…"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
                  {busquedaNuevaVenta && (
                    <button onClick={() => setBusquedaNuevaVenta("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Lista de servicios agrupada */}
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden max-h-64 overflow-y-auto">
                  {categoriasPrecios
                    .map(cat => {
                      const items = precios.filter(p =>
                        p.categoria === cat &&
                        (busquedaNuevaVenta === "" ||
                          p.nombre.toLowerCase().includes(busquedaNuevaVenta.toLowerCase()) ||
                          cat.toLowerCase().includes(busquedaNuevaVenta.toLowerCase()))
                      )
                      if (items.length === 0) return null
                      return (
                        <div key={cat}>
                          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{cat}</span>
                          </div>
                          {items.map(p => {
                            const sel = serviciosSeleccionados.some(x => x.id === p.id)
                            return (
                              <button key={p.id}
                                onClick={() => {
                                  const next = sel
                                    ? serviciosSeleccionados.filter(x => x.id !== p.id)
                                    : [...serviciosSeleccionados, p]
                                  setServiciosSeleccionados(next)
                                  const autoTotal = next.reduce((sum, x) => sum + (x.precio ?? 0), 0)
                                  if (autoTotal > 0) setNewTx(prev => ({ ...prev, monto_servicio: autoTotal }))
                                }}
                                className={cn(
                                  "w-full flex items-center justify-between px-4 py-2.5 text-sm transition-all border-b border-gray-50 last:border-0",
                                  sel ? "bg-pink-50 text-pink-700" : "hover:bg-gray-50 text-gray-700"
                                )}>
                                <div className="flex items-center gap-2">
                                  <div className={cn("h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                                    sel ? "border-pink-500 bg-pink-500" : "border-gray-300"
                                  )}>
                                    {sel && <span className="text-white text-xs leading-none">✓</span>}
                                  </div>
                                  <span className={cn("font-medium", sel && "font-semibold")}>{p.nombre}</span>
                                </div>
                                <span className={cn("font-bold", sel ? "text-pink-600" : "text-gray-500")}>
                                  {p.precio !== null ? `RD$${p.precio.toLocaleString()}` : "Variable"}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )
                    })}
                  {precios.filter(p =>
                    busquedaNuevaVenta === "" ||
                    p.nombre.toLowerCase().includes(busquedaNuevaVenta.toLowerCase()) ||
                    p.categoria.toLowerCase().includes(busquedaNuevaVenta.toLowerCase())
                  ).length === 0 && (
                    <div className="text-center py-6 text-gray-400 text-sm">No se encontraron servicios</div>
                  )}
                </div>
              </div>

              {/* Cliente y montos */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cliente *</label>
                  <input value={newTx.cliente} onChange={e => setNewTx({ ...newTx, cliente: e.target.value })}
                    placeholder="Nombre del cliente"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Monto Servicio (RD$)</label>
                  <input type="number" min="0" value={newTx.monto_servicio || ""}
                    onChange={e => setNewTx({ ...newTx, monto_servicio: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                </div>
              </div>

              {newTx.metodo_pago === "efectivo" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Monto Recibido (RD$) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number" min="0"
                      value={newTx.monto_recibido || ""}
                      onChange={e => setNewTx({ ...newTx, monto_recibido: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className={cn(
                        "w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2",
                        newTx.monto_recibido > 0
                          ? "border-gray-200 focus:ring-pink-300"
                          : "border-rose-300 bg-rose-50 focus:ring-rose-300"
                      )} />
                    {newTx.monto_recibido <= 0 && (
                      <p className="text-xs text-rose-500 mt-1">Requerido</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cambio a devolver</label>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700">
                      {formatCurrency(cambioCalc)}
                    </div>
                  </div>
                </div>
              )}

              {newTx.metodo_pago === "tarjeta" && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-sky-700">Total a cobrar (+5% tarjeta)</span>
                  <span className="font-bold text-sky-700">{formatCurrency(montoACobrar)}</span>
                </div>
              )}

              {newTx.metodo_pago === "fiado" && (
                <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-4 space-y-1">
                  <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                    <Wallet className="h-4 w-4" /> Esta venta se registrará como fiado
                  </div>
                  <p className="text-xs text-amber-600">
                    Se creará automáticamente una deuda de <strong>{formatCurrency(newTx.monto_servicio || 0)}</strong> a nombre de <strong>{newTx.cliente || "el cliente"}</strong>. Podrás registrar abonos desde la sección Fiados.
                  </p>
                </div>
              )}

              {newTx.metodo_pago === "transferencia" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Banco de destino <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {["Banco Popular", "Asociación Popular", "Banco de Reservas", "Banco BHD"].map(banco => {
                      const sel = bancoSeleccionado === banco
                      return (
                        <label key={banco} className={cn(
                          "flex items-center gap-3 rounded-xl border-2 py-3 px-4 cursor-pointer transition-all select-none",
                          sel ? "border-violet-500 bg-violet-50" : "border-gray-200 bg-white hover:border-violet-300"
                        )}>
                          <input
                            type="radio"
                            name="banco_transferencia"
                            value={banco}
                            checked={sel}
                            onChange={() => setBancoSeleccionado(banco)}
                            className="accent-violet-500 h-4 w-4 flex-shrink-0"
                          />
                          <span className={cn("text-sm font-medium", sel ? "text-violet-700" : "text-gray-600")}>
                            {banco}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  {!bancoSeleccionado && (
                    <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Selecciona el banco de destino
                    </p>
                  )}
                </div>
              )}

              {/* ── SECCIÓN EMPLEADAS ─────────────────────── */}
              <div className="border border-gray-100 rounded-2xl p-4 space-y-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">¿Cuántas empleadas atendieron?</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setNumParticipantes(Math.max(1, numParticipantes - 1))}
                      className="h-8 w-8 rounded-lg border border-gray-200 bg-white text-gray-600 font-bold hover:border-pink-300 hover:text-pink-500 transition-all flex items-center justify-center">−</button>
                    <span className="w-8 text-center font-bold text-gray-800">{numParticipantes}</span>
                    <button onClick={() => setNumParticipantes(Math.min(empleadas.length || 6, numParticipantes + 1))}
                      className="h-8 w-8 rounded-lg border border-gray-200 bg-white text-gray-600 font-bold hover:border-pink-300 hover:text-pink-500 transition-all flex items-center justify-center">+</button>
                  </div>
                </div>

                {/* Fila por cada participante */}
                {participantes.map((p, i) => (
                  <div key={i} className="rounded-xl border border-white bg-white shadow-sm p-3 space-y-2">
                    <div className="text-xs font-semibold text-pink-400 uppercase tracking-wide">Empleada #{i + 1}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Nombre</label>
                        {empleadas.length > 0 ? (
                          <select value={p.empleada_nombre}
                            onChange={e => {
                              const next = [...participantes]
                              next[i] = { ...next[i], empleada_nombre: e.target.value }
                              setParticipantes(next)
                            }}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-300">
                            <option value="">Seleccionar…</option>
                            {empleadas.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                          </select>
                        ) : (
                          <input value={p.empleada_nombre}
                            onChange={e => {
                              const next = [...participantes]
                              next[i] = { ...next[i], empleada_nombre: e.target.value }
                              setParticipantes(next)
                            }}
                            placeholder="Nombre"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">¿Qué hizo? (% comisión)</label>
                        <select value={p.servicio}
                          onChange={e => {
                            const next = [...participantes]
                            next[i] = { ...next[i], servicio: e.target.value as ServicioTipo }
                            setParticipantes(next)
                          }}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-300">
                          {SERVICIOS.map(s => (
                            <option key={s.value} value={s.value}>{s.label} ({s.porcentaje}%)</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* Preview comisión para esta empleada */}
                    {p.empleada_nombre && newTx.monto_servicio > 0 && (
                      <div className="flex items-center justify-between rounded-lg bg-rose-50 px-3 py-1.5">
                        <span className="text-xs text-rose-600">
                          Base: {formatCurrency(newTx.monto_servicio / numParticipantes)} × {getPorcentaje(p.servicio)}%
                        </span>
                        <span className="text-xs font-bold text-rose-700">
                          Comisión: {formatCurrency((newTx.monto_servicio / numParticipantes) * getPorcentaje(p.servicio) / 100)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observaciones</label>
                <textarea value={newTx.observaciones}
                  onChange={e => setNewTx({ ...newTx, observaciones: e.target.value })}
                  placeholder="Servicio realizado, notas adicionales..."
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none" />
              </div>

              {newTx.metodo_pago === "transferencia" && !bancoSeleccionado && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center gap-2 text-rose-600 text-sm font-medium">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  Debes seleccionar el banco de destino antes de registrar la venta
                </div>
              )}

              {newTx.metodo_pago === "efectivo" && newTx.monto_recibido <= 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center gap-2 text-rose-600 text-sm font-medium">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  Debes ingresar el monto recibido antes de registrar la venta
                </div>
              )}

              <button
                onClick={handleAddTransaction}
                disabled={
                  saving ||
                  (newTx.metodo_pago === "transferencia" && !bancoSeleccionado) ||
                  (newTx.metodo_pago === "efectivo" && newTx.monto_recibido <= 0)
                }
                className="w-full rounded-xl bg-gradient-to-r from-rose-400 to-pink-500 text-white py-3 font-semibold text-sm shadow-lg hover:shadow-xl hover:from-rose-500 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {saving ? "Registrando..." : "Registrar Venta"}
              </button>
            </div>
          </div>
        )

      // ── TRANSACCIONES ──────────────────────────────────
      case "transacciones":
        return (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Transacciones · {transactions.length}</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {transactions.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <Receipt className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>Sin transacciones para este día</p>
                </div>
              )}
              {transactions.map(t => {
                const c = PAYMENT_COLORS[t.metodo_pago]
                const isExpanded = expandedTx === t.id
                const nombres = t.participaciones?.map(p => p.empleada_nombre).join(", ") || "—"
                return (
                  <div key={t.id}>
                    {/* Fila principal */}
                    <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                      <div className={cn("h-2 w-2 rounded-full flex-shrink-0", c.dot)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 text-sm truncate">{t.cliente}</span>
                          <span className={cn("text-xs rounded-full px-2 py-0.5 flex-shrink-0", c.bg, c.text)}>
                            {t.metodo_pago}{t.banco_transferencia ? ` · ${t.banco_transferencia}` : ""}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 truncate">{nombres} · {formatTime(t.hora)}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-gray-800">{formatCurrency(t.monto_servicio)}</div>
                        {t.cambio_entregado > 0 && <div className="text-xs text-amber-500">Cambio: {formatCurrency(t.cambio_entregado)}</div>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setExpandedTx(isExpanded ? null : t.id)}
                          className="p-1 text-gray-300 hover:text-pink-400 transition-colors">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        {isHoy && (
                          <button onClick={() => handleDeleteTransaction(t.id)}
                            className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Detalle expandible con comisiones */}
                    {isExpanded && (
                      <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100">
                        <div className="pt-3 space-y-2">
                          {t.observaciones && (
                            <p className="text-xs text-gray-500 italic">"{t.observaciones}"</p>
                          )}
                          {t.banco_transferencia && (
                            <div className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-100 px-3 py-2">
                              <span className="text-xs font-semibold text-violet-500 uppercase tracking-wide">Banco:</span>
                              <span className="text-sm font-medium text-violet-700">{t.banco_transferencia}</span>
                            </div>
                          )}
                          {(t.participaciones || []).length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Comisiones</div>
                              <div className="space-y-1">
                                {t.participaciones!.map(p => (
                                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-white border border-rose-100 px-3 py-2">
                                    <div>
                                      <span className="font-medium text-sm text-gray-800">{p.empleada_nombre}</span>
                                      <span className="text-xs text-gray-400 ml-2">
                                        {SERVICIOS.find(s => s.value === p.servicio)?.label} · {p.porcentaje}%
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-xs text-gray-400">base {formatCurrency(p.monto_base)}</div>
                                      <div className="font-bold text-rose-600">{formatCurrency(p.comision)}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {/* Modal observación */}
            {showObs && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowObs(null)}>
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
                  <h4 className="font-semibold text-gray-800 mb-3">Observación</h4>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap">{showObs}</p>
                  <button onClick={() => setShowObs(null)} className="mt-4 w-full rounded-xl bg-gray-100 text-gray-700 py-2 text-sm font-medium hover:bg-gray-200">Cerrar</button>
                </div>
              </div>
            )}
          </div>
        )

      // ── GASTOS ─────────────────────────────────────────
      case "gastos":
        return (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <MinusCircle className="h-5 w-5 text-orange-400" /> Registrar Gasto
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Monto (RD$)</label>
                  <input type="number" min="0" value={newExpense.monto || ""}
                    onChange={e => setNewExpense({ ...newExpense, monto: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Descripción</label>
                  <input value={newExpense.descripcion}
                    onChange={e => setNewExpense({ ...newExpense, descripcion: e.target.value })}
                    placeholder="¿En qué se gastó?"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                </div>
              </div>
              <button onClick={handleAddExpense} disabled={saving}
                className="w-full rounded-xl bg-gradient-to-r from-orange-400 to-amber-400 text-white py-3 font-semibold text-sm shadow hover:shadow-lg disabled:opacity-50 transition-all">
                {saving ? "Registrando..." : "Registrar Gasto"}
              </button>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h3 className="font-semibold text-gray-800">Historial · {expenses.length}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {expenses.map(e => (
                  <div key={e.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <div className="font-medium text-gray-800 text-sm">{e.descripcion}</div>
                      <div className="text-xs text-gray-400">{formatTime(e.hora)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-orange-500">{formatCurrency(e.monto)}</span>
                      {isHoy && <button onClick={() => handleDeleteExpense(e.id)} className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </div>
                ))}
                {expenses.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <MinusCircle className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Sin gastos registrados</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      // ── COMISIONES ─────────────────────────────────────
      case "comisiones":
        const totalComDia = comisiones.reduce((s, c) => s + c.comision_total, 0)
        return (
          <div className="space-y-6">
            {/* Header total */}
            <div className="rounded-2xl bg-gradient-to-br from-rose-400 to-pink-600 p-6 text-white shadow-xl">
              <div className="flex items-center gap-2 mb-1">
                <Award className="h-5 w-5 text-pink-100" />
                <span className="text-pink-100 text-sm font-medium uppercase tracking-widest">Total Comisiones del Día</span>
              </div>
              <div className="text-4xl font-black">{formatCurrency(totalComDia)}</div>
              <p className="text-pink-100 text-sm mt-1">{transactions.length} ventas · {comisiones.filter(c => c.comision_total > 0).length} empleadas con comisión</p>
            </div>

            {/* Tarjetas por empleada */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {comisiones.map(c => (
                <div key={c.nombre} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between p-5 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-rose-300 to-pink-400 flex items-center justify-center">
                        <span className="text-white font-bold">{c.nombre.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">{c.nombre}</div>
                        <div className="text-xs text-gray-400">{c.clientes} participación{c.clientes !== 1 ? "es" : ""}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-rose-500">{formatCurrency(c.comision_total)}</div>
                      <div className="text-xs text-gray-400">comisión total</div>
                    </div>
                  </div>
                  {/* Desglose por transacción */}
                  {c.participaciones.length > 0 && (
                    <div className="divide-y divide-gray-50">
                      {c.participaciones.map(p => (
                        <div key={p.id} className="flex items-center justify-between px-5 py-2.5">
                          <div>
                            <div className="text-sm text-gray-700">
                              {SERVICIOS.find(s => s.value === p.servicio)?.label}
                            </div>
                            <div className="text-xs text-gray-400">
                              Base {formatCurrency(p.monto_base)} × {p.porcentaje}%
                            </div>
                          </div>
                          <div className="font-semibold text-rose-600">{formatCurrency(p.comision)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {c.participaciones.length === 0 && (
                    <div className="px-5 py-3 text-sm text-gray-400">Sin participaciones este día</div>
                  )}
                </div>
              ))}
            </div>

            {comisiones.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <Award className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>Sin comisiones registradas para este día</p>
              </div>
            )}
          </div>
        )

      // ── COMISIONES QUINCENALES ─────────────────────────
      case "comisiones-quincenales": {
        const qFiltradas = qBusqueda.trim()
          ? qComisiones.filter(c => c.nombre.toLowerCase().includes(qBusqueda.toLowerCase()))
          : qComisiones
        const totalQuincena = qFiltradas.reduce((s: number, c: any) => s + c.total, 0)

        const exportQPDF = async () => {
          try {
            const { jsPDF } = await import("jspdf")
            const { default: autoTable } = await import("jspdf-autotable")
            const doc = new jsPDF()
            doc.setFontSize(18); doc.setFont("helvetica", "bold")
            doc.text("Reporte de Comisiones Quincenales", 20, 20)
            doc.setFontSize(10); doc.setFont("helvetica", "normal")
            doc.text(`Período: ${qDesde} → ${qHasta}`, 20, 30)
            doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 20, 37)

            autoTable(doc, {
              startY: 48,
              head: [["Empleada", "Participaciones", "Total Comisión", "Último Pago"]],
              body: qFiltradas.map((c: any) => [
                c.nombre,
                c.participaciones.length,
                formatCurrency(c.total),
                c.ultimo_pago || "Sin pagos",
              ]),
              theme: "striped", styles: { fontSize: 10 },
              headStyles: { fillColor: [244, 63, 94] },
              foot: [["TOTAL", "", formatCurrency(totalQuincena), ""]],
              footStyles: { fontStyle: "bold", fillColor: [254, 242, 242], textColor: [159, 18, 57] },
            })

            qFiltradas.forEach((c: any, idx: number) => {
              if (c.participaciones.length === 0) return
              const y = (doc as any).lastAutoTable.finalY + (idx === 0 ? 15 : 10)
              if (y > 250) doc.addPage()
              doc.setFontSize(11); doc.setFont("helvetica", "bold")
              doc.text(`Desglose: ${c.nombre}`, 20, y > 250 ? 20 : y)
              autoTable(doc, {
                startY: (y > 250 ? 20 : y) + 5,
                head: [["Fecha", "Cliente", "Servicio", "Base", "%", "Comisión"]],
                body: c.participaciones.map((p: any) => [
                  p.fecha,
                  p.cliente || "—",
                  SERVICIOS.find((s: any) => s.value === p.servicio)?.label || p.servicio,
                  formatCurrency(p.monto_base),
                  `${p.porcentaje}%`,
                  formatCurrency(p.comision),
                ]),
                theme: "striped", styles: { fontSize: 8 },
                headStyles: { fillColor: [107, 114, 128] },
              })
            })

            doc.save(`comisiones-quincena-${qDesde}-${qHasta}.pdf`)
          } catch { showToast("Error al generar PDF", "err") }
        }

        const exportQExcel = async () => {
          try {
            const XLSX = await import("xlsx")
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
              ["COMISIONES QUINCENALES — SALÓN DE BELLEZA"],
              [`Período: ${qDesde} → ${qHasta}`], [],
              ["Empleada", "Participaciones", "Total Comisión", "Último Pago"],
              ...qFiltradas.map((c: any) => [c.nombre, c.participaciones.length, c.total, c.ultimo_pago || "Sin pagos"]),
              [], ["TOTAL", "", totalQuincena, ""],
            ]), "Resumen")

            qFiltradas.forEach((c: any) => {
              if (c.participaciones.length === 0) return
              XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
                [`Comisiones de ${c.nombre} — ${qDesde} al ${qHasta}`], [],
                ["Fecha", "Cliente", "Servicio", "Base", "% Comisión", "Comisión"],
                ...c.participaciones.map((p: any) => [
                  p.fecha,
                  p.cliente || "—",
                  SERVICIOS.find((s: any) => s.value === p.servicio)?.label || p.servicio,
                  p.monto_base, p.porcentaje, p.comision,
                ]),
                [], ["TOTAL", "", "", "", "", c.total],
              ]), c.nombre.substring(0, 31))
            })

            XLSX.writeFile(wb, `comisiones-quincena-${qDesde}-${qHasta}.xlsx`)
          } catch { showToast("Error al generar Excel", "err") }
        }

        return (
          <div className="max-w-4xl mx-auto space-y-5">
            {/* Selector de período */}
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-rose-400" /> Comisiones por Período
              </h3>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Desde</label>
                  <input type="date" value={qDesde} onChange={e => setQDesde(e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Hasta</label>
                  <input type="date" value={qHasta} onChange={e => setQHasta(e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                </div>
                <button onClick={() => cargarQuincena(qDesde, qHasta)} disabled={qLoading}
                  className="rounded-xl bg-gradient-to-r from-rose-400 to-pink-500 text-white px-5 py-2 text-sm font-semibold shadow hover:shadow-md disabled:opacity-50 transition-all">
                  {qLoading ? "Cargando…" : "Consultar"}
                </button>
                {/* Accesos rápidos */}
                {[
                  { label: "1–15 este mes", ...(() => { const h = new Date(); const m = String(h.getMonth()+1).padStart(2,"0"); return { d: `${h.getFullYear()}-${m}-01`, h2: `${h.getFullYear()}-${m}-15` } })() },
                  { label: "16–fin este mes", ...(() => { const h = new Date(); const m = String(h.getMonth()+1).padStart(2,"0"); const ult = new Date(h.getFullYear(), h.getMonth()+1, 0).getDate(); return { d: `${h.getFullYear()}-${m}-16`, h2: `${h.getFullYear()}-${m}-${ult}` } })() },
                ].map(({ label, d, h2 }) => (
                  <button key={label} onClick={() => { setQDesde(d); setQHasta(h2); cargarQuincena(d, h2) }}
                    className="rounded-xl border border-pink-200 text-pink-600 bg-pink-50 px-4 py-2 text-xs font-medium hover:bg-pink-100 transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {qCargado && (
              <>
                {/* Hero total + búsqueda + acciones */}
                <div className="rounded-2xl bg-gradient-to-br from-rose-400 to-pink-600 p-6 text-white shadow-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-pink-100 text-xs font-medium uppercase tracking-widest mb-1">Total quincena {qDesde} → {qHasta}</div>
                      <div className="text-4xl font-black">{formatCurrency(totalQuincena)}</div>
                      <p className="text-pink-100 text-sm mt-1">{qFiltradas.filter((c: any) => c.total > 0).length} empleadas con comisión pendiente</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={exportQPDF}
                        className="flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 text-white px-4 py-2 text-xs font-medium transition-all">
                        <Download className="h-3.5 w-3.5" /> PDF
                      </button>
                      <button onClick={exportQExcel}
                        className="flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 text-white px-4 py-2 text-xs font-medium transition-all">
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                      </button>
                    </div>
                  </div>
                </div>

                {/* Barra de búsqueda + pagar todas */}
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input value={qBusqueda} onChange={e => setQBusqueda(e.target.value)}
                      placeholder="Buscar empleada…"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
                    {qBusqueda && (
                      <button onClick={() => setQBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {!confirmPagoTodos ? (
                    <button onClick={() => setConfirmPagoTodos(true)} disabled={saving || totalQuincena === 0}
                      className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 text-sm font-semibold disabled:opacity-40 transition-all flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Pagar a todas
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={handlePagarTodas} disabled={saving}
                        className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-all">
                        {saving ? "Guardando…" : "✓ Confirmar"}
                      </button>
                      <button onClick={() => setConfirmPagoTodos(false)}
                        className="rounded-xl border border-gray-200 text-gray-600 px-4 py-2 text-sm hover:bg-gray-50 transition-all">
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {/* Tarjetas por empleada */}
                <div className="space-y-4">
                  {qFiltradas.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No se encontró "{qBusqueda}"</p>
                    </div>
                  ) : qFiltradas.map((c: any) => (
                    <div key={c.nombre} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                      {/* Header empleada */}
                      <div className={cn("flex items-center justify-between p-5 border-b",
                        c.total > 0 ? "border-rose-100 bg-rose-50" : "border-gray-50 bg-gray-50"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-rose-300 to-pink-400 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-sm">{c.nombre.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-800">{c.nombre}</div>
                            <div className="text-xs text-gray-400">
                              {c.participaciones.length} participación{c.participaciones.length !== 1 ? "es" : ""} en el período
                              {c.ultimo_pago && <span className="ml-2 text-emerald-500">· Último pago: {c.ultimo_pago}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className={cn("text-2xl font-black", c.total > 0 ? "text-rose-500" : "text-gray-300")}>
                              {formatCurrency(c.total)}
                            </div>
                            <div className="text-xs text-gray-400">comisión acumulada</div>
                          </div>
                          {c.total > 0 && (
                            <button onClick={() => handlePagarComision(c.nombre, c.total)} disabled={saving}
                              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-all flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4" /> Pagado
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Desglose por día */}
                      {c.participaciones.length > 0 && (() => {
                        const porFecha: Record<string, any[]> = {}
                        c.participaciones.forEach((p: any) => {
                          if (!porFecha[p.fecha]) porFecha[p.fecha] = []
                          porFecha[p.fecha].push(p)
                        })
                        return (
                          <div className="divide-y divide-gray-50">
                            {Object.entries(porFecha).map(([fecha, parts]) => {
                              const subtotal = (parts as any[]).reduce((s: number, p: any) => s + p.comision, 0)
                              return (
                                <div key={fecha} className="px-5 py-3">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                      {isValid(parseISO(fecha)) ? format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es }) : fecha}
                                    </span>
                                    <span className="text-xs font-semibold text-rose-500">{formatCurrency(subtotal)}</span>
                                  </div>
                                  {(parts as any[]).map((p: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between text-sm py-1 pl-3 border-l-2 border-rose-100">
                                      <div>
                                        <span className="text-gray-600">{SERVICIOS.find((s: any) => s.value === p.servicio)?.label || p.servicio}</span>
                                        {p.cliente && p.cliente !== "—" && (
                                          <span className="ml-2 text-xs text-gray-400 font-medium">· {p.cliente}</span>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <span className="text-xs text-gray-400 mr-2">base {formatCurrency(p.monto_base)} × {p.porcentaje}%</span>
                                        <span className="font-semibold text-rose-600">{formatCurrency(p.comision)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                      {c.participaciones.length === 0 && (
                        <div className="px-5 py-4 text-sm text-gray-400">Sin participaciones en este período</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Historial de pagos del período */}
                {qPagos.filter(p => p.fecha_desde >= qDesde && p.fecha_hasta <= qHasta).length > 0 && (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 overflow-hidden">
                    <div className="px-6 py-4 border-b border-emerald-100">
                      <h3 className="font-semibold text-emerald-800 flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4" /> Pagos registrados en este período
                      </h3>
                    </div>
                    <div className="divide-y divide-emerald-100">
                      {qPagos.filter(p => p.fecha_desde >= qDesde && p.fecha_hasta <= qHasta).map(p => (
                        <div key={p.id} className="flex items-center justify-between px-6 py-3">
                          <div>
                            <div className="font-medium text-gray-800 text-sm">{p.empleada_nombre}</div>
                            <div className="text-xs text-gray-400">Pagado el {p.fecha_pago}</div>
                          </div>
                          <span className="font-bold text-emerald-600">{formatCurrency(p.monto_total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!qCargado && (
              <div className="text-center py-16 text-gray-400">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium">Selecciona un período y presiona Consultar</p>
                <p className="text-xs mt-1">Puedes usar los accesos rápidos de arriba</p>
              </div>
            )}
          </div>
        )
      }

      // ── ESTADÍSTICAS ──────────────────────────────────
      case "estadisticas":
        const maxClientes = Math.max(...comisiones.map(c => c.clientes), 1)
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(ventasPorMetodo).map(([m, count]) => {
                const c = PAYMENT_COLORS[m as keyof typeof PAYMENT_COLORS]
                const labels = { efectivo: "💵 Efectivo", tarjeta: "💳 Tarjeta", transferencia: "📱 Transfer.", fiado: "📋 Fiado" }
                const pct = transactions.length > 0 ? Math.round(count / transactions.length * 100) : 0
                return (
                  <div key={m} className={cn("rounded-2xl border p-5", c.border, c.bg)}>
                    <div className={cn("font-bold", c.text)}>{labels[m as keyof typeof labels]}</div>
                    <div className={cn("text-3xl font-black mt-1", c.text)}>{count}</div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/60">
                      <div className={cn("h-full rounded-full", c.dot)} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={cn("text-xs mt-1", c.text)}>{pct}% del total</div>
                  </div>
                )
              })}
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-pink-400" /> Clientes por Empleada
              </h3>
              <div className="space-y-3">
                {comisiones.filter(c => c.clientes > 0).map(c => (
                  <div key={c.nombre} className="flex items-center gap-3">
                    <div className="w-28 text-sm font-medium text-gray-700 truncate">{c.nombre}</div>
                    <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-500 transition-all"
                        style={{ width: `${(c.clientes / maxClientes) * 100}%` }} />
                    </div>
                    <div className="w-16 text-right">
                      <span className="text-sm font-bold text-gray-800">{c.clientes}</span>
                      <span className="text-xs text-gray-400 ml-1">cliente{c.clientes !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                ))}
                {comisiones.every(c => c.clientes === 0) && <p className="text-gray-400 text-sm text-center py-4">Sin datos</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-violet-400" /> Actividad Reciente
              </h3>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {[...transactions].reverse().map(t => {
                  const c = PAYMENT_COLORS[t.metodo_pago]
                  const nombres = t.participaciones?.map(p => p.empleada_nombre).join(", ") || "—"
                  return (
                    <div key={t.id} className="flex items-center justify-between rounded-xl px-4 py-2 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div className={cn("h-2 w-2 rounded-full", c.dot)} />
                        <span className="text-sm font-medium text-gray-700">{t.cliente}</span>
                        <span className="text-xs text-gray-400">· {nombres}</span>
                      </div>
                      <div className="text-sm font-bold text-gray-800">{formatCurrency(t.monto_servicio)}</div>
                    </div>
                  )
                })}
                {transactions.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Sin actividad</p>}
              </div>
            </div>
          </div>
        )

      // ── EMPLEADAS ─────────────────────────────────────
      case "empleadas":
        return (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
                <UserPlus className="h-5 w-5 text-pink-400" /> Agregar Empleada
              </h3>
              <div className="flex gap-3">
                <input value={newEmpleada} onChange={e => setNewEmpleada(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddEmpleada()}
                  placeholder="Nombre completo"
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                <button onClick={handleAddEmpleada} disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-rose-400 to-pink-500 text-white px-5 py-2.5 text-sm font-medium disabled:opacity-50">
                  {saving ? "..." : "Agregar"}
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h3 className="font-semibold text-gray-800">Equipo · {empleadas.length}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {empleadas.map(e => {
                  const stats = comisiones.find(c => c.nombre === e.nombre)
                  return (
                    <div key={e.id} className="flex items-center justify-between px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-rose-200 to-pink-300 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">{e.nombre.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{e.nombre}</div>
                          <div className="text-xs text-gray-400">
                            Desde {isValid(parseISO(e.fecha_registro || "")) ? format(parseISO(e.fecha_registro), "dd MMM yyyy", { locale: es }) : e.fecha_registro}
                            {stats && stats.clientes > 0 && ` · ${stats.clientes} clientes hoy · ${formatCurrency(stats.comision_total)} comisión`}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteEmpleada(e.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
                {empleadas.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No hay empleadas registradas</p>
                  </div>
                )}
              </div>
            </div>
            {/* Tabla de porcentajes */}
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h3 className="font-semibold text-gray-800">Tabla de Comisiones</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {SERVICIOS.map(s => (
                  <div key={s.value} className="flex items-center justify-between px-6 py-3">
                    <span className="text-sm text-gray-700">{s.label}</span>
                    <span className={cn("text-sm font-bold rounded-full px-3 py-1",
                      s.porcentaje >= 15 ? "bg-rose-100 text-rose-700" :
                      s.porcentaje >= 7  ? "bg-amber-100 text-amber-700" :
                                           "bg-emerald-100 text-emerald-700"
                    )}>{s.porcentaje}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      // ── FIADOS ────────────────────────────────────────
      case "fiados": {
        const fiadosFiltrados = fiados
          .filter(f => {
            const matchBusqueda = fiadosBusqueda.trim() === "" ||
              f.cliente_nombre.toLowerCase().includes(fiadosBusqueda.toLowerCase()) ||
              f.descripcion.toLowerCase().includes(fiadosBusqueda.toLowerCase())
            const matchFiltro =
              fiadosFiltro === "todos" ? true :
              fiadosFiltro === "pendientes" ? !f.saldado :
              f.saldado
            return matchBusqueda && matchFiltro
          })
        const totalPendiente = fiados.filter(f => !f.saldado).reduce((s, f) => s + (f.monto_total - f.monto_pagado), 0)
        const totalFiado = fiados.filter(f => !f.saldado).reduce((s, f) => s + f.monto_total, 0)
        const clientesPendientes = fiados.filter(f => !f.saldado).length

        return (
          <div className="max-w-3xl mx-auto space-y-5">

            {/* ── KPIs ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-violet-400 to-purple-600 p-4 text-white shadow-lg">
                <div className="text-violet-100 text-xs font-medium uppercase tracking-widest mb-1">Por cobrar</div>
                <div className="text-2xl font-black">{formatCurrency(totalPendiente)}</div>
                <div className="text-violet-200 text-xs mt-1">{clientesPendientes} cliente{clientesPendientes !== 1 ? "s" : ""}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="text-gray-400 text-xs font-medium uppercase tracking-widest mb-1">Total fiado</div>
                <div className="text-2xl font-black text-gray-700">{formatCurrency(totalFiado)}</div>
                <div className="text-gray-400 text-xs mt-1">monto original</div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
                <div className="text-emerald-500 text-xs font-medium uppercase tracking-widest mb-1">Saldados</div>
                <div className="text-2xl font-black text-emerald-600">{fiados.filter(f => f.saldado).length}</div>
                <div className="text-emerald-400 text-xs mt-1">completados</div>
              </div>
            </div>

            {/* ── Nuevo fiado ── */}
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Wallet className="h-5 w-5 text-violet-400" /> Registrar Nuevo Fiado
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cliente *</label>
                  <input value={nuevoFiado.cliente_nombre}
                    onChange={e => setNuevoFiado({ ...nuevoFiado, cliente_nombre: e.target.value })}
                    placeholder="Nombre del cliente"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Monto (RD$) *</label>
                  <input type="number" min="0" value={nuevoFiado.monto_total}
                    onChange={e => setNuevoFiado({ ...nuevoFiado, monto_total: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Descripción del servicio</label>
                <input value={nuevoFiado.descripcion}
                  onChange={e => setNuevoFiado({ ...nuevoFiado, descripcion: e.target.value })}
                  placeholder="¿Qué servicio se realizó?"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notas</label>
                <input value={nuevoFiado.notas}
                  onChange={e => setNuevoFiado({ ...nuevoFiado, notas: e.target.value })}
                  placeholder="Observaciones adicionales…"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>
              <button onClick={handleAddFiado} disabled={saving}
                className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white py-3 font-semibold text-sm shadow hover:shadow-lg disabled:opacity-50 transition-all">
                {saving ? "Registrando…" : "Registrar Fiado"}
              </button>
            </div>

            {/* ── Filtros + búsqueda + exportar ── */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input value={fiadosBusqueda} onChange={e => setFiadosBusqueda(e.target.value)}
                  placeholder="Buscar cliente…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                {fiadosBusqueda && (
                  <button onClick={() => setFiadosBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {(["pendientes","todos","saldados"] as const).map(f => (
                <button key={f} onClick={() => setFiadosFiltro(f)}
                  className={cn("rounded-xl px-4 py-2.5 text-sm font-medium transition-all capitalize",
                    fiadosFiltro === f
                      ? "bg-violet-500 text-white shadow"
                      : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300"
                  )}>
                  {f === "pendientes" ? "Pendientes" : f === "saldados" ? "Saldados" : "Todos"}
                </button>
              ))}
              <button onClick={exportFiadosPDF}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-all">
                <Download className="h-4 w-4 text-violet-400" /> PDF
              </button>
              <button onClick={exportFiadosExcel}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-all">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Excel
              </button>
            </div>

            {/* ── Lista de fiados ── */}
            <div className="space-y-3">
              {fiadosFiltrados.length === 0 && (
                <div className="text-center py-14 text-gray-400">
                  <Wallet className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">{fiadosBusqueda ? `No se encontró "${fiadosBusqueda}"` : "No hay fiados en esta categoría"}</p>
                </div>
              )}
              {fiadosFiltrados.map(f => {
                const pendiente = f.monto_total - f.monto_pagado
                const pct = Math.min(100, Math.round((f.monto_pagado / f.monto_total) * 100))
                const isExp = expandedFiado === f.id
                return (
                  <div key={f.id} className={cn("rounded-2xl border bg-white shadow-sm overflow-hidden",
                    f.saldado ? "border-emerald-100" : "border-gray-100"
                  )}>
                    {/* Header */}
                    <div className="flex items-center gap-3 p-4">
                      <div className={cn("h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm",
                        f.saldado ? "bg-emerald-100 text-emerald-600" : "bg-violet-100 text-violet-600"
                      )}>
                        {f.cliente_nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800">{f.cliente_nombre}</span>
                          {f.saldado
                            ? <span className="text-xs rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-600 font-medium">✓ Saldado</span>
                            : <span className="text-xs rounded-full px-2 py-0.5 bg-rose-100 text-rose-600 font-medium">Pendiente</span>
                          }
                        </div>
                        {f.descripcion && <div className="text-xs text-gray-400 truncate">{f.descripcion}</div>}
                        <div className="text-xs text-gray-400">{f.fecha}</div>
                        {/* Barra de progreso */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                            <div className={cn("h-full rounded-full transition-all", f.saldado ? "bg-emerald-400" : "bg-violet-400")}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">{pct}%</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <div className="text-xs text-gray-400">Total</div>
                        <div className="font-bold text-gray-800">{formatCurrency(f.monto_total)}</div>
                        {!f.saldado && (
                          <div className="text-xs font-semibold text-rose-500">
                            Debe: {formatCurrency(pendiente)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0 ml-2">
                        {!f.saldado && (
                          <>
                            <button onClick={() => { setAbonoModal(f); setAbonoMonto(""); setAbonoNotas("") }}
                              className="rounded-lg bg-violet-500 hover:bg-violet-600 text-white px-3 py-1.5 text-xs font-semibold transition-all">
                              + Abono
                            </button>
                            <button onClick={() => handleMarcarSaldado(f)} disabled={saving}
                              className="rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50">
                              Saldado
                            </button>
                          </>
                        )}
                        <button onClick={() => setExpandedFiado(isExp ? null : f.id)}
                          className="rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 px-3 py-1.5 text-xs transition-all flex items-center gap-1 justify-center">
                          {isExp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          Historial
                        </button>
                        <button onClick={() => handleDeleteFiado(f.id)}
                          className="rounded-lg text-gray-200 hover:text-red-400 transition-all flex items-center justify-center py-1">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Historial de abonos expandible */}
                    {isExp && (
                      <div className="border-t border-gray-50 bg-gray-50 px-4 py-3 space-y-2">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                          Historial de abonos · {(f.abonos || []).length}
                        </div>
                        {(f.abonos || []).length === 0 ? (
                          <p className="text-sm text-gray-400">Sin abonos registrados</p>
                        ) : (
                          <div className="space-y-1.5">
                            {(f.abonos || []).map((a, i) => (
                              <div key={a.id} className="flex items-center justify-between rounded-xl bg-white border border-gray-100 px-3 py-2">
                                <div>
                                  <span className="text-xs text-gray-400 mr-2">Abono #{i + 1}</span>
                                  <span className="text-xs text-gray-500">{a.fecha}</span>
                                  {a.notas && <span className="text-xs text-gray-400 ml-2 italic">· {a.notas}</span>}
                                </div>
                                <span className="font-semibold text-violet-600 text-sm">{formatCurrency(a.monto)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {f.saldado && f.fecha_saldado && (
                          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-600 font-medium flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" /> Saldado completamente el {f.fecha_saldado}
                          </div>
                        )}
                        {f.notas && (
                          <p className="text-xs text-gray-400 italic">Nota: {f.notas}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Modal abono ── */}
            {abonoModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                onClick={() => setAbonoModal(null)}>
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4"
                  onClick={e => e.stopPropagation()}>
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg">Registrar Abono</h4>
                    <p className="text-sm text-gray-500">{abonoModal.cliente_nombre}</p>
                  </div>
                  <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 flex justify-between text-sm">
                    <span className="text-violet-600">Saldo pendiente</span>
                    <span className="font-bold text-violet-700">{formatCurrency(abonoModal.monto_total - abonoModal.monto_pagado)}</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Monto del abono (RD$) *</label>
                    <input type="number" min="0" value={abonoMonto}
                      onChange={e => setAbonoMonto(e.target.value)}
                      placeholder="0.00" autoFocus
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notas</label>
                    <input value={abonoNotas} onChange={e => setAbonoNotas(e.target.value)}
                      placeholder="Observación (opcional)"
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setAbonoModal(null)}
                      className="flex-1 rounded-xl border border-gray-200 text-gray-600 py-2.5 text-sm font-medium hover:bg-gray-50 transition-all">
                      Cancelar
                    </button>
                    <button onClick={handleAddAbono} disabled={saving}
                      className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white py-2.5 text-sm font-semibold shadow disabled:opacity-50 transition-all">
                      {saving ? "Guardando…" : "Registrar Abono"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      }

      // ── CONFIGURACIÓN ─────────────────────────────────
      case "configuracion":
        return (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-6">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-400" /> Configuración
              </h3>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Monto Inicial en Caja (RD$)</label>
                <p className="text-xs text-gray-400 mb-3">El dinero con el que abres la caja cada día</p>
                {editingInicial ? (
                  <div className="flex gap-3">
                    <input type="number" value={tempInicial}
                      onChange={e => setTempInicial(parseFloat(e.target.value) || 0)}
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                    <button onClick={handleUpdateInicial} className="rounded-xl bg-pink-500 text-white px-4 py-2 text-sm font-medium">Guardar</button>
                    <button onClick={() => { setEditingInicial(false); setTempInicial(resumen.monto_inicial) }}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600">Cancelar</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-black text-gray-800">{formatCurrency(resumen.monto_inicial)}</div>
                    <button onClick={() => setEditingInicial(true)}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:border-pink-200 hover:text-pink-500 transition-colors">
                      Editar
                    </button>
                  </div>
                )}
              </div>
              <hr className="border-gray-100" />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Info del Sistema</label>
                <div className="space-y-2 text-sm text-gray-500">
                  <p>• Base de datos: <span className="text-green-600 font-medium">Supabase (PostgreSQL) ✓</span></p>
                  <p>• Zona horaria: América/Santo Domingo (RD)</p>
                  <p>• Tarjeta incluye 5% de recargo automático</p>
                  <p>• Comisiones: base = monto / nº empleadas × %</p>
                  <p>• Máximo de comisión: 15% (todo completo / lavado+secado)</p>
                </div>
              </div>
            </div>

            {/* ── MENÚ DE PRECIOS eliminado — ahora en sección Servicios ── */}
          </div>
        )

      // ── SERVICIOS ──────────────────────────────────────
      case "servicios": {
        const preciosFiltrados = busquedaServicio.trim()
          ? precios.filter(p =>
              p.nombre.toLowerCase().includes(busquedaServicio.toLowerCase()) ||
              p.categoria.toLowerCase().includes(busquedaServicio.toLowerCase())
            )
          : precios
        const categoriasFiltradas = Array.from(new Set(preciosFiltrados.map(p => p.categoria)))

        return (
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Header con buscador y botón agregar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={busquedaServicio}
                  onChange={e => setBusquedaServicio(e.target.value)}
                  placeholder="Buscar por nombre o categoría…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
                {busquedaServicio && (
                  <button onClick={() => setBusquedaServicio("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Formulario nuevo servicio */}
            <div className="rounded-2xl border border-pink-100 bg-gradient-to-br from-rose-50 to-pink-50 p-5 space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
                <PlusCircle className="h-4 w-4 text-pink-500" /> Agregar nuevo servicio
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nombre *</label>
                  <input
                    value={nuevoServicio.nombre}
                    onChange={e => setNuevoServicio({ ...nuevoServicio, nombre: e.target.value })}
                    placeholder="Ej: Tinte completo"
                    className="w-full rounded-xl border border-white bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Categoría *</label>
                  <div className="relative">
                    <input
                      value={nuevoServicio.categoria}
                      onChange={e => setNuevoServicio({ ...nuevoServicio, categoria: e.target.value })}
                      placeholder="Ej: Tratamientos"
                      list="categorias-list"
                      className="w-full rounded-xl border border-white bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                    <datalist id="categorias-list">
                      {categoriasPrecios.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Precio (RD$)</label>
                  <input
                    type="number"
                    min="0"
                    value={nuevoServicio.precio}
                    onChange={e => setNuevoServicio({ ...nuevoServicio, precio: e.target.value })}
                    placeholder="0 = variable"
                    className="w-full rounded-xl border border-white bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                </div>
              </div>
              <button
                onClick={() => {
                  if (!nuevoServicio.nombre.trim() || !nuevoServicio.categoria.trim())
                    return showToast("Nombre y categoría son requeridos", "err")
                  const nuevo: PrecioServicio = {
                    id: `custom_${Date.now()}`,
                    nombre: nuevoServicio.nombre.trim(),
                    precio: nuevoServicio.precio ? parseFloat(nuevoServicio.precio) : null,
                    categoria: nuevoServicio.categoria.trim(),
                  }
                  guardarPrecios([...precios, nuevo])
                  setNuevoServicio({ nombre: "", precio: "", categoria: "" })
                  showToast("Servicio agregado ✓")
                }}
                className="rounded-xl bg-gradient-to-r from-rose-400 to-pink-500 text-white px-5 py-2 text-sm font-semibold shadow hover:shadow-md transition-all">
                Agregar Servicio
              </button>
            </div>

            {/* Lista de servicios */}
            {preciosFiltrados.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No se encontraron servicios para "{busquedaServicio}"</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-3 border-b border-gray-50 flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium">
                    {preciosFiltrados.length} servicio{preciosFiltrados.length !== 1 ? "s" : ""}
                    {busquedaServicio ? ` encontrado${preciosFiltrados.length !== 1 ? "s" : ""}` : " en total"}
                  </span>
                  <button
                    onClick={() => guardarPrecios(PRECIOS_INICIALES)}
                    className="text-xs text-gray-400 hover:text-red-400 transition-colors">
                    Restablecer originales
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {categoriasFiltradas.map(cat => (
                    <div key={cat}>
                      <div className="px-6 py-2 bg-gradient-to-r from-rose-50 to-pink-50 flex items-center gap-2">
                        <Tag className="h-3 w-3 text-pink-400" />
                        <span className="text-xs font-bold text-pink-600 uppercase tracking-wider">{cat}</span>
                        <span className="text-xs text-pink-400">({preciosFiltrados.filter(p => p.categoria === cat).length})</span>
                      </div>
                      {preciosFiltrados.filter(p => p.categoria === cat).map(p => (
                        <div key={p.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors group">
                          {/* Nombre editable */}
                          <div className="flex-1 mr-4">
                            {editandoNombre === p.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  value={tempNombre}
                                  onChange={e => setTempNombre(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") { guardarPrecios(precios.map(x => x.id === p.id ? { ...x, nombre: tempNombre } : x)); setEditandoNombre(null) }
                                    if (e.key === "Escape") setEditandoNombre(null)
                                  }}
                                  autoFocus
                                  className="flex-1 rounded-lg border border-pink-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                                <button onClick={() => { guardarPrecios(precios.map(x => x.id === p.id ? { ...x, nombre: tempNombre } : x)); setEditandoNombre(null) }} className="text-xs text-pink-500 font-medium">✓</button>
                                <button onClick={() => setEditandoNombre(null)} className="text-xs text-gray-400">✕</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditandoNombre(p.id); setTempNombre(p.nombre) }}
                                className="text-sm text-gray-700 hover:text-pink-600 transition-colors text-left w-full">
                                {p.nombre}
                                <span className="ml-2 text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">editar</span>
                              </button>
                            )}
                          </div>
                          {/* Precio editable + eliminar */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {editandoPrecio === p.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">RD$</span>
                                <input
                                  type="number" min="0"
                                  value={tempPrecio}
                                  onChange={e => setTempPrecio(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") { guardarPrecios(precios.map(x => x.id === p.id ? { ...x, precio: parseFloat(tempPrecio) || null } : x)); setEditandoPrecio(null) }
                                    if (e.key === "Escape") setEditandoPrecio(null)
                                  }}
                                  autoFocus
                                  className="w-24 rounded-lg border border-pink-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-pink-300" />
                                <button onClick={() => { guardarPrecios(precios.map(x => x.id === p.id ? { ...x, precio: parseFloat(tempPrecio) || null } : x)); setEditandoPrecio(null) }} className="text-xs text-pink-500 font-medium">✓</button>
                                <button onClick={() => setEditandoPrecio(null)} className="text-xs text-gray-400">✕</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditandoPrecio(p.id); setTempPrecio(p.precio?.toString() ?? "") }}
                                className="font-bold text-sm text-gray-800 hover:text-pink-600 transition-colors rounded-lg bg-gray-50 hover:bg-pink-50 px-3 py-1 border border-transparent hover:border-pink-200">
                                {p.precio !== null ? `RD$${p.precio.toLocaleString()}` : "Variable"}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (confirm(`¿Eliminar "${p.nombre}"?`))
                                  guardarPrecios(precios.filter(x => x.id !== p.id))
                              }}
                              className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      }

    } // end switch
  } // end renderContent

  // ─── EXPORTS ──────────────────────────────────────────────
  const exportPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf")
      const { default: autoTable } = await import("jspdf-autotable")
      const doc = new jsPDF()
      const totalCom = comisiones.reduce((s, c) => s + c.comision_total, 0)

      doc.setFontSize(20); doc.setFont("helvetica","bold")
      doc.text("Reporte Diario — Salón de Belleza", 20, 25)
      doc.setFontSize(11); doc.setFont("helvetica","normal")
      doc.text(`Fecha: ${dateFormatted}`, 20, 35)
      doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 20, 42)

      autoTable(doc, {
        startY: 55,
        head: [["Concepto","Monto"]],
        body: [
          ["Monto Inicial", formatCurrency(resumen.monto_inicial)],
          ["Total Efectivo", formatCurrency(resumen.total_efectivo)],
          ["Total Transferencias/Tarjeta", formatCurrency(resumen.total_transferencias)],
          ["Total Cambios", formatCurrency(resumen.total_devuelto)],
          ["Gastos Imprevistos", formatCurrency(resumen.total_gastos_imprevistos)],
          ["Total en Caja", formatCurrency(resumen.saldo_final)],
          ["TOTAL GENERAL (Ventas)", formatCurrency(resumen.total_general)],
          ["Total Comisiones", formatCurrency(totalCom)],
          ["GANANCIA NETA DEL DÍA", formatCurrency(resumen.total_general - totalCom)],
        ],
        theme: "striped", styles: { fontSize: 10 },
        headStyles: { fillColor: [236,72,153] },
        bodyStyles: { },
        didParseCell: (data: any) => {
          if (data.row.index === 8) {
            data.cell.styles.fontStyle = "bold"
            data.cell.styles.fillColor = [209, 250, 229]
            data.cell.styles.textColor = [6, 95, 70]
          }
        },
      })

      if (transactions.length > 0) {
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 15,
          head: [["Cliente","Hora","Método","Banco","Servicio","Recibido","Cambio","Empleada(s)"]],
          body: transactions.map(t => [
            t.cliente, formatTime(t.hora), t.metodo_pago,
            t.banco_transferencia || "—",
            formatCurrency(t.monto_servicio), formatCurrency(t.monto_recibido),
            formatCurrency(t.cambio_entregado),
            (t.participaciones||[]).map(p => p.empleada_nombre).join(", ")
          ]),
          theme: "striped", styles: { fontSize: 8 },
          headStyles: { fillColor: [107,114,128] },
        })
      }

      // Hoja de comisiones
      if (comisiones.filter(c => c.comision_total > 0).length > 0) {
        const y = (doc as any).lastAutoTable.finalY + 15
        if (y > 240) doc.addPage()
        autoTable(doc, {
          startY: y > 240 ? 20 : y,
          head: [["Empleada","Servicio","Base","% Comisión","Comisión"]],
          body: comisiones.flatMap(c => c.participaciones.map(p => [
            p.empleada_nombre,
            SERVICIOS.find(s => s.value === p.servicio)?.label || p.servicio,
            formatCurrency(p.monto_base),
            `${p.porcentaje}%`,
            formatCurrency(p.comision),
          ])),
          theme: "striped", styles: { fontSize: 8 },
          headStyles: { fillColor: [244,63,94] },
        })
      }

      doc.save(`salon-reporte-${selectedDate}.pdf`)
    } catch (e) { showToast("Error al generar PDF", "err") }
  }

  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.utils.book_new()
      const totalCom = comisiones.reduce((s, c) => s + c.comision_total, 0)

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["REPORTE SALÓN DE BELLEZA"],
        [`Fecha: ${dateFormatted}`], [],
        ["Concepto","Monto"],
        ["Monto Inicial", resumen.monto_inicial],
        ["Total Efectivo", resumen.total_efectivo],
        ["Total Transferencias", resumen.total_transferencias],
        ["Cambios", resumen.total_devuelto],
        ["Gastos Imprevistos", resumen.total_gastos_imprevistos],
        ["Total Caja", resumen.saldo_final],
        ["TOTAL GENERAL (Ventas)", resumen.total_general],
        ["Total Comisiones", totalCom],
        ["GANANCIA NETA DEL DÍA", resumen.total_general - totalCom],
      ]), "Resumen")

      if (transactions.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
          ["Cliente","Hora","Método","Banco","Servicio","Recibido","Cambio","Empleada(s)","Notas"],
          ...transactions.map(t => [
            t.cliente, t.hora, t.metodo_pago,
            t.banco_transferencia || "—",
            t.monto_servicio, t.monto_recibido, t.cambio_entregado,
            (t.participaciones||[]).map(p => p.empleada_nombre).join(", "), t.observaciones
          ])
        ]), "Transacciones")
      }

      if (comisiones.some(c => c.participaciones.length > 0)) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
          ["Empleada","Servicio","% Comisión","Monto Base","Comisión"],
          ...comisiones.flatMap(c => c.participaciones.map(p => [
            p.empleada_nombre,
            SERVICIOS.find(s => s.value === p.servicio)?.label || p.servicio,
            p.porcentaje, p.monto_base, p.comision
          ]))
        ]), "Comisiones")
      }

      XLSX.writeFile(wb, `salon-reporte-${selectedDate}.xlsx`)
    } catch (e) { showToast("Error al generar Excel", "err") }
  }

  // ─── LOADING ──────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-pink-50">
      <div className="text-center">
        <div className="h-12 w-12 rounded-full border-4 border-pink-200 border-t-pink-500 animate-spin mx-auto mb-4" />
        <p className="text-pink-400 font-medium">Cargando datos...</p>
      </div>
    </div>
  )

  // ─── LAYOUT ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium shadow-xl animate-in slide-in-from-top-2",
          toast.type === "ok" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
        )}>
          {toast.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-white border-r border-gray-100 shadow-lg transform transition-transform duration-200",
        menuOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0 lg:static lg:inset-0"
      )}>
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-50">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
            <Scissors className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="font-black text-gray-900 text-sm leading-none">Salón Control</h1>
            <p className="text-xs text-gray-400 mt-0.5">POS · {isHoy ? "Hoy" : "Histórico"}</p>
          </div>
          <button className="ml-auto lg:hidden text-gray-400" onClick={() => setMenuOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-3">
          {MENU_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setSection(id as Section); setMenuOpen(false) }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                section === id ? "bg-gradient-to-r from-rose-50 to-pink-50 text-pink-600 shadow-sm" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}>
              <Icon className={cn("h-4 w-4", section === id ? "text-pink-500" : "text-gray-400")} />
              {label}
              {id === "nueva-transaccion" && (
                <span className="ml-auto h-5 w-5 rounded-full bg-pink-100 text-pink-600 text-xs flex items-center justify-center font-bold">+</span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-50">
          <div className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</span>
              {!isHoy && <button onClick={() => setSelectedDate(todayISO())} className="text-xs text-pink-500 font-medium hover:text-pink-600">Hoy</button>}
            </div>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="w-full text-sm text-gray-700 font-medium bg-transparent focus:outline-none" />
          </div>
        </div>
      </aside>

      {menuOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-gray-500 p-1" onClick={() => setMenuOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">{MENU_ITEMS.find(m => m.id === section)?.label}</h2>
              <p className="text-xs text-gray-400 capitalize">{dateFormatted}</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-400">En Caja</div>
              <div className="text-sm font-bold text-gray-800">{formatCurrency(resumen.saldo_final)}</div>
            </div>
            <div className="h-8 w-px bg-gray-100" />
            <div className="text-right">
              <div className="text-xs text-gray-400">Comisiones</div>
              <div className="text-sm font-bold text-rose-500">{formatCurrency(comisiones.reduce((s,c) => s + c.comision_total, 0))}</div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="max-w-5xl mx-auto">{renderContent()}</div>
        </div>
      </main>
    </div>
  )
}
