"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { getPocketBase } from "@/lib/pocketbase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import {
  ArrowLeft,
  Bot,
  AlertTriangle,
  Phone,
  ArrowRight,
  CheckSquare,
  FileText,
  Send,
  Download,
  ShieldCheck,
  ShieldAlert,
  Shield,
} from "lucide-react"
import type { Activity, SourcingFind, MarketPrice, PriceHistory, Product } from "@/lib/types"

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

/** Map product names to categories by keyword matching. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Bases cuisine": ["beurre", "farine", "huile", "pomme de terre", "pdt", "oeufs", "oeuf", "riz", "pates", "pâtes", "sel", "sucre"],
  "Boissons": ["vin", "biere", "bière", "eau", "coca", "jus"],
  "Frais": ["tomate", "oignon", "carotte", "salade", "crème", "creme", "herbe", "citron", "fruit", "persil", "basilic", "ciboulette", "menthe"],
  "Viandes": ["entrecôte", "entrecote", "veau", "boeuf", "bœuf", "saucisse", "poulet", "agneau", "porc"],
  "Surgelés": ["frite", "glace", "surgelé", "surgele"],
  "Café": ["café", "cafe", "thé", "the"],
}

function detectCategory(productName: string): string {
  const lower = productName.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category
  }
  return "Autres"
}

/** Get the Monday (00:00) of the week containing a given date. */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Format a date as DD/MM/YYYY. */
function formatDDMMYYYY(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

/** Format time as HH:MM. */
function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

/** Parse duration from activity description, e.g. "Durée: 45s" or "en 2min". */
function parseDuration(desc: string): string {
  const match = desc.match(/(\d+)\s*(?:min|s|sec)/i)
  if (match) return match[0]
  return "N/A"
}

/** Parse source names from activity description. */
function parseSourceNames(desc: string): string[] {
  const regex = /([A-Za-zÀ-ÿ][\w.-]*)\s*\(\d+\)/g
  const sources: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(desc)) !== null) {
    sources.push(match[1])
  }
  return sources
}

/** Determine fiability level for a source. */
function getSourceFiability(source: string): { level: "haute" | "moyenne" | "faible"; label: string; bar: string; color: string; badgeVariant: "success" | "warning" | "secondary" } {
  const lower = source.toLowerCase()
  if (lower.includes("rnm") || lower.includes("franceagrimer") || lower.includes("min")) {
    return { level: "haute", label: "Haute", bar: "\u2588\u2588", color: "text-green-600 dark:text-green-400", badgeVariant: "success" }
  }
  if (lower.includes("metro") || lower.includes("promocash") || lower.includes("transgourmet") || lower.includes("brake")) {
    return { level: "moyenne", label: "Moyenne", bar: "\u2588\u2592", color: "text-amber-600 dark:text-amber-400", badgeVariant: "warning" }
  }
  return { level: "faible", label: "Faible", bar: "\u2592\u2592", color: "text-muted-foreground", badgeVariant: "secondary" }
}

/** Compute savings percentage. */
function savingsPct(currentPrice: number, marketPrice: number): number {
  if (currentPrice > 0 && marketPrice > 0) {
    return ((currentPrice - marketPrice) / currentPrice) * 100
  }
  return 0
}

