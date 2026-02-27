import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return `RD$${amount.toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDateDisplay(isoDate: string): string {
  try {
    return format(parseISO(isoDate), "dd/MM/yyyy")
  } catch {
    return isoDate
  }
}

export function formatTime(timeStr: string): string {
  try {
    const [h, m] = timeStr.split(":")
    const hour = parseInt(h)
    const ampm = hour >= 12 ? "PM" : "AM"
    const h12 = hour % 12 || 12
    return `${h12}:${m} ${ampm}`
  } catch {
    return timeStr
  }
}

export function todayISO(): string {
  // Zona horaria RD (America/Santo_Domingo = UTC-4, sin DST)
  const now = new Date()
  const rd = new Date(now.toLocaleString("en-US", { timeZone: "America/Santo_Domingo" }))
  return format(rd, "yyyy-MM-dd")
}

export function nowTimeISO(): string {
  const now = new Date()
  const rd = new Date(now.toLocaleString("en-US", { timeZone: "America/Santo_Domingo" }))
  return format(rd, "HH:mm:ss")
}

import type { Participacion, Empleada, ComisionEmpleada } from "@/lib/supabase"

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
