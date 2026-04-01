"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Building2,
  Package,
  AlertTriangle,
  Upload,
  Settings,
  ChefHat,
  Radar,
  TrendingUp,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getPocketBase } from "@/lib/pocketbase"
import { toast } from "sonner"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: "Pilotage",
    items: [
      { title: "Vue d'ensemble", href: "/overview", icon: LayoutDashboard },
      { title: "Ma semaine", href: "/week", icon: Calendar },
    ],
  },
  {
    title: "Achats",
    items: [
      { title: "Factures", href: "/invoices", icon: FileText },
      { title: "Fournisseurs", href: "/suppliers", icon: Building2 },
      { title: "Produits", href: "/products", icon: Package, disabled: true },
      { title: "Alertes", href: "/anomalies", icon: AlertTriangle },
    ],
  },
  {
    title: "Veille",
    items: [
      { title: "Sourcing", href: "/sourcing", icon: Radar },
      { title: "Prix marché", href: "/market-prices", icon: TrendingUp },
    ],
  },
  {
    title: "Outils",
    items: [
      { title: "Import", href: "/import", icon: Upload, disabled: true },
      { title: "Paramètres", href: "/settings", icon: Settings, disabled: true },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  function handleLogout() {
    const pb = getPocketBase()
    pb.authStore.clear()
    toast.success("Déconnexion réussie")
    router.push("/login")
  }

  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 h-screen sticky top-0 bg-white border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
        <div className="flex items-center justify-center rounded-lg w-7 h-7 bg-foreground shrink-0">
          <ChefHat className="size-3.5 text-background" />
        </div>
        <div>
          <div className="font-semibold text-sm leading-none text-foreground">Cilli</div>
          <div className="text-[10px] leading-none mt-0.5 text-muted-foreground">Restaurant</div>
        </div>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-3">
        <nav className="px-3 space-y-5">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="px-2 mb-1 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.disabled ? "#" : item.href}
                        className={cn(
                          "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors",
                          isActive
                            ? "bg-accent text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                          item.disabled && "opacity-40 pointer-events-none"
                        )}
                      >
                        <item.icon className="size-4 shrink-0" />
                        <span className="flex-1 truncate">{item.title}</span>
                        {item.disabled && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground/60">
                            bientôt
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Bottom: user + logout */}
      <div className="px-3 py-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2 px-2 py-1.5 mb-0.5">
          <div className="flex items-center justify-center rounded-full w-6 h-6 bg-muted shrink-0 text-[10px] font-semibold text-muted-foreground">
            MC
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate text-foreground">Mme Cilly</div>
            <div className="text-[10px] truncate text-muted-foreground">Responsable</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
        >
          <LogOut className="size-3.5 shrink-0" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