/** Category emoji map. */
const CATEGORY_EMOJI: Record<string, string> = {
  "Bases cuisine": "\uD83E\uDDC8",
  "Boissons": "\uD83C\uDF77",
  "Frais": "\uD83E\uDD6C",
  "Viandes": "\uD83E\uDD69",
  "Surgelés": "\uD83E\uDDCA",
  "Café": "\u2615",
  "Autres": "\uD83D\uDCE6",
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function SourcingReportPage() {
  const params = useParams<{ id: string }>()
  const activityId = params.id

  // State
  const [activity, setActivity] = useState<Activity | null>(null)
  const [finds, setFinds] = useState<SourcingFind[]>([])
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([])
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const pb = getPocketBase()

      // 1. Fetch the activity record
      const act = await pb.collection("activities").getOne<Activity>(activityId)
      setActivity(act)

      // 2. Compute week boundaries from activity.created
      const monday = getMondayOfWeek(new Date(act.created))
      const nextMonday = new Date(monday)
      nextMonday.setDate(nextMonday.getDate() + 7)
      const mondayISO = monday.toISOString().split("T")[0]
      const nextMondayISO = nextMonday.toISOString().split("T")[0]

      // 3. Fetch sourcing_finds for this week
      const findsResult = await pb.collection("sourcing_finds").getList<SourcingFind>(1, 200, {
        filter: `weekOf >= "${mondayISO}" && weekOf < "${nextMondayISO}"`,
        sort: "-potentialSaving",
      })
      setFinds(findsResult.items)

      // 4. Fetch market_prices for this week
      const marketResult = await pb.collection("market_prices").getList<MarketPrice>(1, 500, {
        filter: `scrapedAt >= "${mondayISO}" && scrapedAt < "${nextMondayISO}"`,
        sort: "-scrapedAt",
      })
      setMarketPrices(marketResult.items)

      // 5. Fetch recent price_history for comparison
      const historyResult = await pb.collection("price_history").getList<PriceHistory>(1, 500, {
        sort: "-invoiceDate",
      })
      setPriceHistory(historyResult.items)

      // 6. Fetch products for linking
      const productsResult = await pb.collection("products").getList<Product>(1, 500, {
        sort: "name",
      })
      setProducts(productsResult.items)
    } catch (err) {
      console.error("Failed to fetch sourcing report data:", err)
      setError("Impossible de charger le rapport. Vérifiez que l'ID d'activité est valide.")
      toast.error("Erreur de chargement du rapport")
    } finally {
      setLoading(false)
    }
  }, [activityId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  /** Monday of the report week. */
  const weekMonday = useMemo(() => {
    if (!activity) return null
    return getMondayOfWeek(new Date(activity.created))
  }, [activity])

  /** Sources parsed from description or from market_prices. */
  const sourcesBreakdown = useMemo(() => {
    if (!activity) return []

    // Try description first
    const fromDesc = parseSourceNames(activity.description || "")
    const allSources = new Set<string>()

    // Also gather from market_prices
    for (const mp of marketPrices) {
      if (mp.source) allSources.add(mp.source)
    }

    // Merge both
    for (const s of fromDesc) allSources.add(s)

    // Build breakdown with status
    const sourceWithPrices = new Set(marketPrices.map((mp) => mp.source))
    return Array.from(allSources).map((source) => ({
      source,
      hasData: sourceWithPrices.has(source),
      count: marketPrices.filter((mp) => mp.source === source).length,
    }))
  }, [activity, marketPrices])

  /** Find the product record by productName. */
  function findProductByName(productName: string): Product | undefined {
    const lower = productName.toLowerCase()
    return products.find((p) => p.name.toLowerCase() === lower)
  }

  /** Get latest price from price_history for a product name. */
  function getLatestPrice(productName: string): number | null {
    const lower = productName.toLowerCase()
    const matching = priceHistory.filter((ph) => {
      // Match by productId→product name or by productDescription
      const prod = products.find((p) => p.id === ph.productId)
      const descMatch = (ph.productDescription || "").toLowerCase().includes(lower)
      return (prod && prod.name.toLowerCase() === lower) || descMatch
    })
    if (matching.length === 0) return null
    // Already sorted by -invoiceDate, first is latest
    return matching[0].normalizedUnitPrice || matching[0].unitPrice
  }

  /** Get the best (lowest) market price for a product this week. */
  function getBestMarketPrice(productName: string): { price: number; source: string } | null {
    const lower = productName.toLowerCase()
    const matching = marketPrices.filter((mp) => mp.productName.toLowerCase() === lower)
    if (matching.length === 0) return null
    const best = matching.reduce((min, mp) => (mp.price < min.price ? mp : min), matching[0])
    return { price: best.price, source: best.source }
  }

  /** Priority find (highest savings > 15%). */
  const priorityFind = useMemo(() => {
    const eligible = finds.filter((f) => {
      if (f.currentPrice <= 0) return false
      const pct = ((f.currentPrice - f.indicativePrice) / f.currentPrice) * 100
      return pct > 15
    })
    if (eligible.length === 0) return null
    return eligible.reduce((best, f) => {
      const bestPct = ((best.currentPrice - best.indicativePrice) / best.currentPrice) * 100
      const fPct = ((f.currentPrice - f.indicativePrice) / f.currentPrice) * 100
      return fPct > bestPct ? f : best
    }, eligible[0])
  }, [finds])

  /** Comparatif data grouped by category. */
  const comparatifByCategory = useMemo(() => {
    // Collect all unique product names from market_prices and sourcing_finds
    const productNames = new Set<string>()
    for (const mp of marketPrices) productNames.add(mp.productName)
    for (const f of finds) productNames.add(f.productName)

    // Build rows
    const rows: {
      productName: string
      category: string
      yourPrice: number | null
      marketPrice: number | null
      marketSource: string
      ecartPct: number
      productId: string | null
    }[] = []

    for (const name of productNames) {
      const category = detectCategory(name)
      const yourPrice = getLatestPrice(name)
      const best = getBestMarketPrice(name)
      const marketPrice = best?.price ?? null
      const marketSource = best?.source ?? ""
      const ecart = yourPrice && marketPrice ? savingsPct(yourPrice, marketPrice) : 0
      const prod = findProductByName(name)
      rows.push({
        productName: name,
        category,
        yourPrice,
        marketPrice,
        marketSource,
        ecartPct: ecart,
        productId: prod?.id ?? null,
      })
    }

    // Group by category
    const grouped: Record<string, typeof rows> = {}
    for (const row of rows) {
      if (!grouped[row.category]) grouped[row.category] = []
      grouped[row.category].push(row)
    }

    // Sort rows within each category by ecart descending
    for (const cat of Object.keys(grouped)) {
      grouped[cat].sort((a, b) => b.ecartPct - a.ecartPct)
    }

    // Sort categories: ones with highest max ecart first
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
      const maxA = Math.max(0, ...grouped[a].map((r) => r.ecartPct))
      const maxB = Math.max(0, ...grouped[b].map((r) => r.ecartPct))
      return maxB - maxA
    })

    return { grouped, sortedCategories }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finds, marketPrices, priceHistory, products])

  /** Action plan grouped by priority tiers. */
  const actionPlan = useMemo(() => {
    const tier1: SourcingFind[] = [] // > 20%
    const tier2: SourcingFind[] = [] // 10-20%
    const tier3: SourcingFind[] = [] // 5-10%

    for (const f of finds) {
      if (f.currentPrice <= 0) continue
      const pct = ((f.currentPrice - f.indicativePrice) / f.currentPrice) * 100
      if (pct > 20) tier1.push(f)
      else if (pct > 10) tier2.push(f)
      else if (pct > 5) tier3.push(f)
    }

    // Sort each tier by savings descending
    const sortBySavings = (a: SourcingFind, b: SourcingFind) =>
      b.potentialSaving - a.potentialSaving
    tier1.sort(sortBySavings)
    tier2.sort(sortBySavings)
    tier3.sort(sortBySavings)

    return { tier1, tier2, tier3 }
  }, [finds])

  /** Total monthly saving estimate for action plan. */
  const totalMonthlySaving = useMemo(() => {
    return [...actionPlan.tier1, ...actionPlan.tier2, ...actionPlan.tier3].reduce(
      (sum, f) => sum + (f.potentialSaving || 0) * 30,
      0,
    )
  }, [actionPlan])

  // -------------------------------------------------------------------------
  // Loading / Error states
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="space-y-6 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-96" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </TooltipProvider>
    )
  }

  if (error || !activity) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <Link
          href="/sourcing"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Radar Sourcing
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <AlertTriangle className="size-10 mb-3 opacity-30" />
            <p className="font-medium">{error || "Rapport introuvable"}</p>
            <p className="text-sm mt-1">
              L'activité demandée n'existe pas ou a été supprimée.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const weekLabel = weekMonday ? formatDDMMYYYY(weekMonday) : "N/A"

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* ================================================================= */}
        {/* SECTION 1 — RÉSUMÉ DE L'AGENT                                     */}
        {/* ================================================================= */}
        <div className="space-y-4">
          <Link
            href="/sourcing"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Radar Sourcing
          </Link>

          <PageHeader
            title={`RAPPORT VEILLE — Semaine du ${weekLabel}`}
          />

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="rounded-full p-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <Bot className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm">
                    Agent Sourcing{" "}
                    <span className="text-muted-foreground font-normal">
                      {" · "}
                      {formatDate(activity.created)} {"à"} {formatTime(activity.created)}
                      {" · "}
                      {"Durée : "}{parseDuration(activity.description || "")}
                    </span>
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {/* Description */}
              {activity.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {activity.description}
                </p>
              )}

              {/* Sources breakdown */}
              {sourcesBreakdown.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Sources interrogées
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sourcesBreakdown.map((s) => (
                      <span
                        key={s.source}
                        className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md bg-muted"
                      >
                        <span>{s.hasData ? "\u2705" : "\u2B1C"}</span>
                        <span className="font-medium">{s.source}</span>
                        {s.count > 0 && (
                          <span className="text-muted-foreground text-xs">({s.count})</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ================================================================= */}
        {/* SECTION 2 — ALERTE PRIORITAIRE                                    */}
        {/* ================================================================= */}
        {priorityFind && (() => {
          const pct = ((priorityFind.currentPrice - priorityFind.indicativePrice) / priorityFind.currentPrice) * 100
          const monthlySaving = (priorityFind.potentialSaving || 0) * 30
          const fiability = getSourceFiability(priorityFind.source || "")
          const product = findProductByName(priorityFind.productName)

          return (
            <Card className="border-red-200 dark:border-red-800/50" style={{ borderLeft: "4px solid #EF4444" }}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-red-500" />
                  <CardTitle className="text-base text-red-600 dark:text-red-400">
                    Alerte prioritaire
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3 flex-1">
                    {/* Product */}
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {CATEGORY_EMOJI[detectCategory(priorityFind.productName)] || "\uD83D\uDCE6"}
                      </span>
                      <span className="text-lg font-semibold">{priorityFind.productName}</span>
                    </div>

                    {/* Price comparison */}
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground line-through">
                        {formatCurrency(priorityFind.currentPrice)}/{priorityFind.unit}
                      </span>
                      <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(priorityFind.indicativePrice)}/{priorityFind.unit}
                      </span>
                    </div>

                    {/* Savings */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="destructive" className="text-sm">
                        -{pct.toFixed(0)}%
                      </Badge>
                      {monthlySaving > 0 && (
                        <span className="text-sm text-muted-foreground">
                          ~{formatCurrency(monthlySaving)}/mois d'économie
                        </span>
                      )}
                    </div>

                    {/* Source + fiability */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {priorityFind.source && (
                        <Badge variant="outline" className="text-xs">
                          {priorityFind.source}
                        </Badge>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`text-xs font-medium ${fiability.color}`}>
                            {fiability.bar} {fiability.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Fiabilité de la source : {fiability.label}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap pt-2">
                  <Button size="sm">
                    <Phone className="size-3.5" />
                    Contacter fournisseur
                  </Button>
                  {product && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/products/${product.id}`}>
                        Voir fiche produit
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })()}

        {/* ================================================================= */}
        {/* SECTION 3 — COMPARATIF DÉTAILLÉ                                   */}
        {/* ================================================================= */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Comparatif détaillé</h2>

          {comparatifByCategory.sortedCategories.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <FileText className="size-10 mb-3 opacity-30" />
                <p className="font-medium">Aucune donnée de comparaison</p>
                <p className="text-sm mt-1">
                  Pas de prix marché ou de référence pour cette semaine.
                </p>
              </CardContent>
            </Card>
          ) : (
            comparatifByCategory.sortedCategories.map((category) => {
              const rows = comparatifByCategory.grouped[category]
              const emoji = CATEGORY_EMOJI[category] || "\uD83D\uDCE6"

              return (
                <Card key={category}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span>{emoji}</span>
                      {category}
                      <Badge variant="secondary" className="text-xs ml-1">
                        {rows.length} produit{rows.length > 1 ? "s" : ""}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produit</TableHead>
                            <TableHead className="text-right">Ton prix</TableHead>
                            <TableHead className="text-right">Marché</TableHead>
                            <TableHead className="w-[180px]">Écart %</TableHead>
                            <TableHead>Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => {
                            const fiability = row.marketSource
                              ? getSourceFiability(row.marketSource)
                              : null
                            const barWidth = Math.min(row.ecartPct, 25)
                            const barColor =
                              row.ecartPct > 20
                                ? "bg-red-500"
                                : row.ecartPct > 10
                                  ? "bg-amber-500"
                                  : row.ecartPct > 0
                                    ? "bg-green-500"
                                    : "bg-muted"

                            return (
                              <TableRow key={row.productName}>
                                {/* Produit */}
                                <TableCell className="font-medium">
                                  {row.productId ? (
                                    <Link
                                      href={`/products/${row.productId}`}
                                      className="hover:underline text-primary"
                                    >
                                      {row.productName}
                                    </Link>
                                  ) : (
                                    row.productName
                                  )}
                                </TableCell>

                                {/* Ton prix */}
                                <TableCell className="text-right tabular-nums">
                                  {row.yourPrice !== null ? formatCurrency(row.yourPrice) : (
                                    <span className="text-muted-foreground">--</span>
                                  )}
                                </TableCell>

                                {/* Marché */}
                                <TableCell className="text-right tabular-nums">
                                  {row.marketPrice !== null ? (
                                    <span className={row.ecartPct > 10 ? "font-semibold text-green-600 dark:text-green-400" : ""}>
                                      {formatCurrency(row.marketPrice)}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">--</span>
                                  )}
                                </TableCell>

                                {/* Écart % with progress bar */}
                                <TableCell>
                                  {row.ecartPct > 0 ? (
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[100px]">
                                        <div
                                          className={`h-full rounded-full transition-all ${barColor}`}
                                          style={{ width: `${(barWidth / 25) * 100}%` }}
                                        />
                                      </div>
                                      <span
                                        className={`text-sm tabular-nums font-medium whitespace-nowrap ${
                                          row.ecartPct > 20
                                            ? "text-red-600 dark:text-red-400"
                                            : row.ecartPct > 10
                                              ? "text-amber-600 dark:text-amber-400"
                                              : "text-green-600 dark:text-green-400"
                                        }`}
                                      >
                                        -{row.ecartPct.toFixed(1)}%
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">--</span>
                                  )}
                                </TableCell>

                                {/* Source + fiability */}
                                <TableCell>
                                  {row.marketSource && fiability ? (
                                    <div className="flex items-center gap-1.5">
                                      <Badge variant="outline" className="text-xs">
                                        {row.marketSource}
                                      </Badge>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className={`text-xs ${fiability.color}`}>
                                            {fiability.bar}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Fiabilité : {fiability.label}
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">--</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* ================================================================= */}
        {/* SECTION 4 — PLAN D'ACTION                                         */}
        {/* ================================================================= */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Plan d'action</h2>
            {totalMonthlySaving > 0 && (
              <Badge variant="success" className="text-xs">
                Économie estimée : {formatCurrency(totalMonthlySaving)}/mois
              </Badge>
            )}
          </div>

          {actionPlan.tier1.length === 0 && actionPlan.tier2.length === 0 && actionPlan.tier3.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <CheckSquare className="size-10 mb-3 opacity-30" />
                <p className="font-medium">Aucune action recommandée</p>
                <p className="text-sm mt-1">
                  Les écarts de prix cette semaine sont trop faibles pour justifier une action.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="space-y-6 pt-2">
                {/* Tier 1: > 20% */}
                {actionPlan.tier1.length > 0 && (
                  <ActionTier
                    number={1}
                    label="Renégocier ou resourcer"
                    badge="destructive"
                    icon={<ShieldAlert className="size-4" />}
                    finds={actionPlan.tier1}
                    products={products}
                  />
                )}

                {/* Tier 2: 10-20% */}
                {actionPlan.tier2.length > 0 && (
                  <ActionTier
                    number={actionPlan.tier1.length > 0 ? 2 : 1}
                    label="Bases à fort volume"
                    badge="warning"
                    icon={<ShieldCheck className="size-4" />}
                    finds={actionPlan.tier2}
                    products={products}
                  />
                )}

                {/* Tier 3: 5-10% */}
                {actionPlan.tier3.length > 0 && (
                  <ActionTier
                    number={
                      (actionPlan.tier1.length > 0 ? 1 : 0) +
                      (actionPlan.tier2.length > 0 ? 1 : 0) +
                      1
                    }
                    label="Second temps"
                    badge="secondary"
                    icon={<Shield className="size-4" />}
                    finds={actionPlan.tier3}
                    products={products}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Placeholder buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" disabled>
                  <CheckSquare className="size-3.5" />
                  Valider ce plan
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bientôt disponible</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" disabled>
                  <Send className="size-3.5" />
                  Telegram
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bientôt disponible</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" disabled>
                  <Download className="size-3.5" />
                  Export PDF
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bientôt disponible</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

// ---------------------------------------------------------------------------
// ActionTier sub-component
// ---------------------------------------------------------------------------

function ActionTier({
  number,
  label,
  badge,
  icon,
  finds,
  products,
}: {
  number: number
  label: string
  badge: "destructive" | "warning" | "secondary"
  icon: React.ReactNode
  finds: SourcingFind[]
  products: Product[]
}) {
  const tierMonthlySaving = finds.reduce((sum, f) => sum + (f.potentialSaving || 0) * 30, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center justify-center size-6 rounded-full bg-muted text-xs font-bold">
          {number}
        </span>
        <Badge variant={badge} className="text-xs gap-1">
          {icon}
          {label}
        </Badge>
        {tierMonthlySaving > 0 && (
          <span className="text-xs text-muted-foreground">
            ~{formatCurrency(tierMonthlySaving)}/mois
          </span>
        )}
      </div>
      <div className="space-y-2 pl-8">
        {finds.map((f) => {
          const pct = f.currentPrice > 0
            ? ((f.currentPrice - f.indicativePrice) / f.currentPrice) * 100
            : 0
          const fiability = getSourceFiability(f.source || "")
          const product = products.find((p) => p.name.toLowerCase() === f.productName.toLowerCase())
          const monthlySaving = (f.potentialSaving || 0) * 30

          return (
            <div
              key={f.id}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between py-2 border-b last:border-0"
            >
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-sm">
                  {CATEGORY_EMOJI[detectCategory(f.productName)] || "\uD83D\uDCE6"}
                </span>
                {product ? (
                  <Link
                    href={`/products/${product.id}`}
                    className="text-sm font-medium hover:underline text-primary truncate"
                  >
                    {f.productName}
                  </Link>
                ) : (
                  <span className="text-sm font-medium truncate">{f.productName}</span>
                )}
                {pct > 0 && (
                  <span className={`text-xs font-semibold tabular-nums ${
                    pct > 20 ? "text-red-600 dark:text-red-400" : pct > 10 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                  }`}>
                    -{pct.toFixed(0)}%
                  </span>
                )}
                {f.source && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`text-xs ${fiability.color}`}>
                        {fiability.bar}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {f.source} — Fiabilité : {fiability.label}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground sm:shrink-0">
                {monthlySaving > 0 && (
                  <span className="tabular-nums">~{formatCurrency(monthlySaving)}/mois</span>
                )}
                <span className="tabular-nums">
                  {formatCurrency(f.currentPrice)} {"\u2192"} {formatCurrency(f.indicativePrice)}/{f.unit}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
