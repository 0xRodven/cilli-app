import PocketBase from "pocketbase"

let pbInstance: PocketBase | null = null

function getPocketBaseUrl(): string {
  // If an explicit public URL is set (Vercel deployment), use it directly
  if (process.env.NEXT_PUBLIC_POCKETBASE_URL) {
    return process.env.NEXT_PUBLIC_POCKETBASE_URL
  }
  // Client-side on VPS: go through Next.js rewrite proxy (/pb → 127.0.0.1:8090)
  if (typeof window !== "undefined") {
    return `${window.location.origin}/pb`
  }
  // Server-side on VPS: direct connection
  return "http://127.0.0.1:8090"
}

export function getPocketBase(): PocketBase {
  if (typeof window === "undefined") {
    // Server-side: always create a fresh instance (no singleton — SSR)
    return new PocketBase(getPocketBaseUrl())
  }
  if (!pbInstance) {
    pbInstance = new PocketBase(getPocketBaseUrl())
    pbInstance.autoCancellation(false)
  }
  return pbInstance
}

export const pb = typeof window !== "undefined" ? getPocketBase() : null!

export default getPocketBase
