import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatCurrencyCompact(value: number): string {
  if (value >= 1000) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value)
  }
  return formatCurrency(value)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("fr-FR").format(d)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

// Convert Excel serial date to JS Date
export function excelSerialToDate(serial: number): Date {
  const excelEpoch = new Date(1900, 0, 1)
  const days = serial - 2 // Excel has a leap year bug for 1900
  const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000)
  return date
}

export function excelSerialToISOString(serial: number): string {
  return excelSerialToDate(serial).toISOString().split("T")[0]
}
