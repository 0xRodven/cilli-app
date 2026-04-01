/**
 * seed-odoo.ts — Import Odoo data into PocketBase
 *
 * Usage:
 *   cd scripts
 *   npm install
 *   POCKETBASE_URL=http://localhost:8090 npx tsx seed-odoo.ts
 *
 * Data files (relative to this script):
 *   ../../data/odoo/contacts.json      — 75 contacts
 *   ../../data/odoo/moves_1.json       — CA mensuel (19 mois)
 *   ../../data/odoo/moves_2.json       — 1200 factures fournisseurs
 *   ../../data/odoo/moves_3.json       — 89 avoirs
 *   ../../data/odoo/payments.json      — 208 paiements
 *   ../../data/odoo/accounting_lines.json — lignes 607100 (achats)
 */

import PocketBase from "pocketbase"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "../../data/odoo")

const PB_URL = process.env.POCKETBASE_URL || "http://localhost:8090"
const PB_EMAIL = process.env.PB_ADMIN_EMAIL || "admin@cilli.local"
const PB_PASSWORD = process.env.PB_ADMIN_PASSWORD || "admin1234567"

// ── Excel serial date → ISO string ──────────────────────────────────────────
function excelToISO(serial: number | undefined): string | null {
  if (!serial || typeof serial !== "number") return null
  const excelEpoch = new Date(Date.UTC(1900, 0, 1))
  const days = serial - 2 // Excel leap year bug
  const date = new Date(excelEpoch.getTime() + days * 86400000)
  return date.toISOString().split("T")[0]
}

function excelToMonth(serial: number | undefined): string | null {
  const iso = excelToISO(serial)
  if (!iso) return null
  return iso.substring(0, 7) + "-01" // first of month
}

// ── Load JSON files ──────────────────────────────────────────────────────────
function loadJSON<T>(filename: string): T[] {
  try {
    const content = readFileSync(join(DATA_DIR, filename), "utf-8")
    return JSON.parse(content) as T[]
  } catch (err) {
    console.warn(`⚠️  Could not load ${filename}: ${err}`)
    return []
  }
}

// ── Food suppliers (those appearing in accounting 607100) ────────────────────
const FOOD_SUPPLIER_KEYWORDS = [
  "VANDENBULCKE", "MARCOVA", "MARVOVA", "Vandendriessche",
  "PassionFroid", "TOM FRUIT", "Carniato", "CAR NIATO", "CARNIATO",
  "Beuvain", "GASTRONOR", "Lebeau", "NORECA", "Promocash",
  "Auchan", "SENEZ", "Tajjelac", "DESMARESCAUX",
]

function isFoodSupplier(name: string): boolean {
  if (!name) return false
  const upper = name.toUpperCase()
  return FOOD_SUPPLIER_KEYWORDS.some(k => upper.includes(k.toUpperCase()))
}

// ── Deduplicate supplier names ────────────────────────────────────────────────
const SUPPLIER_ALIASES: Record<string, string> = {
  "MARVOVA": "MARCOVA",
  "CAR NIATO": "Carniato",
  "CARNIATO EUROPE": "Carniato",
  "Carniato": "Carniato",
}

