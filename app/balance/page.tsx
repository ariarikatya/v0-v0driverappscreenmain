"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Wallet, QrCode, ChevronDown, Undo2, RefreshCw, AlertCircle } from "lucide-react"
import Link from "next/link"
import { translations, type Language } from "@/lib/translations"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CashQRDialog } from "@/components/cash-qr-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface Transaction {
  id: number
  type: "booking" | "boarding" | "client" | "income"
  amount: number
  passengerName: string
  timestamp: Date
  paymentMethod: "cash" | "qr"
  description?: string
  expanded?: boolean
}

type PeriodFilter = "today" | "yesterday" | "week" | "month"
type PaymentFilter = "qr" | "cash"

interface SettlementPerson {
  id: number
  name: string
  amount: number
  type: "driver" | "dispatcher"
  throughDispatcher?: boolean
  selectedDispatcher?: string
  completedAt?: Date
  dispatcherName?: string // НОВОЕ ПОЛЕ
}

interface QRScanData {
  sum: number
  recipient: string
  created_at: string
}

export default function BalancePage() {
  const [language, setLanguage] = useState<Language>("ru")
  const t = translations[language]
  const { toast } = useToast()
  const router = useRouter()

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("today")
  const [paymentFilters, setPaymentFilters] = useState<PaymentFilter[]>(["qr", "cash"])
  const [balance, setBalance] = useState<number>(12450)
  const [activeTab, setActiveTab] = useState<"operations" | "settlements">("operations")

  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: 1,
      type: "booking",
      amount: 450,
      passengerName: "Иван П.",
      timestamp: new Date(),
      paymentMethod: "qr",
    },
    {
      id: 2,
      type: "boarding",
      amount: 900,
      passengerName: "Ольга В.",
      timestamp: new Date(Date.now() - 3600000),
      paymentMethod: "qr",
    },
    {
      id: 3,
      type: "client",
      amount: 900,
      passengerName: "Мария С.",
      timestamp: new Date(Date.now() - 7200000),
      paymentMethod: "cash",
    },
  ])

  const available = balance

  // Добавили отрицательную сумму для примера кнопки "Списать"
  const [recalcResults, setRecalcResults] = useState<SettlementPerson[]>([
    { id: 1, name: "Водитель Иванов", amount: 1500, type: "driver", throughDispatcher: false, selectedDispatcher: "" },
    { id: 2, name: "Водитель Смирнов", amount: -500, type: "driver", throughDispatcher: false, selectedDispatcher: "" },
  ])
  // Вычисляем суммы для принятия и списания
  const toAccept = recalcResults.filter((r) => !r.completedAt && r.amount > 0).reduce((sum, r) => sum + r.amount, 0)

  const toDebit = recalcResults
    .filter((r) => !r.completedAt && r.amount < 0)
    .reduce((sum, r) => sum + Math.abs(r.amount), 0)

  const saldo = toAccept - toDebit

  const [lastRecalcTime, setLastRecalcTime] = useState<Date | null>(null) // Дата последнего перерасчета

  const [showCashQRDialog, setShowCashQRDialog] = useState(false)
  const [showGeneratedQR, setShowGeneratedQR] = useState(false)
  const [currentSettlementPerson, setCurrentSettlementPerson] = useState<SettlementPerson | null>(null)
  const [settlementAction, setSettlementAction] = useState<"debit" | "credit" | null>(null)
  const [generatedQRData, setGeneratedQRData] = useState<QRScanData | null>(null)

  const [scannedQRData, setScannedQRData] = useState<QRScanData | null>(null)
  const [showQRResult, setShowQRResult] = useState<"operations" | "settlements" | false>(false) // qrError: null | 'not_found' | 'mismatch'
  const [qrError, setQRError] = useState<null | "not_found" | "mismatch">(null)
  const [deposit, setDeposit] = useState<number>(2500) // Новое состояние для депозита
  const getTransactionTypeLabel = (type: string) => {
    if (type === "booking") return t.booking
    if (type === "boarding") return t.boarding
    if (type === "income") return t.income
    return t.client
  }

  const getPaymentMethodLabel = (method: "cash" | "qr") => {
    if (method === "qr") return t.qr
    return language === "ru" ? "ЛС" : "LS"
  }

  const toggleTransactionExpanded = (id: number) => {
    setTransactions(transactions.map((t) => (t.id === id ? { ...t, expanded: !t.expanded } : t)))
  }

  const togglePaymentFilter = (filter: PaymentFilter | "all") => {
    if (filter === "all") {
      setPaymentFilters(["qr", "cash"])
    } else {
      setPaymentFilters((prev) => {
        if (prev.includes(filter)) {
          const newFilters = prev.filter((f) => f !== filter)
          return newFilters.length === 0 ? ["qr", "cash"] : newFilters
        } else {
          return [...prev, filter]
        }
      })
    }
  }

  const filteredTransactions = transactions.filter((t) => {
    const matchesPayment = paymentFilters.length === 2 || paymentFilters.includes(t.paymentMethod)
    return matchesPayment
  })

  // 1. Кнопка перерасчета
  const handleRecalculate = () => {
  // Обновляем список расчетов
  setLastRecalcTime(new Date())
  
  // Если депозит > 0, добавляем его в список для списания
  if (deposit > 0) {
    const depositExists = recalcResults.some(r => r.id === 999 && r.name === (language === "ru" ? "Депозит" : "Deposit"))
    
    if (!depositExists) {
      const depositItem: SettlementPerson = {
        id: 999, // Специальный ID для депозита
        name: language === "ru" ? "Депозит" : "Deposit",
        amount: -deposit, // Отрицательная сумма, так как надо списать
        type: "driver",
        throughDispatcher: true, // Обязательно через диспетчера
        selectedDispatcher: ""
      }
      setRecalcResults(prev => [...prev, depositItem])
    }
  }
  
  toast({
    title: language === "ru" ? "Список обновлен" : "List updated",
  })
}

 // Обработка действий (Принять/Списать)
