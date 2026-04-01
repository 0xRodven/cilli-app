"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export type DatePreset =
  | "this_week"
  | "this_month"
  | "last_month"
  | "3_months"
  | "6_months"
  | "this_year"
  | "custom"

export type ComparisonMode = "previous_period" | "same_period_last_year" | "none"

interface DateFilterState {
  preset: DatePreset
  dateFrom: string
  dateTo: string
  comparisonDateFrom: string
  comparisonDateTo: string
  comparisonMode: ComparisonMode
}

interface DateFilterContextValue extends DateFilterState {
  setPreset: (preset: DatePreset, customFrom?: string, customTo?: string) => void
  setComparisonMode: (mode: ComparisonMode) => void
}

const DateFilterContext = createContext<DateFilterContextValue | null>(null)

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

export function computeDateRange(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } {
  const now = new Date()
  switch (preset) {
    case "this_week": {
      const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
      const start = new Date(now)
      start.setDate(now.getDate() - dayOfWeek)
      start.setHours(0, 0, 0, 0)
      return { from: fmtDate(start), to: fmtDate(now) }
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: fmtDate(start), to: fmtDate(now) }
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: fmtDate(start), to: fmtDate(end) }
    }
    case "3_months": {
      const start = new Date(now)
      start.setMonth(start.getMonth() - 3)
      return { from: fmtDate(start), to: fmtDate(now) }
    }
    case "6_months": {
      const start = new Date(now)
      start.setMonth(start.getMonth() - 6)
      return { from: fmtDate(start), to: fmtDate(now) }
    }
    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1)
      return { from: fmtDate(start), to: fmtDate(now) }
    }
    case "custom":
      if (customFrom && customTo) return { from: customFrom, to: customTo }
      // fallthrough
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: fmtDate(start), to: fmtDate(now) }
    }
  }
}

function computeComparisonRange(
  dateFrom: string,
  dateTo: string,
  mode: ComparisonMode
): { from: string; to: string } {
  if (mode === "none") return { from: "", to: "" }

  const from = new Date(dateFrom)
  const to = new Date(dateTo)
  const durationMs = to.getTime() - from.getTime()

  if (mode === "same_period_last_year") {
    const compFrom = new Date(from)
    compFrom.setFullYear(compFrom.getFullYear() - 1)
    const compTo = new Date(to)
    compTo.setFullYear(compTo.getFullYear() - 1)
    return { from: fmtDate(compFrom), to: fmtDate(compTo) }
  }

  // previous_period
  const compTo = new Date(from.getTime() - 24 * 60 * 60 * 1000)
  const compFrom = new Date(compTo.getTime() - durationMs)
  return { from: fmtDate(compFrom), to: fmtDate(compTo) }
}

export function DateFilterProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const getInitialState = (): DateFilterState => {
    const preset = (searchParams.get("period") as DatePreset) || "this_month"
    const customFrom = searchParams.get("from") || undefined
    const customTo = searchParams.get("to") || undefined
    const mode = (searchParams.get("compare") as ComparisonMode) || "previous_period"
    const range = computeDateRange(preset, customFrom, customTo)
    const compRange = computeComparisonRange(range.from, range.to, mode)
    return {
      preset,
      dateFrom: range.from,
      dateTo: range.to,
      comparisonDateFrom: compRange.from,
      comparisonDateTo: compRange.to,
      comparisonMode: mode,
    }
  }

  const [state, setState] = useState<DateFilterState>(getInitialState)

  const setPreset = useCallback(
    (preset: DatePreset, customFrom?: string, customTo?: string) => {
      const range = computeDateRange(preset, customFrom, customTo)
      setState((prev) => {
        const compRange = computeComparisonRange(range.from, range.to, prev.comparisonMode)
        return { ...prev, preset, dateFrom: range.from, dateTo: range.to, ...compRange && { comparisonDateFrom: compRange.from, comparisonDateTo: compRange.to } }
      })
      const params = new URLSearchParams(searchParams.toString())
      params.set("period", preset)
      if (preset === "custom" && customFrom && customTo) {
        params.set("from", customFrom)
        params.set("to", customTo)
      } else {
        params.delete("from")
        params.delete("to")
      }
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [searchParams, router]
  )

  const setComparisonMode = useCallback(
    (mode: ComparisonMode) => {
      setState((prev) => {
        const compRange = computeComparisonRange(prev.dateFrom, prev.dateTo, mode)
        return { ...prev, comparisonMode: mode, comparisonDateFrom: compRange.from, comparisonDateTo: compRange.to }
      })
      const params = new URLSearchParams(searchParams.toString())
      params.set("compare", mode)
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [searchParams, router]
  )

  return (
    <DateFilterContext.Provider value={{ ...state, setPreset, setComparisonMode }}>
      {children}
    </DateFilterContext.Provider>
  )
}

export function useDateFilter() {
  const ctx = useContext(DateFilterContext)
  if (!ctx) throw new Error("useDateFilter must be used within DateFilterProvider")
  return ctx
}
