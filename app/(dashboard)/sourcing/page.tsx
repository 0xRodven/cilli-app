"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { KPICard } from "@/components/dashboard/kpi-card"
import { getPocketBase } from "@/lib/pocketbase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import {
  Radar,
  Euro,
  Eye,
  Package,
  BarChart3,
  Clock,
  Star,
  Phone,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CalendarDays,
  Search,
} from "lucide-react"
import type { SourcingFind, MarketPrice, Activity } from "@/lib/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VEILLES_PER_PAGE = 3

const CATEGORY_EMOJI: Record<string, string> = {
  oeufs: "\u{1F95A}",
  beurre: "\u{1F9C8}",
  pommes_de_terre: "\u{1F954}",
  huile: "\u{1FAD2}",
  farine: "\u{1F33E}",
  vin: "\u{1F377}",
  viande: "\u{1F969}",
  legumes: "\u{1F955}",
  fruits: "\u{1F34E}",
  poisson: "\u{1F41F}",
  fromage: "\u{1F9C0}",
  epices: "\u{1F336}\uFE0F",
}

const STATUS_CONFIG: Record<
  SourcingFind["status"],
  { label: string; emoji: string; variant: "info" | "success" | "warning" | "secondary" }
> = {
  new: { label: "new", emoji: "\u{1F7E2}", variant: "info" },
  interesting: { label: "intéress.", emoji: "\u{1F7E1}", variant: "success" },
  contacted: { label: "contacté", emoji: "\u{1F4DE}", variant: "warning" },
  dismissed: { label: "écarté", emoji: "\u{274C}", variant: "secondary" },
}

type StatusFilterValue = "active" | "all" | "new" | "interesting" | "contacted" | "dismissed"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse numbers from an activity description using common patterns. */
function parseDescriptionNumbers(desc: string) {
  const lignesMatch = desc.match(/(\d+)\s*ligne/i)
  const produitsMatch = desc.match(/(\d+)\s*produit/i)
  const prixMatch = desc.match(/(\d+)\s*prix/i)
  const oppsMatch = desc.match(/(\d+)\s*opportunit/i)
  return {
    lignes: lignesMatch ? parseInt(lignesMatch[1], 10) : null,
    produits: produitsMatch ? parseInt(produitsMatch[1], 10) : null,
    prix: prixMatch ? parseInt(prixMatch[1], 10) : null,
    opportunites: oppsMatch ? parseInt(oppsMatch[1], 10) : null,
  }
}

/** Parse source counts from activity description, e.g. "SearXNG (4) · RNM (2)". */
function parseSourceCounts(desc: string): { source: string; count: number }[] {
  const results: { source: string; count: number }[] = []
  const regex = /([A-Za-zÀ-ÿ][\w.-]*)\s*\((\d+)\)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(desc)) !== null) {
    results.push({ source: match[1], count: parseInt(match[2], 10) })
  }
  return results
}

