"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSuppliers } from "@/hooks/use-suppliers"
import { useSupplierExpenses } from "@/hooks/use-analytics"
import { useDateFilter } from "@/contexts/date-filter-context"
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils"
import { Search, MapPin, ExternalLink, Building2, TrendingUp } from "lucide-react"
import type { Supplier } from "@/lib/types"

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

export default function SuppliersPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const { dateFrom, dateTo } = useDateFilter()
  const { suppliers, loading } = useSuppliers(search || undefined)
  const { data: expenses, totalExpenses, topSupplierName, topSupplierAmount, loading: expLoading } = useSupplierExpenses(dateFrom, dateTo)

  const activeCount = suppliers.filter((s) => s.status === "active").length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fournisseurs"
        description={`${suppliers.length} fournisseur${suppliers.length !== 1 ? "s" : ""}`}
        sticky
      />

      {/* KPI row */}
      {!expLoading && totalExpenses > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Fournisseurs actifs</p>
                  <p className="text-xl font-bold">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">Top dépensier</p>
                  <p className="text-xl font-bold truncate">{topSupplierName}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrencyCompact(topSupplierAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2 lg:col-span-1">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <div className="size-4 text-muted-foreground shrink-0 font-bold text-sm">€</div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Total dépenses période</p>
                  <p className="text-xl font-bold">{formatCurrencyCompact(totalExpenses)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Rechercher un fournisseur..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead className="text-right">Dépenses</TableHead>
                <TableHead className="text-right">Nb factures</TableHead>
                <TableHead>Fiabilité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun fournisseur trouvé
                  </TableCell>
                </TableRow>
              ) : (
                suppliers.map((supplier: Supplier) => {
                  const reliability = reliabilityConfig[supplier.reliability] || reliabilityConfig.unknown
                  const status = statusConfig[supplier.status] || statusConfig.active
                  const exp = expenses[supplier.name]
                  return (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">
                        <Link href={`/suppliers/${supplier.id}`} className="hover:underline text-primary">
                          {supplier.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {supplier.city && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="size-3" />
                            {supplier.city}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {expLoading ? (
                          <Skeleton className="h-4 w-20 ml-auto" />
                        ) : exp ? formatCurrency(exp.total) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {expLoading ? (
                          <Skeleton className="h-4 w-10 ml-auto" />
                        ) : exp ? exp.count : "—"}
                      </TableCell>
                      <TableCell><Badge variant={reliability.variant}>{reliability.label}</Badge></TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => router.push(`/invoices?search=${encodeURIComponent(supplier.name)}`)}
                        >
                          Factures
                          <ExternalLink className="size-3 ml-1" />
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
    </div>
  )
}
