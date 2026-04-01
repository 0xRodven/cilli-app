"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, MapPin, Phone, Mail, Building2, FileText, Euro, ShoppingCart } from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { KPICard } from "@/components/dashboard/kpi-card"
import { useSupplier } from "@/hooks/use-suppliers"
import { getPocketBase } from "@/lib/pocketbase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { CHART_COLORS } from "@/lib/chart-colors"
import type { Invoice } from "@/lib/types"

// --- Config maps ---

const reliabilityConfig = {
  good: { label: "Fiable", variant: "success" as const },
  average: { label: "Moyen", variant: "warning" as const },
  poor: { label: "Faible", variant: "destructive" as const },
  unknown: { label: "Inconnu", variant: "secondary" as const },
}

const statusConfig = {
  active: { label: "Actif", variant: "success" as const },
  inactive: { label: "Inactif", variant: "secondary" as const },
  new: { label: "Nouveau", variant: "info" as const },
}

const invoiceStatusConfig: Record<string, { label: string; className: string }> = {
  pending: {
    label: "En attente",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  },
  validated: {
    label: "Validee",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  },
  anomaly: {
    label: "Anomalie",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  },
  paid: {
    label: "Payee",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  },
}

// --- Helpers ---

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)

interface MonthlyData {
  month: string
  label: string
  totalHT: number
}

function computeMonthlyData(invoices: Invoice[]): MonthlyData[] {
  const byMonth: Record<string, number> = {}
  for (const inv of invoices) {
    if (!inv.invoiceDate) continue
    const m = inv.invoiceDate.substring(0, 7)
    byMonth[m] = (byMonth[m] || 0) + (inv.totalHT || 0)
  }

  // Generate last 12 months
  const now = new Date()
  const months: MonthlyData[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })
    months.push({ month: key, label, totalHT: Math.round(byMonth[key] || 0) })
  }
  return months
}

// --- Component ---

