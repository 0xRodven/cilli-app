"use client"

import { useState, useMemo, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useInvoices } from "@/hooks/use-invoices"
import { useDateFilter, computeDateRange, type DatePreset } from "@/contexts/date-filter-context"
import { getPocketBase } from "@/lib/pocketbase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Search, ChevronLeft, ChevronRight, FileText, Eye } from "lucide-react"
import type { Invoice, Import } from "@/lib/types"

// --- Status config ---
const statusConfig: Record<string, { label: string; className: string }> = {
  pending: {
    label: "En attente",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  },
  validated: {
    label: "Validée",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  },
  anomaly: {
    label: "Anomalie",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  },
  paid: {
    label: "Payée",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  },
}

const sourceLabels: Record<string, string> = {
  odoo_import: "Odoo",
  ocr_email: "Email OCR",
  ocr_telegram: "Telegram",
  ocr_upload: "Upload",
  manual: "Manuel",
}

type Period = "all" | "this_week" | "this_month" | "last_month" | "3_months" | "6_months" | "this_year"
type AmountRange = "all" | "lt100" | "100_500" | "500_2000" | "gt2000"

function getAmountBounds(range: AmountRange): { min?: number; max?: number } {
  if (range === "all") return {}
  if (range === "lt100") return { max: 100 }
  if (range === "100_500") return { min: 100, max: 500 }
  if (range === "500_2000") return { min: 500, max: 2000 }
  if (range === "gt2000") return { min: 2000 }
  return {}
}

const GLOBAL_PERIODS: Period[] = ["this_week", "this_month", "last_month", "3_months", "6_months", "this_year"]

const today = new Date().toISOString().split("T")[0]

