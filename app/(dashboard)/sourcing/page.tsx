"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { getPocketBase } from "@/lib/pocketbase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { Radar, TrendingDown, Euro, ChevronDown } from "lucide-react"
import type { SourcingFind } from "@/lib/types"

const statusConfig = {
  new: { label: "Nouveau", variant: "info" as const },
  interesting: { label: "Intéressant", variant: "success" as const },
  contacted: { label: "Contacté", variant: "warning" as const },
  dismissed: { label: "Écarté", variant: "secondary" as const },
}

export default function SourcingPage() {
  const [finds, setFinds] = useState<SourcingFind[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("new")

  const fetchFinds = useCallback(async () => {
    setLoading(true)
    try {
      const pb = getPocketBase()
      const filters: string[] = []
      if (statusFilter && statusFilter !== "all") filters.push(`status = "${statusFilter}"`)
      const result = await pb.collection("sourcing_finds").getList<SourcingFind>(1, 50, {
        filter: filters.join(" && ") || undefined,
        sort: "-weekOf,-created",
      })
      setFinds(result.items)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchFinds() }, [fetchFinds])

  async function updateStatus(id: string, status: string) {
    try {
      const pb = getPocketBase()
      await pb.collection("sourcing_finds").update(id, { status })
      toast.success("Statut mis à jour")
      fetchFinds()
    } catch {
      toast.error("Erreur")
    }
  }

  const totalSaving = finds.reduce((sum, f) => sum + (f.potentialSaving || 0), 0)

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      <PageHeader
        title="Radar Sourcing"
        description="Opportunités d'achat identifiées par l'agent chaque lundi"
        sticky
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingDown className="size-4 text-green-500" />
          <span>Économies potentielles : <strong className="text-foreground">{formatCurrency(totalSaving)}</strong></span>
        </div>
      </PageHeader>

      <Card>
        <CardContent className="pt-4 pb-4">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="new">Nouveaux</SelectItem>
              <SelectItem value="interesting">Intéressants</SelectItem>
              <SelectItem value="contacted">Contactés</SelectItem>
              <SelectItem value="dismissed">Écartés</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)
        ) : finds.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Radar className="size-10 mb-3 opacity-30" />
                <p className="font-medium">Aucune opportunité pour ce filtre</p>
                <p className="text-sm mt-1">L'agent sourcing tourne chaque lundi matin et alimente ce tableau automatiquement.</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          finds.map((find) => {
            const st = statusConfig[find.status] || statusConfig.new
            const savingPct = find.currentPrice > 0
              ? ((find.currentPrice - find.indicativePrice) / find.currentPrice * 100)
              : 0
            return (
              <Card key={find.id} className="flex flex-col gap-3 py-4">
                <CardHeader className="px-4 pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{find.title}</CardTitle>
                    <Badge variant={st.variant} className="shrink-0">{st.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 flex-1 flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">{find.description}</p>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted/50 rounded-md p-2">
                      <p className="text-xs text-muted-foreground">Prix actuel</p>
                      <p className="font-semibold">{find.currentPrice ? formatCurrency(find.currentPrice) : "—"}<span className="text-xs font-normal text-muted-foreground">/{find.unit}</span></p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-md p-2">
                      <p className="text-xs text-muted-foreground">Prix trouvé</p>
                      <p className="font-semibold text-green-700 dark:text-green-400">{find.indicativePrice ? formatCurrency(find.indicativePrice) : "—"}<span className="text-xs font-normal text-muted-foreground">/{find.unit}</span></p>
                    </div>
                  </div>

                  {savingPct > 0 && (
                    <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 font-medium">
                      <TrendingDown className="size-4" />
                      <span>-{savingPct.toFixed(0)}% · Économie {formatCurrency(find.potentialSaving || 0)}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {find.category && <Badge variant="outline" className="text-[10px]">{find.category}</Badge>}
                    {find.weekOf && <span>{formatDate(find.weekOf)}</span>}
                  </div>

                  <div className="flex gap-2 mt-auto pt-2">
                    {find.status === "new" && (
                      <Button size="sm" variant="outline" className="flex-1 text-green-600 border-green-200" onClick={() => updateStatus(find.id, "interesting")}>
                        Intéressant
                      </Button>
                    )}
                    {(find.status === "new" || find.status === "interesting") && (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => updateStatus(find.id, "contacted")}>
                        Contacté
                      </Button>
                    )}
                    {find.status !== "dismissed" && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => updateStatus(find.id, "dismissed")}>
                        Écarter
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
