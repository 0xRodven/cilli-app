export interface Supplier {
  id: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
  name: string
  type: string
  address: string
  city: string
  phone: string
  email: string
  status: "active" | "inactive" | "new"
  reliability: "good" | "average" | "poor" | "unknown"
  contactName: string
  specialties: string[]
  deliveryDays: string[]
  notes: string
  tags: string[]
  odooPartnerId: string
}

export interface Product {
  id: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
  name: string
  code: string
  category: string
  unit: string
  description: string
  origin: string
  isVolatile: boolean
  tags: string[]
}

export interface Invoice {
  id: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
  invoiceNumber: string
  supplierId: string  // text field (not a relation)
  supplierName: string
  invoiceDate: string
  dueDate: string
  status: "pending" | "validated" | "anomaly" | "paid"
  totalHT: number
  tva: number
  totalTTC: number
  reference: string
  sourceChannel: "ocr_email" | "ocr_telegram" | "ocr_upload" | "odoo_import" | "manual"
  // Legacy alias — kept for backward compat during migration
  source?: "ocr_email" | "ocr_telegram" | "ocr_upload" | "odoo_import" | "manual"
}

export interface InvoiceLine {
  id: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
  invoice: string
  lineNumber: number
  product: string
  rawDescription: string
  quantity: number
  unit: string
  unitPrice: number
  totalHT: number
}

export interface Anomaly {
  id: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
  invoice: string
  invoiceLine: string
  supplier: string
  supplierName: string
  product: string
  type: "price_increase" | "price_decrease" | "duplicate" | "missing_info" | "supplier_too_expensive"
  severity: "high" | "medium" | "low"
  status: "new" | "reviewing" | "resolved" | "dismissed"
  previousValue: number
  currentValue: number
  percentageChange: number
  description: string
  expand?: {
    invoice?: Invoice
    supplier?: Supplier
  }
}

export interface PriceHistory {
  id: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
  product: string
  supplier: string
  supplierName: string
  invoiceLine: string
  price: number
  quantity: number
  date: string
}

export interface SupplierProduct {
  id: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
  supplier: string
  product: string
  lastPrice: number
  avgPrice: number
  minPrice: number
  maxPrice: number
  orderCount: number
  totalQuantity: number
  lastOrderDate: string
}

export interface Activity {
  id: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
  type: string
  title: string
  description: string
  entityType: string
  entityId: string
  metadata: Record<string, unknown>
}

export interface MonthlyStats {
  id: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
  month: string
  revenue: number
  purchases: number
  foodCostPct: number
  invoiceCount: number
  anomalyCount: number
  topSupplierName: string
  topSupplierAmount: number
}

export interface Import {
  id: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
  filename: string
  fileSize: number
  mimeType: string
  status: "uploading" | "processing" | "completed" | "error"
  progress: number
  invoice: string
  errorMessage: string
  rawExtractedData: Record<string, unknown>
  file: string
}

export type SeverityLevel = "high" | "medium" | "low"
export type AnomalyStatus = "new" | "reviewing" | "resolved" | "dismissed"
export type InvoiceStatus = "pending" | "validated" | "anomaly" | "paid"
export type PaymentStatus = "unpaid" | "partial" | "paid"

export interface SourcingFind {
  id: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
  title: string
  description: string
  productName: string
  supplierName: string
  supplierContact: string
  indicativePrice: number
  unit: string
  currentPrice: number
  potentialSaving: number
  source: string
  category: string
  tags: string[]
  status: "new" | "interesting" | "contacted" | "dismissed"
  weekOf: string
}

export interface MarketPrice {
  id: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
  productName: string
  price: number
  unit: string
  source: string
  scrapedAt: string
}
