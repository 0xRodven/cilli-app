"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SourceLink } from "@/components/dashboard/source-link"
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
  ExternalLink,
} from "lucide-react"
import type { SourcingFind, MarketPrice, Activity, Product } from "@/lib/types"

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
  const [products, setProducts] = useState<Product[]>([])

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
        sort: "-weekOf",
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

  const fetchProducts = useCallback(async () => {
    try {
      const pb = getPocketBase()
      const result = await pb.collection("products").getList<Product>(1, 500, { sort: "name" })
      setProducts(result.items)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchFinds()
    fetchMarketData()
    fetchActivities()
    fetchProducts()
  }, [fetchFinds, fetchMarketData, fetchActivities, fetchProducts])

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

    return { monthlySaving, totalPotentialSaving, opportunityCount, newCount, interestingCount, productsWatched, avgSavingPct }
  }, [finds, activeFinds, marketPrices])

  /** Find product ID from product name */
  function findProductId(productName: string): string | null {
    const lower = productName.toLowerCase()
    const p = products.find((pr) => pr.name.toLowerCase() === lower)
    return p ? p.id : null
  }

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
    const norm = (s: string) => (s || "").split(" ")[0].split("T")[0]
    const target = norm(weekOf)
    return finds.filter((f) => norm(f.weekOf) === target)
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
  // Trigger sourcing
  // -------------------------------------------------------------------------

  const [scanState, setScanState] = useState<"idle" | "triggering" | "polling" | "done" | "timeout">("idle")
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStartTime, setScanStartTime] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<{ title: string; finds: number } | null>(null)
  const scanPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (scanPollRef.current) clearInterval(scanPollRef.current)
    }
  }, [])

  async function triggerSourcing() {
    setScanState("triggering")
    setScanProgress(0)
    setScanResult(null)

    try {
      const res = await fetch("/api/trigger-sourcing", { method: "POST" })
      const data = await res.json()
      if (!data.ok) {
        toast.error("Erreur : " + (data.error || "échec du déclenchement"))
        setScanState("idle")
        return
      }

      // Start polling
      const triggerTime = new Date().toISOString()
      setScanStartTime(triggerTime)
      setScanState("polling")
      setScanProgress(10)

      let elapsed = 0
      const POLL_INTERVAL = 8000 // 8s
      const TIMEOUT = 5 * 60 * 1000 // 5 min

      scanPollRef.current = setInterval(async () => {
        elapsed += POLL_INTERVAL

        // Animate progress bar (slow fill to ~85% over 3 min)
        setScanProgress(Math.min(85, 10 + (elapsed / TIMEOUT) * 75))

        // Check for new activity
        try {
          const pb = getPocketBase()
          const result = await pb.collection("activities").getList(1, 1, {
            filter: `type = "sourcing_search" && created > "${triggerTime}"`,
            sort: "-created",
          })

          if (result.items.length > 0) {
            // Scan finished!
            if (scanPollRef.current) clearInterval(scanPollRef.current)
            setScanProgress(100)

            // Count new finds
            const newFinds = await pb.collection("sourcing_finds").getList(1, 1, {
              filter: `created > "${triggerTime}"`,
            })

            setScanResult({
              title: result.items[0].title || "Veille terminée",
              finds: newFinds.totalItems,
            })
            setScanState("done")

            // Refresh data
            fetchFinds()
            fetchMarketData()
            fetchActivities()

            toast.success("Veille terminée", {
              description: newFinds.totalItems > 0
                ? `${newFinds.totalItems} nouvelle${newFinds.totalItems > 1 ? "s" : ""} opportunité${newFinds.totalItems > 1 ? "s" : ""} trouvée${newFinds.totalItems > 1 ? "s" : ""}. Les données ont été mises à jour.`
                : "Aucune nouvelle opportunité cette fois. Les prix existants ont été vérifiés.",
              duration: 10000,
            })
          }
        } catch { /* silent poll error */ }

        // Timeout
        if (elapsed >= TIMEOUT) {
          if (scanPollRef.current) clearInterval(scanPollRef.current)
          setScanState("timeout")
          setScanProgress(100)
        }
      }, POLL_INTERVAL)
    } catch {
      toast.error("Impossible de contacter le serveur")
      setScanState("idle")
    }
  }

  function dismissScan() {
    if (scanPollRef.current) clearInterval(scanPollRef.current)
    setScanState("idle")
    setScanProgress(0)
    setScanResult(null)
  }

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
          <Button
            variant={scanState === "idle" ? "outline" : "secondary"}
            size="sm"
            onClick={scanState === "idle" ? triggerSourcing : undefined}
            disabled={scanState !== "idle"}
            className={scanState === "polling" ? "animate-pulse" : ""}
          >
            <Radar className={`size-4 ${scanState === "polling" ? "animate-spin" : ""}`} />
            {scanState === "idle" && "Lancer une veille"}
            {scanState === "triggering" && "Lancement..."}
            {scanState === "polling" && "Veille en cours..."}
            {scanState === "done" && "Terminée"}
            {scanState === "timeout" && "Timeout"}
          </Button>
        </PageHeader>

        {/* Scan progress banner */}
        {scanState !== "idle" && (
          <Card className="overflow-hidden border-blue-200 dark:border-blue-800">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {scanState === "polling" && (
                    <>
                      <div className="size-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-sm font-medium">L'agent analyse les prix marché...</span>
                    </>
                  )}
                  {scanState === "done" && scanResult && (
                    <>
                      <div className="size-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">
                        {scanResult.title}
                      </span>
                    </>
                  )}
                  {scanState === "timeout" && (
                    <>
                      <div className="size-2 rounded-full bg-amber-500" />
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        Le scan prend plus longtemps que prévu. Les résultats apparaîtront automatiquement.
                      </span>
                    </>
                  )}
                </div>
                {(scanState === "done" || scanState === "timeout") && (
                  <Button variant="ghost" size="sm" onClick={dismissScan}>
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    scanState === "done"
                      ? "bg-green-500"
                      : scanState === "timeout"
                        ? "bg-amber-500"
                        : "bg-blue-500"
                  }`}
                  style={{ width: `${scanProgress}%` }}
                />
              </div>

              {scanState === "polling" && (
                <p className="text-xs text-muted-foreground">
                  Interrogation des sources (SearXNG, RNM, MIN Lomme, Promocash, Transgourmet)...
                </p>
              )}
              {scanState === "done" && scanResult && scanResult.finds > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  {scanResult.finds} nouvelle{scanResult.finds > 1 ? "s" : ""} opportunité{scanResult.finds > 1 ? "s" : ""} trouvée{scanResult.finds > 1 ? "s" : ""}. Les KPIs ont été mis à jour.
                </p>
              )}
            </CardContent>
          </Card>
        )}

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
              {/* Éco. potentielle — avec popover produits */}
              <Popover>
                <PopoverTrigger asChild>
                  <div>
                    <KPICard
                      title="Économie potentielle"
                      value={kpis.monthlySaving > 0 ? formatCurrency(kpis.monthlySaving) : "0 €"}
                      suffix="/mois"
                      subtitle={
                        activeFinds.length > 0
                          ? `sur ${activeFinds.length} produit${activeFinds.length > 1 ? "s" : ""}`
                          : "aucun produit actif"
                      }
                      icon={Euro}
                      color="green"
                      className="cursor-pointer hover:shadow-md transition-shadow"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  className="w-80 backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-white/20 shadow-2xl rounded-xl"
                  side="bottom"
                  align="start"
                >
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Détail par produit
                  </p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {activeFinds.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucune opportunité active</p>
                    ) : (
                      activeFinds
                        .sort((a, b) => (b.potentialSaving || 0) - (a.potentialSaving || 0))
                        .map((f) => {
                          const pid = findProductId(f.productName)
                          return (
                            <Link
                              key={f.id}
                              href={pid ? `/products/${pid}` : "#"}
                              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                            >
                              <span className="text-sm truncate">
                                {categoryEmoji(f.category)} {f.productName}
                              </span>
                              <span className="text-xs font-semibold tabular-nums text-green-600 dark:text-green-400 shrink-0">
                                -{formatCurrency(f.potentialSaving || 0)}
                              </span>
                            </Link>
                          )
                        })
                    )}
                  </div>
                  {activeFinds.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/10 flex justify-between text-xs font-medium">
                      <span className="text-muted-foreground">Total / unité</span>
                      <span className="text-green-600 dark:text-green-400">
                        {formatCurrency(activeFinds.reduce((s, f) => s + (f.potentialSaving || 0), 0))}
                      </span>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {/* Opportunités actives — avec popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <div>
                    <KPICard
                      title="Opportunités actives"
                      value={kpis.opportunityCount.toString()}
                      subtitle={`${kpis.newCount} nouvelle${kpis.newCount > 1 ? "s" : ""} · ${kpis.interestingCount} intéressante${kpis.interestingCount > 1 ? "s" : ""}`}
                      icon={Eye}
                      color="blue"
                      className="cursor-pointer hover:shadow-md transition-shadow"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  className="w-80 backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-white/20 shadow-2xl rounded-xl"
                  side="bottom"
                  align="start"
                >
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Opportunités
                  </p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {activeFinds
                      .sort((a, b) => savingsPct(b) - savingsPct(a))
                      .map((f) => {
                        const pid = findProductId(f.productName)
                        const pct = savingsPct(f)
                        const st = STATUS_CONFIG[f.status]
                        return (
                          <Link
                            key={f.id}
                            href={pid ? `/products/${pid}` : "#"}
                            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          >
                            <span className="text-sm truncate">
                              {categoryEmoji(f.category)} {f.productName}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-xs font-semibold tabular-nums ${pct > 15 ? "text-red-600" : "text-amber-600"}`}>
                                -{pct.toFixed(0)}%
                              </span>
                              <span className="text-[10px]">{st.emoji}</span>
                            </div>
                          </Link>
                        )
                      })}
                  </div>
                </PopoverContent>
              </Popover>

              <KPICard
                title="Produits surveillés"
                value={kpis.productsWatched.toString()}
                subtitle="relevés par l'agent"
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
                subtitle="vs tes prix actuels"
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
                              {(() => {
                                const pid = findProductId(find.productName)
                                return pid ? (
                                  <Link href={`/products/${pid}`} className="hover:underline">
                                    <span className="mr-1.5">{categoryEmoji(find.category)}</span>
                                    {find.productName}
                                  </Link>
                                ) : (
                                  <>
                                    <span className="mr-1.5">{categoryEmoji(find.category)}</span>
                                    {find.productName}
                                  </>
                                )
                              })()}
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
                              <SourceLink source={find.source} sourceUrl={find.sourceUrl} />
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
