"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getPocketBase } from "@/lib/pocketbase"
import { toast } from "sonner"
import { Upload, FileText, CheckCircle, XCircle, Loader2, Eye, RefreshCw, AlertTriangle } from "lucide-react"
import { cn, formatDate, formatCurrency } from "@/lib/utils"
import type { Import, Invoice } from "@/lib/types"

function getFileUrl(imp: Import): string | null {
  if (!imp.file) return null
  const pb = getPocketBase()
  return `${pb.baseURL}/api/files/imports/${imp.id}/${imp.file}`
}

const progressSteps = [
  { min: 0, label: "En file d'attente" },
  { min: 10, label: "Démarrage..." },
  { min: 30, label: "Lecture du document..." },
  { min: 50, label: "Extraction des données..." },
  { min: 70, label: "Vérification doublons & création..." },
  { min: 90, label: "Finalisation..." },
  { min: 100, label: "Terminé" },
]

function getProgressLabel(progress: number): string {
  for (let i = progressSteps.length - 1; i >= 0; i--) {
    if (progress >= progressSteps[i].min) return progressSteps[i].label
  }
  return "En attente..."
}

function ImportCard({
  imp,
  onPreview,
}: {
  imp: Import & { linkedInvoice?: Invoice | null }
  onPreview: (imp: Import) => void
}) {
  const isProcessing = imp.status === "uploading" || imp.status === "processing"
  const isCompleted = imp.status === "completed"
  const isError = imp.status === "error"
  const progress = imp.progress || 0
  const isDuplicate = isError && imp.errorMessage?.toLowerCase().includes("doublon")

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-all",
        isProcessing && "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20",
        isCompleted && "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20",
        isError && !isDuplicate && "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20",
        isDuplicate && "border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20"
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 rounded-md p-2",
            isProcessing && "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
            isCompleted && "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
            isError && !isDuplicate && "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400",
            isDuplicate && "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"
          )}
        >
          {isProcessing && <Loader2 className="size-4 animate-spin" />}
          {isCompleted && <CheckCircle className="size-4" />}
          {isError && !isDuplicate && <XCircle className="size-4" />}
          {isDuplicate && <AlertTriangle className="size-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{imp.filename}</p>
            {imp.file && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                title="Aperçu PDF"
                onClick={() => onPreview(imp)}
              >
                <Eye className="size-3" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{formatDate(imp.created)}</p>
        </div>

        {/* Status badge */}
        <div
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
            isProcessing && "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
            isCompleted && "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
            isError && !isDuplicate && "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
            isDuplicate && "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
          )}
        >
          {isProcessing && "Traitement..."}
          {isCompleted && "Importée"}
          {isError && !isDuplicate && "Erreur"}
          {isDuplicate && "Doublon"}
        </div>
      </div>

      {/* Progress bar — visible during processing */}
      {isProcessing && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              {getProgressLabel(progress)}
            </span>
            <span className="text-muted-foreground tabular-nums">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-blue-100 dark:bg-blue-900/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-700 ease-out"
              style={{ width: `${Math.max(progress, 5)}%` }}
            />
          </div>
        </div>
      )}

      {/* Completed — show extracted invoice info */}
      {isCompleted && imp.linkedInvoice && (
        <div className="mt-3 rounded-md bg-white/60 dark:bg-white/5 border border-green-100 dark:border-green-900/30 p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Fournisseur</p>
              <p className="font-medium truncate">{imp.linkedInvoice.supplierName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">N° facture</p>
              <p className="font-medium font-mono">{imp.linkedInvoice.invoiceNumber || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date</p>
              <p className="font-medium">{imp.linkedInvoice.invoiceDate ? formatDate(imp.linkedInvoice.invoiceDate) : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Montant TTC</p>
              <p className="font-medium">{formatCurrency(imp.linkedInvoice.totalTTC || 0)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {isError && imp.errorMessage && (
        <div className={cn(
          "mt-3 rounded-md p-2.5 text-xs",
          isDuplicate
            ? "bg-amber-100/50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
            : "bg-red-100/50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
        )}>
          {imp.errorMessage}
        </div>
      )}
    </div>
  )
}

export default function ImportPage() {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imports, setImports] = useState<(Import & { linkedInvoice?: Invoice | null })[]>([])
  const [previewImport, setPreviewImport] = useState<Import | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const invoiceCacheRef = useRef<Record<string, Invoice>>({})

  const fetchImports = useCallback(async () => {
    try {
      const pb = getPocketBase()
      const result = await pb.collection("imports").getList<Import>(1, 30, { sort: "-created" })

      // Enrich completed imports with cached invoice data
      const enriched = result.items.map((imp) => {
        if (imp.status === "completed" && imp.invoice && invoiceCacheRef.current[imp.invoice]) {
          return { ...imp, linkedInvoice: invoiceCacheRef.current[imp.invoice] }
        }
        return { ...imp, linkedInvoice: null as Invoice | null }
      })

      // Fetch missing invoices (not in cache) — fire and forget, update on next poll
      const missing = enriched.filter(
        (imp) => imp.status === "completed" && imp.invoice && !imp.linkedInvoice
      )
      if (missing.length > 0) {
        Promise.all(
          missing.map(async (imp) => {
            try {
              const invoice = await pb.collection("invoices").getOne<Invoice>(imp.invoice)
              invoiceCacheRef.current[imp.invoice] = invoice
            } catch { /* skip */ }
          })
        ).then(() => {
          // Re-enrich with fetched invoices
          setImports((prev) =>
            prev.map((imp) => {
              if (imp.status === "completed" && imp.invoice && invoiceCacheRef.current[imp.invoice]) {
                return { ...imp, linkedInvoice: invoiceCacheRef.current[imp.invoice] }
              }
              return imp
            })
          )
        })
      }

      setImports(enriched)
      return enriched
    } catch {
      return []
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchImports()
  }, [fetchImports])

  // Poll every 3s while there are pending imports — use ref to avoid re-triggering
  const hasPendingRef = useRef(false)
  useEffect(() => {
    hasPendingRef.current = imports.some(
      (i) => i.status === "uploading" || i.status === "processing"
    )
  }, [imports])

  useEffect(() => {
    const startPolling = () => {
      if (pollRef.current) return
      pollRef.current = setInterval(async () => {
        await fetchImports()
        // Check ref after fetch — stop if nothing pending
        if (!hasPendingRef.current && pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      }, 3000)
    }

    // Start polling after initial fetch if needed
    const check = setTimeout(() => {
      if (hasPendingRef.current) startPolling()
    }, 1000)

    return () => {
      clearTimeout(check)
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [fetchImports])

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setUploading(true)
      try {
        const pb = getPocketBase()
        let count = 0
        for (const file of Array.from(files)) {
          const formData = new FormData()
          formData.append("filename", file.name)
          formData.append("fileSize", file.size.toString())
          formData.append("mimeType", file.type)
          formData.append("file", file)
          formData.append("status", "uploading")
          formData.append("progress", "0")
          await pb.collection("imports").create(formData)
          count++
        }
        toast.success(
          `${count} fichier${count > 1 ? "s" : ""} uploadé${count > 1 ? "s" : ""} — traitement lancé`
        )
        await fetchImports()

        // Trigger VPS processing
        fetch("/api/trigger-import", { method: "POST" }).catch(() => {})

        // Start polling for progress
        if (!pollRef.current) {
          hasPendingRef.current = true
          pollRef.current = setInterval(async () => {
            await fetchImports()
            if (!hasPendingRef.current && pollRef.current) {
              clearInterval(pollRef.current)
              pollRef.current = null
            }
          }, 3000)
        }
      } catch {
        toast.error("Erreur lors de l'upload")
      } finally {
        setUploading(false)
      }
    },
    [fetchImports]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const processingCount = imports.filter(
    (i) => i.status === "uploading" || i.status === "processing"
  ).length
  const completedCount = imports.filter((i) => i.status === "completed").length
  const errorCount = imports.filter((i) => i.status === "error").length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Import factures"
        description="Uploadez vos factures PDF ou images — traitement automatique"
        sticky
      >
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => fetchImports()}
        >
          <RefreshCw className="size-3.5" />
          Actualiser
        </Button>
      </PageHeader>

      {/* Drop zone */}
      <Card>
        <CardContent className="pt-6">
          <input
            id="file-input"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.heic"
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = "" }}
          />
          <label
            htmlFor="file-input"
            className={cn(
              "block border-2 border-dashed rounded-xl p-10 text-center transition-all",
              dragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-muted-foreground/25 hover:border-muted-foreground/50",
              "cursor-pointer"
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            {uploading ? (
              <Loader2 className="size-10 mx-auto mb-3 text-primary animate-spin" />
            ) : (
              <Upload className="size-10 mx-auto mb-3 text-muted-foreground" />
            )}
            <p className="font-medium text-base">
              {uploading ? "Upload en cours..." : "Déposez vos factures ici"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              PDF, JPG, PNG, HEIC — plusieurs fichiers acceptés
            </p>
            {!uploading && (
              <span className="inline-flex items-center justify-center mt-4 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                Parcourir...
              </span>
            )}
          </label>
        </CardContent>
      </Card>

      {/* Processing banner */}
      {processingCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3">
          <Loader2 className="size-4 text-blue-500 animate-spin shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <span className="font-medium">{processingCount} fichier{processingCount > 1 ? "s" : ""}</span>{" "}
            en cours de traitement — mise à jour automatique toutes les 3s
          </p>
        </div>
      )}

      {/* Import history */}
      {imports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Historique
              <div className="flex items-center gap-1.5 text-xs font-normal">
                {completedCount > 0 && (
                  <span className="rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 px-2 py-0.5">
                    {completedCount} importée{completedCount > 1 ? "s" : ""}
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 px-2 py-0.5">
                    {errorCount} erreur{errorCount > 1 ? "s" : ""}
                  </span>
                )}
                {processingCount > 0 && (
                  <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-0.5">
                    {processingCount} en cours
                  </span>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              {imports.length} import{imports.length > 1 ? "s" : ""} au total
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {imports.map((imp) => (
              <ImportCard
                key={imp.id}
                imp={imp}
                onPreview={setPreviewImport}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {imports.length === 0 && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <FileText className="size-10 opacity-30" />
              <p className="font-medium text-sm text-foreground">Aucun import</p>
              <p className="text-xs">
                Déposez vos factures ci-dessus pour commencer
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PDF Preview Dialog */}
      <Dialog
        open={!!previewImport}
        onOpenChange={(open) => !open && setPreviewImport(null)}
      >
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="text-base truncate">
              {previewImport?.filename}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 pb-6">
            {previewImport && getFileUrl(previewImport) ? (
              previewImport.mimeType?.startsWith("image/") ? (
                <img
                  src={getFileUrl(previewImport)!}
                  alt={previewImport.filename}
                  className="w-full h-full object-contain rounded-md"
                />
              ) : (
                <iframe
                  src={getFileUrl(previewImport)!}
                  className="w-full h-full rounded-md border"
                  title={previewImport.filename}
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Aperçu non disponible
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
