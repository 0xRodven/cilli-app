import { NextResponse } from "next/server"

const BOT_TOKEN = "8772491229:AAHYEKH86Ps2Z42MPXUzdCMb0eHR5ZkZjE8"
const OUSMANE_CHAT_ID = "6232011371"

export async function POST() {
  try {
    const message = `🔍 Veille sourcing manuelle déclenchée depuis le dashboard.\n\nLance la veille prix maintenant : interroge les sources (SearXNG, RNM, MIN Lomme, Promocash, Transgourmet) et mets à jour market_prices + sourcing_finds dans PocketBase. Stocke le sourceUrl (lien direct) pour chaque prix trouvé.`

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: OUSMANE_CHAT_ID,
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
