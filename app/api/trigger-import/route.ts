import { NextResponse } from "next/server"

const BOT_TOKEN = "8772491229:AAHYEKH86Ps2Z42MPXUzdCMb0eHR5ZkZjE8"
const OUSMANE_CHAT_ID = "6232011371"

export async function POST(req: Request) {
  try {
    const { importId, filename } = await req.json()

    // Send a message to the bot as if Ousmane is asking it to process
    // The bot will see this as a DM and trigger the invoice-processor skill
    const message = `Nouvelle facture uploadée via le dashboard :\n📎 ${filename}\n\nTraite cette facture depuis PocketBase imports/${importId}. Récupère le fichier, fais l'OCR, crée la facture et les lignes dans PocketBase.`

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
  } catch (err) {
    return NextResponse.json({ error: "Failed to trigger import" }, { status: 500 })
  }
}
