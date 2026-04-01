import PocketBase from "pocketbase"

let pbInstance: PocketBase | null = null

function getPocketBaseUrl(): string {
  // Client-side: always use the Next.js rewrite proxy to avoid mixed content (HTTPS → HTTP)
  if (typeof window !== "undefined") {
    return `${window.location.origin}/pb`
  }
  // Server-side: use direct URL if available, otherwise localhost
  return process.env.POCKETBASE_INTERNAL_URL || "http://127.0.0.1:8090"
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
