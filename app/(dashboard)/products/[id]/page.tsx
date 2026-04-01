"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getPocketBase } from "@/lib/pocketbase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { CHART_COLORS } from "@/lib/chart-colors"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import {
  ArrowLeft,
  Package,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  BarChart3,
} from "lucide-react"
import type { Product, PriceHistory, Anomaly, SupplierProduct } from "@/lib/types"

// --- French month names ---
const MONTH_NAMES_FR = [
  "Jan", "Fev", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Aou", "Sep", "Oct", "Nov", "Dec",
]

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return `${MONTH_NAMES_FR[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)

// --- Supplier reference row ---
interface SupplierRef {
  name: string
  lastPrice: number
  avgPrice: number
  orderCount: number
  lastOrderDate: string
}

// --- Types for chart data ---
interface PriceChartPoint {
  month: string
  monthKey: string
  [supplierName: string]: string | number
}

interface VolumeChartPoint {
  month: string
  monthKey: string
  [supplierName: string]: string | number
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>()
  const productId = params.id

  const [product, setProduct] = useState<Product | null>(null)
  const [history, setHistory] = useState<PriceHistory[]>([])
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([])
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const pb = getPocketBase()

        // Fetch the product
        const prod = await pb.collection("products").getOne<Product>(productId)
        setProduct(prod)

        // Fetch price history for this product (by product relation or name match)
        const histResult = await pb.collection("price_history").getList<PriceHistory>(1, 500, {
          filter: `product="${productId}"`,
          sort: "-date",
        })
        setHistory(histResult.items)

        // Fetch supplier_products for this product
        try {
          const spResult = await pb.collection("supplier_products").getList<SupplierProduct>(1, 50, {
            filter: `product="${productId}"`,
            sort: "-lastOrderDate",
          })
          setSupplierProducts(spResult.items)
        } catch {
          // collection may not exist, ignore
        }

        // Fetch related anomalies
        try {
          const anomResult = await pb.collection("anomalies").getList<Anomaly>(1, 20, {
            filter: `product="${productId}" || description~"${prod.name}"`,
            sort: "-created",
          })
          setAnomalies(anomResult.items)
        } catch {
          // ignore if no matching anomalies
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de chargement")
      } finally {
        setLoading(false)
      }
    }
    if (productId) fetchData()
  }, [productId])

  // Build supplier reference table from history or supplier_products
  const supplierRefs = useMemo((): SupplierRef[] => {
    // Prefer supplier_products if available
    if (supplierProducts.length > 0) {
      return supplierProducts.map((sp) => ({
        name: sp.supplier || "—",
        lastPrice: sp.lastPrice,
        avgPrice: sp.avgPrice,
        orderCount: sp.orderCount,
        lastOrderDate: sp.lastOrderDate,
      }))
    }

    // Fallback: compute from price history
    const map = new Map<string, { prices: number[]; count: number; lastDate: string; lastPrice: number }>()
    for (const h of history) {
      const name = h.supplierName || "Inconnu"
      const entry = map.get(name) || { prices: [], count: 0, lastDate: "", lastPrice: 0 }
      entry.prices.push(h.price)
      entry.count++
      if (!entry.lastDate || h.date > entry.lastDate) {
        entry.lastDate = h.date
        entry.lastPrice = h.price
      }
      map.set(name, entry)
    }

    return Array.from(map.entries())
      .map(([name, d]) => ({
        name,
        lastPrice: d.lastPrice,
        avgPrice: d.prices.reduce((a, b) => a + b, 0) / d.prices.length,
        orderCount: d.count,
        lastOrderDate: d.lastDate,
      }))
      .sort((a, b) => (b.lastOrderDate > a.lastOrderDate ? 1 : -1))
  }, [history, supplierProducts])

  // Unique supplier names for colors
  const supplierNames = useMemo(() => {
    const names = new Set<string>()
    for (const h of history) {
      names.add(h.supplierName || "Inconnu")
    }
    return Array.from(names)
  }, [history])

  const supplierColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    supplierNames.forEach((name, i) => {
      map[name] = CHART_COLORS.suppliers[i % CHART_COLORS.suppliers.length]
    })
    return map
  }, [supplierNames])

  // Build 12-month price chart data
  const priceChartData = useMemo((): PriceChartPoint[] => {
    if (history.length === 0) return []

    // Generate last 12 months
    const now = new Date()
    const months: { key: string; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${MONTH_NAMES_FR[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`,
      })
    }

    // Group history by month+supplier, take average price per month
    const grouped = new Map<string, Map<string, number[]>>()
    for (const h of history) {
      const mk = monthKey(h.date)
      const supplier = h.supplierName || "Inconnu"
      if (!grouped.has(mk)) grouped.set(mk, new Map())
      const supplierMap = grouped.get(mk)!
      if (!supplierMap.has(supplier)) supplierMap.set(supplier, [])
      supplierMap.get(supplier)!.push(h.price)
    }

    return months.map(({ key, label }) => {
      const point: PriceChartPoint = { month: label, monthKey: key }
      const supplierMap = grouped.get(key)
      if (supplierMap) {
        for (const [supplier, prices] of supplierMap) {
          point[supplier] = Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
        }
      }
      return point
    })
  }, [history])

  // Build 12-month volume chart data
  const volumeChartData = useMemo((): VolumeChartPoint[] => {
    if (history.length === 0) return []

    const now = new Date()
    const months: { key: string; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${MONTH_NAMES_FR[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`,
      })
    }

    const grouped = new Map<string, Map<string, number>>()
    for (const h of history) {
      const mk = monthKey(h.date)
      const supplier = h.supplierName || "Inconnu"
      if (!grouped.has(mk)) grouped.set(mk, new Map())
      const supplierMap = grouped.get(mk)!
      supplierMap.set(supplier, (supplierMap.get(supplier) || 0) + h.quantity)
    }

    return months.map(({ key, label }) => {
      const point: VolumeChartPoint = { month: label, monthKey: key }
      const supplierMap = grouped.get(key)
      if (supplierMap) {
        for (const [supplier, qty] of supplierMap) {
          point[supplier] = Math.round(qty * 100) / 100
        }
      }
      return point
    })
  }, [history])

  // Purchase history (last 20)
  const recentHistory = useMemo(() => history.slice(0, 20), [history])

  // --- Loading state ---
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    )
  }

  // --- Error state ---
  if (error || !product) {
    return (
      <div className="space-y-4">
        <Link href="/products">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="size-4" />
            Retour
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Package className="size-10 mb-3 opacity-30" />
            <p className="font-medium">Produit introuvable</p>
            <p className="text-sm mt-1">{error || "Ce produit n'existe pas ou a ete supprime."}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeAnomalies = anomalies.filter((a) => a.status === "new" || a.status === "reviewing")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Link href="/products">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2">
            <ArrowLeft className="size-4" />
            Retour
          </Button>
        </Link>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
              {product.code && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {product.code}
                </Badge>
              )}
            </div>

            {/* Category breadcrumb */}
            {product.category && (
              <p className="text-sm text-muted-foreground">{product.category}</p>
            )}

            {/* Info chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {product.unit && (
                <Badge variant="outline" className="text-xs">
                  {product.unit}
                </Badge>
              )}
              {product.origin && (
                <Badge variant="outline" className="text-xs">
                  {product.origin}
                </Badge>
              )}
              {product.isVolatile && (
                <Badge variant="warning">Volatil</Badge>
              )}
              {product.tags?.length > 0 && product.tags.map((tag) => (
                <Badge key={tag} variant="info" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex gap-3 text-sm text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{supplierRefs.length}</p>
              <p className="text-xs">Fournisseur{supplierRefs.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{history.length}</p>
              <p className="text-xs">Commande{history.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Anomaly banner */}
      {activeAnomalies.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-amber-50 border border-amber-200 text-amber-700">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            <span className="font-semibold">{activeAnomalies.length} alerte{activeAnomalies.length > 1 ? "s" : ""}</span>
            {" "}active{activeAnomalies.length > 1 ? "s" : ""} sur ce produit
          </span>
          <Link href="/anomalies" className="ml-auto text-xs underline hover:no-underline">
            Voir
          </Link>
        </div>
      )}

      {/* Description */}
      {product.description && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">{product.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Supplier reference table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="size-4" />
            Fournisseurs
          </CardTitle>
          <CardDescription>
            {supplierRefs.length === 0
              ? "Aucun fournisseur enregistre"
              : `${supplierRefs.length} fournisseur${supplierRefs.length !== 1 ? "s" : ""} references`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {supplierRefs.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Aucune donnee fournisseur disponible
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Dernier prix</TableHead>
                  <TableHead className="text-right">Prix moyen</TableHead>
                  <TableHead className="text-right">Nb commandes</TableHead>
                  <TableHead>Derniere commande</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierRefs.map((ref) => (
                  <TableRow key={ref.name}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: supplierColorMap[ref.name] || CHART_COLORS.blue }}
                        />
                        {ref.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatCurrency(ref.lastPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(ref.avgPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {ref.orderCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ref.lastOrderDate ? formatDate(ref.lastOrderDate) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      {history.length > 0 && (
        <Tabs defaultValue="price" className="space-y-4">
          <TabsList>
            <TabsTrigger value="price" className="gap-1.5">
              <TrendingUp className="size-3.5" />
              Prix
            </TabsTrigger>
            <TabsTrigger value="volume" className="gap-1.5">
              <BarChart3 className="size-3.5" />
              Volumes
            </TabsTrigger>
          </TabsList>

          {/* Price evolution chart */}
          <TabsContent value="price">
            <Card>
              <CardHeader>
                <CardTitle>Evolution des prix</CardTitle>
                <CardDescription>Prix unitaire moyen par mois - 12 derniers mois</CardDescription>
              </CardHeader>
              <CardContent>
                {priceChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
                    Aucune donnee disponible
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={priceChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => fmtEur(v)}
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={80}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [fmtEur(value), name]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
                        labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                      />
                      {supplierNames.length > 1 && (
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      )}
                      {supplierNames.map((name) => (
                        <Line
                          key={name}
                          type="monotone"
                          dataKey={name}
                          stroke={supplierColorMap[name]}
                          strokeWidth={2}
                          dot={{ r: 3, fill: supplierColorMap[name] }}
                          activeDot={{ r: 5 }}
                          connectNulls={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Volume chart */}
          <TabsContent value="volume">
            <Card>
              <CardHeader>
                <CardTitle>Volumes commandes</CardTitle>
                <CardDescription>
                  Quantite achetee par mois{product.unit ? ` (${product.unit})` : ""} - 12 derniers mois
                </CardDescription>
              </CardHeader>
              <CardContent>
                {volumeChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
                    Aucune donnee disponible
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={volumeChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${value} ${product.unit || ""}`,
                          name,
                        ]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
                        labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                      />
                      {supplierNames.length > 1 && (
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      )}
                      {supplierNames.map((name) => (
                        <Bar
                          key={name}
                          dataKey={name}
                          fill={supplierColorMap[name]}
                          stackId="volume"
                          radius={supplierNames.indexOf(name) === supplierNames.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Purchase history table */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des achats</CardTitle>
          <CardDescription>
            {history.length === 0
              ? "Aucun achat enregistre"
              : history.length <= 20
                ? `${history.length} achat${history.length !== 1 ? "s" : ""}`
                : `20 derniers achats sur ${history.length}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground px-6">
              <ShoppingCart className="size-8 mb-2 opacity-30" />
              <p className="text-sm">
                Aucun historique d'achat. Les donnees apparaitront au fil des factures traitees.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Quantite</TableHead>
                  <TableHead className="text-right">Prix unitaire</TableHead>
                  <TableHead className="text-right">Total HT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentHistory.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-muted-foreground">
                      {h.date ? formatDate(h.date) : "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: supplierColorMap[h.supplierName || "Inconnu"] || CHART_COLORS.blue }}
                        />
                        {h.supplierName || "Inconnu"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {h.quantity} {product.unit || ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(h.price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatCurrency(h.price * h.quantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Anomalies section */}
      {anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              Alertes liees
            </CardTitle>
            <CardDescription>
              {anomalies.length} alerte{anomalies.length !== 1 ? "s" : ""} detectee{anomalies.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {anomalies.slice(0, 5).map((anomaly) => {
              const severityVariant =
                anomaly.severity === "high" ? "destructive" as const
                : anomaly.severity === "medium" ? "warning" as const
                : "secondary" as const
              const statusVariant =
                anomaly.status === "new" ? "destructive" as const
                : anomaly.status === "reviewing" ? "warning" as const
                : anomaly.status === "resolved" ? "success" as const
                : "secondary" as const
              const severityLabel =
                anomaly.severity === "high" ? "Haute"
                : anomaly.severity === "medium" ? "Moyenne"
                : "Faible"
              const statusLabel =
                anomaly.status === "new" ? "Nouvelle"
                : anomaly.status === "reviewing" ? "En cours"
                : anomaly.status === "resolved" ? "Resolue"
                : "Ecartee"
              return (
                <div
                  key={anomaly.id}
                  className="flex items-start gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={severityVariant}>{severityLabel}</Badge>
                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(anomaly.created)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">{anomaly.description}</p>
                  </div>
                  {anomaly.percentageChange !== 0 && (
                    <span className={`text-sm font-medium shrink-0 ${anomaly.percentageChange > 0 ? "text-red-600" : "text-green-600"}`}>
                      {anomaly.percentageChange > 0 ? "+" : ""}{anomaly.percentageChange.toFixed(1)}%
                    </span>
                  )}
                </div>
              )
            })}
            {anomalies.length > 5 && (
              <Link href="/anomalies" className="block text-center text-xs text-muted-foreground hover:underline pt-1">
                Voir toutes les alertes
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
