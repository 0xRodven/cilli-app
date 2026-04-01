"use client"

import { useState, useEffect } from "react"
import { getPocketBase } from "@/lib/pocketbase"
import type { Invoice } from "@/lib/types"

interface UseInvoicesOptions {
  page?: number
  perPage?: number
  status?: string
  supplierId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export function useInvoices(options: UseInvoicesOptions = {}) {
  const { page = 1, perPage = 20, status, supplierId, dateFrom, dateTo, search } = options
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchInvoices() {
      setLoading(true)
      setError(null)
      try {
        const pb = getPocketBase()
        const filters: string[] = []
        if (status) filters.push(`status = "${status}"`)
        if (supplierId) filters.push(`supplierId = "${supplierId}"`)
        if (dateFrom) filters.push(`invoiceDate >= "${dateFrom}"`)
        if (dateTo) filters.push(`invoiceDate <= "${dateTo}"`)
        if (search) filters.push(`(invoiceNumber ~ "${search}" || supplierName ~ "${search}")`)

        const result = await pb.collection("invoices").getList<Invoice>(page, perPage, {
          filter: filters.join(" && ") || undefined,
          sort: "-invoiceDate",
        })
        if (!cancelled) {
          setInvoices(result.items)
          setTotal(result.totalItems)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur de chargement")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchInvoices()
    return () => { cancelled = true }
  }, [page, perPage, status, supplierId, dateFrom, dateTo, search])

  return { invoices, total, loading, error }
}

export function useInvoice(id: string) {
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    async function fetchInvoice() {
      setLoading(true)
      try {
        const pb = getPocketBase()
        const result = await pb.collection("invoices").getOne<Invoice>(id, { expand: "supplier" })
        setInvoice(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur")
      } finally {
        setLoading(false)
      }
    }
    fetchInvoice()
  }, [id])

  return { invoice, loading, error }
}
