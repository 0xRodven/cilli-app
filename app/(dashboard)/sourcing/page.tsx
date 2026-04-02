"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { KPICard } from "@/components/dashboard/kpi-card"
import { getPocketBase } from "@/lib/pocketbase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import {
  Radar,
  TrendingDown,
  TrendingUp,
  Euro,
  Eye,
  Package,
  BarChart3,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  XCircle,
  Star,
  Phone,
  Filter,
} from "lucide-react"
import type { SourcingFind, MarketPrice, PriceHistory, Activity } from "@/lib/types"

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const statusConfig: Record<
  SourcingFind["status"],
  { label: string; variant: "info" | "success" | "warning" | "secondary" }
> = {
  new: { label: "Nouveau", variant: "info" },
  interesting: { label: "Intéressant", variant: "success" },
  contacted: { label: "Contacté", variant: "warning" },
  dismissed: { label: "Écarté", variant: "secondary" },
}

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

interface ComparativeRow {
  productName: string
  internalPrice: number | null
  sourcesPrices: Record<string, number | null>
  bestSource: string | null
  bestPrice: number | null
  ecartPct: number | null
  category: string
}

interface VeilleLogEntry {
  id: string
  created: string
  title: string
  description: string
  produitsAnalyses: number | null
  prixTrouves: number | null
  opportunites: number | null
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SourcingPage() {
  // Data states
  const [finds, setFinds] = useState<SourcingFind[]>([])
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([])
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [latestVeille, setLatestVeille] = useState<Activity | null>(null)

  // Loading states
  const [loadingFinds, setLoadingFinds] = useState(true)
  const [loadingMarket, setLoadingMarket] = useState(true)
  const [loadingActivities, setLoadingActivities] = useState(true)

  // Filter states
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [ecartOnlyToggle, setEcartOnlyToggle] = useState(false)
  const [sortByField, setSortByField] = useState<"ecart" | "product">("ecart")

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchFinds = useCallback(async () => {
    setLoadingFinds(true)
    try {
      const pb = getPocketBase()
      const result = await pb.collection("sourcing_finds").getList<SourcingFind>(1, 200, {
        sort: "-weekOf,-created",
      })
      setFinds(result.items)
    } catch {
      /* silent */
    } finally {
      setLoadingFinds(false)
    }
  }, [])

  const fetchMarketData = useCallback(async () => {
    setLoadingMarket(true)
    try {
      const pb = getPocketBase()
      const fourWeeksAgo = new Date()
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
      const cutoff = fourWeeksAgo.toISOString().replace("T", " ")

      const [mpResult, phResult] = await Promise.all([
        pb.collection("market_prices").getList<MarketPrice>(1, 500, {
          filter: `scrapedAt >= "${cutoff}"`,
          sort: "-scrapedAt",
        }),
        pb.collection("price_history").getList<PriceHistory>(1, 500, {
          sort: "-date",
        }),
      ])

      setMarketPrices(mpResult.items)
      setPriceHistory(phResult.items)
    } catch {
      /* silent */
    } finally {
      setLoadingMarket(false)
    }
  }, [])

  const fetchActivities = useCallback(async () => {
    setLoadingActivities(true)
    try {
      const pb = getPocketBase()
      const result = await pb.collection("activities").getList<Activity>(1, 20, {
        filter: 'type = "sourcing_search"',
        sort: "-created",
      })
      setActivities(result.items)
      if (result.items.length > 0) {
        setLatestVeille(result.items[0])
      }
    } catch {
      /* silent */
    } finally {
      setLoadingActivities(false)
    }
  }, [])

  useEffect(() => {
    fetchFinds()
    fetchMarketData()
    fetchActivities()
  }, [fetchFinds, fetchMarketData, fetchActivities])

  // -------------------------------------------------------------------------
  // Status update
  // -------------------------------------------------------------------------

  async function updateStatus(id: string, status: string) {
    try {
      const pb = getPocketBase()
      await pb.collection("sourcing_finds").update(id, { status })
      toast.success("Statut mis à jour")
      fetchFinds()
    } catch {
      toast.error("Erreur lors de la mise à jour")
    }
  }

  // -------------------------------------------------------------------------
  // KPI computations
  // -------------------------------------------------------------------------

  const activeFinds = useMemo(
    () => finds.filter((f) => f.status === "new" || f.status === "interesting"),
    [finds]
  )

  const kpis = useMemo(() => {
    const totalPotentialSaving = activeFinds.reduce(
      (sum, f) => sum + (f.potentialSaving || 0),
      0
    )
    const monthlySaving = totalPotentialSaving * 30

    const newCount = finds.filter((f) => f.status === "new").length
    const interestingCount = finds.filter((f) => f.status === "interesting").length
    const opportunityCount = newCount + interestingCount

    const uniqueProducts = new Set(marketPrices.map((mp) => mp.productName))
    const productsWatched = uniqueProducts.size

    const avgSavingPct =
      activeFinds.length > 0
        ? activeFinds.reduce((sum, f) => {
            if (f.currentPrice > 0) {
              return sum + ((f.currentPrice - f.indicativePrice) / f.currentPrice) * 100
            }
            return sum
          }, 0) / activeFinds.filter((f) => f.currentPrice > 0).length || 0
        : 0

    return {
      monthlySaving,
      activeProductCount: activeFinds.length,
      opportunityCount,
      newCount,
      interestingCount,
      productsWatched,
      avgSavingPct,
    }
  }, [finds, activeFinds, marketPrices])

  // -------------------------------------------------------------------------
  // Comparative table data
  // -------------------------------------------------------------------------

  const { comparativeRows, allSources, allCategories } = useMemo(() => {
    // Build internal price map: productName -> avg unit price
    const internalMap: Record<string, { total: number; count: number }> = {}
    for (const ph of priceHistory) {
      const name = (ph.product || "").trim().toLowerCase()
      if (!name) continue
      if (!internalMap[name]) internalMap[name] = { total: 0, count: 0 }
      internalMap[name].total += ph.price || 0
      internalMap[name].count += 1
    }

    // Build market price map: productName -> { source -> latest price }
    const marketMap: Record<string, Record<string, { price: number; date: string }>> = {}
    const sourcesSet = new Set<string>()
    const categoriesSet = new Set<string>()

    for (const mp of marketPrices) {
      const name = mp.productName.trim().toLowerCase()
      const source = mp.source || "Autre"
      sourcesSet.add(source)
      if (!marketMap[name]) marketMap[name] = {}
      const existing = marketMap[name][source]
      if (!existing || mp.scrapedAt > existing.date) {
        marketMap[name][source] = { price: mp.price, date: mp.scrapedAt }
      }
    }

    // Add categories from finds
    for (const f of finds) {
      if (f.category) categoriesSet.add(f.category)
    }

    // Merge all product names
    const allProductNames = new Set<string>([
      ...Object.keys(internalMap),
      ...Object.keys(marketMap),
    ])

    // Build find category lookup
    const findCategoryMap: Record<string, string> = {}
    for (const f of finds) {
      const name = f.productName.trim().toLowerCase()
      if (f.category) findCategoryMap[name] = f.category
    }

    const sources = Array.from(sourcesSet).sort()

    const rows: ComparativeRow[] = []
    for (const name of allProductNames) {
      const internal = internalMap[name]
      const internalPrice = internal ? internal.total / internal.count : null

      const sourcesPrices: Record<string, number | null> = {}
      for (const s of sources) {
        sourcesPrices[s] = marketMap[name]?.[s]?.price ?? null
      }

      // Find best market price
      let bestPrice: number | null = null
      let bestSource: string | null = null
      for (const s of sources) {
        const p = sourcesPrices[s]
        if (p !== null && (bestPrice === null || p < bestPrice)) {
          bestPrice = p
          bestSource = s
        }
      }

      // Ecart %
      let ecartPct: number | null = null
      if (internalPrice !== null && bestPrice !== null && internalPrice > 0) {
        ecartPct = ((internalPrice - bestPrice) / internalPrice) * 100
      }

      rows.push({
        productName: name,
        internalPrice,
        sourcesPrices,
        bestSource,
        bestPrice,
        ecartPct,
        category: findCategoryMap[name] || "",
      })
    }

    return {
      comparativeRows: rows,
      allSources: sources,
      allCategories: Array.from(categoriesSet).sort(),
    }
  }, [marketPrices, priceHistory, finds])

  // Filtered & sorted rows
  const filteredRows = useMemo(() => {
    let rows = [...comparativeRows]
    if (categoryFilter !== "all") {
      rows = rows.filter((r) => r.category === categoryFilter)
    }
    if (ecartOnlyToggle) {
      rows = rows.filter((r) => r.ecartPct !== null && r.ecartPct > 5)
    }
    if (sortByField === "ecart") {
      rows.sort((a, b) => (b.ecartPct ?? -Infinity) - (a.ecartPct ?? -Infinity))
    } else {
      rows.sort((a, b) => a.productName.localeCompare(b.productName))
    }
    return rows
  }, [comparativeRows, categoryFilter, ecartOnlyToggle, sortByField])

  // Split rows by >5% and <=5%
  const { aboveThreshold, belowThreshold } = useMemo(() => {
    const above = filteredRows.filter((r) => r.ecartPct !== null && r.ecartPct > 5)
    const below = filteredRows.filter((r) => r.ecartPct === null || r.ecartPct <= 5)
    return { aboveThreshold: above, belowThreshold: below }
  }, [filteredRows])

  // -------------------------------------------------------------------------
  // Filtered finds for Section 4
  // -------------------------------------------------------------------------

  const filteredFinds = useMemo(() => {
    if (statusFilter === "all") return finds
    return finds.filter((f) => f.status === statusFilter)
  }, [finds, statusFilter])

  // -------------------------------------------------------------------------
  // Veille log entries (parsed)
  // -------------------------------------------------------------------------

  const veilleEntries = useMemo((): VeilleLogEntry[] => {
    return activities.slice(0, 10).map((a) => {
      // Try to parse numbers from description
      const produitsMatch = a.description?.match(/(\d+)\s*produit/i)
      const prixMatch = a.description?.match(/(\d+)\s*prix/i)
      const oppsMatch = a.description?.match(/(\d+)\s*opportunit/i)
      return {
        id: a.id,
        created: a.created,
        title: a.title || "Veille sourcing",
        description: a.description || "",
        produitsAnalyses: produitsMatch ? parseInt(produitsMatch[1], 10) : null,
        prixTrouves: prixMatch ? parseInt(prixMatch[1], 10) : null,
        opportunites: oppsMatch ? parseInt(oppsMatch[1], 10) : null,
      }
    })
  }, [activities])

  // -------------------------------------------------------------------------
  // Header info
  // -------------------------------------------------------------------------

  const headerText = useMemo(() => {
    if (!latestVeille) return null
    const d = new Date(latestVeille.created)
    const dayNames = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"]
    const dayName = dayNames[d.getDay()]
    const dateStr = d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    const timeStr = d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })

    // Parse numbers from description/metadata
    const desc = latestVeille.description || ""
    const produitsMatch = desc.match(/(\d+)\s*produit/i)
    const prixMatch = desc.match(/(\d+)\s*prix/i)
    const oppsMatch = desc.match(/(\d+)\s*opportunit/i)

    const produits = produitsMatch ? produitsMatch[1] : "?"
    const prix = prixMatch ? prixMatch[1] : "?"
    const opps = oppsMatch ? oppsMatch[1] : "?"

    return `Derniere veille : ${dayName} ${dateStr} a ${timeStr} — ${produits} produits · ${prix} prix trouves · ${opps} opportunites`
  }, [latestVeille])

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const isLoading = loadingFinds || loadingMarket || loadingActivities

  function formatProductName(name: string) {
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  function renderEcartBadge(ecart: number | null) {
    if (ecart === null) {
      return <Badge variant="secondary">N/A</Badge>
    }
    if (ecart > 5) {
      return (
        <Badge variant="destructive" className="tabular-nums">
          <ArrowDownRight className="size-3" />-{ecart.toFixed(1)}%
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="tabular-nums">
        {ecart > 0 ? `-${ecart.toFixed(1)}%` : `+${Math.abs(ecart).toFixed(1)}%`}
      </Badge>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* ================================================================= */}
      {/* SECTION 1 — Header */}
      {/* ================================================================= */}
      <PageHeader
        title="Radar Sourcing"
        description="Veille automatisee, comparatif prix marche et opportunites d'achat"
        sticky
      >
        <Button variant="outline" size="sm" disabled className="text-muted-foreground">
          <Radar className="size-4" />
          Lancer une veille
        </Button>
      </PageHeader>

      {/* Veille status bar */}
      {loadingActivities ? (
        <Skeleton className="h-10 rounded-lg" />
      ) : headerText ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-muted/50 border">
          <Clock className="size-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">{headerText}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-muted/50 border">
          <Clock className="size-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">
            Aucune veille enregistree — la veille sourcing tourne automatiquement chaque lundi.
          </span>
        </div>
      )}

      {/* ================================================================= */}
      {/* SECTION 2 — 4 KPI Cards */}
      {/* ================================================================= */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            <KPICard
              title="Eco. potentielle"
              value={
                kpis.monthlySaving > 0
                  ? formatCurrency(kpis.monthlySaving)
                  : "0 \u20AC"
              }
              suffix="/mois"
              subtitle={
                kpis.activeProductCount > 0
                  ? `sur ${kpis.activeProductCount} produit${kpis.activeProductCount > 1 ? "s" : ""}`
                  : "aucun produit actif"
              }
              icon={Euro}
              color="green"
            />
            <KPICard
              title="Opportunites"
              value={kpis.opportunityCount.toString()}
              subtitle={`${kpis.newCount} new · ${kpis.interestingCount} int.`}
              icon={Eye}
              color="blue"
            />
            <KPICard
              title="Produits surveilles"
              value={kpis.productsWatched.toString()}
              subtitle={`${kpis.productsWatched} avec prix`}
              icon={Package}
              color="purple"
            />
            <KPICard
              title="Ecart moyen"
              value={
                kpis.avgSavingPct !== 0
                  ? `-${Math.abs(kpis.avgSavingPct).toFixed(1)}%`
                  : "0%"
              }
              subtitle="vs ton prix"
              icon={BarChart3}
              color={kpis.avgSavingPct > 5 ? "red" : "amber"}
            />
          </>
        )}
      </div>

      {/* ================================================================= */}
      {/* SECTION 3 — Comparatif prix marche */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Comparatif prix marche</CardTitle>
              <CardDescription>
                Ton prix interne vs prix releves chez chaque source
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {allCategories.length > 0 && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40" size="sm">
                    <SelectValue placeholder="Categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes categories</SelectItem>
                    {allCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant={ecartOnlyToggle ? "default" : "outline"}
                size="sm"
                onClick={() => setEcartOnlyToggle(!ecartOnlyToggle)}
              >
                <Filter className="size-3.5" />
                Ecart &gt; 5%
              </Button>
              <Select value={sortByField} onValueChange={(v) => setSortByField(v as "ecart" | "product")}>
                <SelectTrigger className="w-36" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ecart">Tri par ecart</SelectItem>
                  <SelectItem value="product">Tri par produit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingMarket ? (
            <div className="px-6 pb-6 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground px-6">
              <BarChart3 className="size-10 mb-3 opacity-30" />
              <p className="font-medium">Aucune donnee de prix disponible</p>
              <p className="text-sm mt-1">
                Les prix marche et l'historique d'achats alimentent ce tableau automatiquement.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Ton prix</TableHead>
                  {allSources.map((s) => (
                    <TableHead key={s} className="text-right">
                      {s}
                    </TableHead>
                  ))}
                  <TableHead>Meilleur</TableHead>
                  <TableHead className="text-right">Ecart</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Above threshold rows */}
                {aboveThreshold.map((row) => (
                  <TableRow key={row.productName} className="bg-red-50/30 dark:bg-red-900/5">
                    <TableCell className="font-medium">
                      {formatProductName(row.productName)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.internalPrice !== null
                        ? formatCurrency(row.internalPrice)
                        : <span className="text-muted-foreground">--</span>}
                    </TableCell>
                    {allSources.map((s) => (
                      <TableCell key={s} className="text-right tabular-nums">
                        {row.sourcesPrices[s] !== null
                          ? formatCurrency(row.sourcesPrices[s]!)
                          : <span className="text-muted-foreground">--</span>}
                      </TableCell>
                    ))}
                    <TableCell>
                      {row.bestSource ? (
                        <Badge variant="success" className="text-xs">
                          {row.bestSource}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {renderEcartBadge(row.ecartPct)}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Separator if both sections have data */}
                {aboveThreshold.length > 0 && belowThreshold.length > 0 && !ecartOnlyToggle && (
                  <TableRow>
                    <TableCell
                      colSpan={3 + allSources.length}
                      className="py-1 bg-muted/30 text-center text-xs text-muted-foreground font-medium"
                    >
                      Ecarts &le; 5% ci-dessous
                    </TableCell>
                  </TableRow>
                )}

                {/* Below threshold rows */}
                {!ecartOnlyToggle &&
                  belowThreshold.map((row) => (
                    <TableRow key={row.productName}>
                      <TableCell className="font-medium">
                        {formatProductName(row.productName)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.internalPrice !== null
                          ? formatCurrency(row.internalPrice)
                          : <span className="text-muted-foreground">--</span>}
                      </TableCell>
                      {allSources.map((s) => (
                        <TableCell key={s} className="text-right tabular-nums">
                          {row.sourcesPrices[s] !== null
                            ? formatCurrency(row.sourcesPrices[s]!)
                            : <span className="text-muted-foreground">--</span>}
                        </TableCell>
                      ))}
                      <TableCell>
                        {row.bestSource ? (
                          <Badge variant="outline" className="text-xs">
                            {row.bestSource}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderEcartBadge(row.ecartPct)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* SECTION 4 — Opportunites (cards) */}
      {/* ================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Opportunites</h2>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44" size="sm">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="new">Nouveaux</SelectItem>
              <SelectItem value="interesting">Interessants</SelectItem>
              <SelectItem value="contacted">Contactes</SelectItem>
              <SelectItem value="dismissed">Ecartes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loadingFinds ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : filteredFinds.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Radar className="size-10 mb-3 opacity-30" />
              <p className="font-medium">Aucune opportunite pour ce filtre</p>
              <p className="text-sm mt-1">
                L'agent sourcing tourne chaque lundi matin et alimente ce tableau automatiquement.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredFinds.map((find) => {
              const st = statusConfig[find.status] || statusConfig.new
              const savingPct =
                find.currentPrice > 0
                  ? ((find.currentPrice - find.indicativePrice) / find.currentPrice) * 100
                  : 0
              const monthlySavingEstimate = (find.potentialSaving || 0) * 30

              return (
                <Card key={find.id} className="flex flex-col gap-3 py-4">
                  <CardHeader className="px-4 pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-base font-semibold leading-snug truncate">
                          {find.productName || find.title}
                        </div>
                        {find.supplierName && (
                          <div className="text-sm text-muted-foreground mt-0.5">
                            {find.supplierName}
                          </div>
                        )}
                      </div>
                      <Badge variant={st.variant} className="shrink-0">
                        {st.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 flex-1 flex flex-col gap-3">
                    {find.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {find.description}
                      </p>
                    )}

                    {/* Price comparison */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs text-muted-foreground">Ton prix</p>
                        <p className="font-semibold">
                          {find.currentPrice
                            ? formatCurrency(find.currentPrice)
                            : "--"}
                          <span className="text-xs font-normal text-muted-foreground">
                            /{find.unit || "u"}
                          </span>
                        </p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-md p-2">
                        <p className="text-xs text-muted-foreground">Prix trouve</p>
                        <p className="font-semibold text-green-700 dark:text-green-400">
                          {find.indicativePrice
                            ? formatCurrency(find.indicativePrice)
                            : "--"}
                          <span className="text-xs font-normal text-muted-foreground">
                            /{find.unit || "u"}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Savings progress bar */}
                    {savingPct > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                            <TrendingDown className="size-4" />-{savingPct.toFixed(0)}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Eco. {formatCurrency(find.potentialSaving || 0)}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{
                              width: `${Math.min(savingPct, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Monthly estimate */}
                    {monthlySavingEstimate > 0 && (
                      <div className="text-sm text-muted-foreground">
                        ~{formatCurrency(monthlySavingEstimate)}/mois estime
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {find.source && (
                        <Badge variant="outline" className="text-[10px]">
                          {find.source}
                        </Badge>
                      )}
                      {find.category && (
                        <Badge variant="outline" className="text-[10px]">
                          {find.category}
                        </Badge>
                      )}
                      {find.weekOf && <span>{formatDate(find.weekOf)}</span>}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-auto pt-2">
                      {find.status === "new" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => updateStatus(find.id, "interesting")}
                        >
                          <Star className="size-3.5" />
                          Interessant
                        </Button>
                      )}
                      {(find.status === "new" || find.status === "interesting") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => updateStatus(find.id, "contacted")}
                        >
                          <Phone className="size-3.5" />
                          Contacte
                        </Button>
                      )}
                      {find.status !== "dismissed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => updateStatus(find.id, "dismissed")}
                        >
                          <XCircle className="size-3.5" />
                          Ecarter
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* SECTION 5 — Journal des veilles */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Journal des veilles</CardTitle>
          <CardDescription>
            Historique des executions de l'agent sourcing
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingActivities ? (
            <div className="px-6 pb-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : veilleEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground px-6">
              <Clock className="size-10 mb-3 opacity-30" />
              <p className="font-medium">Aucune veille enregistree</p>
              <p className="text-sm mt-1">
                Le journal se remplit automatiquement a chaque execution de la veille sourcing.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Produits analyses</TableHead>
                  <TableHead className="text-right">Prix trouves</TableHead>
                  <TableHead className="text-right">Opportunites</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {veilleEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {formatDate(entry.created)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.produitsAnalyses !== null ? (
                        entry.produitsAnalyses
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.prixTrouves !== null ? (
                        entry.prixTrouves
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.opportunites !== null ? (
                        entry.opportunites
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                      {entry.description || entry.title}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
