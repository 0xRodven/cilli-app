"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getPocketBase } from "@/lib/pocketbase"
import { SourceLink } from "@/components/dashboard/source-link"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Search, TrendingUp } from "lucide-react"
import type { MarketPrice } from "@/lib/types"

export default function MarketPricesPage() {
  const [prices, setPrices] = useState<MarketPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    async function fetchPrices() {
      setLoading(true)
      try {
        const pb = getPocketBase()
        const filters: string[] = []
        if (search) filters.push(`productName ~ "${search}"`)
        const result = await pb.collection("market_prices").getList<MarketPrice>(1, 100, {
          filter: filters.join(" && ") || undefined,
          sort: "-scrapedAt,productName",
        })
        setPrices(result.items)
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }
    fetchPrices()
  }, [search])

  return (
    <div className="space-y-4 max-w-[1000px] mx-auto">
      <PageHeader
        title="Prix marché"
        description="Relevés de prix collectés par l'agent sourcing"
        sticky
      />

      {prices.length === 0 && !loading && !search && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <TrendingUp className="size-10 mb-3 opacity-30" />
            <p className="font-medium">Aucun prix marché enregistré</p>
            <p className="text-sm mt-1 max-w-sm">
              L'agent sourcing (cron lundi 10h) scrape les prix et les enregistre ici automatiquement.
            </p>
          </CardContent>
        </Card>
      )}

      {(prices.length > 0 || search) && (
        <>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Rechercher un produit..."
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
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Prix marché</TableHead>
                    <TableHead>Unité</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Relevé le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : prices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun prix trouvé</TableCell>
                    </TableRow>
                  ) : (
                    prices.map((price) => (
                      <TableRow key={price.id}>
                        <TableCell className="font-medium">{price.productName}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(price.price)}</TableCell>
                        <TableCell className="text-muted-foreground">{price.unit || "—"}</TableCell>
                        <TableCell>
                          <SourceLink source={price.source} sourceUrl={price.sourceUrl} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{price.scrapedAt ? formatDate(price.scrapedAt) : "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