/** Get the Monday of a given week from a weekOf string (YYYY-MM-DD). */
function formatWeekHeader(weekOf: string): string {
  const d = new Date(weekOf + "T00:00:00")
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

/** Compute savings percentage for a find. */
function savingsPct(find: SourcingFind): number {
  if (find.currentPrice > 0) {
    return ((find.currentPrice - find.indicativePrice) / find.currentPrice) * 100
  }
  return 0
}

/** Get emoji for a category. */
function categoryEmoji(category: string): string {
  const key = category.toLowerCase().replace(/\s+/g, "_")
  return CATEGORY_EMOJI[key] || "\u{1F4E6}"
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SourcingPage() {
  // Data states
  const [finds, setFinds] = useState<SourcingFind[]>([])
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([])
  const [activities, setActivities] = useState<Activity[]>([])

  // Loading states
  const [loadingFinds, setLoadingFinds] = useState(true)
  const [loadingMarket, setLoadingMarket] = useState(true)
  const [loadingActivities, setLoadingActivities] = useState(true)

  // Veilles pagination
  const [veillePage, setVeillePage] = useState(0)

  // Opportunities filter
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("active")

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
      const result = await pb.collection("market_prices").getList<MarketPrice>(1, 500, {
        sort: "-scrapedAt",
      })
      setMarketPrices(result.items)
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
      const result = await pb.collection("activities").getList<Activity>(1, 100, {
        filter: 'type = "sourcing_search"',
        sort: "-created",
      })
      setActivities(result.items)
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

  async function updateStatus(id: string, status: SourcingFind["status"]) {
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
    [finds],
  )

  const kpis = useMemo(() => {
    const totalPotentialSaving = activeFinds.reduce(
      (sum, f) => sum + (f.potentialSaving || 0),
      0,
    )
    const monthlySaving = totalPotentialSaving * 30

    const newCount = finds.filter((f) => f.status === "new").length
    const interestingCount = finds.filter((f) => f.status === "interesting").length
    const opportunityCount = newCount + interestingCount

    const uniqueProducts = new Set(marketPrices.map((mp) => mp.productName))
    const productsWatched = uniqueProducts.size

    const findsWithPrice = activeFinds.filter((f) => f.currentPrice > 0)
    const avgSavingPct =
      findsWithPrice.length > 0
        ? findsWithPrice.reduce((sum, f) => sum + savingsPct(f), 0) / findsWithPrice.length
        : 0

    return { monthlySaving, opportunityCount, newCount, interestingCount, productsWatched, avgSavingPct }
  }, [finds, activeFinds, marketPrices])

  // -------------------------------------------------------------------------
  // Veilles timeline data
  // -------------------------------------------------------------------------

  const totalVeillePages = Math.max(1, Math.ceil(activities.length / VEILLES_PER_PAGE))

  const pagedActivities = useMemo(() => {
    const start = veillePage * VEILLES_PER_PAGE
    return activities.slice(start, start + VEILLES_PER_PAGE)
  }, [activities, veillePage])

  /** Get the weekOf value closest to an activity's created date. */
  function activityWeekOf(activity: Activity): string {
    const d = new Date(activity.created)
    // Find the Monday of that week
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    return monday.toISOString().split("T")[0]
  }

  /** Get finds for a given activity week. */
  function findsForWeek(weekOf: string): SourcingFind[] {
    return finds.filter((f) => f.weekOf === weekOf)
  }

  /** Get market prices grouped by source for a week. */
  function sourcesForWeek(activity: Activity): { source: string; count: number }[] {
    // First try parsing from description
    const fromDesc = parseSourceCounts(activity.description || "")
    if (fromDesc.length > 0) return fromDesc

    // Fallback: group market_prices by source for the week
    const weekOf = activityWeekOf(activity)
    const weekEnd = new Date(weekOf)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const cutoffStart = weekOf
    const cutoffEnd = weekEnd.toISOString().split("T")[0]

    const sourceCounts: Record<string, number> = {}
    for (const mp of marketPrices) {
      const scraped = mp.scrapedAt?.split("T")[0] || mp.scrapedAt?.split(" ")[0] || ""
      if (scraped >= cutoffStart && scraped < cutoffEnd) {
        sourceCounts[mp.source || "Autre"] = (sourceCounts[mp.source || "Autre"] || 0) + 1
      }
    }

    return Object.entries(sourceCounts).map(([source, count]) => ({ source, count }))
  }

  // -------------------------------------------------------------------------
  // Filtered finds for opportunities table
  // -------------------------------------------------------------------------

  const filteredFinds = useMemo(() => {
    switch (statusFilter) {
      case "active":
        return finds.filter((f) => f.status === "new" || f.status === "interesting")
      case "all":
        return finds
      default:
        return finds.filter((f) => f.status === statusFilter)
    }
  }, [finds, statusFilter])

  const sortedFinds = useMemo(() => {
    return [...filteredFinds].sort((a, b) => savingsPct(b) - savingsPct(a))
  }, [filteredFinds])

  // -------------------------------------------------------------------------
  // Loading flag
  // -------------------------------------------------------------------------

  const isLoading = loadingFinds || loadingMarket || loadingActivities

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* ================================================================= */}
        {/* HEADER                                                             */}
        {/* ================================================================= */}
        <PageHeader
          title="Radar Sourcing"
          description="Veille automatisée, comparatif prix marché et opportunités d'achat"
          sticky
        >
          <Button variant="outline" size="sm" disabled className="text-muted-foreground">
            <Radar className="size-4" />
            Lancer une veille
          </Button>
        </PageHeader>

        {/* ================================================================= */}
        {/* SECTION 1 — 4 KPI Cards                                           */}
        {/* ================================================================= */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          ) : (
            <>
              <KPICard
                title="Éco. potentielle"
                value={kpis.monthlySaving > 0 ? formatCurrency(kpis.monthlySaving) : "0 \u20AC"}
                suffix="/mois"
                subtitle={
                  activeFinds.length > 0
                    ? `sur ${activeFinds.length} produit${activeFinds.length > 1 ? "s" : ""}`
                    : "aucun produit actif"
                }
                icon={Euro}
                color="green"
              />
              <KPICard
                title="Opportunités actives"
                value={kpis.opportunityCount.toString()}
                subtitle={`${kpis.newCount} new \u00B7 ${kpis.interestingCount} int.`}
                icon={Eye}
                color="blue"
              />
              <KPICard
                title="Produits surveillés"
                value={kpis.productsWatched.toString()}
                subtitle="dans market_prices"
                icon={Package}
                color="purple"
              />
              <KPICard
                title="Écart moyen"
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
        {/* SECTION 2 — VEILLES HEBDOMADAIRES (timeline cards)                */}
        {/* ================================================================= */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Veilles hebdomadaires</h2>

          {loadingActivities ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Clock className="size-10 mb-3 opacity-30" />
                <p className="font-medium">Aucune veille enregistrée</p>
                <p className="text-sm mt-1">
                  La prochaine veille automatique est prévue lundi à 10h.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-4">
                {pagedActivities.map((activity) => {
                  const weekOf = activityWeekOf(activity)
                  const parsed = parseDescriptionNumbers(activity.description || "")
                  const weekFinds = findsForWeek(weekOf)
                  const newFindsCount = weekFinds.filter((f) => f.status === "new" || f.status === "interesting").length
                  const sources = sourcesForWeek(activity)

                  // Top opportunities for this week sorted by savings %
                  const topOpps = [...weekFinds]
                    .map((f) => ({ ...f, pct: savingsPct(f) }))
                    .filter((f) => f.pct > 0)
                    .sort((a, b) => b.pct - a.pct)
                    .slice(0, 5)

                  return (
                    <Card key={activity.id} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="size-4 text-muted-foreground shrink-0" />
                            <CardTitle className="text-base">
                              Semaine du {formatWeekHeader(weekOf)}
                            </CardTitle>
                          </div>
                          {newFindsCount > 0 && (
                            <Badge variant="info">
                              {newFindsCount} nouvelle{newFindsCount > 1 ? "s" : ""} opport.
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        {/* Stats line */}
                        <p className="text-sm text-muted-foreground">
                          {[
                            parsed.lignes !== null ? `${parsed.lignes} lignes analysées` : null,
                            parsed.produits !== null ? `${parsed.produits} produits` : null,
                            parsed.prix !== null ? `${parsed.prix} prix trouvés` : null,
                          ]
                            .filter(Boolean)
                            .join(" \u00B7 ") || activity.title || "Veille sourcing"}
                        </p>

                        {/* Top opportunities */}
                        {topOpps.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {topOpps.map((opp) => {
                              const isAlert = opp.pct > 20
                              return (
                                <span
                                  key={opp.id}
                                  className={`inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-md ${
                                    isAlert
                                      ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                      : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                                  }`}
                                >
                                  {isAlert && "\u{1F6A8}"}
                                  {categoryEmoji(opp.category)} {opp.productName}{" "}
                                  <span className="font-semibold tabular-nums">
                                    -{opp.pct.toFixed(0)}%
                                  </span>
                                </span>
                              )
                            })}
                          </div>
                        )}

                        {/* Sources line */}
                        {sources.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Sources :{" "}
                            {sources
                              .map((s) => `${s.source} (${s.count})`)
                              .join(" \u00B7 ")}
                          </p>
                        )}

                        {/* Report link */}
                        <Link
                          href={`/sourcing/${activity.id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          Voir le rapport complet
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Pagination */}
              {activities.length > VEILLES_PER_PAGE && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={veillePage === 0}
                    onClick={() => setVeillePage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="size-4" />
                    Précédent
                  </Button>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {veillePage + 1} / {totalVeillePages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={veillePage >= totalVeillePages - 1}
                    onClick={() => setVeillePage((p) => Math.min(totalVeillePages - 1, p + 1))}
                  >
                    Suivant
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ================================================================= */}
        {/* SECTION 3 — OPPORTUNITÉS EN COURS (compact table)                 */}
        {/* ================================================================= */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Opportunités en cours</h2>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilterValue)}
            >
              <SelectTrigger className="w-52" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">new + intéressant</SelectItem>
                <SelectItem value="all">tous</SelectItem>
                <SelectItem value="new">new</SelectItem>
                <SelectItem value="interesting">intéressant</SelectItem>
                <SelectItem value="contacted">contacté</SelectItem>
                <SelectItem value="dismissed">écarté</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingFinds ? (
                <div className="px-6 py-6 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded" />
                  ))}
                </div>
              ) : sortedFinds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground px-6">
                  <Search className="size-10 mb-3 opacity-30" />
                  <p className="font-medium">Aucune opportunité pour ce filtre</p>
                  <p className="text-sm mt-1">
                    L'agent sourcing tourne chaque lundi matin et alimente ce tableau automatiquement.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-right">Écart</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Semaine</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedFinds.map((find) => {
                        const pct = savingsPct(find)
                        const st = STATUS_CONFIG[find.status]

                        return (
                          <TableRow key={find.id}>
                            {/* Produit */}
                            <TableCell className="font-medium whitespace-nowrap">
                              <span className="mr-1.5">{categoryEmoji(find.category)}</span>
                              {find.productName}
                            </TableCell>

                            {/* Écart */}
                            <TableCell className="text-right tabular-nums whitespace-nowrap">
                              {pct > 0 ? (
                                <span
                                  className={
                                    pct > 15
                                      ? "text-red-600 dark:text-red-400 font-semibold"
                                      : pct > 5
                                        ? "text-amber-600 dark:text-amber-400 font-semibold"
                                        : "text-muted-foreground"
                                  }
                                >
                                  -{pct.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">--</span>
                              )}
                            </TableCell>

                            {/* Source */}
                            <TableCell>
                              {find.source ? (
                                <Badge variant="outline" className="text-xs">
                                  {find.source}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">--</span>
                              )}
                            </TableCell>

                            {/* Semaine */}
                            <TableCell className="text-sm tabular-nums whitespace-nowrap">
                              {find.weekOf
                                ? formatDate(find.weekOf)
                                : "--"}
                            </TableCell>

                            {/* Statut */}
                            <TableCell>
                              <Badge variant={st.variant} className="text-xs">
                                {st.emoji} {st.label}
                              </Badge>
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {find.status !== "interesting" && find.status !== "dismissed" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                        onClick={() => updateStatus(find.id, "interesting")}
                                      >
                                        <Star className="size-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Marquer intéressant</TooltipContent>
                                  </Tooltip>
                                )}

                                {(find.status === "new" || find.status === "interesting") && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                        onClick={() => updateStatus(find.id, "contacted")}
                                      >
                                        <Phone className="size-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Marquer contacté</TooltipContent>
                                  </Tooltip>
                                )}

                                {find.status !== "dismissed" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={() => updateStatus(find.id, "dismissed")}
                                      >
                                        <X className="size-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Écarter</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  )
}