function normalizeSupplierName(name: string): string {
  const upper = name.trim().toUpperCase()
  for (const [alias, canonical] of Object.entries(SUPPLIER_ALIASES)) {
    if (upper === alias.toUpperCase() || upper.includes(alias.toUpperCase())) {
      return canonical
    }
  }
  return name.trim()
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Seeding PocketBase at ${PB_URL}\n`)

  const pb = new PocketBase(PB_URL)
  await pb.collection("_superusers").authWithPassword(PB_EMAIL, PB_PASSWORD)
  console.log("✅ Authenticated\n")

  // ── 1. Load data ────────────────────────────────────────────────────────────
  const contacts = loadJSON<Record<string, string>>("contacts.json")
  const moves1 = loadJSON<Record<string, number | string>>("moves_1.json")  // CA
  const moves2 = loadJSON<Record<string, number | string>>("moves_2.json")  // Fournisseur invoices
  const moves3 = loadJSON<Record<string, number | string>>("moves_3.json")  // Avoirs
  const payments = loadJSON<Record<string, number | string>>("payments.json")
  const accountingLines = loadJSON<Record<string, number | string>>("accounting_lines.json")

  console.log(`📄 Loaded: ${contacts.length} contacts, ${moves1.length} CA entries, ${moves2.length} invoices, ${moves3.length} avoirs, ${payments.length} payments`)

  // ── 2. Find food suppliers from accounting lines ─────────────────────────
  const suppliersInAccounting = new Set<string>()
  for (const line of accountingLines) {
    const compte = String(line["Compte"] || "")
    const partner = String(line["Partenaire"] || "")
    if (compte.startsWith("607100") && partner) {
      suppliersInAccounting.add(normalizeSupplierName(partner))
    }
  }
  console.log(`\n🏭 Suppliers found in accounting 607100: ${suppliersInAccounting.size}`)
  console.log([...suppliersInAccounting].join(", "))

  // ── 3. Seed suppliers ────────────────────────────────────────────────────
  console.log("\n📦 Seeding suppliers...")
  const supplierIdMap: Record<string, string> = {} // normalized name → PB id

  // All unique supplier names from accounting + contacts
  const allSupplierNames = new Set([
    ...suppliersInAccounting,
    ...contacts
      .filter(c => isFoodSupplier(String(c["Nom complet"] || "")))
      .map(c => normalizeSupplierName(String(c["Nom complet"] || ""))),
  ])

  for (const name of allSupplierNames) {
    // Check if already exists
    try {
      const existing = await pb.collection("suppliers").getFirstListItem(`name="${name}"`)
      supplierIdMap[name] = existing.id
      console.log(`  ⚠️  '${name}' exists (${existing.id})`)
      continue
    } catch { /* not found, create */ }

    // Find contact data
    const contactData = contacts.find(c => {
      const n = normalizeSupplierName(String(c["Nom complet"] || ""))
      return n === name || n.toUpperCase() === name.toUpperCase()
    })

    try {
      const record = await pb.collection("suppliers").create({
        name,
        type: "alimentaire",
        city: contactData?.["Ville"] || "",
        phone: contactData?.["Téléphone"] || "",
        email: contactData?.["E-mail"] || "",
        status: "active",
        reliability: "unknown",
        source: "odoo_import",
        tags: JSON.stringify(["alimentation"]),
      })
      supplierIdMap[name] = record.id
      console.log(`  ✅ Created supplier: ${name} (${record.id})`)
    } catch (err) {
      console.error(`  ❌ Failed to create ${name}: ${err}`)
    }
  }

  console.log(`\n✅ ${Object.keys(supplierIdMap).length} suppliers seeded`)

  // ── 4. Seed invoices (moves_2 = fournisseur) ─────────────────────────────
  console.log("\n🧾 Seeding invoices from moves_2...")
  let invoiceCount = 0
  let invoiceErrorCount = 0
  const invoiceIdByOdooRef: Record<string, string> = {}

  for (const move of moves2) {
    const supplierRaw = String(move["Nom d'affichage du partenaire de la facture"] || "")
    const supplierName = normalizeSupplierName(supplierRaw)
    const dateSerial = move["Date de facturation"] as number
    const dueSerial = move["Date d'échéance"] as number
    const amount = Number(move["Untaxed Amount Signed Currency"] || 0)
    const ref = String(move["Référence"] || "")
    const num = String(move["Numéro"] || "")
    const payStatus = String(move["Status In Payment"] || "")

    const dateStr = excelToISO(dateSerial)
    if (!dateStr || !supplierName) continue

    const totalHT = Math.abs(amount)

    // Map payment status
    let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid"
    if (payStatus === "Réglé" || payStatus === "Payé") paymentStatus = "paid"
    else if (payStatus === "Partiellement réglé") paymentStatus = "partial"

    // Map invoice status
    let status: "pending" | "validated" | "paid" = "pending"
    if (paymentStatus === "paid") status = "paid"
    else if (payStatus !== "Brouillon") status = "validated"

    const supplierId = supplierIdMap[supplierName]

    try {
      const record = await pb.collection("invoices").create({
        invoiceNumber: ref || num || "ODOO-IMPORT",
        supplierId: supplierId || undefined,
        supplierName: supplierName || supplierRaw,
        invoiceDate: dateStr,
        dueDate: excelToISO(dueSerial) || undefined,
        status,
        totalHT,
        tva: totalHT * 0.055,
        totalTTC: totalHT * 1.055,
        notes: [payStatus, num].filter(Boolean).join(" | ") || undefined,
      })
      if (ref) invoiceIdByOdooRef[ref] = record.id
      if (num) invoiceIdByOdooRef[num] = record.id
      invoiceCount++
      if (invoiceCount % 100 === 0) console.log(`  ... ${invoiceCount} invoices created`)
    } catch (err) {
      invoiceErrorCount++
      if (invoiceErrorCount <= 5) console.error(`  ❌ Invoice error for ${supplierName}: ${err}`)
    }
  }

  // ── 5. Seed avoirs (moves_3) ──────────────────────────────────────────────
  console.log(`\n🧾 Seeding avoirs from moves_3 (${moves3.length} records)...`)
  let avoirCount = 0

  for (const move of moves3) {
    const supplierRaw = String(move["Nom d'affichage du partenaire de la facture"] || "")
    const supplierName = normalizeSupplierName(supplierRaw)
    const dateSerial = move["Date de facturation"] as number
    const amount = Number(move["Untaxed Amount Signed Currency"] || 0)
    const ref = String(move["Référence"] || "")
    const num = String(move["Numéro"] || "")

    const dateStr = excelToISO(dateSerial)
    if (!dateStr || !supplierName) continue

    const supplierId = supplierIdMap[supplierName]

    try {
      await pb.collection("invoices").create({
        invoiceNumber: (num || ref) ? `AVOIR-${num || ref}` : "AVOIR",
        supplierId: supplierId || undefined,
        supplierName: supplierName || supplierRaw,
        invoiceDate: dateStr,
        status: "validated",
        totalHT: -Math.abs(amount),
        notes: `Avoir ${num || ref}`,
      })
      avoirCount++
    } catch { /* skip */ }
  }

  console.log(`  ✅ ${avoirCount} avoirs created`)
  console.log(`\n✅ ${invoiceCount} invoices seeded (${invoiceErrorCount} errors)`)

  // ── 6. Seed monthly_stats from moves_1 + accounting_lines ────────────────
  console.log("\n📊 Seeding monthly_stats...")

  // Build CA by month from moves_1
  const caByMonth: Record<string, number> = {}
  for (const move of moves1) {
    const dateSerial = move["Date de facturation"] as number
    const amount = Number(move["Untaxed Amount Signed Currency"] || 0)
    const monthKey = excelToMonth(dateSerial)
    if (monthKey) {
      caByMonth[monthKey] = (caByMonth[monthKey] || 0) + Math.abs(amount)
    }
  }

  // Build purchases by month from accounting_lines 607100
  const purchasesByMonth: Record<string, number> = {}
  for (const line of accountingLines) {
    const compte = String(line["Compte"] || "")
    if (!compte.startsWith("607100")) continue
    const dateSerial = line["Date"] as number
    const credit = Number(line["Crédit"] || 0)
    const monthKey = excelToMonth(dateSerial)
    if (monthKey) {
      purchasesByMonth[monthKey] = (purchasesByMonth[monthKey] || 0) + credit
    }
  }

  // Merge and create monthly_stats
  const allMonths = new Set([...Object.keys(caByMonth), ...Object.keys(purchasesByMonth)])
  let statsCount = 0

  for (const month of [...allMonths].sort()) {
    const revenue = caByMonth[month] || 0
    const purchases = purchasesByMonth[month] || 0
    const foodCostPct = revenue > 0 ? (purchases / revenue) * 100 : 0

    // Check if exists
    try {
      await pb.collection("monthly_stats").getFirstListItem(`month="${month}"`)
      console.log(`  ⚠️  monthly_stats for ${month} exists — skipping`)
      continue
    } catch { /* not found */ }

    try {
      await pb.collection("monthly_stats").create({
        month,
        revenue,
        purchases,
        foodCostPct: Math.round(foodCostPct * 10) / 10,
        invoiceCount: 0,
        anomalyCount: 0,
        topSupplierName: "",
        topSupplierAmount: 0,
      })
      statsCount++
      console.log(`  ✅ ${month}: CA ${Math.round(revenue / 1000)}k€, achats ${Math.round(purchases / 1000)}k€, food cost ${foodCostPct.toFixed(1)}%`)
    } catch (err) {
      console.error(`  ❌ monthly_stats ${month}: ${err}`)
    }
  }

  console.log(`\n✅ ${statsCount} monthly_stats entries created`)

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════╗
║         Seed completed! 🎉           ║
╠══════════════════════════════════════╣
║  Suppliers:      ${String(Object.keys(supplierIdMap).length).padEnd(20)}║
║  Invoices:       ${String(invoiceCount).padEnd(20)}║
║  Avoirs:         ${String(avoirCount).padEnd(20)}║
║  Monthly stats:  ${String(statsCount).padEnd(20)}║
╚══════════════════════════════════════╝
`)

  console.log("🌐 Open dashboard: http://localhost:3000")
  console.log("🗄️  PocketBase admin: " + PB_URL + "/_/")
}

main().catch((err) => {
  console.error("💥 Seed failed:", err)
  process.exit(1)
})