export default function InvoicesPage() {
  const searchParams = useSearchParams()
  const { preset: globalPreset, setPreset: setGlobalPreset } = useDateFilter()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [status, setStatus] = useState<string>(searchParams.get("status") || "")
  const [period, setPeriod] = useState<Period>("all")
  const [amountRange, setAmountRange] = useState<AmountRange>("all")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState("")
  const perPage = 20

  const openPdfPreview = useCallback(async (invoice: Invoice) => {
    try {
      const pb = getPocketBase()
      // Find the import record linked to this invoice
      const result = await pb.collection("imports").getList<Import>(1, 1, {
        filter: `invoice = "${invoice.id}"`,
      })
      if (result.items.length > 0 && result.items[0].file) {
        const imp = result.items[0]
        const url = `${pb.baseURL}/api/files/imports/${imp.id}/${imp.file}`
        setPreviewUrl(url)
        setPreviewTitle(`${invoice.supplierName} — ${invoice.invoiceNumber}`)
      }
    } catch { /* no import linked */ }
  }, [])

  const { dateFrom, dateTo } = useMemo(() => {
    if (period === "all") return { dateFrom: undefined, dateTo: undefined }
    const range = computeDateRange(period as DatePreset)
    return { dateFrom: range.from, dateTo: range.to }
  }, [period])

  const { min: minAmount, max: maxAmount } = useMemo(() => getAmountBounds(amountRange), [amountRange])

  const { invoices: rawInvoices, total, loading } = useInvoices({
    page,
    perPage,
    status: status || undefined,
    dateFrom,
    dateTo,
    search: search || undefined,
  })

  // Client-side amount filter
  const invoices = useMemo(() => {
    if (minAmount === undefined && maxAmount === undefined) return rawInvoices
    return rawInvoices.filter((inv) => {
      const v = inv.totalHT || 0
      if (minAmount !== undefined && v < minAmount) return false
      if (maxAmount !== undefined && v > maxAmount) return false
      return true
    })
  }, [rawInvoices, minAmount, maxAmount])

  const totalPages = Math.ceil(total / perPage)
  const visibleTotalHT = invoices.reduce((sum, inv) => sum + (inv.totalHT || 0), 0)
  const visibleTotalTTC = invoices.reduce((sum, inv) => sum + (inv.totalTTC || 0), 0)
  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1
  const rangeEnd = Math.min(page * perPage, total)

  function resetPage() { setPage(1) }

  function handlePeriodChange(v: Period) {
    setPeriod(v)
    resetPage()
    if (v !== "all" && GLOBAL_PERIODS.includes(v)) {
      setGlobalPreset(v as DatePreset)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Factures" description={`${total} factures au total`} sticky />

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Rechercher fournisseur ou numéro..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); resetPage() }}
                />
              </div>
              <Select
                value={status || "all"}
                onValueChange={(v) => { setStatus(v === "all" ? "" : v); resetPage() }}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="validated">Validée</SelectItem>
                  <SelectItem value="anomaly">Anomalie</SelectItem>
                  <SelectItem value="paid">Payée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={period} onValueChange={(v) => handlePeriodChange(v as Period)}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tout</SelectItem>
                  <SelectItem value="this_week">Cette semaine</SelectItem>
                  <SelectItem value="this_month">Ce mois</SelectItem>
                  <SelectItem value="last_month">Mois dernier</SelectItem>
                  <SelectItem value="3_months">3 derniers mois</SelectItem>
                  <SelectItem value="6_months">6 derniers mois</SelectItem>
                  <SelectItem value="this_year">Cette année</SelectItem>
                </SelectContent>
              </Select>

              <Select value={amountRange} onValueChange={(v) => { setAmountRange(v as AmountRange); resetPage() }}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Montant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous montants</SelectItem>
                  <SelectItem value="lt100">&lt; 100€</SelectItem>
                  <SelectItem value="100_500">100 – 500€</SelectItem>
                  <SelectItem value="500_2000">500 – 2 000€</SelectItem>
                  <SelectItem value="gt2000">&gt; 2 000€</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary bar */}
      {!loading && total > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground px-1">
          <span>
            Affichage : <span className="font-medium text-foreground">{invoices.length}</span> factures
            {total !== invoices.length && (
              <span> sur <span className="font-medium text-foreground">{total}</span> au total</span>
            )}
          </span>
          <span className="hidden sm:inline text-border">·</span>
          <span>
            Total HT visible :{" "}
            <span className="font-medium text-foreground">{formatCurrency(visibleTotalHT)}</span>
          </span>
          <span className="hidden sm:inline text-border">·</span>
          <span>
            Total TTC visible :{" "}
            <span className="font-medium text-foreground">{formatCurrency(visibleTotalTTC)}</span>
          </span>
          {totalPages > 1 && (
            <>
              <span className="hidden sm:inline text-border">·</span>
              <span>Page {page}/{totalPages}</span>
            </>
          )}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead className="text-right">Montant HT</TableHead>
                <TableHead className="text-right">Montant TTC</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-16">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <FileText className="size-10 opacity-30" />
                      <div className="text-center">
                        <p className="font-medium text-sm text-foreground">Aucune facture trouvée</p>
                        <p className="text-xs mt-1">
                          {search || status || period !== "all" || amountRange !== "all"
                            ? "Essayez de modifier vos filtres"
                            : "Les factures apparaîtront ici dès qu'elles seront importées"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice: Invoice) => {
                  const statusCfg = statusConfig[invoice.status] || {
                    label: invoice.status,
                    className: "bg-muted text-muted-foreground",
                  }
                  const sourceChannel = (invoice as Invoice & { sourceChannel?: string }).sourceChannel || invoice.source
                  const isOverdue = invoice.dueDate && invoice.dueDate < today && invoice.status !== "paid"
                  return (
                    <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {invoice.invoiceNumber || "—"}
                      </TableCell>
                      <TableCell className="font-medium">{invoice.supplierName || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {invoice.invoiceDate ? formatDate(invoice.invoiceDate) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {invoice.dueDate ? (
                          <span className={isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}>
                            {formatDate(invoice.dueDate)}
                            {isOverdue && (
                              <Badge className="ml-1.5 text-[10px] bg-red-100 text-red-700 border-red-200 h-4 px-1">
                                en retard
                              </Badge>
                            )}
                          </span>
                        ) : "—"}
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
                      <TableCell className="text-xs text-muted-foreground">
                        {sourceLabels[sourceChannel] || sourceChannel || "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="Voir le PDF"
                          onClick={(e) => { e.stopPropagation(); openPdfPreview(invoice) }}
                        >
                          <Eye className="size-3.5 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {rangeStart}–{rangeEnd} sur {total} résultats
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Page précédente</span>
            </Button>
            <span className="text-xs px-2">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">Page suivante</span>
            </Button>
          </div>
        </div>
      )}

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="text-base truncate">{previewTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 pb-6">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-md border"
                title={previewTitle}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Aucun PDF lié à cette facture
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
