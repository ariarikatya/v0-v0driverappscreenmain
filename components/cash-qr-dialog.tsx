"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { QrCode, CheckCircle2, XCircle } from "lucide-react"

interface CashQRDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  driverName: string
  amount: number
  currency: string
  onConfirm: () => void
  onInvalid?: () => void
  language: "ru" | "en" | "fr" | "ar"
  showNotFoundButton?: boolean
  onQRNotFound?: () => void
}

export function CashQRDialog({
  open,
  onOpenChange,
  driverName,
  amount,
  currency,
  onConfirm,
  onInvalid,
  language,
  showNotFoundButton = false,
  onQRNotFound,
}: CashQRDialogProps) {
  const [scanStatus, setScanStatus] = useState<"scanning" | "success" | "error" | "notfound">("scanning")
  const isScanningRef = useRef(false)
  const consumedRef = useRef(false)

  const t = {
    ru: {
      scanning: "Сканирование...",
      success: "Успешно!",
      error: "Ошибка сканирования",
      qrNotFound: "QR не найден",
    },
    en: {
      scanning: "Scanning...",
      success: "Success!",
      error: "Scan error",
      qrNotFound: "QR not found",
    },
    fr: {
      scanning: "Scan en cours...",
      success: "Succès!",
      error: "Erreur de scan",
      qrNotFound: "QR introuvable",
    },
    ar: {
      scanning: "جاري المسح...",
      success: "نجح!",
      error: "خطأ في المسح",
      qrNotFound: "QR غير موجود",
    },
  }[language]

  useEffect(() => {
    if (open) {
      setScanStatus("scanning")
      isScanningRef.current = false
      consumedRef.current = false
    }
  }, [open])

  useEffect(() => {
    if (open && !isScanningRef.current && !consumedRef.current) {
      isScanningRef.current = true
      console.log("[v0] scan:start", { timestamp: new Date().toISOString() })

      const scanTimer = setTimeout(() => {
        if (consumedRef.current) {
          return
        }

        consumedRef.current = true
        console.log("[v0] Scanner simulation complete")

        // Random validation: 70% valid, 30% invalid
        const isValid = Math.random() > 0.3

        if (isValid) {
          console.log("[v0] QR scan valid")
          setScanStatus("success")

          // Auto-close on success after 1.5s
          setTimeout(() => {
            onConfirm()
            onOpenChange(false)
          }, 1500)
        } else {
          console.log("[v0] QR scan invalid/mismatch")
          setScanStatus("notfound")
          if (onInvalid) {
            onInvalid()
          }
        }

        isScanningRef.current = false
      }, 800)

      return () => {
        clearTimeout(scanTimer)
        isScanningRef.current = false
      }
    }
  }, [open, onConfirm, onOpenChange, onInvalid])

  const handleQRNotFound = () => {
    console.log("[v0] QR not found button clicked")
    if (onQRNotFound) {
      onQRNotFound()
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="space-y-4">
          <div className="p-4 bg-secondary rounded-lg">
            <div className="flex items-center justify-center bg-white dark:bg-gray-900 p-8 rounded-lg border-4 border-primary/20">
              <div className="w-48 h-48 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center relative">
                {scanStatus === "scanning" && <QrCode className="h-32 w-32 text-primary animate-pulse" />}
                {scanStatus === "success" && <CheckCircle2 className="h-32 w-32 text-green-500" />}
                {(scanStatus === "error" || scanStatus === "notfound") && (
                  <XCircle className="h-32 w-32 text-red-500" />
                )}

                {/* Corner frames */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary" />
              </div>
            </div>
          </div>

          {scanStatus === "notfound" && (
            <Button onClick={handleQRNotFound} className="w-full h-12 text-base font-semibold" variant="destructive">
              {t.qrNotFound}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
