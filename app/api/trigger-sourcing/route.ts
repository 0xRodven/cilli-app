import { NextResponse } from "next/server"

const BOT_TOKEN = "8772491229:AAHYEKH86Ps2Z42MPXUzdCMb0eHR5ZkZjE8"
const SOURCING_GROUP_ID = "-5212665597"

export async function POST() {
  try {
    const message = `Veille sourcing maintenant — skill sourcing-radar. Utilise Tavily + RNM FranceAgriMer, PAS SearXNG. Stocke le sourceUrl (lien direct) pour chaque prix trouvé.`

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: SOURCING_GROUP_ID,
        text: message,
      }),
    })

    const data = await res.json()

    if (!data.ok) {
      return NextResponse.json({ error: data.description }, { status: 500 })
    }

    return NextResponse.json({ ok: true, messageId: data.result?.message_id })
  } catch {
    return NextResponse.json({ error: "Failed to trigger sourcing" }, { status: 500 })
  }
}
