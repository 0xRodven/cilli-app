# HANDOFF — Cilli Dashboard (pour Claude local)

> Ce fichier contient TOUT le contexte pour reprendre le dev du dashboard Cilli en local.
> Dernière mise à jour : 2026-04-02

---

## Setup local

```bash
git clone https://github.com/0xRodven/cilli-app.git
cd cilli-app
npm install

# .env.local — pointe vers le PocketBase de production (VPS Hetzner)
cat > .env.local << 'EOF'
NEXT_PUBLIC_POCKETBASE_URL=http://46.225.210.206:8090
POCKETBASE_INTERNAL_URL=http://46.225.210.206:8090
EOF

npm run dev
# → http://localhost:3000
# Login : ousmane@cilli.fr / Cilli2026!
```

## Stack technique

| Composant | Version | Notes |
|-----------|---------|-------|
| Next.js | 16.2.2 | App Router, Turbopack |
| React | 19 | |
| TypeScript | 5 | strict |
| Tailwind CSS | 4.1 | PostCSS |
| PocketBase SDK | 0.26.8 | CRITIQUE : le serveur PB est v0.36.6. Ne PAS downgrader le SDK |
| Recharts | 2.15.4 | Charts (Bar, Line, Composed) |
| Radix UI | via shadcn/ui | Card, Badge, Button, Table, Select, Dialog, Tabs, Tooltip, etc. |
| sonner | 1.7.4 | Toasts |
| lucide-react | 0.454 | Icônes |
| date-fns | 4.1 | Formatage dates |

## Architecture des pages

```
app/
├── (auth)/
│   └── login/page.tsx              # Login PocketBase (email/password)
├── (dashboard)/
│   ├── layout.tsx                  # Auth guard + sidebar + header + DateFilterProvider
│   ├── overview/page.tsx           # KPIs, charts revenus/marge, Pareto fournisseurs, anomalies
│   ├── week/page.tsx               # Bilan hebdo, budget, anomalies, échéances
│   ├── invoices/page.tsx           # Liste factures paginée, filtres, PDF viewer dialog
│   ├── suppliers/
│   │   ├── page.tsx                # Liste fournisseurs avec dépenses
│   │   └── [id]/page.tsx           # Fiche fournisseur : KPIs, chart 12 mois, factures, badge sourcing
│   ├── products/
│   │   ├── page.tsx                # Liste produits
│   │   └── [id]/page.tsx           # Fiche produit : 2 onglets (Achats + Prix marché), charts, historique
│   ├── anomalies/page.tsx          # Alertes prix avec boutons resolve/dismiss
│   ├── sourcing/
│   │   ├── page.tsx                # Radar Sourcing : KPIs, timeline veilles, table opportunités
│   │   └── [id]/page.tsx           # Rapport de veille : résumé agent, alerte prio, comparatif catégories, plan action
│   ├── market-prices/page.tsx      # Tableau prix marché bruts
│   ├── import/page.tsx             # Upload factures PDF + viewer + trigger OCR auto
│   └── settings/page.tsx           # Paramètres basiques
├── api/
│   └── trigger-import/route.ts     # API route qui envoie un message Telegram au bot pour traiter un import
├── globals.css
├── layout.tsx                      # Root layout (fonts, theme, Toaster)
└── page.tsx                        # Redirect → /overview
```

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `lib/pocketbase.ts` | Client PB singleton. URL = `/pb` (proxy) en production, direct en dev |
| `lib/types.ts` | Tous les types TS (Supplier, Product, Invoice, Anomaly, SourcingFind, MarketPrice, Activity, Import, etc.) |
| `lib/utils.ts` | `formatCurrency`, `formatCurrencyCompact`, `formatDate`, `formatPercent`, `cn` |
| `lib/chart-colors.ts` | Palette de couleurs pour Recharts |
| `contexts/date-filter-context.tsx` | Provider global pour les filtres de date (preset, from, to, comparison) |
| `hooks/use-suppliers.ts` | `useSuppliers(search?)`, `useSupplier(id)` |
| `hooks/use-invoices.ts` | `useInvoices(options)`, `useInvoice(id)` |
| `hooks/use-anomalies.ts` | `useAnomalies(options)`, `useAnomalyCount()`, `resolveAnomaly`, `dismissAnomaly` |
| `hooks/use-analytics.ts` | `useDashboardKPIs`, `useMonthlyRevenueMargin`, `useSupplierBreakdown`, `useSupplierExpenses`, `useWeekStats` |
| `hooks/use-activities.ts` | `useActivities(limit)` |
| `hooks/use-pocketbase.ts` | Auth state management |
| `components/ui/*` | shadcn/ui components |
| `components/dashboard/*` | KPI cards, charts, widgets |
| `components/layout/*` | Sidebar, header, page-header |
| `next.config.ts` | Rewrites `/pb/*` → PocketBase URL (proxy pour éviter mixed content HTTPS→HTTP) |

