#!/bin/bash
# setup-pocketbase.sh — Create/update all PocketBase collections for Cilli dashboard
# Supports PocketBase v0.22+
# Usage: bash scripts/setup-pocketbase.sh
# Env: PB_URL (default http://localhost:8090), PB_EMAIL, PB_PASSWORD

set -euo pipefail

PB_URL="${POCKETBASE_URL:-http://localhost:8090}"
PB_EMAIL="${PB_ADMIN_EMAIL:-admin@cilli.local}"
PB_PASSWORD="${PB_ADMIN_PASSWORD:-admin1234567}"

echo "🔐 Authenticating to PocketBase at $PB_URL..."

TOKEN=$(curl -s -X POST \
  "${PB_URL}/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"${PB_EMAIL}\",\"password\":\"${PB_PASSWORD}\"}" \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [[ -z "$TOKEN" ]]; then
  echo "❌ Auth failed. Check PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD." >&2
  exit 1
fi

AUTH="Authorization: Bearer $TOKEN"
echo "✅ Authenticated"

# ─── Helper ────────────────────────────────────────────────────────────────────

upsert_collection() {
  local NAME="$1"
  local PAYLOAD="$2"

  # Check if exists
  local EXISTING
  EXISTING=$(curl -s -X GET \
    "${PB_URL}/api/collections/${NAME}" \
    -H "$AUTH" 2>/dev/null)

  if echo "$EXISTING" | grep -q '"id"'; then
    echo "⚠️  '$NAME' already exists — skipping (delete manually to recreate)"
  else
    local RESP
    RESP=$(curl -s -X POST \
      "${PB_URL}/api/collections" \
      -H "Content-Type: application/json" \
      -H "$AUTH" \
      -d "$PAYLOAD")
    if echo "$RESP" | grep -q '"id"'; then
      echo "✅ Created '$NAME'"
    else
      echo "❌ '$NAME': $RESP"
    fi
  fi
}

# ─── Collections ───────────────────────────────────────────────────────────────

upsert_collection "suppliers" '{
  "name": "suppliers",
  "type": "base",
  "fields": [
    {"name":"name","type":"text","required":true},
    {"name":"type","type":"text"},
    {"name":"address","type":"text"},
    {"name":"city","type":"text"},
    {"name":"phone","type":"text"},
    {"name":"email","type":"email"},
    {"name":"status","type":"select","values":["active","inactive","new"],"maxSelect":1},
    {"name":"reliability","type":"select","values":["good","average","poor","unknown"],"maxSelect":1},
    {"name":"contactName","type":"text"},
    {"name":"specialties","type":"json"},
    {"name":"deliveryDays","type":"json"},
    {"name":"notes","type":"text"},
    {"name":"tags","type":"json"},
    {"name":"odooPartnerId","type":"text"}
  ]
}'

upsert_collection "products" '{
  "name": "products",
  "type": "base",
  "fields": [
    {"name":"name","type":"text","required":true},
    {"name":"code","type":"text"},
    {"name":"category","type":"text"},
    {"name":"unit","type":"text"},
    {"name":"description","type":"text"},
    {"name":"origin","type":"text"},
    {"name":"isVolatile","type":"bool"},
    {"name":"tags","type":"json"}
  ]
}'

upsert_collection "invoices" '{
  "name": "invoices",
  "type": "base",
  "fields": [
    {"name":"invoiceNumber","type":"text"},
    {"name":"supplier","type":"relation","collectionId":"_pb_invoices_supplier_","maxSelect":1},
    {"name":"supplierName","type":"text","required":true},
    {"name":"date","type":"date","required":true},
    {"name":"dueDate","type":"date"},
    {"name":"status","type":"select","values":["pending","validated","anomaly","paid"],"maxSelect":1},
    {"name":"totalHT","type":"number"},
    {"name":"tva","type":"number"},
    {"name":"totalTTC","type":"number"},
    {"name":"reference","type":"text"},
    {"name":"source","type":"select","values":["ocr_email","ocr_telegram","ocr_upload","odoo_import","manual"],"maxSelect":1},
    {"name":"paymentStatus","type":"select","values":["unpaid","partial","paid"],"maxSelect":1},
    {"name":"paymentDate","type":"date"},
    {"name":"odooMoveNumber","type":"text"}
  ]
}'

