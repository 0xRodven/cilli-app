"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import {
  LogOut,
  ChefHat,
  Menu,
  LayoutDashboard,
  Calendar,
  FileText,
  Building2,
  Package,
  AlertTriangle,
  Upload,
  Settings,
  Radar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { getPocketBase } from "@/lib/pocketbase"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const navSections = [
  {
    title: "PILOTAGE",
    items: [
      { title: "Vue d'ensemble", href: "/overview", icon: LayoutDashboard },
      { title: "Ma semaine", href: "/week", icon: Calendar },
    ],
  },
  {
    title: "ACHATS",
    items: [
      { title: "Factures", href: "/invoices", icon: FileText },
      { title: "Fournisseurs", href: "/suppliers", icon: Building2 },
      { title: "Produits", href: "/products", icon: Package, disabled: true },
      { title: "Alertes", href: "/anomalies", icon: AlertTriangle },
    ],
  },
  {
    title: "VEILLE",
    items: [
      { title: "Sourcing", href: "/sourcing", icon: Radar, disabled: true },
    ],
  },
  {
    title: "OUTILS",
    items: [
      { title: "Import", href: "/import", icon: Upload, disabled: true },
      { title: "Paramètres", href: "/settings", icon: Settings, disabled: true },
    ],
  },
]

const pageTitles: Record<string, string> = {
  "/overview": "Vue d'ensemble",
  "/week": "Ma semaine",
  "/invoices": "Factures",
  "/suppliers": "Fournisseurs",
  "/products": "Produits",
  "/anomalies": "Alertes",
  "/sourcing": "Sourcing",
  "/import": "Import",
  "/settings": "Paramètres",
}

export function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Derive page title from pathname
  const pageTitle = Object.entries(pageTitles).find(([path]) =>
    pathname === path || pathname.startsWith(path + "/")
  )?.[1] || "Cilli"

  function handleLogout() {
    const pb = getPocketBase()
    pb.authStore.clear()
    toast.success("Déconnexion réussie")
    router.push("/login")
  }

  return (
    <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-2.5 bg-background/95 backdrop-blur border-b">
      <div className="flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2 h-8 w-8">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0" style={{ backgroundColor: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}>
            <SheetHeader className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
              <SheetTitle className="flex items-center gap-2.5">
                <div
                  className="flex items-center justify-center rounded-lg w-8 h-8"
                  style={{ backgroundColor: "var(--sidebar-primary)" }}
                >
                  <ChefHat className="size-4" style={{ color: "var(--sidebar-primary-foreground)" }} />
                </div>
                <div>
                  <div className="font-bold text-sm leading-none" style={{ color: "var(--sidebar-foreground)" }}>Cilli</div>
                  <div className="text-[11px] leading-none mt-0.5" style={{ color: "oklch(0.94 0 0 / 0.45)" }}>Restaurant</div>
                </div>
              </SheetTitle>
            </SheetHeader>
            <nav className="px-2 py-3 space-y-4 flex-1 overflow-y-auto">
              {navSections.map((section) => (
                <div key={section.title}>
                  <p
                    className="px-2 mb-1.5 text-[10px] font-semibold tracking-widest uppercase"
                    style={{ color: "oklch(0.94 0 0 / 0.40)" }}
                  >
                    {section.title}
                  </p>
                  <ul className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                      const disabled = (item as { disabled?: boolean }).disabled
                      return (
                        <li key={item.href}>
                          <Link
                            href={disabled ? "#" : item.href}
                            onClick={() => !disabled && setOpen(false)}
                            className={cn(
                              "flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors",
                              disabled && "opacity-40 cursor-not-allowed pointer-events-none"
                            )}
                            style={
                              isActive
                                ? { backgroundColor: "var(--sidebar-primary)", color: "var(--sidebar-primary-foreground)" }
                                : { color: "oklch(0.94 0 0 / 0.70)" }
                            }
                          >
                            <item.icon className="size-4 shrink-0" />
                            {item.title}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="px-3 pb-4 pt-2" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-2 py-2 rounded-md text-sm transition-colors cursor-pointer"
                style={{ color: "oklch(0.94 0 0 / 0.55)" }}
              >
                <LogOut className="size-4 shrink-0" />
                Se déconnecter
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-1.5">
          <div className="rounded-md p-1" style={{ backgroundColor: "var(--sidebar)" }}>
            <ChefHat className="size-3.5" style={{ color: "var(--sidebar-foreground)" }} />
          </div>
          <span className="font-semibold text-sm">{pageTitle}</span>
        </div>
      </div>
    </header>
  )
}
