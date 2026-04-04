"use client"

import { useState, useMemo } from "react"
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
import { formatCurrency } from "@/lib/utils"
import { Search, Building2, ChevronRight, Phone, Mail, Filter } from "lucide-react"
import type { Supplier } from "@/lib/types"

const categoryConfig: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "info" | "destructive" }> = {
  alimentaire: { label: "Alimentaire", variant: "success" },
  services: { label: "Services", variant: "info" },
  energie: { label: "Énergie", variant: "warning" },
  equipement: { label: "Équipement", variant: "secondary" },
  autre: { label: "Autre", variant: "default" },
}

export default function SuppliersPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const { suppliers, loading } = useSuppliers()

  // Filter by search + category
  const filtered = useMemo(() => {
    let result = suppliers
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.address || "").toLowerCase().includes(q) ||
        (s.siret || "").toLowerCase().includes(q)
      )
    }
    if (categoryFilter) {
      result = result.filter(s => (s.category || s.type || "autre") === categoryFilter)
    }
    return result
  }, [suppliers, search, categoryFilter])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of suppliers) {
      const cat = s.category || s.type || "autre"
      counts[cat] = (counts[cat] || 0) + 1
    }
    return counts
  }, [suppliers])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fournisseurs"
        description={`${suppliers.length} fournisseur${suppliers.length !== 1 ? "s" : ""} enregistrés`}
        sticky
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Rechercher par nom, adresse, SIRET..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="size-3.5 text-muted-foreground" />
              <Button
                variant={categoryFilter === null ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setCategoryFilter(null)}
              >
                Tous ({suppliers.length})
              </Button>
              {Object.entries(categoryConfig).map(([key, config]) => {
                const count = categoryCounts[key] || 0
                if (count === 0) return null
                return (
                  <Button
                    key={key}
                    variant={categoryFilter === key ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setCategoryFilter(categoryFilter === key ? null : key)}
                  >
                    {config.label} ({count})
                  </Button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fournisseur</TableHead>
                <TableHead className="hidden md:table-cell">SIRET / TVA</TableHead>
                <TableHead className="hidden lg:table-cell">Contact</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="hidden sm:table-cell">Adresse</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Building2 className="size-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-foreground text-sm">Aucun fournisseur trouvé</p>
                    <p className="text-xs mt-1">Modifiez votre recherche ou vos filtres</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((supplier: Supplier) => {
                  const cat = categoryConfig[(supplier.category || supplier.type || "autre")] || categoryConfig.autre
                  return (
                    <TableRow
                      key={supplier.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/suppliers/${supplier.id}`)}
                    >
                      <TableCell>
                        <p className="font-medium text-sm">{supplier.name}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {supplier.siret ? (
                          <span className="font-mono text-xs text-muted-foreground">{supplier.siret}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-col gap-0.5">
                          {supplier.phone && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="size-3" />
                              {supplier.phone}
                            </span>
                          )}
                          {supplier.email && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="size-3" />
                              {supplier.email}
                            </span>
                          )}
                          {!supplier.phone && !supplier.email && (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={cat.variant} className="text-[10px]">{cat.label}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                          {supplier.address || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="size-4 text-muted-foreground" />
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
