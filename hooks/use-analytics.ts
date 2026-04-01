"use client"

import { useState, useEffect } from "react"
import { getPocketBase } from "@/lib/pocketbase"
import type { Invoice, MonthlyStats } from "@/lib/types"

// ─── DashboardKPIs ───────────────────────────────────────────────────────────

export interface DashboardKPIs {
  caThisMonth: number
  caTrend: number | null
  purchasesThisMonth: number
  purchasesTrend: number | null
  grossMargin: number
  grossMarginPct: number | null
  grossMarginTrend: number | null
  pendingInvoices: number
  pendingInvoicesAmount: number
  activeAnomalies: number
}

interface DateParams {
  dateFrom: string
  dateTo: string
  comparisonDateFrom: string
  comparisonDateTo: string
}

export function useDashboardKPIs(params: DateParams): {
  kpis: DashboardKPIs | null
  loading: boolean
  error: string | null
} {
  const { dateFrom, dateTo, comparisonDateFrom, comparisonDateTo } = params
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchKPIs() {
      setLoading(true)
      setError(null)
      try {
        const pb = getPocketBase()

        // Derive month keys for monthly_stats lookup
        const firstMonthCur = dateFrom.substring(0, 7)
        const lastMonthCur = dateTo.substring(0, 7)
        const firstMonthPrev = comparisonDateFrom ? comparisonDateFrom.substring(0, 7) : ""
        const lastMonthPrev = comparisonDateTo ? comparisonDateTo.substring(0, 7) : ""

        const promises: Promise<unknown>[] = [
          // [0] Current period invoices
          pb.collection("invoices").getList<Invoice>(1, 1000, {
            filter: `invoiceDate >= "${dateFrom}" && invoiceDate <= "${dateTo}" && totalHT > 0`,
            fields: "totalHT",
          }),
          // [1] Monthly stats current period
          pb.collection("monthly_stats").getList<MonthlyStats>(1, 24, {
            filter: `month >= "${firstMonthCur}-01" && month <= "${lastMonthCur}-31"`,
            sort: "month",
          }),
          // [2] Pending invoices (global)
          pb.collection("invoices").getList<Invoice>(1, 500, {
            filter: 'status = "pending"',
            fields: "totalHT",
          }),
          // [3] Active anomalies
          pb.collection("anomalies").getList(1, 1, { filter: 'status = "new"' }),
        ]

        if (comparisonDateFrom && comparisonDateTo) {
          promises.push(
            // [4] Comparison period invoices
            pb.collection("invoices").getList<Invoice>(1, 1000, {
              filter: `invoiceDate >= "${comparisonDateFrom}" && invoiceDate <= "${comparisonDateTo}" && totalHT > 0`,
              fields: "totalHT",
            }),
            // [5] Monthly stats comparison period
            pb.collection("monthly_stats").getList<MonthlyStats>(1, 24, {
              filter: `month >= "${firstMonthPrev}-01" && month <= "${lastMonthPrev}-31"`,
              sort: "month",
            })
          )
        }

        const results = await Promise.all(promises)
        const [curInvoices, curStats, pendingResult, anomalyResult] = results as [
          { items: Invoice[] },
          { items: MonthlyStats[] },
          { items: Invoice[]; totalItems: number },
          { totalItems: number },
        ]

        const purchasesCur = curInvoices.items.reduce((s, i) => s + (i.totalHT || 0), 0)
        const caCur = curStats.items.reduce((s, st) => s + (st.revenue || 0), 0)
        const grossMargin = caCur - purchasesCur
        const grossMarginPct = caCur > 0 ? (grossMargin / caCur) * 100 : null

        const pendingInvoices = pendingResult.totalItems
        const pendingInvoicesAmount = pendingResult.items.reduce((s, i) => s + (i.totalHT || 0), 0)

        let caTrend: number | null = null
        let purchasesTrend: number | null = null
        let grossMarginTrend: number | null = null

        if (comparisonDateFrom && comparisonDateTo && results.length > 4) {
          const [prevInvoices, prevStats] = results.slice(4) as [
            { items: Invoice[] },
            { items: MonthlyStats[] },
          ]
          const purchasesPrev = prevInvoices.items.reduce((s, i) => s + (i.totalHT || 0), 0)
          const caPrev = prevStats.items.reduce((s, st) => s + (st.revenue || 0), 0)
          const grossMarginPrev = caPrev - purchasesPrev
          const grossMarginPctPrev = caPrev > 0 ? (grossMarginPrev / caPrev) * 100 : null

          if (caPrev > 0) caTrend = ((caCur - caPrev) / caPrev) * 100
          if (purchasesPrev > 0) purchasesTrend = ((purchasesCur - purchasesPrev) / purchasesPrev) * 100
          if (grossMarginPctPrev !== null && grossMarginPct !== null) {
            grossMarginTrend = grossMarginPct - grossMarginPctPrev
          }
        }

        if (!cancelled) {
          setKpis({
            caThisMonth: caCur,
            caTrend,
            purchasesThisMonth: purchasesCur,
            purchasesTrend,
            grossMargin,
            grossMarginPct,
            grossMarginTrend,
            pendingInvoices,
            pendingInvoicesAmount,
            activeAnomalies: anomalyResult.totalItems,
          })
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur de chargement")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchKPIs()
    return () => { cancelled = true }
  }, [dateFrom, dateTo, comparisonDateFrom, comparisonDateTo])

  return { kpis, loading, error }
}

// ─── MonthlyStats ─────────────────────────────────────────────────────────────

export function useMonthlyStats(months = 12) {
  const [stats, setStats] = useState<MonthlyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      try {
        const pb = getPocketBase()
        const result = await pb.collection("monthly_stats").getList<MonthlyStats>(1, months, { sort: "-month" })
        if (!cancelled) setStats(result.items.reverse())
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [months])

  return { stats, loading, error }
}

// ─── MonthlyRevenueMargin ─────────────────────────────────────────────────────

export interface MonthlyRevenueMarginData {
  month: string
  achats: number
  ca: number
  marginPct: number | null
}

export function useMonthlyRevenueMargin(dateFrom: string, dateTo: string): {
  data: MonthlyRevenueMarginData[]
  loading: boolean
  error: string | null
} {
  const [data, setData] = useState<MonthlyRevenueMarginData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!dateFrom || !dateTo) return
    let cancelled = false
    async function fetch() {
      setLoading(true)
      try {
        const pb = getPocketBase()
        const firstMonth = dateFrom.substring(0, 7)
        const lastMonth = dateTo.substring(0, 7)

        const [invoicesResult, statsResult] = await Promise.all([
          pb.collection("invoices").getList<Invoice>(1, 2000, {
            filter: `invoiceDate >= "${dateFrom}" && invoiceDate <= "${dateTo}" && totalHT > 0`,
            fields: "invoiceDate,totalHT",
          }),
          pb.collection("monthly_stats").getList<MonthlyStats>(1, 24, {
            filter: `month >= "${firstMonth}-01" && month <= "${lastMonth}-31"`,
            sort: "month",
          }),
        ])

        const byMonth: Record<string, number> = {}
        for (const inv of invoicesResult.items) {
          const m = (inv.invoiceDate as string).substring(0, 7)
          byMonth[m] = (byMonth[m] || 0) + (inv.totalHT || 0)
        }
        const caByMonth: Record<string, number> = {}
        for (const s of statsResult.items) {
          const m = (s.month as string).substring(0, 7)
          caByMonth[m] = s.revenue || 0
        }

        const allMonths = Array.from(
          new Set([...Object.keys(byMonth), ...Object.keys(caByMonth)])
        ).sort()

        const result: MonthlyRevenueMarginData[] = allMonths.map((m) => {
          const [year, month] = m.split("-")
          const date = new Date(parseInt(year), parseInt(month) - 1, 1)
          const achats = Math.round(byMonth[m] || 0)
          const ca = Math.round(caByMonth[m] || 0)
          const marginPct = ca > 0 ? ((ca - achats) / ca) * 100 : null
          return {
            month: date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
            achats,
            ca,
            marginPct: marginPct !== null ? Math.round(marginPct * 10) / 10 : null,
          }
        })

        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [dateFrom, dateTo])

  return { data, loading, error }
}

// ─── SupplierBreakdown ────────────────────────────────────────────────────────

export interface SupplierBreakdownItem {
  name: string
  value: number
  pct: number
  cumPct: number
}

export function useSupplierBreakdown(dateFrom?: string, dateTo?: string): {
  data: SupplierBreakdownItem[]
  loading: boolean
  error: string | null
} {
  const [data, setData] = useState<SupplierBreakdownItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      setLoading(true)
      try {
        const pb = getPocketBase()
        const filters = ["totalHT > 0"]
        if (dateFrom) filters.push(`invoiceDate >= "${dateFrom}"`)
        if (dateTo) filters.push(`invoiceDate <= "${dateTo}"`)

        const result = await pb.collection("invoices").getList<Invoice>(1, 2000, {
          filter: filters.join(" && "),
          fields: "supplierName,totalHT",
        })

        const totals: Record<string, number> = {}
        let grand = 0
        for (const inv of result.items) {
          const name = inv.supplierName || "Inconnu"
          totals[name] = (totals[name] || 0) + (inv.totalHT || 0)
          grand += inv.totalHT || 0
        }

        const sorted = Object.entries(totals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)

        let running = 0
        const items: SupplierBreakdownItem[] = sorted.map(([name, value]) => {
          const pct = grand > 0 ? (value / grand) * 100 : 0
          running += pct
          return { name, value, pct, cumPct: Math.round(running * 10) / 10 }
        })

        if (!cancelled) setData(items)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [dateFrom, dateTo])

  return { data, loading, error }
}

// ─── SupplierExpenses (for suppliers page) ────────────────────────────────────

export interface SupplierExpense {
  total: number
  count: number
}

export function useSupplierExpenses(dateFrom?: string, dateTo?: string): {
  data: Record<string, SupplierExpense>
  totalExpenses: number
  topSupplierName: string
  topSupplierAmount: number
  loading: boolean
} {
  const [data, setData] = useState<Record<string, SupplierExpense>>({})
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [topSupplierName, setTopSupplierName] = useState("")
  const [topSupplierAmount, setTopSupplierAmount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      setLoading(true)
      try {
        const pb = getPocketBase()
        const filters = ["totalHT > 0"]
        if (dateFrom) filters.push(`invoiceDate >= "${dateFrom}"`)
        if (dateTo) filters.push(`invoiceDate <= "${dateTo}"`)

        const result = await pb.collection("invoices").getList<Invoice>(1, 2000, {
          filter: filters.join(" && "),
          fields: "supplierName,totalHT",
        })

        const expenses: Record<string, SupplierExpense> = {}
        let total = 0
        for (const inv of result.items) {
          const name = inv.supplierName || "Inconnu"
          if (!expenses[name]) expenses[name] = { total: 0, count: 0 }
          expenses[name].total += inv.totalHT || 0
          expenses[name].count += 1
          total += inv.totalHT || 0
        }

        const top = Object.entries(expenses).sort((a, b) => b[1].total - a[1].total)[0]

        if (!cancelled) {
          setData(expenses)
          setTotalExpenses(total)
          setTopSupplierName(top?.[0] || "—")
          setTopSupplierAmount(top?.[1].total || 0)
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [dateFrom, dateTo])

  return { data, totalExpenses, topSupplierName, topSupplierAmount, loading }
}

// ─── WeekStats ────────────────────────────────────────────────────────────────

export function useWeekStats() {
  const [data, setData] = useState<{
    weekTotal: number
    prevWeekTotal: number
    prevMonthWeekTotal: number
    monthlyAvgRevenue: number
    invoiceCount: number
    upcomingDue: Invoice[]
    thisWeekInvoices: Invoice[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      try {
        const pb = getPocketBase()
        const now = new Date()
        const dow = now.getDay() === 0 ? 6 : now.getDay() - 1
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - dow)
        weekStart.setHours(0, 0, 0, 0)
        const prevWeekStart = new Date(weekStart)
        prevWeekStart.setDate(weekStart.getDate() - 7)
        const prevWeekEnd = new Date(weekStart)
        prevWeekEnd.setDate(weekStart.getDate() - 1)
        // Same week 4 weeks ago (same week of previous month approximation)
        const prevMonthWeekStart = new Date(weekStart)
        prevMonthWeekStart.setDate(weekStart.getDate() - 28)
        const prevMonthWeekEnd = new Date(prevWeekStart)
        prevMonthWeekEnd.setDate(prevWeekStart.getDate() - 21)

        const nextWeek = new Date(now)
        nextWeek.setDate(now.getDate() + 7)
        const fmt = (d: Date) => d.toISOString().split("T")[0]

        const [cur, prev, prevMonth, upcoming, stats] = await Promise.all([
          pb.collection("invoices").getList<Invoice>(1, 200, {
            filter: `invoiceDate >= "${fmt(weekStart)}" && invoiceDate <= "${fmt(now)}"`,
            fields: "totalHT,totalTTC,supplierName,invoiceDate,dueDate",
            sort: "-totalHT",
          }),
          pb.collection("invoices").getList<Invoice>(1, 200, {
            filter: `invoiceDate >= "${fmt(prevWeekStart)}" && invoiceDate <= "${fmt(prevWeekEnd)}"`,
            fields: "totalHT",
          }),
          pb.collection("invoices").getList<Invoice>(1, 200, {
            filter: `invoiceDate >= "${fmt(prevMonthWeekStart)}" && invoiceDate <= "${fmt(prevMonthWeekEnd)}"`,
            fields: "totalHT",
          }),
          pb.collection("invoices").getList<Invoice>(1, 10, {
            filter: `dueDate >= "${fmt(now)}" && dueDate <= "${fmt(nextWeek)}"`,
            sort: "dueDate",
          }),
          pb.collection("monthly_stats").getList<MonthlyStats>(1, 3, { sort: "-month" }),
        ])

        const monthlyAvgRevenue = stats.items.length > 0
          ? stats.items.reduce((s, st) => s + (st.revenue || 0), 0) / stats.items.length
          : 0

        if (!cancelled) {
          setData({
            weekTotal: cur.items.reduce((s, i) => s + (i.totalHT || 0), 0),
            prevWeekTotal: prev.items.reduce((s, i) => s + (i.totalHT || 0), 0),
            prevMonthWeekTotal: prevMonth.items.reduce((s, i) => s + (i.totalHT || 0), 0),
            monthlyAvgRevenue,
            invoiceCount: cur.totalItems,
            upcomingDue: upcoming.items,
            thisWeekInvoices: cur.items,
          })
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}