const handleSettlementAction = (person: SettlementPerson, action: "debit" | "credit") => {
  console.log(`[v1] ${action} operation:`, person.id)

  setCurrentSettlementPerson(person)
  setSettlementAction(action)

  const amountToTransfer = person.amount < 0 ? Math.abs(person.amount) : person.amount

  if (action === "debit") {
    if (person.throughDispatcher && person.selectedDispatcher) {
      const dispatcherName =
        person.selectedDispatcher === "dispatcher1"
          ? language === "ru"
            ? "Диспетчер Петров"
            : "Dispatcher Petrov"
          : language === "ru"
            ? "Диспетчер Сидоров"
            : "Dispatcher Sidorov"

      setRecalcResults((prev) => {
        const existingDispatcher = prev.find((p) => p.name === dispatcherName && p.type === "dispatcher")

        let newRecalcResults = prev.map((p) =>
          p.id === person.id
            ? {
                ...p,
                completedAt: new Date(),
                throughDispatcher: false,
                selectedDispatcher: "",
                dispatcherName: dispatcherName,
              }
            : p,
        )

        if (existingDispatcher) {
          newRecalcResults = newRecalcResults.map((p) =>
            p.id === existingDispatcher.id ? { ...p, amount: p.amount - amountToTransfer } : p,
          )
        } else {
          const newDispatcherItem: SettlementPerson = {
            id: Date.now(),
            name: dispatcherName,
            amount: -amountToTransfer,
            type: "dispatcher",
            throughDispatcher: false,
          }
          newRecalcResults = [...newRecalcResults, newDispatcherItem]
        }
        return newRecalcResults
      })

      if (person.id === 999) {
        setDeposit(0)
      }

      toast({
        title: language === "ru" ? "Перенесено на диспетчера" : "Transferred to dispatcher",
        description: `${dispatcherName}: ${formatCurrency(amountToTransfer)} RUB`,
      })

      setCurrentSettlementPerson(null)
      setSettlementAction(null)
    } else {
      const qrData: QRScanData = {
        sum: Math.abs(person.amount),
        recipient: person.name,
        created_at: formatDateTime(new Date()),
      }
      setGeneratedQRData(qrData)
      setShowGeneratedQR(true)
    }
  } else {
    if (person.throughDispatcher && person.selectedDispatcher) {
      const dispatcherName =
        person.selectedDispatcher === "dispatcher1"
          ? language === "ru"
            ? "Диспетчер Петров"
            : "Dispatcher Petrov"
          : language === "ru"
            ? "Диспетчер Сидоров"
            : "Dispatcher Sidorov"

      const existingDispatcher = recalcResults.find((p) => p.name === dispatcherName && p.type === "dispatcher")

      if (existingDispatcher) {
        setRecalcResults((prev) =>
          prev.map((p) =>
            p.id === existingDispatcher.id
              ? { ...p, amount: p.amount + person.amount }
              : p.id === person.id
                ? {
                    ...p,
                    completedAt: new Date(),
                    throughDispatcher: false,
                    selectedDispatcher: "",
                    dispatcherName: dispatcherName,
                  }
                : p,
          ),
        )
      } else {
        const newDispatcherItem: SettlementPerson = {
          id: Date.now(),
          name: dispatcherName,
          amount: person.amount,
          type: "dispatcher",
          throughDispatcher: false,
        }
        setRecalcResults((prev) => [
          ...prev.map((p) =>
            p.id === person.id
              ? {
                  ...p,
                  completedAt: new Date(),
                  throughDispatcher: false,
                  selectedDispatcher: "",
                  dispatcherName: dispatcherName,
                }
              : p,
          ),
          newDispatcherItem,
        ])
      }

      toast({
        title: language === "ru" ? "Перенесено на диспетчера" : "Transferred to dispatcher",
        description: `${dispatcherName}: ${formatCurrency(person.amount)} RUB`,
      })

      setCurrentSettlementPerson(null)
      setSettlementAction(null)
    } else {
      setShowCashQRDialog(true)
    }
  }
}

  const handleQRConfirm = () => {
    if (activeTab === "operations") {
      // Логика для вкладки Операции
      const mockQRData: QRScanData = {
        sum: 450,
        recipient: language === "ru" ? "Клиент Иванов И.И." : "Client Ivanov I.", // ИЗМЕНЕНО: Клиент вместо Водитель
        created_at: formatDateTime(new Date()),
      }
      setScannedQRData(mockQRData)
      setQRError(null)
      setShowQRResult(activeTab)
      setShowCashQRDialog(false)
    } else {
      // Логика для вкладки Расчеты
      if (!currentSettlementPerson) return

      const isSimulateNotFound = false
      const isSimulateError = false

      if (isSimulateNotFound) {
        setScannedQRData(null)
        setQRError("not_found")
        setShowQRResult("settlements")
        setShowCashQRDialog(false)
        return
      }

      if (isSimulateError) {
        const mockQRData: QRScanData = {
          sum: Math.abs(currentSettlementPerson.amount) + 100,
          recipient: "Неизвестный Водитель",
          created_at: formatDateTime(new Date()),
        }
        setScannedQRData(mockQRData)
        setQRError("mismatch")
        setShowQRResult("settlements")
        setShowCashQRDialog(false)
        return
      }

      const mockQRData: QRScanData = {
        sum: Math.abs(currentSettlementPerson.amount),
        recipient: currentSettlementPerson.name,
        created_at: formatDateTime(new Date()),
      }

      setScannedQRData(mockQRData)
      setQRError(null)
      setShowQRResult("settlements")
      setShowCashQRDialog(false)
    }
  }

  const isQRValidForSettlement = () => {
    if (activeTab !== "settlements" || !currentSettlementPerson || (!scannedQRData && qrError !== null)) return false

    if (qrError === "not_found" || qrError === "mismatch") return false

    // Простая проверка: совпадают ли имена и суммы (допустим небольшую погрешность float)
    // Используем абсолютные значения для сравнения
    const isSumValid = Math.abs((scannedQRData?.sum || 0) - Math.abs(currentSettlementPerson.amount)) < 0.1
    const isNameValid = scannedQRData?.recipient === currentSettlementPerson.name

    return isSumValid && !!isNameValid
  }

  const isValid = isQRValidForSettlement()

  const handleAcceptQR = () => {
    if (activeTab === "operations") {
      // Логика для вкладки Операции
      toast({
        title: language === "ru" ? "Операция принята" : "Operation accepted",
        description: `${formatCurrency(scannedQRData?.sum || 0)} RUB`,
      })

      // Сброс состояния
      setShowQRResult(false)
      setScannedQRData(null)
      setQRError(null)
      return
    }

    if (!scannedQRData || qrError !== null) return

    // Если это вкладка Расчеты И QR валиден
    if (activeTab === "settlements" && currentSettlementPerson && isValid) {
      const amountToTransfer =
        currentSettlementPerson.amount < 0 ? Math.abs(currentSettlementPerson.amount) : currentSettlementPerson.amount

      // *** Логика Принятия ЧЕРЕЗ ДИСПЕТЧЕРА после успешного сканирования ***
      if (currentSettlementPerson.throughDispatcher && currentSettlementPerson.selectedDispatcher) {
        const dispatcherName =
          currentSettlementPerson.selectedDispatcher === "dispatcher1"
            ? language === "ru"
              ? "Диспетчер Петров"
              : "Dispatcher Petrov"
            : language === "ru"
              ? "Диспетчер Сидоров"
              : "Dispatcher Sidorov"

        setRecalcResults((prev) => {
          const existingDispatcher = prev.find((p) => p.name === dispatcherName && p.type === "dispatcher")

          let newRecalcResults = prev.map((p) =>
            p.id === currentSettlementPerson.id
              ? {
                  ...p,
                  completedAt: new Date(),
                  throughDispatcher: false,
                  selectedDispatcher: "",
                  dispatcherName: dispatcherName,
                }
              : p,
          )

          if (existingDispatcher) {
            // Обновляем сумму существующего диспетчера
            newRecalcResults = newRecalcResults.map((p) =>
              p.id === existingDispatcher.id ? { ...p, amount: p.amount - amountToTransfer } : p,
            )
          } else {
            // Создаем новую запись для диспетчера
            const newDispatcherItem: SettlementPerson = {
              id: Date.now(),
              name: dispatcherName,
              amount: -amountToTransfer,
              type: "dispatcher",
              throughDispatcher: false,
            }
            newRecalcResults = [...newRecalcResults, newDispatcherItem]
          }
          return newRecalcResults
        })

        toast({
          title: language === "ru" ? "Перенесено на диспетчера" : "Transferred to dispatcher",
          description: `${dispatcherName}: ${formatCurrency(amountToTransfer)} RUB`,
        })
      } else {
        // Обычное завершение — помечаем существующую запись как выполненную
        setRecalcResults((prev) =>
          prev.map((p) =>
            p.id === currentSettlementPerson.id
              ? { ...p, completedAt: new Date(), throughDispatcher: false, selectedDispatcher: "" }
              : p,
          ),
        )

        toast({
          title: language === "ru" ? "Операция принята" : "Operation accepted",
          description: `${formatCurrency(scannedQRData?.sum || currentSettlementPerson.amount)} RUB`,
        })
      }
    }

    // Сброс состояния
    setShowQRResult(false)
    setScannedQRData(null)
    setQRError(null)
    setCurrentSettlementPerson(null)
    setSettlementAction(null)
  }

  const handleRejectQR = () => {
    toast({
      title: language === "ru" ? "Операция отклонена" : "Operation rejected",
      variant: "destructive",
    })
    setShowQRResult(false)
    setScannedQRData(null)
    setQRError(null)
    setCurrentSettlementPerson(null)
    setSettlementAction(null)
  }

  const handleReturnQR = () => {
    setShowQRResult(false)
    setScannedQRData(null)
    setQRError(null)
    setCurrentSettlementPerson(null)
    setSettlementAction(null)
  }

  const handleCloseGeneratedQR = () => {
    setShowGeneratedQR(false)
    setGeneratedQRData(null)
    setCurrentSettlementPerson(null)
    setSettlementAction(null)
    toast({
      title: language === "ru" ? "QR код закрыт" : "QR code closed",
    })
  }

  const handleToggleDispatcher = (personId: number) => {
    setRecalcResults(
      recalcResults.map((p) =>
        p.id === personId ? { ...p, throughDispatcher: !p.throughDispatcher, selectedDispatcher: "" } : p,
      ),
    )
  }

  const handleSelectDispatcher = (personId: number, dispatcherId: string) => {
    setRecalcResults(recalcResults.map((p) => (p.id === personId ? { ...p, selectedDispatcher: dispatcherId } : p)))
  }

  useEffect(() => {
    const savedAuthState = localStorage.getItem("driverAuthenticated")
    if (savedAuthState !== "true") {
      router.push("/")
    }
  }, [router])

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-foreground flex-1">{t.driverBalance}</h1>
        </div>
      </div>

      <div className="px-4 pt-6 space-y-6">
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">{t.currentBalance}</span>
          </div>
          <div className="text-4xl font-bold text-foreground mb-4">{formatCurrency(balance)} RUB</div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-background/50">
                <div className="text-xs text-muted-foreground mb-1">{language === "ru" ? "Принять" : "To Accept"}</div>
                <div className="text-lg font-semibold text-green-600">{formatCurrency(toAccept)} RUB</div>
              </div>
              <div className="p-3 rounded-lg bg-background/50">
                <div className="text-xs text-muted-foreground mb-1">{language === "ru" ? "Списать" : "To Debit"}</div>
                <div className="text-lg font-semibold text-orange-600">{formatCurrency(toDebit)} RUB</div>
              </div>
            </div>

            {/* СТРОКА: Депозит слева, Сальдо справа */}
