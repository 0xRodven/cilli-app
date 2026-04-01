"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppHeader } from "@/components/layout/app-header"
import { getPocketBase } from "@/lib/pocketbase"
import { DateFilterProvider } from "@/contexts/date-filter-context"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const pb = getPocketBase()
    if (!pb.authStore.isValid) {
      router.push("/login")
    } else {
      setAuthChecked(true)
    }
  }, [router])

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="size-6 border-2 border-primary border-r-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Suspense>
            <DateFilterProvider>
              {children}
            </DateFilterProvider>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