upsert_collection "invoice_lines" '{
  "name": "invoice_lines",
  "type": "base",
  "fields": [
    {"name":"invoice","type":"relation","collectionId":"_pb_invoice_lines_invoice_","maxSelect":1,"required":true},
    {"name":"lineNumber","type":"number"},
    {"name":"product","type":"relation","collectionId":"_pb_invoice_lines_product_","maxSelect":1},
    {"name":"rawDescription","type":"text"},
    {"name":"quantity","type":"number"},
    {"name":"unit","type":"text"},
    {"name":"unitPrice","type":"number"},
    {"name":"totalHT","type":"number"}
  ]
}'

upsert_collection "anomalies" '{
  "name": "anomalies",
  "type": "base",
  "fields": [
    {"name":"invoice","type":"relation","collectionId":"_pb_anomalies_invoice_","maxSelect":1},
    {"name":"invoiceLine","type":"text"},
    {"name":"supplier","type":"relation","collectionId":"_pb_anomalies_supplier_","maxSelect":1},
    {"name":"supplierName","type":"text"},
    {"name":"product","type":"text"},
    {"name":"type","type":"select","values":["price_increase","price_decrease","duplicate","missing_info","supplier_too_expensive"],"maxSelect":1},
    {"name":"severity","type":"select","values":["high","medium","low"],"maxSelect":1},
    {"name":"status","type":"select","values":["new","reviewing","resolved","dismissed"],"maxSelect":1},
    {"name":"previousValue","type":"number"},
    {"name":"currentValue","type":"number"},
    {"name":"percentageChange","type":"number"},
    {"name":"description","type":"text"}
  ]
}'

upsert_collection "price_history" '{
  "name": "price_history",
  "type": "base",
  "fields": [
    {"name":"product","type":"text"},
    {"name":"supplier","type":"text"},
    {"name":"supplierName","type":"text"},
    {"name":"invoiceLine","type":"text"},
    {"name":"price","type":"number","required":true},
    {"name":"quantity","type":"number"},
    {"name":"date","type":"date","required":true}
  ]
}'

upsert_collection "supplier_products" '{
  "name": "supplier_products",
  "type": "base",
  "fields": [
    {"name":"supplier","type":"text"},
    {"name":"product","type":"text"},
    {"name":"lastPrice","type":"number"},
    {"name":"avgPrice","type":"number"},
    {"name":"minPrice","type":"number"},
    {"name":"maxPrice","type":"number"},
    {"name":"orderCount","type":"number"},
    {"name":"totalQuantity","type":"number"},
    {"name":"lastOrderDate","type":"date"}
  ]
}'

upsert_collection "activities" '{
  "name": "activities",
  "type": "base",
  "fields": [
    {"name":"type","type":"text","required":true},
    {"name":"title","type":"text","required":true},
    {"name":"description","type":"text"},
    {"name":"entityType","type":"text"},
    {"name":"entityId","type":"text"},
    {"name":"metadata","type":"json"}
  ]
}'

upsert_collection "monthly_stats" '{
  "name": "monthly_stats",
  "type": "base",
  "fields": [
    {"name":"month","type":"date","required":true},
    {"name":"revenue","type":"number"},
    {"name":"purchases","type":"number"},
    {"name":"foodCostPct","type":"number"},
    {"name":"invoiceCount","type":"number"},
    {"name":"anomalyCount","type":"number"},
    {"name":"topSupplierName","type":"text"},
    {"name":"topSupplierAmount","type":"number"}
  ]
}'

upsert_collection "imports" '{
  "name": "imports",
  "type": "base",
  "fields": [
    {"name":"filename","type":"text","required":true},
    {"name":"fileSize","type":"number"},
    {"name":"mimeType","type":"text"},
    {"name":"status","type":"select","values":["uploading","processing","completed","error"],"maxSelect":1},
    {"name":"progress","type":"number"},
    {"name":"invoice","type":"text"},
    {"name":"errorMessage","type":"text"},
    {"name":"rawExtractedData","type":"json"}
  ]
}'

echo ""
echo "✅ PocketBase setup complete!"
echo "📊 Admin UI: ${PB_URL}/_/"
echo ""
echo "Next step: run seed"
echo "  cd scripts && npm install && npx tsx seed-odoo.ts"
