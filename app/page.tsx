"use client"

import { useState, useEffect, useCallback } from "react"
import { format, parseISO, isToday } from "date-fns"
import { es } from "date-fns/locale"
import {
  LayoutDashboard, Plus, Receipt, BarChart3, Settings, Menu, X,
  UserPlus, DollarSign, Banknote, CreditCard, ArrowDownLeft,
  Users, Clock, Wallet, Trash2, MinusCircle, TrendingUp,
  Sparkles, Download, FileSpreadsheet, ChevronRight,
  AlertCircle, CheckCircle2, Scissors, Award, ChevronDown, ChevronUp
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
} from "@/actions"

type Section = "dashboard" | "nueva-transaccion" | "transacciones" | "gastos" | "estadisticas" | "comisiones" | "empleadas" | "configuracion"

const MENU_ITEMS = [
  { id: "dashboard",         label: "Dashboard",       icon: LayoutDashboard },
  { id: "nueva-transaccion", label: "Nueva Venta",      icon: Plus },
  { id: "transacciones",     label: "Transacciones",   icon: Receipt },
  { id: "gastos",            label: "Gastos",           icon: MinusCircle },
  { id: "estadisticas",      label: "Estadísticas",    icon: BarChart3 },
  { id: "comisiones",        label: "Comisiones",       icon: Award },
  { id: "empleadas",         label: "Empleadas",        icon: UserPlus },
  { id: "configuracion",     label: "Configuración",   icon: Settings },
] as const

const PAYMENT_COLORS = {
  efectivo:      { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  tarjeta:       { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200",     dot: "bg-sky-500"     },
  transferencia: { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200",  dot: "bg-violet-500"  },
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
  const [menuOpen,      setMenuOpen]      = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [toast,         setToast]         = useState<{ msg: string; type: "ok"|"err" }|null>(null)
  const [showObs,       setShowObs]       = useState<string|null>(null)
  const [editingInicial,setEditingInicial]= useState(false)
  const [tempInicial,   setTempInicial]   = useState(0)
  const [expandedTx,    setExpandedTx]    = useState<string|null>(null)

  // ── Formulario nueva transacción ──────────────────────
  const [newTx, setNewTx] = useState({
    cliente: "", metodo_pago: "efectivo" as Transaccion["metodo_pago"],
    monto_recibido: 0, monto_servicio: 0, cambio_entregado: 0, observaciones: "",
  })
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
  const dateFormatted = format(parseISO(selectedDate), "EEEE d 'de' MMMM, yyyy", { locale: es })
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
    if (participantes.some(p => !p.empleada_nombre)) return showToast("Selecciona todas las empleadas", "err")

    setSaving(true)
    const res = await addTransactionAction({
      ...newTx,
      monto_recibido: newTx.metodo_pago === "tarjeta" ? montoACobrar :
                      newTx.metodo_pago === "transferencia" ? newTx.monto_servicio : newTx.monto_recibido,
      cambio_entregado: cambioCalc,
      participantes,
    })
    setSaving(false)
    if (res.success) {
      showToast("Venta registrada ✓")
      setNewTx({ cliente: "", metodo_pago: "efectivo", monto_recibido: 0, monto_servicio: 0, cambio_entregado: 0, observaciones: "" })
      setNumParticipantes(1)
      setParticipantes([emptyParticipante()])
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
                        <div className={cn("text-xs rounded-full px-2 py-0.5 inline-block", c.bg, c.text)}>{t.metodo_pago}</div>
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
                <div className="grid grid-cols-3 gap-2">
                  {(["efectivo","tarjeta","transferencia"] as const).map(m => {
                    const c = PAYMENT_COLORS[m]
                    const labels = { efectivo: "💵 Efectivo", tarjeta: "💳 Tarjeta", transferencia: "📱 Transfer." }
                    return (
                      <button key={m} onClick={() => setNewTx({ ...newTx, metodo_pago: m })}
                        className={cn("rounded-xl border-2 py-3 text-sm font-medium transition-all",
                          newTx.metodo_pago === m ? `${c.border} ${c.bg} ${c.text}` : "border-gray-100 text-gray-500 hover:border-gray-200"
                        )}>
                        {labels[m]}
                      </button>
                    )
                  })}
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
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Monto Recibido (RD$)</label>
                    <input type="number" min="0" value={newTx.monto_recibido || ""}
                      onChange={e => setNewTx({ ...newTx, monto_recibido: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
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

              <button onClick={handleAddTransaction} disabled={saving}
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
                          <span className={cn("text-xs rounded-full px-2 py-0.5 flex-shrink-0", c.bg, c.text)}>{t.metodo_pago}</span>
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

      // ── ESTADÍSTICAS ──────────────────────────────────
      case "estadisticas":
        const maxClientes = Math.max(...comisiones.map(c => c.clientes), 1)
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(ventasPorMetodo).map(([m, count]) => {
                const c = PAYMENT_COLORS[m as keyof typeof PAYMENT_COLORS]
                const labels = { efectivo: "💵 Efectivo", tarjeta: "💳 Tarjeta", transferencia: "📱 Transfer." }
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
                            Desde {format(parseISO(e.fecha_registro), "dd MMM yyyy", { locale: es })}
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
          </div>
        )
    }
  }

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
          ["TOTAL GENERAL", formatCurrency(resumen.total_general)],
          ["Total Comisiones", formatCurrency(totalCom)],
        ],
        theme: "striped", styles: { fontSize: 10 },
        headStyles: { fillColor: [236,72,153] },
      })

      if (transactions.length > 0) {
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 15,
          head: [["Cliente","Hora","Método","Servicio","Recibido","Cambio","Empleada(s)"]],
          body: transactions.map(t => [
            t.cliente, formatTime(t.hora), t.metodo_pago,
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
        ["TOTAL GENERAL", resumen.total_general],
        ["Total Comisiones", totalCom],
      ]), "Resumen")

      if (transactions.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
          ["Cliente","Hora","Método","Servicio","Recibido","Cambio","Empleada(s)","Notas"],
          ...transactions.map(t => [
            t.cliente, t.hora, t.metodo_pago, t.monto_servicio, t.monto_recibido, t.cambio_entregado,
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
