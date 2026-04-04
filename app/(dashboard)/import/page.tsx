"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getPocketBase } from "@/lib/pocketbase"
import { toast } from "sonner"
import { Upload, FileText, CheckCircle, XCircle, Loader2, Eye, RefreshCw } from "lucide-react"
import { cn, formatDate } from "@/lib/utils"
import type { Import } from "@/lib/types"

function getFileUrl(imp: Import): string | null {
  if (!imp.file) return null
  const pb = getPocketBase()
  return `${pb.baseURL}/api/files/imports/${imp.id}/${imp.file}`
}

export default function ImportPage() {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imports, setImports] = useState<Import[]>([])
  const [previewImport, setPreviewImport] = useState<Import | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchImports = useCallback(async () => {
    try {
      const pb = getPocketBase()
      const result = await pb.collection("imports").getList<Import>(1, 20, { sort: "-created" })
      setImports(result.items)
      return result.items
    } catch {
      return []
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchImports()
  }, [fetchImports])

  // Poll while there are pending imports
  useEffect(() => {
    const hasPending = imports.some(i => i.status === "uploading" || i.status === "processing")
    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(fetchImports, 5000)
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [imports, fetchImports])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const pb = getPocketBase()
      const newImportIds: string[] = []
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append("filename", file.name)
        formData.append("fileSize", file.size.toString())
        formData.append("mimeType", file.type)
        formData.append("file", file)
        formData.append("status", "uploading")
        formData.append("progress", "0")
        const record = await pb.collection("imports").create(formData)
        newImportIds.push(record.id)
      }
      toast.success(`${files.length} fichier${files.length > 1 ? "s" : ""} uploadé${files.length > 1 ? "s" : ""} — traitement OCR lancé`)
      await fetchImports()

      // Trigger immediate processing via VPS HTTP trigger
      fetch("/api/trigger-import", { method: "POST" }).catch(() => {
        // Silent — cron import-watch picks up within 15 min
      })
    } catch {
      toast.error("Erreur lors de l'upload")
    } finally {
      setUploading(false)
    }
  }, [fetchImports])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const statusConfig = {
    uploading: { label: "En attente...", variant: "info" as const, icon: Loader2, spin: true },
    processing: { label: "Traitement OCR...", variant: "warning" as const, icon: Loader2, spin: true },
    completed: { label: "Terminé", variant: "success" as const, icon: CheckCircle, spin: false },
    error: { label: "Erreur", variant: "destructive" as const, icon: XCircle, spin: false },
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Import factures" description="Uploadez vos factures PDF ou images" sticky>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fetchImports()}>
          <RefreshCw className="size-3.5" />
          Actualiser
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Déposer des fichiers</CardTitle>
          <CardDescription>Formats acceptés : PDF, JPG, PNG, HEIC — taille max 10 Mo</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-10 text-center transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
              "cursor-pointer"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.heic"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {uploading ? (
              <Loader2 className="size-8 mx-auto mb-3 text-primary animate-spin" />
            ) : (
              <Upload className="size-8 mx-auto mb-3 text-muted-foreground" />
            )}
            <p className="font-medium">{uploading ? "Upload en cours..." : "Déposez vos factures ici"}</p>
            <p className="text-sm text-muted-foreground mt-1">ou cliquez pour sélectionner des fichiers</p>
            {!uploading && (
              <Button className="mt-4" variant="outline" type="button">
                Parcourir...
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {imports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historique des imports</CardTitle>
            {imports.some(i => i.status === "uploading" || i.status === "processing") && (
              <CardDescription className="flex items-center gap-1.5 text-blue-600">
                <Loader2 className="size-3 animate-spin" />
                Traitement en cours — mise à jour automatique...
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {imports.map((imp: Import) => {
              const config = statusConfig[imp.status] || statusConfig.uploading
              const Icon = config.icon
              return (
                <div key={imp.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-md">
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{imp.filename}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(imp.created)}</p>
                    {imp.errorMessage && (
                      <p className="text-xs text-destructive mt-0.5">{imp.errorMessage}</p>
                    )}
                  </div>
                  {imp.file && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-7 text-xs gap-1"
                      onClick={() => setPreviewImport(imp)}
                    >
                      <Eye className="size-3" />
                      Aperçu
                    </Button>
                  )}
                  <Badge variant={config.variant} className="gap-1 shrink-0">
                    <Icon className={cn("size-3", config.spin && "animate-spin")} />
                    {config.label}
                  </Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewImport} onOpenChange={(open) => !open && setPreviewImport(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="text-base truncate">{previewImport?.filename}</DialogTitle>
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
