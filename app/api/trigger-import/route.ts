import { NextResponse } from "next/server"

// The trigger server runs on the VPS at localhost:8095
// We proxy through this Next.js route since Vercel can't reach VPS ports directly
const VPS_HOST = (process.env.POCKETBASE_INTERNAL_URL || "http://46.225.210.206:8090").replace(":8090", "")
const TRIGGER_URL = `${VPS_HOST}:8095`

export async function POST() {
  try {
    const res = await fetch(`${TRIGGER_URL}/import`, {
      method: "POST",
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "VPS trigger unreachable" }, { status: 502 })
  }
}

export async function GET() {
  try {
    const res = await fetch(`${TRIGGER_URL}/import/status`, {
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "VPS unreachable" }, { status: 502 })
  }
}