export default function SupplierDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { supplier, loading: supplierLoading, error: supplierError } = useSupplier(id)

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)
  const [invoicesError, setInvoicesError] = useState<string | null>(null)

  // Fetch all invoices for this supplier once we have the supplier name
  useEffect(() => {
    if (!supplier?.name) return
    let cancelled = false
    async function fetchInvoices() {
      setInvoicesLoading(true)
      setInvoicesError(null)
      try {
        const pb = getPocketBase()
        const result = await pb.collection("invoices").getList<Invoice>(1, 500, {
          filter: `supplierName="${supplier!.name}"`,
          sort: "-invoiceDate",
        })
        if (!cancelled) setInvoices(result.items)
      } catch (err) {
        if (!cancelled) setInvoicesError(err instanceof Error ? err.message : "Erreur de chargement")
      } finally {
        if (!cancelled) setInvoicesLoading(false)
      }
    }
    fetchInvoices()
    return () => { cancelled = true }
  }, [supplier?.name])

  // Compute KPIs from invoices
  const kpis = useMemo(() => {
    if (invoices.length === 0) return null
    const totalHT = invoices.reduce((s, i) => s + (i.totalHT || 0), 0)
    const totalTTC = invoices.reduce((s, i) => s + (i.totalTTC || 0), 0)
    const count = invoices.length
    const avgHT = count > 0 ? totalHT / count : 0
    return { totalHT, totalTTC, count, avgHT }
  }, [invoices])

  // Compute monthly chart data
  const monthlyData = useMemo(() => computeMonthlyData(invoices), [invoices])

  const loading = supplierLoading || invoicesLoading

  // --- Loading state ---
  if (supplierLoading) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-xl" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    )
  }

  // --- Error state ---
  if (supplierError || !supplier) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/suppliers">
              <ArrowLeft className="size-4 mr-1" />
              Retour
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Building2 className="size-10 opacity-30" />
              <p className="font-medium text-foreground">Fournisseur introuvable</p>
              <p className="text-sm">{supplierError || "Ce fournisseur n'existe pas ou a ete supprime."}</p>
              <Button variant="outline" size="sm" asChild className="mt-2">
                <Link href="/suppliers">Retour aux fournisseurs</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const reliability = reliabilityConfig[supplier.reliability] || reliabilityConfig.unknown
  const status = statusConfig[supplier.status] || statusConfig.active

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2">
          <Link href="/suppliers">
            <ArrowLeft className="size-4 mr-1" />
            Retour
          </Link>
        </Button>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant={reliability.variant}>{reliability.label}</Badge>
          </div>
        </div>

        {/* Info row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
          {supplier.city && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {supplier.city}
            </span>
          )}
          {supplier.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" />
              {supplier.phone}
            </span>
          )}
          {supplier.email && (
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" />
              <a href={`mailto:${supplier.email}`} className="hover:underline text-primary">
                {supplier.email}
              </a>
            </span>
          )}
          {supplier.contactName && (
            <span className="flex items-center gap-1.5">
              <Building2 className="size-3.5" />
              {supplier.contactName}
            </span>
          )}
        </div>

        {/* Additional info */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          {supplier.type && <span>Type : {supplier.type}</span>}
          {supplier.deliveryDays && supplier.deliveryDays.length > 0 && (
            <span>Livraison : {supplier.deliveryDays.join(", ")}</span>
          )}
          {supplier.specialties && supplier.specialties.length > 0 && (
            <span>Specialites : {supplier.specialties.join(", ")}</span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {invoicesLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : kpis ? (
          <>
            <KPICard
              title="Total HT"
              value={formatCurrency(kpis.totalHT)}
              icon={Euro}
              color="blue"
            />
            <KPICard
              title="Total TTC"
              value={formatCurrency(kpis.totalTTC)}
              icon={ShoppingCart}
              color="green"
            />
            <KPICard
              title="Nb factures"
              value={kpis.count.toString()}
              icon={FileText}
              color="purple"
            />
            <KPICard
              title="Panier moyen"
              subtitle="Moyenne HT / facture"
              value={formatCurrency(kpis.avgHT)}
              icon={Euro}
              color="amber"
            />
          </>
        ) : (
          <div className="col-span-full">
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground text-sm">
                  Aucune facture enregistree pour ce fournisseur.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Monthly evolution chart */}
      <Card>
        <CardHeader>
          <CardTitle>Evolution mensuelle</CardTitle>
          <CardDescription>Depenses HT sur les 12 derniers mois</CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <Skeleton className="h-[260px]" />
          ) : invoicesError ? (
            <div className="flex items-center justify-center h-[260px] text-sm text-red-500">
              {invoicesError}
            </div>
          ) : monthlyData.every((d) => d.totalHT === 0) ? (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
              Aucune donnee disponible
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) =>
                    v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                  }
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number) => [fmtEur(value), "Total HT"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
                />
                <Bar
                  dataKey="totalHT"
                  fill={CHART_COLORS.blue}
                  radius={[4, 4, 0, 0]}
                  name="Total HT"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Invoice table */}
      <Card>
        <CardHeader>
          <CardTitle>Factures</CardTitle>
          <CardDescription>
            {invoicesLoading
              ? "Chargement..."
              : `${invoices.length} facture${invoices.length !== 1 ? "s" : ""} pour ${supplier.name}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N&#176; Facture</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total HT</TableHead>
                <TableHead className="text-right">Total TTC</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoicesLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <FileText className="size-10 opacity-30" />
                      <div className="text-center">
                        <p className="font-medium text-sm text-foreground">Aucune facture</p>
                        <p className="text-xs mt-1">
                          Les factures pour ce fournisseur apparaitront ici.
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => {
                  const statusCfg = invoiceStatusConfig[invoice.status] || {
                    label: invoice.status,
                    className: "bg-muted text-muted-foreground",
                  }
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {invoice.invoiceNumber || "\u2014"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {invoice.invoiceDate ? formatDate(invoice.invoiceDate) : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(invoice.totalHT || 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(invoice.totalTTC || 0)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.className}`}
                        >
                          {statusCfg.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Notes */}
      {supplier.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{supplier.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