## PocketBase — Collections (serveur v0.36.6 sur VPS)

| Collection | Records | Champs clés |
|------------|---------|-------------|
| `users` | 2 | email, name, role (auth collection) |
| `suppliers` | 92 | name, city, phone, email, status, reliability, siret, contactName |
| `invoices` | 2574 | invoiceNumber, supplierName, invoiceDate, totalHT, totalTTC, status, sourceChannel |
| `invoice_lines` | 0 | invoiceId, description, quantity, unitPrice, totalHT |
| `products` | 30 | name, code, category, unit, origin, isVolatile, tags |
| `price_history` | 1083 | supplierName, productDescription, unitPrice, invoiceDate, quantity, unit |
| `anomalies` | 37 | supplierName, description, severity (high/medium/low), status (new/reviewing/resolved/dismissed), type, percentageChange |
| `monthly_stats` | 52 | month, revenue, purchases, foodCostPct, invoiceCount, topSupplierName |
| `market_prices` | 25+ | productName, price, unit, source, scrapedAt |
| `sourcing_finds` | 10+ | title, description, productName, supplierName, currentPrice, indicativePrice, potentialSaving, unit, source, category, status (new/interesting/contacted/dismissed), weekOf |
| `activities` | 3+ | type, title, description, entityType, entityId (+ autodate created/updated) |
| `imports` | 0+ | filename, fileSize, mimeType, file (fichier), status (uploading/processing/completed/error), progress, invoice, errorMessage |

### API Rules
Toutes les collections ont `listRule: ""`, `viewRule: ""`, `createRule: ""`, `updateRule: ""` (accès public). Auth PB = superuser `admin@cilli.local` / `CilliPB2026SecureAdmin`.

### PocketBase URL
- **Depuis le VPS (Docker network)** : `http://pocketbase:8090`
- **Depuis l'extérieur** : `http://46.225.210.206:8090` (HTTP, port public)
- **Depuis Vercel (production)** : proxy via Next.js rewrites `/pb/*` → `POCKETBASE_INTERNAL_URL`
- **Depuis le dev local** : direct `http://46.225.210.206:8090` via `.env.local`
- **Admin UI** : `http://46.225.210.206:8090/_/`
- **Stockage** : volume Hetzner 300GB monté sur `/mnt/HC_Volume_105306720/pocketbase`

## Système agent (OpenClaw sur VPS — NE PAS TOUCHER)

Le dashboard est le frontend. Le backend agent est sur le VPS via OpenClaw :

### Bot Telegram
- **Bot** : `@cilli_resto_bot` (token: `8772491229:AAH...`)
- **3 groupes** : Alertes (`-5268431342`), Opérations (`-5147727139`), Sourcing (`-5212665597`)
- **Ousmane user ID** : `6232011371`

### 5 Crons actifs
| Cron | Schedule | Groupe | Ce qu'il fait |
|------|----------|--------|---------------|
| `cilli-import-watch` | */15 min 8h-20h Lun-Sam | Alertes | Check imports PB status="uploading", OCR via GPT 5.4 vision |
| `cilli-daily-brief` | 8h30 Lun-Sam | Opérations | Brief matinal (factures J-1, anomalies en attente) |
| `cilli-sourcing` | Lundi 10h | Sourcing | Veille prix : SearXNG + Firecrawl (RNM, MIN) → market_prices + sourcing_finds |
| `cilli-weekly` | Vendredi 17h | Opérations | Bilan hebdo (dépenses, food cost, top fournisseurs, anomalies) |
| `cilli-anomaly-sweep` | 20h Lun-Sam | Alertes | Review anomalies non traitées |

