// components/queue-qr-scanner.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { QrCode, X, User } from "lucide-react"
import { CashQRDialog } from "@/components/cash-qr-dialog"
import { formatCurrency } from "@/lib/utils"
import { logFSMEvent } from "@/lib/fsm-types"
import type { Language } from "@/lib/translations"

export interface QueuePassenger {
  id: number
  name: string
  queuePosition: number
  isFirst: boolean
  count: number
  ticketCount: number
  orderNumber: number
  scanned?: boolean
  qrError?: boolean
  qrData?: {
    sum: number
    recipient: string
    created_at: string
  }
}

interface QueueQRScannerProps {
  passengers: QueuePassenger[]
  onUpdate: (passengers: QueuePassenger[]) => void
  onAccept: (passengerId: number) => void
  onReject: (passengerId: number) => void
  onReturn: (passengerId: number) => void
  disabled: boolean
  language: Language
  t: Record<string, string>
}

export function QueueQRScanner({
  passengers,
  onUpdate,
  onAccept,
  onReject,
  onReturn,
  disabled,
  language,
  t,
}: QueueQRScannerProps) {
  const [showScanner, setShowScanner] = useState(false)
  const [currentScanId, setCurrentScanId] = useState<number | null>(null)
  const [scanLocked, setScanLocked] = useState(false)

  const handleStartScan = () => {
    if (disabled) {
      logFSMEvent("ui:blocked", { 
        action: "queue_scan", 
        reason: "preparation_not_started" 
      })
      return
    }

    const nextPassenger = passengers.find(p => !p.scanned && !p.qrError)
    
    if (!nextPassenger) {
      logFSMEvent("ui:blocked", { 
        action: "queue_scan", 
        reason: "no_passengers_available" 
      })
      return
    }

    logFSMEvent("scan:start", { 
      passengerId: nextPassenger.id,
      context: "queue"
    })

    setCurrentScanId(nextPassenger.id)
    setScanLocked(true)
    setShowScanner(true)
  }

  const handleScanSuccess = () => {
    if (!currentScanId) return

    const passenger = passengers.find(p => p.id === currentScanId)
    if (!passenger) return

    logFSMEvent("scan:result", {
      passengerId: currentScanId,
      match: true,
      amount: passenger.ticketCount * 320
    })

    const mockQRData = {
      sum: passenger.ticketCount * 320,
      recipient: language === "ru" ? "Водитель Иванов И.И." : "Driver Ivanov I.",
      created_at: new Date().toISOString(),
    }

    const updatedPassengers = passengers.map(p =>
      p.id === currentScanId
        ? {
            ...p,
            scanned: true,
            qrError: false,
            qrData: mockQRData,
          }
        : p
    )

    onUpdate(updatedPassengers)
    
    // Close scanner and unlock immediately
    setShowScanner(false)
    setCurrentScanId(null)
    setScanLocked(false)
  }

  const handleScanError = () => {
    if (!currentScanId) return

    logFSMEvent("scan:error", {
      passengerId: currentScanId,
      error: "Invalid QR"
    })

    const updatedPassengers = passengers.map(p =>
      p.id === currentScanId
        ? {
            ...p,
            qrError: true,
            scanned: false,
          }
        : p
    )

    onUpdate(updatedPassengers)
    
    setShowScanner(false)
    setCurrentScanId(null)
    setScanLocked(false)
  }

  const handleAccept = (passengerId: number) => {
    logFSMEvent("accept:clicked", { 
      passengerId,
      context: "queue"
    })
    onAccept(passengerId)
  }

  const handleReject = (passengerId: number) => {
    logFSMEvent("reject:clicked", { 
      passengerId,
      context: "queue"
    })
    onReject(passengerId)
  }

  const handleReturn = (passengerId: number) => {
    logFSMEvent("return:clicked", { 
      passengerId,
      context: "queue"
    })
    onReturn(passengerId)
  }

  const renderPassengerIcons = (count: number) => {
    const iconCount = Math.min(count, 3)
    return Array(iconCount)
      .fill(0)
      .map((_, i) => <User key={i} className="h-4 w-4" />)
  }

  return (
    <>
      {/* Grid of passengers */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {passengers.slice(0, 5).map((passenger) => (
          <div
            key={passenger.id}
            className={`h-20 flex flex-col items-center justify-center p-2 rounded-md border-2 ${
              passenger.qrError
                ? "bg-red-100 border-red-500 dark:bg-red-900/30 dark:border-red-600"
                : passenger.scanned && passenger.qrData
                  ? "bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-600"
                  : passenger.isFirst
                    ? "bg-primary/10 border-primary"
                    : "bg-secondary border-border"
            }`}
          >
            {(passenger.qrError || (passenger.scanned && passenger.qrData)) && (
              <Button
                onClick={() => handleReturn(passenger.id)}
                size="icon"
                variant="ghost"
                className="h-5 w-5 p-0 mb-1"
                title={t.revert}
                disabled={disabled}
              >
                <X className="h-4 w-4 text-red-500" />
              </Button>
            )}
            {!passenger.qrError && !passenger.scanned && (
              <div className="flex items-center gap-0.5 mb-1">{renderPassengerIcons(passenger.count)}</div>
            )}
            <span className="text-xs font-bold">
              {passenger.queuePosition} • {passenger.count}
            </span>
          </div>
        ))}
      </div>

      {/* Show accept/reject buttons for scanned passengers */}
      {passengers
        .filter(p => p.scanned && p.qrData && !p.qrError)
        .map(passenger => (
          <div key={passenger.id} className="mb-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200">
            <p className="text-sm font-semibold mb-2">{passenger.name}</p>
            <p className="text-sm mb-3">{t.sumLabel}: {formatCurrency(passenger.qrData!.sum)} RUB</p>
            <div className="flex gap-2">
              <Button
                onClick={() => handleAccept(passenger.id)}
                className="flex-1"
                disabled={disabled}
              >
                {t.accept}
              </Button>
              <Button
                onClick={() => handleReject(passenger.id)}
                variant="destructive"
                className="flex-1"
                disabled={disabled}
              >
                {t.reject}
              </Button>
            </div>
          </div>
        ))}

      {/* Main scan button - only show if no pending accept/reject */}
      {!passengers.some(p => p.scanned && p.qrData && !p.qrError) && (
        <Button 
          onClick={handleStartScan} 
          className="w-full" 
          disabled={disabled || scanLocked}
        >
          <QrCode className="mr-2 h-4 w-4" />
          {t.scanQR}
        </Button>
      )}

      {/* Scanner dialog */}
      <CashQRDialog
        open={showScanner}
        onOpenChange={setShowScanner}
        driverName={language === "ru" ? "Водитель Иванов И.И." : "Driver Ivanov I."}
        amount={320}
        currency="RUB"
        onConfirm={handleScanSuccess}
        onInvalid={handleScanError}
        language={language}
        showNotFoundButton={true}
        onQRNotFound={handleScanError}
      />
    </>
  )
}
