"use client"

import { useState, useEffect } from "react"
import { getPocketBase } from "@/lib/pocketbase"
import type { Supplier } from "@/lib/types"

export function useSuppliers(search?: string) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSuppliers() {
      setLoading(true)
      setError(null)
      try {
        const pb = getPocketBase()
        const filters: string[] = []
        if (search) filters.push(`name ~ "${search}"`)

        const result = await pb.collection("suppliers").getList<Supplier>(1, 100, {
          filter: filters.join(" && ") || undefined,
          sort: "name",
        })
        console.log("[useSuppliers] result:", result.totalItems, "items:", result.items?.length)
        setSuppliers(result.items)
      } catch (err) {
        console.error("[useSuppliers] error:", err)
        setError(err instanceof Error ? err.message : "Erreur")
      } finally {
        setLoading(false)
      }
    }
    fetchSuppliers()
  }, [search])

  return { suppliers, loading, error }
}

export function useSupplier(id: string) {
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    async function fetchSupplier() {
      setLoading(true)
      try {
        const pb = getPocketBase()
        const result = await pb.collection("suppliers").getOne<Supplier>(id)
        setSupplier(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur")
      } finally {
        setLoading(false)
      }
    }
    fetchSupplier()
  }, [id])

  return { supplier, loading, error }
}
