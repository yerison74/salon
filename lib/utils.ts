import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, isValid } from "date-fns"
import { es } from "date-fns/locale"
import type { Participacion, Empleada, ComisionEmpleada } from "@/lib/supabase"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  const n = amount ?? 0
  return `RD$${n.toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDateDisplay(isoDate: string | null | undefined): string {
  if (!isoDate) return "—"
  try {
    const d = parseISO(isoDate)
    if (!isValid(d)) return isoDate
    return format(d, "dd/MM/yyyy")
  } catch {
    return isoDate
  }
}

export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "—"
  try {
    const parts = timeStr.split(":")
    if (parts.length < 2) return timeStr
    const hour = parseInt(parts[0])
    const min = parts[1]
    if (isNaN(hour)) return timeStr
    const ampm = hour >= 12 ? "PM" : "AM"
    const h12 = hour % 12 || 12
    return `${h12}:${min} ${ampm}`
  } catch {
    return timeStr
  }
}

export function formatDateLabel(isoDate: string | null | undefined): string {
  if (!isoDate) return "—"
  try {
    const d = parseISO(isoDate)
    if (!isValid(d)) return isoDate
    return format(d, "dd MMM yyyy", { locale: es })
  } catch {
    return isoDate
  }
}

export function todayISO(): string {
  const now = new Date()
  const rd = new Date(now.toLocaleString("en-US", { timeZone: "America/Santo_Domingo" }))
  return format(rd, "yyyy-MM-dd")
}

export function nowTimeISO(): string {
  const now = new Date()
  const rd = new Date(now.toLocaleString("en-US", { timeZone: "America/Santo_Domingo" }))
  return format(rd, "HH:mm:ss")
}

export function calcularComisionesPorEmpleada(
  participaciones: Participacion[],
  empleadas: Empleada[]
): ComisionEmpleada[] {
  const map: Record<string, ComisionEmpleada> = {}

  empleadas.forEach(e => {
    map[e.nombre] = { nombre: e.nombre, clientes: 0, comision_total: 0, participaciones: [] }
  })

  participaciones.forEach(p => {
    if (!map[p.empleada_nombre]) {
      map[p.empleada_nombre] = { nombre: p.empleada_nombre, clientes: 0, comision_total: 0, participaciones: [] }
    }
    map[p.empleada_nombre].clientes += 1
    map[p.empleada_nombre].comision_total += p.comision
    map[p.empleada_nombre].participaciones.push(p)
  })

  return Object.values(map).sort((a, b) => b.comision_total - a.comision_total)
}
