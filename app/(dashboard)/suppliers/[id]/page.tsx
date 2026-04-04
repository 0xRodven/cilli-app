"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, MapPin, Phone, Mail, Building2, FileText, Euro, ShoppingCart, Globe, ExternalLink, Eye } from "lucide-react"
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

const categoryConfig: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "info" }> = {
  alimentaire: { label: "Alimentaire", variant: "success" },
  services: { label: "Services", variant: "info" },
  energie: { label: "Énergie", variant: "warning" },
  equipement: { label: "Équipement", variant: "secondary" },
  autre: { label: "Autre", variant: "default" },
}

const invoiceStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "info" | "destructive" }> = {
  pending: { label: "En attente", variant: "warning" },
  validated: { label: "Validée", variant: "info" },
  anomaly: { label: "Anomalie", variant: "destructive" },
  paid: { label: "Payée", variant: "success" },
}

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)

interface MonthlyData { month: string; label: string; totalHT: number }

function computeMonthlyData(invoices: Invoice[]): MonthlyData[] {
  const byMonth: Record<string, number> = {}
  for (const inv of invoices) {
    if (!inv.invoiceDate) continue
    const m = inv.invoiceDate.substring(0, 7)
    byMonth[m] = (byMonth[m] || 0) + (inv.totalHT || 0)
  }
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

export default function SupplierDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { supplier, loading: supplierLoading, error: supplierError } = useSupplier(id)

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)

  useEffect(() => {
    if (!supplier?.name) return
    let cancelled = false
    async function fetchInvoices() {
      setInvoicesLoading(true)
      try {
        const pb = getPocketBase()
        const result = await pb.collection("invoices").getList<Invoice>(1, 500, {
          filter: `supplierName~"${supplier!.name}"`,
          sort: "-invoiceDate",
        })
        if (!cancelled) setInvoices(result.items)
      } catch {
        if (!cancelled) setInvoices([])
      } finally {
        if (!cancelled) setInvoicesLoading(false)
      }
    }
    fetchInvoices()
    return () => { cancelled = true }
  }, [supplier?.name])

  const kpis = useMemo(() => {
    if (invoices.length === 0) return null
    const totalHT = invoices.reduce((s, i) => s + (i.totalHT || 0), 0)
    const totalTTC = invoices.reduce((s, i) => s + (i.totalTTC || 0), 0)
    const count = invoices.length
    const avgHT = count > 0 ? totalHT / count : 0
    return { totalHT, totalTTC, count, avgHT }
  }, [invoices])

  const monthlyData = useMemo(() => computeMonthlyData(invoices), [invoices])

  if (supplierLoading) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 rounded-xl" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (supplierError || !supplier) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/suppliers"><ArrowLeft className="size-4 mr-1" />Retour</Link>
        </Button>
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="size-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Fournisseur introuvable</p>
            <Button variant="outline" size="sm" asChild className="mt-4">
              <Link href="/suppliers">Retour aux fournisseurs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const cat = categoryConfig[(supplier.category || supplier.type || "autre")] || categoryConfig.autre

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Navigation */}
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2">
        <Link href="/suppliers"><ArrowLeft className="size-4 mr-1" />Fournisseurs</Link>
      </Button>

      {/* Header card */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col gap-4">
            {/* Name + badges */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
                <Badge variant={cat.variant}>{cat.label}</Badge>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              {/* Address */}
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="size-4 mt-0.5 shrink-0" />
                <span>{supplier.address || "Adresse non renseignée"}</span>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="size-4 shrink-0" />
                {supplier.phone ? (
                  <a href={`tel:${supplier.phone}`} className="hover:underline">{supplier.phone}</a>
                ) : (
                  <span className="text-muted-foreground/50">Non renseigné</span>
                )}
              </div>

              {/* Email */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-4 shrink-0" />
                {supplier.email ? (
                  <a href={`mailto:${supplier.email}`} className="hover:underline text-primary truncate">{supplier.email}</a>
                ) : (
                  <span className="text-muted-foreground/50">Non renseigné</span>
                )}
              </div>

              {/* SIRET */}
              {supplier.siret && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="size-4 shrink-0" />
                  <span className="text-xs">SIRET : <span className="font-mono">{supplier.siret}</span></span>
                </div>
              )}
            </div>

            {/* Website if present */}
            {supplier.website && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="size-4 shrink-0" />
                <a href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`}
                   target="_blank" rel="noopener noreferrer"
                   className="hover:underline text-primary flex items-center gap-1">
                  {supplier.website}
                  <ExternalLink className="size-3" />
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {invoicesLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : kpis ? (
          <>
            <KPICard title="Total HT" value={formatCurrency(kpis.totalHT)} icon={Euro} color="blue" />
            <KPICard title="Total TTC" value={formatCurrency(kpis.totalTTC)} icon={ShoppingCart} color="green" />
            <KPICard title="Factures" value={kpis.count.toString()} icon={FileText} color="purple" />
            <KPICard title="Panier moyen HT" value={formatCurrency(kpis.avgHT)} icon={Euro} color="amber" />
          </>
        ) : (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aucune facture enregistrée pour ce fournisseur.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Monthly chart */}
      <Card>
        <CardHeader>
          <CardTitle>Évolution mensuelle</CardTitle>
          <CardDescription>Dépenses HT sur les 12 derniers mois</CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <Skeleton className="h-[260px]" />
          ) : monthlyData.every(d => d.totalHT === 0) ? (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
              Aucune donnée disponible
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number) => [fmtEur(value), "Total HT"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }} />
                <Bar dataKey="totalHT" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} name="Total HT" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Invoice table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Factures</CardTitle>
              <CardDescription>
                {invoicesLoading ? "Chargement..." : `${invoices.length} facture${invoices.length !== 1 ? "s" : ""}`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Facture</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total HT</TableHead>
                <TableHead className="text-right">Total TTC</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoicesLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <FileText className="size-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">Aucune facture</p>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map(invoice => {
                  const statusCfg = invoiceStatusConfig[invoice.status] || { label: invoice.status, variant: "secondary" as const }
                  const sourceLabel = invoice.sourceChannel === "ocr_upload" ? "OCR" : invoice.sourceChannel === "odoo_import" ? "Odoo" : invoice.sourceChannel || "—"
                  return (
                    <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.open(`/invoices?search=${encodeURIComponent(invoice.invoiceNumber || "")}`, "_self")}>
                      <TableCell className="font-mono text-xs text-primary">{invoice.invoiceNumber || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{invoice.invoiceDate ? formatDate(invoice.invoiceDate) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatCurrency(invoice.totalHT || 0)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(invoice.totalTTC || 0)}</TableCell>
                      <TableCell><Badge variant={statusCfg.variant}>{statusCfg.label}</Badge></TableCell>
                      <TableCell><span className="text-xs text-muted-foreground">{sourceLabel}</span></TableCell>
                      <TableCell>
                        <Eye className="size-3.5 text-muted-foreground" />
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
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{supplier.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
