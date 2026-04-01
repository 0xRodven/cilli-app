"use client"

import { useRouter } from "next/navigation"
import { useSupplierBreakdown } from "@/hooks/use-analytics"
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
} from "recharts"
import { CHART_COLORS } from "@/lib/chart-colors"
import { cn } from "@/lib/utils"

interface SupplierParetoChartProps { className?: string }

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)

const truncate = (s: string, n = 15) => s.length > n ? s.slice(0, n) + "…" : s

export function SupplierParetoChart({ className }: SupplierParetoChartProps) {
  const router = useRouter()
  const { dateFrom, dateTo } = useDateFilter()
  const { data, loading, error } = useSupplierBreakdown(dateFrom, dateTo)

  const chartData = data.map((d) => ({ ...d, label: truncate(d.name) }))

  function handleBarClick(entry: { name?: string }) {
    if (entry?.name) {
      router.push(`/invoices?search=${encodeURIComponent(entry.name)}`)
    }
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Top fournisseurs</CardTitle>
        <CardDescription>Pareto — cliquez pour voir les factures</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[260px]" />
        ) : error ? (
          <div className="flex items-center justify-center h-[260px] text-sm text-red-500">{error}</div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
            Aucune donnée
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 30 + 40)}>
            <ComposedChart
              layout="vertical"
              data={chartData}
              margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
              onClick={(e) => {
                if (e?.activePayload?.[0]?.payload) {
                  handleBarClick(e.activePayload[0].payload as { name?: string })
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
              <XAxis
                xAxisId={0}
                type="number"
                tickFormatter={(v) => `${Math.round(v / 1000)}k€`}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                orientation="bottom"
              />
              <XAxis
                xAxisId={1}
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                orientation="top"
              />
              <YAxis
                type="category"
                dataKey="label"
                width={110}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "cumPct") return [`${value}%`, "Cumul %"]
                  return [fmtEur(value), "Achats HT"]
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
              />
              <Bar
                xAxisId={0}
                dataKey="value"
                fill={CHART_COLORS.blue}
                radius={[0, 3, 3, 0]}
                cursor="pointer"
                name="value"
              />
              <Line
                xAxisId={1}
                type="monotone"
                dataKey="cumPct"
                stroke={CHART_COLORS.amber}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART_COLORS.amber }}
                name="cumPct"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
