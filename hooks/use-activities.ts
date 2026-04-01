"use client"

import { useState, useEffect } from "react"
import { getPocketBase } from "@/lib/pocketbase"
import type { Activity } from "@/lib/types"

export function useActivities(limit = 10) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchActivities() {
      try {
        const pb = getPocketBase()
        const result = await pb.collection("activities").getList<Activity>(1, limit, {
          sort: "-created",
        })
        setActivities(result.items)
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }
    fetchActivities()
  }, [limit])

  return { activities, loading }
}