### 3 Skills agent
| Skill | Rôle | PocketBase collections touchées |
|-------|------|-------------------------------|
| `invoice-processor` | OCR factures (vision GPT 5.4), extraction JSON, détection anomalies (hausse >10/15/25%, doublons, montant inhabituel) | invoices, invoice_lines, price_history, anomalies, activities, suppliers |
| `sourcing-radar` | Veille prix : SearXNG (large) + Firecrawl (RNM, MIN) → comparaison interne → opportunités | market_prices, sourcing_finds, activities |
| `weekly-brief` | Agrégation stats → update monthly_stats → rapport prose | invoices, anomalies, monthly_stats, activities |

### Import flow
```
Upload PDF sur /import → PocketBase (status: "uploading")
  → API route /api/trigger-import envoie msg Telegram au bot
  → Bot GPT 5.4 vision traite le fichier immédiatement
  → Si trigger échoue → cron import-watch rattrape (15 min max)
  → Invoice + lines + anomalies créés dans PocketBase
  → Dashboard se met à jour
```

## Problèmes connus / TODO

### Données
- 92 suppliers au lieu de 46 (doublons du double-seed) — à nettoyer
- `sourcing_finds` : 10 records seedés mais les KPIs montrent 0 opportunités → vérifier le filtre `status` (les records seedés ont peut-être status="new" mais le filtre ne les trouve pas)
- `activities` : collection recréée avec autodate — peu de records, le journal des veilles sera vide jusqu'au prochain lundi

### Pages à vérifier/debugger
- `/sourcing` : les KPIs "Éco. potentielle" et "Opportunités" montrent 0 alors qu'il y a 10 sourcing_finds → probablement un problème de filtre PB ou de champ status
- `/sourcing/[id]` : la page rapport crash si on y accède sans ID valide (OK) mais le lien depuis la timeline devrait marcher
- `/import` : le viewer PDF fonctionne, le trigger bot fonctionne, mais l'OCR n'a pas encore été testé end-to-end avec un vrai PDF

### Fonctionnalités manquantes
- **Odoo API** : credentials existent (`secrets/odoo.env`) mais l'auth échoue (mot de passe changé ?). Import bulk des PDFs Odoo à faire quand l'auth sera fixée.
- **IMAP** : pas configuré (cron `cilli-invoice-poll` désactivé). Ousmane doit créer un Gmail dédié.
- **HTTPS sur PocketBase** : actuellement HTTP public sur port 8090. Sécuriser avec reverse proxy ou Cloudflare Tunnel.
- **Export PDF** des rapports de veille (bouton placeholder)
- **Fiche facture détaillée** (`/invoices/[id]`) — hook `useInvoice(id)` existe mais pas de page

## Vercel

- **Project** : `ousmanes-projects-239e9b94/cilli-dashboard`
- **URL prod** : https://cilli-dashboard.vercel.app
- **Deploy** : push sur `main` → `vercel --prod --yes` (ou auto-deploy si connecté)
- **Env vars Vercel** : `POCKETBASE_INTERNAL_URL=http://46.225.210.206:8090`

## GitHub

- **Repo** : https://github.com/0xRodven/cilli-app
- **Branch** : `main`
- **Auth** : `gh auth login` (compte `0xRodven`)

## Convention de code

- Français pour tous les labels UI
- `"use client"` sur toutes les pages (pas de SSR pour le dashboard)
- `getPocketBase()` pour toutes les requêtes PB (singleton client-side, fresh server-side)
- `catch { /* silent */ }` dans les hooks (erreurs silencieuses, pas de crash)
- Skeletons pour le loading, empty states avec icône + message
- shadcn/ui components (`components/ui/`), pas de CSS custom
- Recharts pour les graphiques
- `sonner` toast pour les notifications
- Responsive (mobile-first avec `sm:`, `lg:` breakpoints)

## Contexte métier

**Restaurant** : Raphalance (SAS), Lesquin, Nord (59). Propriétaire : Mme Cilly.
**CA** : ~43k€/mois. **Food cost cible** : < 33%.
**Top fournisseurs** : VANDENBULCKE (alimentation), MARCOVA (alimentation), Vandendriessche (alimentation), Carniato (viandes import Italie), Beuvain (boissons), Engie (énergie).
**Données Odoo** : 26 mois (oct 2023 → mars 2026), 1200 factures, 75 contacts, 8764 lignes comptables.
