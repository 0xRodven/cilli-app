"use client"

import { useMemo } from "react"
import { useMonthlyRevenueMargin } from "@/hooks/use-analytics"
import { useDateFilter } from "@/contexts/date-filter-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { CHART_COLORS } from "@/lib/chart-colors"
import { cn } from "@/lib/utils"

interface RevenueMarginChartProps { className?: string }

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)

const fmtK = (v: number) => `${Math.round(v / 1000)}k`

export function RevenueMarginChart({ className }: RevenueMarginChartProps) {
  const { dateTo } = useDateFilter()

  // Always show 12 months of context ending at dateTo
  const chartDateFrom = useMemo(() => {
    const d = new Date(dateTo)
    d.setFullYear(d.getFullYear() - 1)
    return d.toISOString().split("T")[0]
  }, [dateTo])

  const { data, loading, error } = useMonthlyRevenueMargin(chartDateFrom, dateTo)

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Évolution CA + Marge</CardTitle>
        <CardDescription>Achats, CA et marge brute — 12 derniers mois</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[260px]" />
        ) : error ? (
          <div className="flex items-center justify-center h-[260px] text-sm text-red-500">{error}</div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
            Aucune donnée disponible
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="eur"
                orientation="left"
                tickFormatter={fmtK}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="pct"
                orientation="right"
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "marginPct") return [`${value?.toFixed(1) ?? "N/A"}%`, "Marge %"]
                  if (name === "ca") return [fmtEur(value), "CA HT"]
                  if (name === "achats") return [fmtEur(value), "Achats HT"]
                  return [value, name]
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
              />
              <Legend
                formatter={(v) =>
                  v === "ca" ? "CA HT" : v === "achats" ? "Achats HT" : "Marge %"
                }
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar yAxisId="eur" dataKey="ca" fill={CHART_COLORS.green} radius={[3, 3, 0, 0]} name="ca" />
              <Bar yAxisId="eur" dataKey="achats" fill={CHART_COLORS.blue} radius={[3, 3, 0, 0]} name="achats" />
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="marginPct"
                stroke={CHART_COLORS.purple}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: CHART_COLORS.purple }}
                activeDot={{ r: 5 }}
                name="marginPct"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
