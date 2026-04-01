"use client"

import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getPocketBase } from "@/lib/pocketbase"
import { toast } from "sonner"
import { LogOut, Info } from "lucide-react"

export default function SettingsPage() {
  const router = useRouter()

  function handleLogout() {
    const pb = getPocketBase()
    pb.authStore.clear()
    toast.success("Déconnexion réussie")
    router.push("/login")
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader title="Paramètres" description="Configuration du tableau de bord" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="size-4" />
            À propos
          </CardTitle>
          <CardDescription>Informations sur le système</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span>1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Backend</span>
            <span>PocketBase</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">URL PocketBase</span>
            <span className="font-mono text-xs">{process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://localhost:8090"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <LogOut className="size-4" />
            Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleLogout}>
            <LogOut className="size-4 mr-2" />
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
