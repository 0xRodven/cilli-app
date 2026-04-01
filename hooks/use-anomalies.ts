"use client"

import { useState, useEffect, useCallback } from "react"
import { getPocketBase } from "@/lib/pocketbase"
import type { Anomaly } from "@/lib/types"
import { toast } from "sonner"

interface UseAnomaliesOptions {
  status?: string
  severity?: string
  limit?: number
}

export function useAnomalies(options: UseAnomaliesOptions = {}) {
  const { status, severity, limit } = options
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnomalies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const pb = getPocketBase()
      const filters: string[] = []
      if (status) filters.push(`status = "${status}"`)
      if (severity) filters.push(`severity = "${severity}"`)

      const result = await pb.collection("anomalies").getList<Anomaly>(1, limit || 50, {
        filter: filters.join(" && ") || undefined,
        sort: "-created",
        // No expand — anomalies collection has no relation fields (supplierName is a text field)
      })
      setAnomalies(result.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [status, severity, limit])

  useEffect(() => {
    fetchAnomalies()
  }, [fetchAnomalies])

  const resolveAnomaly = useCallback(
    async (id: string) => {
      try {
        const pb = getPocketBase()
        await pb.collection("anomalies").update(id, { status: "resolved" })
        toast.success("Anomalie résolue")
        fetchAnomalies()
      } catch {
        toast.error("Erreur lors de la résolution")
      }
    },
    [fetchAnomalies]
  )

  const dismissAnomaly = useCallback(
    async (id: string) => {
      try {
        const pb = getPocketBase()
        await pb.collection("anomalies").update(id, { status: "dismissed" })
        toast.success("Anomalie écartée")
        fetchAnomalies()
      } catch {
        toast.error("Erreur lors de l'action")
      }
    },
    [fetchAnomalies]
  )

  return { anomalies, loading, error, resolveAnomaly, dismissAnomaly, refetch: fetchAnomalies }
}

export function useAnomalyCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    async function fetchCount() {
      try {
        const pb = getPocketBase()
        const result = await pb.collection("anomalies").getList(1, 1, { filter: 'status = "new"' })
        if (!cancelled) setCount(result.totalItems)
      } catch {
        /* silent */
      }
    }
    fetchCount()
    return () => { cancelled = true }
  }, [])
  return count
}
