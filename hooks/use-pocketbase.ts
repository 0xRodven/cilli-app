"use client"

import { useState, useEffect, useCallback } from "react"
import { getPocketBase } from "@/lib/pocketbase"
import type PocketBase from "pocketbase"

export function usePocketBase() {
  const [pb, setPb] = useState<PocketBase | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const instance = getPocketBase()
    setPb(instance)
    setIsAuthenticated(instance.authStore.isValid)
  }, [])

  const logout = useCallback(() => {
    const instance = getPocketBase()
    instance.authStore.clear()
    setIsAuthenticated(false)
  }, [])

  return { pb, isAuthenticated, logout }
}
