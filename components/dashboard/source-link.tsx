"use client"

import { ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface SourceLinkProps {
  source: string
  sourceUrl?: string
}

function getDomain(source: string): string {
  try {
    if (source.startsWith("http")) return new URL(source).hostname.replace("www.", "")
    return source.replace("www.", "")
  } catch {
    return source
  }
}

function getFullUrl(source: string, sourceUrl?: string): string | null {
  if (sourceUrl) return sourceUrl.startsWith("http") ? sourceUrl : `https://${sourceUrl}`
  if (source.startsWith("http")) return source
  // If it looks like a domain, link to it
  if (source.includes(".")) return `https://${source}`
  return null
}

function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
}

export function SourceLink({ source, sourceUrl }: SourceLinkProps) {
  if (!source) return <span className="text-muted-foreground">--</span>

  const domain = getDomain(sourceUrl || source)
  const fullUrl = getFullUrl(source, sourceUrl)
  const hasDirectUrl = !!sourceUrl

  if (!fullUrl) {
    return (
      <Badge variant="outline" className="text-xs">
        {source}
      </Badge>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 group cursor-pointer">
          <Badge variant="outline" className="text-xs hover:bg-accent transition-colors">
            {domain}
            <ExternalLink className="size-2.5 ml-0.5 opacity-50" />
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 backdrop-blur-xl bg-white/90 dark:bg-zinc-900/90 border border-white/20 shadow-2xl rounded-xl p-3"
        side="bottom"
        align="start"
      >
        <div className="space-y-2">
          {/* Header with favicon */}
          <div className="flex items-center gap-2">
            <img
              src={getFaviconUrl(domain)}
              alt=""
              className="size-4 rounded-sm"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
            />
            <span className="text-sm font-medium truncate">{domain}</span>
          </div>

          {/* URL preview */}
          {hasDirectUrl ? (
            <div className="rounded-lg bg-black/5 dark:bg-white/5 px-3 py-2">
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">
                Lien direct vers le produit
              </p>
              <p className="text-xs text-foreground truncate">{sourceUrl}</p>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider font-medium">
                Page d'accueil uniquement
              </p>
              <p className="text-xs text-muted-foreground">
                Le lien direct sera disponible à la prochaine veille.
              </p>
            </div>
          )}

          {/* Action */}
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 rounded-lg px-3 py-2 hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="size-3" />
            Ouvrir {hasDirectUrl ? "la fiche" : "le site"}
          </a>
        </div>
      </PopoverContent>
    </Popover>
  )
}
