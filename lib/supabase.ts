import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
if (!supabaseAnonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── TIPOS ────────────────────────────────────────────────

export type ServicioTipo =
  | 'todo'           // 15% — hizo todo sola
  | 'lavado_secado'  // 15%
  | 'lava_rolo'      // 5%  (lava y rolo)
  | 'lavado'         // 5%
  | 'secado'         // 7%
  | 'rolo'           // 5%

export const SERVICIOS: { value: ServicioTipo; label: string; porcentaje: number }[] = [
  { value: 'todo',          label: 'Todo completo',    porcentaje: 15 },
  { value: 'lavado_secado', label: 'Lavado y secado',  porcentaje: 15 },
  { value: 'lava_rolo',     label: 'Lavado y rolo',    porcentaje: 7  },
  { value: 'lavado',        label: 'Solo lavado',      porcentaje: 5  },
  { value: 'secado',        label: 'Solo secado',      porcentaje: 7  },
  { value: 'rolo',          label: 'Solo rolo',        porcentaje: 5  },
]

export function getPorcentaje(servicio: ServicioTipo): number {
  return SERVICIOS.find(s => s.value === servicio)?.porcentaje ?? 0
}

export interface ParticipanteForm {
  empleada_nombre: string
  servicio: ServicioTipo
}

export interface Participacion {
  id: string
  transaccion_id: string
  empleada_nombre: string
  servicio: ServicioTipo
  porcentaje: number
  monto_base: number
  comision: number
  fecha: string
  created_at?: string
}

export interface Transaccion {
  id: string
  fecha: string
  hora: string
  cliente: string
  metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia'
  banco_transferencia?: string | null
  monto_recibido: number
  monto_servicio: number
  cambio_entregado: number
  observaciones: string
  created_at?: string
  // join opcional
  participaciones?: Participacion[]
}

export interface GastoImprevisto {
  id: string
  fecha: string
  hora: string
  monto: number
  descripcion: string
  created_at?: string
}

export interface ResumenDiario {
  id?: string
  fecha: string
  monto_inicial: number
  total_efectivo: number
  total_transferencias: number
  total_devuelto: number
  total_gastos_imprevistos: number
  saldo_final: number
  total_general: number
  updated_at?: string
}

export interface Empleada {
  id: string
  nombre: string
  fecha_registro: string
  activa: boolean
  created_at?: string
}

// Resumen de comisiones por empleada para un día
export interface ComisionEmpleada {
  nombre: string
  clientes: number
  comision_total: number
  participaciones: Participacion[]
}

// Fiado (deuda de cliente)
export interface Fiado {
  id: string
  cliente_nombre: string
  descripcion: string
  monto_total: number
  monto_pagado: number
  fecha: string
  saldado: boolean
  fecha_saldado?: string | null
  notas: string
  created_at?: string
  // join opcional
  abonos?: AbonoFiado[]
}

// Abono a un fiado
export interface AbonoFiado {
  id: string
  fiado_id: string
  monto: number
  fecha: string
  notas: string
  created_at?: string
}

// Pago de comisión quincenal registrado
export interface PagoComision {
  id: string
  empleada_nombre: string
  fecha_desde: string
  fecha_hasta: string
  monto_total: number
  fecha_pago: string
  notas: string
  created_at?: string
}

// Comisión quincenal acumulada por empleada (sin pagar)
export interface ComisionQuincenal {
  nombre: string
  total: number
  participaciones: (Participacion & { fecha: string })[]
  ultimo_pago?: string // fecha del último pago
}
