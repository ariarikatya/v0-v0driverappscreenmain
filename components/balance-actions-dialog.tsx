'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BalanceActionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'deposit' | 'withdraw'
  onConfirm: (amount: number) => void
  title: string
  description: string
  confirmText: string
  cancelText: string
}

export function BalanceActionsDialog({
  open,
  onOpenChange,
  type,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
}: BalanceActionsDialogProps) {
  const [amount, setAmount] = useState('')

  const handleConfirm = () => {
    const numAmount = parseFloat(amount)
    if (!isNaN(numAmount) && numAmount > 0) {
      onConfirm(numAmount)
      setAmount('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Сумма (RUB)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="1000.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setAmount('')
              onOpenChange(false)
            }}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!amount || parseFloat(amount) <= 0}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
