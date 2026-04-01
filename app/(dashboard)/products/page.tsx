"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getPocketBase } from "@/lib/pocketbase"
import Link from "next/link"
import { Search, Package } from "lucide-react"
import type { Product } from "@/lib/types"

export default function ProductsPage() {
  const [search, setSearch] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      try {
        const pb = getPocketBase()
        const filters: string[] = []
        if (search) filters.push(`name ~ "${search}" || code ~ "${search}"`)
        const result = await pb.collection("products").getList<Product>(1, 100, {
          filter: filters.join(" && ") || undefined,
          sort: "name",
        })
        setProducts(result.items)
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [search])

  return (
    <div className="space-y-4">
      <PageHeader title="Produits" description={`${products.length} produit${products.length !== 1 ? "s" : ""}`} sticky />

      {products.length === 0 && !loading && !search && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Package className="size-10 mb-3" />
            <p className="font-medium">Catalogue vide</p>
            <p className="text-sm mt-1 max-w-sm">
              Le catalogue produits se rempli automatiquement au fil des factures traitées par OCR.
              Importez vos premières factures pour commencer.
            </p>
          </CardContent>
        </Card>
      )}

      {(products.length > 0 || search) && (
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
                    <TableHead>Nom</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Unité</TableHead>
                    <TableHead>Origine</TableHead>
                    <TableHead>Prix volatil</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Aucun produit trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product: Product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">
                          <Link href={`/products/${product.id}`} className="hover:underline text-primary">
                            {product.name}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{product.code || "—"}</TableCell>
                        <TableCell>{product.category || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{product.unit || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{product.origin || "—"}</TableCell>
                        <TableCell>
                          {product.isVolatile ? (
                            <Badge variant="warning">Volatil</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
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