<div className="grid grid-cols-2 gap-3">
  <div className="p-3 rounded-lg bg-background/50">
    <div className="text-xs text-muted-foreground mb-1">{language === "ru" ? "Депозит" : "Deposit"}</div>
    <div className="text-lg font-semibold text-blue-600">{formatCurrency(deposit)} RUB</div>
  </div>
  <div className="p-3 rounded-lg bg-background/50">
    <div className="text-xs text-muted-foreground mb-1">{language === "ru" ? "Сальдо" : "Balance"}</div>
    <div className={`text-lg font-semibold ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
      {formatCurrency(saldo)} RUB
    </div>
  </div>
</div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-background/50">
                <div className="text-xs text-muted-foreground mb-1">{t.dailyIncome}</div>
                <div className="text-base font-semibold text-blue-600">{formatCurrency(3250)} RUB</div>
              </div>
              <div className="p-3 rounded-lg bg-background/50">
                <div className="text-xs text-muted-foreground mb-1">{t.weeklyIncome}</div>
                <div className="text-base font-semibold text-purple-600">{formatCurrency(18700)} RUB</div>
              </div>
            </div>
          </div>
        </Card>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "operations" | "settlements")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="operations">{language === "ru" ? "Операции" : "Operations"}</TabsTrigger>
            <TabsTrigger value="settlements">{language === "ru" ? "Расчеты" : "Settlements"}</TabsTrigger>
          </TabsList>

          <TabsContent value="operations" className="space-y-4 mt-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <Select value={periodFilter} onValueChange={(value) => setPeriodFilter(value as PeriodFilter)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t.today} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">{t.today}</SelectItem>
                  <SelectItem value="yesterday">{t.yesterday}</SelectItem>
                  <SelectItem value="week">{t.week}</SelectItem>
                  <SelectItem value="month">{t.month}</SelectItem>
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[120px] justify-between bg-transparent">
                    <span className="text-sm">
                      {paymentFilters.length === 2
                        ? language === "ru"
                          ? "Все"
                          : "All"
                        : paymentFilters.length === 1
                          ? paymentFilters[0] === "qr"
                            ? t.qr
                            : language === "ru"
                              ? "ЛС"
                              : "LS"
                          : language === "ru"
                            ? "Все"
                            : "All"}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[120px]">
                  <DropdownMenuCheckboxItem
                    checked={paymentFilters.length === 2}
                    onCheckedChange={() => togglePaymentFilter("all")}
                  >
                    {language === "ru" ? "Все" : "All"}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={paymentFilters.includes("qr")}
                    onCheckedChange={() => togglePaymentFilter("qr")}
                  >
                    {t.qr}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={paymentFilters.includes("cash")}
                    onCheckedChange={() => togglePaymentFilter("cash")}
                  >
                    {language === "ru" ? "ЛС" : "LS"}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Карточка результата сканирования (общая или ошибка) */}
            {showQRResult === "operations" && (scannedQRData || qrError) && (
              <Card
                className={`p-4 border-2 ${qrError ? "border-red-500 bg-red-50 dark:bg-red-900/20" : "border-green-500 bg-green-50 dark:bg-green-900/20"}`}
              >
                <div className="space-y-3">
                  {qrError === "mismatch" && (
                    <div className="flex items-center gap-2 text-red-600 font-bold">
                      <AlertCircle className="h-5 w-5" />
                      <span>{language === "ru" ? "Несоответствие данных!" : "Data mismatch!"}</span>
                    </div>
                  )}

                  {qrError === "not_found" ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-red-600 font-bold">
                        <AlertCircle className="h-5 w-5" />
                        <span>{language === "ru" ? "QR не найден" : "QR not found"}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {language === "ru"
                          ? "Сканируемый QR код не найден в системе."
                          : "Scanned QR code was not found in the system."}
                      </div>
                    </div>
                  ) : (
                    scannedQRData && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">{t.sumLabel}:</span>
                          <span className={`text-lg font-bold ${qrError ? "text-red-600" : "text-green-600"}`}>
                            {formatCurrency(scannedQRData.sum)} RUB
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {language === "ru" ? "Клиент:" : "Client:"}
                          </span>
                          <span className="text-sm font-semibold">{scannedQRData.recipient}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{t.qrCreatedAt}:</span>
                          <span className="text-sm font-semibold">{scannedQRData.created_at}</span>
                        </div>
                      </>
                    )
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleAcceptQR} className="flex-1" variant="default" disabled={qrError !== null}>
                      {t.accept}
                    </Button>
                    <Button onClick={handleRejectQR} className="flex-1" variant="destructive">
                      {t.reject}
                    </Button>
                    <Button
                      onClick={handleReturnQR}
                      className="h-10 w-10 bg-transparent"
                      variant="outline"
                      size="icon"
                      title={language === "ru" ? "Вернуть" : "Return"}
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {showQRResult !== "operations" && (
              <Button
                onClick={() => setShowCashQRDialog(true)}
                className="w-full h-14 text-base font-semibold"
                variant="default"
              >
                <QrCode className="mr-2 h-5 w-5" />
                {t.scanQR}
              </Button>
            )}

            <div className="space-y-3 mt-3">
              {filteredTransactions.map((transaction) => (
                <Card
                  key={transaction.id}
                  className="p-4 cursor-pointer hover:bg-accent/5 transition-colors"
                  onClick={() => toggleTransactionExpanded(transaction.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                        {transaction.paymentMethod === "qr" ? (
                          <QrCode className="h-5 w-5 text-green-600" />
                        ) : (
                          <Wallet className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground text-sm">
                          {getTransactionTypeLabel(transaction.type)} {formatDateTime(transaction.timestamp)} +
                          {formatCurrency(transaction.amount)} {getPaymentMethodLabel(transaction.paymentMethod)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{transaction.passengerName}</div>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        transaction.expanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>

                  {transaction.expanded && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{t.passengerInfo}:</span>
                          <span className="font-semibold">{transaction.passengerName}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{t.paymentAmount}:</span>
                          <span className="font-bold text-green-600">{formatCurrency(transaction.amount)} RUB</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{t.currentTime}:</span>
                          <span className="font-semibold">{formatDateTime(transaction.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settlements" className="space-y-4 mt-4">
            <Card className="p-4 border-2 border-border">
              {/* 1 & 2. Заголовок кнопка и дата перерасчета */}
              <div className="flex items-center justify-between mb-4">
                <Button
                  onClick={handleRecalculate}
                  variant="outline"
                  className="font-bold border-2 border-primary/20 hover:border-primary/50 bg-transparent"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {language === "ru" ? "Перерасчет" : "Recalculate"}
                </Button>
                {lastRecalcTime && (
                  <span className="text-xs text-muted-foreground font-mono">{formatDateTime(lastRecalcTime)}</span>
                )}
              </div>

              {/* Отображаем результат сканирования и для вкладки Settlements (вверху списка) */}
              {showQRResult === "settlements" && activeTab === "settlements" && (
                <Card
                  className={`p-4 mb-4 border-2 ${isValid ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-red-500 bg-red-50 dark:bg-red-900/20"}`}
                >
                  <div className="space-y-3">
                    {qrError === "mismatch" && (
                      <div className="flex items-center gap-2 text-red-600 font-bold">
                        <AlertCircle className="h-5 w-5" />
                        <span>{language === "ru" ? "Несоответствие данных!" : "Data mismatch!"}</span>
                      </div>
                    )}

                    {qrError === "not_found" ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-red-600 font-bold">
                          <AlertCircle className="h-5 w-5" />
                          <span>{language === "ru" ? "QR не найден" : "QR not found"}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {language === "ru"
                            ? "Сканируемый QR код не найден в системе."
                            : "Scanned QR code was not found in the system."}
                        </div>
                      </div>
                    ) : (
                      scannedQRData && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">{t.sumLabel}:</span>
                            <span className={`text-lg font-bold ${isValid ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(scannedQRData.sum)} RUB
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              {language === "ru" ? "В QR коде:" : "In QR code:"}
                            </span>
                            <span className="text-sm font-semibold">{scannedQRData.recipient}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{t.qrCreatedAt}:</span>
                            <span className="text-sm font-semibold">{scannedQRData.created_at}</span>
                          </div>
                        </>
                      )
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleAcceptQR} className="flex-1" variant="default" disabled={!isValid}>
                        {t.accept}
                      </Button>
                      <Button onClick={handleRejectQR} className="flex-1" variant="destructive">
                        {t.reject}
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              <div className="space-y-3">
                {recalcResults.map((result) => {
                  // 5. Вид после успешного чтения QR (без кнопок и галок)
                  if (result.completedAt) {
                    return (
                      <div
                        key={result.id}
                        className="p-3 border rounded-lg bg-green-50 dark:bg-green-900/10 border-green-200"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{result.name}</span>
                          <span className="font-bold text-green-700">{formatCurrency(result.amount)} RUB</span>
                        </div>
                        {/* Показываем дату/время для всех типов */}
                        <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                          {result.type !== "dispatcher" && result.dispatcherName && (
                            <span>
                              {language === "ru" ? "Через диспетчера" : "Through dispatcher"} {result.dispatcherName}
                            </span>
                          )}
                          <span className={result.type !== "dispatcher" && result.dispatcherName ? "" : "ml-auto"}>
                            {formatDateTime(result.completedAt)}
                          </span>
                        </div>
                      </div>
                    )
                  }

                  // НЕЗАВЕРШЕННЫЕ ОПЕРАЦИИ
                  const isSettlementNeeded = result.amount !== 0 && result.type === "dispatcher"
                  const showButtons = result.type === "driver" || isSettlementNeeded

                  return (
                    <div key={result.id} className="p-3 border rounded-lg bg-secondary">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold">{result.name}</span>
                        <span className={`text-sm font-bold ${result.amount < 0 ? "text-red-500" : "text-green-600"}`}>
                          {formatCurrency(result.amount)} RUB
                        </span>
                      </div>

                      {showButtons && (
                        <div className="flex gap-2 mb-3">
                          {result.amount < 0 ? (
                            <Button
                              onClick={() => handleSettlementAction(result, "debit")}
                              size="sm"
                              variant="destructive"
                              className="w-full"
                              disabled={
                                (result.type === "dispatcher" && result.throughDispatcher) ||
                                (result.throughDispatcher && !result.selectedDispatcher) ||
                                (result.type === "dispatcher" && showQRResult === "settlements")
                              }
                            >
                              {language === "ru" ? "Списать" : "Debit"}
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleSettlementAction(result, "credit")}
                              size="sm"
                              variant="default"
                              className="w-full"
                              disabled={
                                (result.type === "dispatcher" && result.throughDispatcher) ||
                                (result.throughDispatcher && !result.selectedDispatcher) ||
                                (result.type === "dispatcher" && showQRResult === "settlements")
                              }
                            >
                              {language === "ru" ? "Принять" : "Accept"}
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Чекбокс "Через диспетчера" показываем только для водителей */}
                      {result.type === "driver" && (
  <>
    <div className="flex items-center gap-2">
      <Checkbox
        id={`dispatcher-${result.id}`}
        checked={result.throughDispatcher}
        onCheckedChange={() => handleToggleDispatcher(result.id)}
        disabled={result.id === 999} // Для депозита чекбокс неактивен
      />
      <label htmlFor={`dispatcher-${result.id}`} className="text-sm">
        {language === "ru" ? "Через диспетчера" : "Through dispatcher"}
        {result.id === 999 && <span className="text-red-500 ml-1">*</span>}
      </label>
    </div>

    {result.throughDispatcher && (
      <Select
        value={result.selectedDispatcher}
        onValueChange={(value) => handleSelectDispatcher(result.id, value)}
      >
        <SelectTrigger className="w-full mt-2">
          <SelectValue
            placeholder={language === "ru" ? "Выберите диспетчера" : "Select dispatcher"}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dispatcher1">
            {language === "ru" ? "Диспетчер Петров" : "Dispatcher Petrov"}
          </SelectItem>
          <SelectItem value="dispatcher2">
            {language === "ru" ? "Диспетчер Сидоров" : "Dispatcher Sidorov"}
          </SelectItem>
        </SelectContent>
      </Select>
    )}
  </>
)}
                    </div>
                  )
                })}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog для показа сгенерированного QR при списании */}
      <Dialog open={showGeneratedQR} onOpenChange={setShowGeneratedQR}>
        <DialogContent className="sm:max-w-md">
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">
                {language === "ru" ? "QR код для списания" : "QR code for debit"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {language === "ru"
                  ? "Покажите этот QR код водителю для списания средств"
                  : "Show this QR code to the driver to debit funds"}
              </p>
            </div>

            {generatedQRData && (
  <Card className="p-4 bg-secondary">
    {/* Тестовые кнопки вместо QR */}
    <div className="flex items-center justify-center p-8 mb-4">
      <div className="w-full space-y-3">
        <Button
          onClick={() => {
            // Успешное сканирование
            if (currentSettlementPerson) {
              setRecalcResults((prev) =>
                prev.map((p) =>
                  p.id === currentSettlementPerson.id
                    ? { ...p, completedAt: new Date(), throughDispatcher: false, selectedDispatcher: "" }
                    : p,
                ),
              )
              
              // Если это был депозит (id === 999), обнуляем его
              if (currentSettlementPerson.id === 999) {
                setDeposit(0)
              }
              
              toast({
                title: language === "ru" ? "Операция выполнена" : "Operation completed",
                description: `${formatCurrency(generatedQRData.sum)} RUB`,
              })
            }
            setShowGeneratedQR(false)
            setGeneratedQRData(null)
            setCurrentSettlementPerson(null)
            setSettlementAction(null)
          }}
          variant="default"
          className="w-full h-24 text-lg font-semibold"
        >
          {language === "ru" ? "ОК - Успешно" : "OK - Success"}
        </Button>
        <Button
          onClick={() => {
            // Неудачное сканирование
            toast({
              title: language === "ru" ? "Операция отклонена" : "Operation rejected",
              variant: "destructive",
            })
            setShowGeneratedQR(false)
            setGeneratedQRData(null)
            setCurrentSettlementPerson(null)
            setSettlementAction(null)
          }}
          variant="destructive"
          className="w-full h-24 text-lg font-semibold"
        >
          {language === "ru" ? "НЕ ОК - Ошибка" : "NOT OK - Error"}
        </Button>
      </div>
    </div>

    <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t.sumLabel}:</span>
                    <span className="font-bold text-lg">{formatCurrency(generatedQRData.sum)} RUB</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t.recipientInfo}:</span>
                    <span className="font-semibold">{generatedQRData.recipient}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t.qrCreatedAt}:</span>
                    <span className="font-semibold">{generatedQRData.created_at}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog для сканирования QR (операции и прием при взаиморасчетах) */}
      <CashQRDialog
        open={showCashQRDialog}
        onOpenChange={setShowCashQRDialog}
        driverName={language === "ru" ? "Водитель Иванов И.И." : "Driver Ivanov I."}
        amount={currentSettlementPerson?.amount || 0}
        currency="RUB"
        onConfirm={handleQRConfirm}
        onInvalid={() => {}}
        language={language}
        showNotFoundButton={false}
      />
    </div>
  )
}
