"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getPocketBase } from "@/lib/pocketbase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { ChefHat } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const pb = getPocketBase()
      await pb.collection("users").authWithPassword(email, password)
      router.push("/overview")
    } catch {
      toast.error("Email ou mot de passe incorrect")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex items-center justify-center rounded-lg w-9 h-9 bg-foreground">
            <ChefHat className="size-4 text-background" />
          </div>
          <div>
            <div className="font-semibold text-base leading-none">Cilli</div>
            <div className="text-[11px] text-muted-foreground leading-none mt-0.5">Restaurant</div>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-foreground">Connexion</h1>
            <p className="text-sm text-muted-foreground mt-1">Accédez à votre tableau de bord</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="madame@cilli.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-9"
              />
            </div>
            <Button type="submit" className="w-full h-9 font-medium mt-2" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-3.5 border-2 border-current border-r-transparent rounded-full animate-spin" />
                  Connexion…
                </span>
              ) : "Se connecter"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Accès réservé au personnel autorisé
        </p>
      </div>
    </div>
  )
}
