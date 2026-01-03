"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Wallet, LogOut, ArrowLeftRight, Users, Clock, Minus, Plus, QrCode, Undo2, X } from "lucide-react"
import { LoginForm } from "@/components/login-form"
import { RegisterForm } from "@/components/register-form"
import { translations, type Language } from "@/lib/translations"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { formatCurrency, formatDateTime, generateTripId } from "@/lib/utils"
import { GeoTrackerIndicator } from "@/components/geo-tracker-indicator"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { QueueQRScanner } from "@/components/queue-qr-scanner"
import { CashQRDialog } from "@/components/cash-qr-dialog"
import { RACE_STATE_TO_PANELS, TRIP_STATUS_TO_RACE_STATE } from "@/lib/fsm-types"

const STATE = {
  PREP_IDLE: "PREP_IDLE",
  PREP_TIMER: "PREP_TIMER",
  BOARDING: "BOARDING",
  ROUTE_READY: "ROUTE_READY",
  IN_ROUTE: "IN_ROUTE",
  FINISHED: "FINISHED",
} as const

type TripStatus = (typeof STATE)[keyof typeof STATE]

interface Seat {
  id: number
  status: "free" | "occupied"
  passengerName?: string
  fromStop?: number
  toStop?: number
  paymentMethod?: "cash" | "qr"
  amountPaid?: number
}

interface Booking {
  id: number
  passengerName: string
  pickupTime: string
  pickupLocation: string
  fromStopIndex: number
  toStopIndex: number
  amount: number
  accepted?: boolean
  reserved?: boolean
  scanned?: boolean
  qrError?: string
  count: number
  showQRButtons?: boolean
  qrData?: {
    sum: number
    recipient: string
    created_at: string
  }
  passengerCount?: number
  cancelContext?: 'boarding' | 'future_stop' // ДОБАВЛЕНО
}

interface RouteStop {
  id: number
  name: string
  time: string
}

interface QueuePassenger {
  id: number
  name: string
  queuePosition: number
  isFirst: boolean
  scanned?: boolean
  count: number
  qrError?: boolean
  showQRButtons?: boolean
  qrData?: {
    sum: number
    recipient: string
    created_at: string
  }
  ticketCount: number
  orderNumber: number
}

interface StopHistory {
  stopId: number
  reserved: number
  boarded: number
}

const tripRoutes = {
  "247": {
    start: "Центр",
    end: "Вокзал",
    stops: [
      { id: 0, name: "Центр", time: "14:00" },
      { id: 1, name: "ул. Ленина", time: "14:15" },
      { id: 2, name: "ТЦ Галерея", time: "14:45" },
      { id: 3, name: "Вокзал", time: "15:15" },
    ],
  },
  "248": {
    start: "Аэропорт",
    end: "Университет",
    stops: [
      { id: 0, name: "Аэропорт", time: "10:00" },
      { id: 1, name: "пл. Революции", time: "10:20" },
      { id: 2, name: "пр. Победы", time: "10:40" },
      { id: 3, name: "Университет", time: "11:00" },
    ],
  },
  "249": {
    start: "Рынок",
    end: "Больница",
    stops: [
      { id: 0, name: "Рынок", time: "08:00" },
      { id: 1, name: "ул. Мира", time: "08:20" },
      { id: 2, name: "Парк", time: "08:40" },
      { id: 3, name: "Больница", time: "09:00" },
    ],
  },
}

export default function DriverDashboard() {
  const [currentStopIndex, setCurrentStopIndex] = useState<number>(0)
  const [visitedStops, setVisitedStops] = useState(new Set<number>())

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [userStatus, setUserStatus] = useState<"pending" | "approved" | "confirmed">("pending") // Changed to include confirmed
  const [language, setLanguage] = useState<Language>("ru")
  const t = translations[language]
  const { toast } = useToast()

  const [tripStatus, setTripStatus] = useState<TripStatus>(STATE.PREP_IDLE)
  const [tripId, setTripId] = useState<string>("")
  const [selectedTrip, setSelectedTrip] = useState("247")
  const [isDirectionReversed, setIsDirectionReversed] = useState(false)
  const [isRouteDropdownDisabled, setIsRouteDropdownDisabled] = useState(false)

  const [prepareTimer, setPrepareTimer] = useState<number>(600)

  const [balance, setBalance] = useState(12450)
  const [showCashQRDialog, setShowCashQRDialog] = useState(false)
  const [currentCashAmount, setCurrentCashAmount] = useState(0)
  const [qrScannedData, setQrScannedData] = useState<{
    amount: number
    recipient: string
    createdAt: string
    scannedPassengerId?: number
  } | null>(null)
  const [stopHistoryMap, setStopHistoryMap] = useState(new Map<number, StopHistory>())

  const [stops, setStops] = useState<RouteStop[]>(tripRoutes["247"].stops)

  const [seats, setSeats] = useState<Seat[]>([
    {
      id: 1,
      status: "occupied",
      passengerName: "Иван П.",
      fromStop: 0,
      toStop: 3,
      paymentMethod: "qr",
      amountPaid: 450,
    },
    {
      id: 2,
      status: "occupied",
      passengerName: "Мария С.",
      fromStop: 0,
      toStop: 2,
      paymentMethod: "cash",
      amountPaid: 280,
    },
    { id: 3, status: "free" },
    { id: 4, status: "free" },
    {
      id: 5,
      status: "occupied",
      passengerName: "Алексей К.",
      fromStop: 0,
      toStop: 3,
      paymentMethod: "qr",
      amountPaid: 380,
    },
    { id: 6, status: "free" },
  ])

  const [bookings, setBookings] = useState<Booking[]>([
    {
      id: 1,
      passengerName: "Ольга В.",
      pickupTime: "14:15",
      pickupLocation: tripRoutes["247"].stops[1].name,
      fromStopIndex: 1,
      toStopIndex: 3,
      amount: 320,
      count: 1,
      passengerCount: 1, // Added
    },
    {
      id: 2,
      passengerName: "Дмитрий Н.",
      pickupTime: "14:15",
      pickupLocation: tripRoutes["247"].stops[1].name,
      fromStopIndex: 1,
      toStopIndex: 3,
      amount: 320,
      count: 2,
      passengerCount: 1, // Added
    },
    {
      id: 3,
      passengerName: "Елена Т.",
      pickupTime: "14:45",
      pickupLocation: tripRoutes["247"].stops[2].name,
      fromStopIndex: 2,
      toStopIndex: 3,
      amount: 180,
      count: 1,
      passengerCount: 1, // Added
    },
  ])

  const [queuePassengers, setQueuePassengers] = useState<QueuePassenger[]>([
    { id: 1, name: "Петр С.", queuePosition: 1, isFirst: true, count: 1, ticketCount: 1, orderNumber: 1 },
    { id: 2, name: "Анна М.", queuePosition: 2, isFirst: false, count: 2, ticketCount: 2, orderNumber: 2 },
    { id: 3, name: "Игорь Л.", queuePosition: 3, isFirst: false, count: 1, ticketCount: 1, orderNumber: 3 },
    { id: 4, name: "Ольга К.", queuePosition: 4, isFirst: false, count: 3, ticketCount: 3, orderNumber: 4 },
    { id: 5, name: "Сергей Д.", queuePosition: 5, isFirst: false, count: 1, ticketCount: 1, orderNumber: 5 },
  ])

  const [manualOccupied, setManualOccupied] = useState(0)
  const [tempBookingId, setTempBookingId] = useState<number | null>(null)
  const [scanningForQueue, setScanningForQueue] = useState(false)
  const [highlightedBookingId, setHighlightedBookingId] = useState<number | null>(null)
  const [currentQueueScanId, setCurrentQueueScanId] = useState<number | null>(null)
  const [highlightedPassengerId, setHighlightedPassengerId] = useState<number | null>(null) // Added for queue passengers
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelBookingId, setCancelBookingId] = useState<number | null>(null)
  const [cancelReason, setCancelReason] = useState<string>("")
  const [isScanningLocked, setIsScanningLocked] = useState(false)
  const [areSeatsLocked, setAreSeatsLocked] = useState(true) // Seats start locked
  const [isGeoTrackerActive, setIsGeoTrackerActive] = useState(false)
  const [showStopHistory, setShowStopHistory] = useState(false)
  const currentRaceState = TRIP_STATUS_TO_RACE_STATE[tripStatus]
  const panelVisibility = RACE_STATE_TO_PANELS[currentRaceState]
  const scanInProgressRef = useRef(false)
  // Загрузка состояния из localStorage при монтировании
  // В useEffect для сохранения состояния:
useEffect(() => {
  const stateToSave = {
    tripStatus,
    tripId,
    selectedTrip,
    isDirectionReversed,
    currentStopIndex,
    manualOccupied,
    areSeatsLocked,
    isGeoTrackerActive,
    prepareTimer,
    visitedStops: Array.from(visitedStops),
    bookings, // ДОБАВЛЕНО
  }
  localStorage.setItem("driverAppState", JSON.stringify(stateToSave))
}, [
  tripStatus,
  tripId,
  selectedTrip,
  isDirectionReversed,
  currentStopIndex,
  manualOccupied,
  areSeatsLocked,
  isGeoTrackerActive,
  prepareTimer,
  visitedStops,
  bookings, // ДОБАВЛЕНО
])

// Загрузка состояния ПРИ МОНТИРОВАНИИ (выполняется ОДИН раз)
// ИСПРАВЛЕНО: Загрузка и сохранение состояния
  const [isStateLoaded, setIsStateLoaded] = useState(false)

  // 1. ЗАГРУЗКА состояния ПРИ МОНТИРОВАНИИ (выполняется ОДИН раз)
  useEffect(() => {
    const savedState = localStorage.getItem("driverAppState")
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        
        console.log("[v0] Restoring state from localStorage:", parsed)
        
        // Восстанавливаем базовые состояния
        if (parsed.tripStatus !== undefined) setTripStatus(parsed.tripStatus)
        if (parsed.tripId !== undefined) setTripId(parsed.tripId)
        if (parsed.selectedTrip !== undefined) setSelectedTrip(parsed.selectedTrip)
        if (parsed.isDirectionReversed !== undefined) setIsDirectionReversed(parsed.isDirectionReversed)
        if (parsed.currentStopIndex !== undefined) setCurrentStopIndex(parsed.currentStopIndex)
        if (parsed.manualOccupied !== undefined) setManualOccupied(parsed.manualOccupied)
        
        // Критические состояния
        if (parsed.areSeatsLocked !== undefined) setAreSeatsLocked(parsed.areSeatsLocked)
        if (parsed.isGeoTrackerActive !== undefined) setIsGeoTrackerActive(parsed.isGeoTrackerActive)
        
        // Таймер
        if (parsed.prepareTimer !== undefined) setPrepareTimer(parsed.prepareTimer)
        
        // Посещенные остановки
        if (parsed.visitedStops && Array.isArray(parsed.visitedStops)) {
          setVisitedStops(new Set(parsed.visitedStops))
        }
        
        // История остановок
        if (parsed.stopHistoryMap) {
          const restoredMap = new Map()
          Object.entries(parsed.stopHistoryMap).forEach(([key, value]) => {
            restoredMap.set(Number(key), value)
          })
          setStopHistoryMap(restoredMap)
        }
        
        // Бронирования с полным сохранением статусов
        if (parsed.bookings && Array.isArray(parsed.bookings)) {
          setBookings(parsed.bookings)
        }
        
        // Места
        if (parsed.seats && Array.isArray(parsed.seats)) {
          setSeats(parsed.seats)
        }
        
        // Очередь
        if (parsed.queuePassengers && Array.isArray(parsed.queuePassengers)) {
          setQueuePassengers(parsed.queuePassengers)
        }
        
        // Маршрут (остановки)
        if (parsed.stops && Array.isArray(parsed.stops)) {
          setStops(parsed.stops)
        }
        
        console.log("[v0] State successfully restored from localStorage")
      } catch (e) {
        console.error("[v0] Failed to restore state:", e)
      }
    }
    setIsStateLoaded(true)
  }, []) // ВАЖНО: Пустой массив зависимостей

  // 2. СОХРАНЕНИЕ состояния при изменениях (только после загрузки)
  useEffect(() => {
    if (!isStateLoaded) {
      console.log("[v0] Skipping save - state not loaded yet")
      return
    }
    
    // Не сохраняем пустое начальное состояние
    if (!selectedTrip && tripStatus === STATE.PREP_IDLE && !tripId) {
      console.log("[v0] Skipping save - initial state")
      return
    }
    
    // Конвертируем Map в объект для сохранения
    const stopHistoryObject: Record<number, StopHistory> = {}
    stopHistoryMap.forEach((value, key) => {
      stopHistoryObject[key] = value
    })
    
    const stateToSave = {
      tripStatus,
      tripId,
      selectedTrip,
      isDirectionReversed,
      currentStopIndex,
      manualOccupied,
      areSeatsLocked,
      isGeoTrackerActive,
      prepareTimer,
      visitedStops: Array.from(visitedStops),
      stopHistoryMap: stopHistoryObject,
      bookings,
      seats,
      queuePassengers,
      stops,
    }
    
    localStorage.setItem("driverAppState", JSON.stringify(stateToSave))
    console.log("[v0] State saved to localStorage")
  }, [
    isStateLoaded, // ДОБАВЛЕНО
    tripStatus,
    tripId,
    selectedTrip,
    isDirectionReversed,
    currentStopIndex,
    manualOccupied,
    areSeatsLocked,
    isGeoTrackerActive,
    prepareTimer,
    visitedStops,
    stopHistoryMap,
    bookings,
    seats,
    queuePassengers,
    stops,
  ])

  useEffect(() => {
    const savedAuthState = localStorage.getItem("driverAuthenticated")
    if (savedAuthState === "true") {
      setIsAuthenticated(true)
    }
    const savedUserStatus = localStorage.getItem("userStatus")
    if (savedUserStatus) {
      setUserStatus(savedUserStatus as "pending" | "approved" | "confirmed")
    }
  }, [])

  useEffect(() => {
    if (tripStatus === STATE.PREP_TIMER) {
      const interval = setInterval(() => {
        setPrepareTimer((prev) => prev - 1)
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [tripStatus])

  const cycleLanguage = () => {
    const languages: Language[] = ["ru", "en", "fr", "ar"]
    const currentIndex = languages.indexOf(language)
    const nextIndex = (currentIndex + 1) % languages.length
    setLanguage(languages[nextIndex])
  }

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
  }

  const clickStartPrep = () => {
    if (userStatus !== "confirmed") {
      console.log("[v0] ui:blocked", { action: "startPrep", reason: "accountUnconfirmed" })
      toast({
        title: t.error,
        description: language === "ru" ? "Аккаунт не подтвержден" : "Account not confirmed",
        variant: "destructive",
      })
      return
    }
    if (tripStatus !== STATE.PREP_IDLE) {
      console.error("[v0] Illegal transition: clickStartPrep from", tripStatus)
      return
    }
    // Геотрекер НЕ включаем в PREP_TIMER, включим позже
    setAreSeatsLocked(false)
    const newTripId = generateTripId()
    setTripId(newTripId)
    setTripStatus(STATE.PREP_TIMER)
    setPrepareTimer(600)
  }
  const clickCancelPrep = () => {
    if (tripStatus !== STATE.PREP_TIMER) {
      console.error("[v0] Illegal transition: clickCancelPrep from", tripStatus)
      return
    }
    setIsGeoTrackerActive(false)
    setAreSeatsLocked(true)
    setPrepareTimer(600)
    setTripId("")
    setTripStatus(STATE.PREP_IDLE)

    toast({
      title: language === "ru" ? "Отменено" : "Cancelled",
      description: language === "ru" ? "Подготовка рейса отменена" : "Trip preparation cancelled",
    })
  }
  // Added complete implementation for clickStartBoarding
  const clickStartBoarding = () => {
    if (tripStatus !== STATE.PREP_TIMER) {
      console.error("[v0] Illegal transition: clickStartBoarding from", tripStatus)
      return
    }
    // ИСПРАВЛЕНИЕ: Включаем геотрекер в начале посадки
    setIsGeoTrackerActive(true)
    setVisitedStops((prev) => new Set(prev).add(currentStopIndex))
    setTripStatus(STATE.BOARDING)
  }

  const clickReadyForRoute = () => {
    if (tripStatus !== STATE.BOARDING) {
      console.error("[v0] Illegal transition: clickReadyForRoute from", tripStatus)
      return
    }
    setVisitedStops((prev) => new Set(prev).add(currentStopIndex))
    setTripStatus(STATE.ROUTE_READY)
  }

  const clickStartRoute = () => {
    if (tripStatus !== STATE.ROUTE_READY && tripStatus !== STATE.BOARDING) {
      console.error("[v0] Illegal transition: clickStartRoute from", tripStatus)
      return
    }

    // ИСПРАВЛЕННЫЙ подсчет:
    // Зарезервировано = все брони на этой остановке, которые еще НЕ отсканированы (не сели)
    const reservedCount = bookings
      .filter((b) => b.fromStopIndex === currentStopIndex && !b.scanned)
      .reduce((sum, b) => sum + (b.passengerCount || b.count || 1), 0)

    // Посажено = те, кто успешно прошел сканирование на этой остановке
    const boardedCount = bookings
      .filter((b) => b.fromStopIndex === currentStopIndex && b.scanned)
      .reduce((sum, b) => sum + (b.passengerCount || b.count || 1), 0)

    setStopHistoryMap((prev) => {
      const newMap = new Map(prev)
      newMap.set(currentStopIndex, {
        stopId: currentStopIndex,
        reserved: reservedCount,
        boarded: boardedCount,
      })
      return newMap
    })

    setVisitedStops((prev) => new Set(prev).add(currentStopIndex))
    setCurrentStopIndex(currentStopIndex + 1)
    setTripStatus(STATE.IN_ROUTE)
  }

  const clickArrivedAtStop = () => {
    if (tripStatus !== STATE.IN_ROUTE) {
      console.error("[v0] Illegal transition: clickArrivedAtStop from", tripStatus)
      return
    }

    setVisitedStops((prev) => new Set(prev).add(currentStopIndex))

    // ИСПРАВЛЕНО: Подсчет статистики ПЕРЕД переходом
    const stopBookings = bookings.filter((b) => b.fromStopIndex === currentStopIndex)

    const reservedCount = stopBookings
      .filter((b) => !b.scanned)
      .reduce((sum, b) => sum + (b.passengerCount || b.count || 1), 0)

    const boardedCount = stopBookings
      .filter((b) => b.scanned)
      .reduce((sum, b) => sum + (b.passengerCount || b.count || 1), 0)

    setStopHistoryMap((prev) => {
      const newMap = new Map(prev)
      newMap.set(currentStopIndex, {
        stopId: currentStopIndex,
        reserved: reservedCount,
        boarded: boardedCount,
      })
      return newMap
    })

    // Проверяем, конечная ли это остановка
    if (currentStopIndex === stops.length - 1) {
      // Конечная остановка - завершаем рейс
      setTripStatus(STATE.FINISHED)
    } else {
      // Промежуточная остановка - переходим в BOARDING для посадки
      setTripStatus(STATE.BOARDING) // ИСПРАВЛЕНО: было ROUTE_READY
    }
  }

  const clickFinish = () => {
  if (tripStatus !== "FINISHED") {
    console.error("[v0] Illegal transition: clickFinish from", tripStatus)
    return
  }
  setIsGeoTrackerActive(false)
  setAreSeatsLocked(true)
  setPrepareTimer(600)
  setTripId("")
  setIsDirectionReversed(false)
  setTripStatus(STATE.PREP_IDLE)
  setCurrentStopIndex(0)
  setVisitedStops(new Set())
  setStopHistoryMap(new Map())
  setManualOccupied(0)

  // Сбросить статусы броней к начальному состоянию
  setBookings([
    {
      id: 1,
      passengerName: "Ольга В.",
      pickupTime: "14:15",
      pickupLocation: tripRoutes["247"].stops[1].name,
      fromStopIndex: 1,
      toStopIndex: 3,
      amount: 320,
      count: 1,
      passengerCount: 1,
    },
    {
      id: 2,
      passengerName: "Дмитрий Н.",
      pickupTime: "14:15",
      pickupLocation: tripRoutes["247"].stops[1].name,
      fromStopIndex: 1,
      toStopIndex: 3,
      amount: 320,
      count: 2,
      passengerCount: 1,
    },
    {
      id: 3,
      passengerName: "Елена Т.",
      pickupTime: "14:45",
      pickupLocation: tripRoutes["247"].stops[2].name,
      fromStopIndex: 2,
      toStopIndex: 3,
      amount: 180,
      count: 1,
      passengerCount: 1,
    },
  ])

  setSeats([
    {
      id: 1,
      status: "occupied",
      passengerName: "Иван П.",
      fromStop: 0,
      toStop: 3,
      paymentMethod: "qr",
      amountPaid: 450,
    },
    {
      id: 2,
      status: "occupied",
      passengerName: "Мария С.",
      fromStop: 0,
      toStop: 2,
      paymentMethod: "cash",
      amountPaid: 280,
    },
    { id: 3, status: "free" },
    { id: 4, status: "free" },
    {
      id: 5,
      status: "occupied",
      passengerName: "Алексей К.",
      fromStop: 0,
      toStop: 3,
      paymentMethod: "qr",
      amountPaid: 380,
    },
    { id: 6, status: "free" },
  ])

  setQueuePassengers([
    { id: 1, name: "Петр С.", queuePosition: 1, isFirst: true, count: 1, ticketCount: 1, orderNumber: 1 },
    { id: 2, name: "Анна М.", queuePosition: 2, isFirst: false, count: 2, ticketCount: 2, orderNumber: 2 },
    { id: 3, name: "Игорь Л.", queuePosition: 3, isFirst: false, count: 1, ticketCount: 1, orderNumber: 3 },
    { id: 4, name: "Ольга К.", queuePosition: 4, isFirst: false, count: 3, ticketCount: 3, orderNumber: 4 },
    { id: 5, name: "Сергей Д.", queuePosition: 5, isFirst: false, count: 1, ticketCount: 1, orderNumber: 5 },
  ])
  
  // НЕ ОЧИЩАЕМ localStorage здесь - он автоматически обновится через useEffect
}
  const getTripButtonText = () => {
    if (tripStatus === STATE.PREP_IDLE) return t.prepareTrip

    if (tripStatus === STATE.PREP_TIMER) {
      return `${t.prepareTrip}  ${formatTimer(prepareTimer)}`
    }

    if (tripStatus === STATE.BOARDING) {
      // ИСПРАВЛЕНО: Показываем разный текст для первой и промежуточных остановок
      if (currentStopIndex === 0) {
        return t.startBoarding // "Начать посадку"
      } else {
        return language === "ru" ? "Посадка завершена" : "Boarding Complete"
      }
    }

    if (tripStatus === STATE.ROUTE_READY) {
      if (currentStopIndex === 0) {
        return language === "ru" ? "Отправиться" : "Depart"
      } else {
        return language === "ru" ? "Продолжить рейс" : "Continue Trip"
      }
    }

    if (tripStatus === STATE.IN_ROUTE) {
      const stopName = stops[currentStopIndex]?.name || ""
      return language === "ru" ? `Прибыл ${stopName}` : `Arrived ${stopName}`
    }

    if (tripStatus === STATE.FINISHED) return t.finishTrip

    return ""
  }

  const getTripStatusEmoji = () => {
    if (tripStatus === STATE.IN_ROUTE) return "🚌"
    if (tripStatus === STATE.ROUTE_READY) return "🚦"
    if (tripStatus === STATE.BOARDING) return "👥"
    if (tripStatus === STATE.PREP_TIMER) return "⏱️"
    return "⏸️"
  }

  const formatTimer = (seconds: number) => {
    const isNegative = seconds < 0
    const absSeconds = Math.abs(seconds)
    const mins = Math.floor(absSeconds / 60)
    const secs = absSeconds % 60
    const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    return isNegative ? `-${timeStr}` : timeStr
  }

  const handleTripButton = () => {
    if (tripStatus === STATE.PREP_IDLE) {
      clickStartPrep()
    } else if (tripStatus === STATE.PREP_TIMER) {
      clickStartBoarding()
    } else if (tripStatus === STATE.BOARDING) {
      clickReadyForRoute()
    } else if (tripStatus === STATE.ROUTE_READY) {
      clickStartRoute()
    } else if (tripStatus === STATE.IN_ROUTE) {
      clickArrivedAtStop()
    } else if (tripStatus === STATE.FINISHED) {
      clickFinish()
    }
  }

  const handleOpenBookingScanner = (bookingId: number) => {
    if (areSeatsLocked) {
      // Check if seats are locked
      console.log("[v0] ui:blocked", { action: "openBookingScanner", reason: "seatsLocked" })
      toast({
        title: t.error,
        description: language === "ru" ? "Сначала начните подготовку рейса" : "Start trip preparation first",
        variant: "destructive",
      })
      return
    }

    if (isScanningLocked) {
      console.log("[v0] ui:blocked", { action: "openBookingScanner", reason: "scanningInProgress" })
      return
    }

    if (userStatus !== "confirmed") {
      console.log("[v0] ui:blocked", { action: "openBookingScanner", reason: "accountUnconfirmed" })
      toast({
        title: t.error,
        description: language === "ru" ? "Аккаунт не подтвержден" : "Account not confirmed",
        variant: "destructive",
      })
      return
    }

    console.log("[v0] scan:start", { bookingId, timestamp: new Date().toISOString() }) // Changed log message
    setIsScanningLocked(true)
    setTempBookingId(bookingId)
    setScanningForQueue(false)
    setCurrentQueueScanId(null)
    setShowCashQRDialog(true)
    setTimeout(() => setIsScanningLocked(false), 300)
  }

  const handleReturnBooking = (bookingId: number) => {
    console.log("[v0] return:clicked", { bookingId, timestamp: new Date().toISOString() })

    const booking = bookings.find((b) => b.id === bookingId)
    if (!booking) {
      console.log("[v0] return:error", { bookingId, reason: "booking_not_found" })
      return
    }

    // Если была ошибка QR, открываем сканер снова
    if (booking.qrError) {
      setBookings(
        bookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                qrError: undefined,
              }
            : b,
        ),
      )

      // Открываем сканер заново
      handleOpenBookingScanner(bookingId)
      return
    }

    // Остальная логика возврата...
    setBookings(
      bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              showQRButtons: false,
              qrData: undefined,
              accepted: false,
              reserved: false,
              scanned: false,
              qrError: undefined,
            }
          : b,
      ),
    )

    if (booking.scanned) {
      const seatCountToRevert = booking.passengerCount || booking.count || 1
      setManualOccupied((prev) => Math.max(0, prev - seatCountToRevert))
    }

    toast({
      title: language === "ru" ? "Возврат" : "Return",
      description: language === "ru" ? "Бронь возвращена в начальное состояние" : "Booking returned to initial state",
    })
  }

  const handleReturnQueuePassenger = (passengerId: number) => {
    console.log("[v0] return:clicked", { passengerId, timestamp: new Date().toISOString() })

    const passenger = queuePassengers.find((p) => p.id === passengerId)
    if (!passenger) {
      console.log("[v0] return:error", { passengerId, reason: "passenger_not_found" })
      return
    }

    setQueuePassengers(
      queuePassengers.map((p) =>
        p.id === passengerId
          ? {
              ...p,
              showQRButtons: false,
              qrData: undefined,
              scanned: false, // Added: reset scanned status
              qrError: undefined, // Added: reset qrError
            }
          : p,
      ),
    )

    const seatCountToRevert = passenger.ticketCount || 1
    setManualOccupied((prev) => Math.max(0, prev - seatCountToRevert))

    console.log("[v0] return:success", {
      passengerId,
      seatCountReverted: seatCountToRevert,
      timestamp: new Date().toISOString(),
    })

    toast({
      title: language === "ru" ? "Возврат" : "Return",
      description: language === "ru" ? "Операция отменена" : "Operation canceled",
    })
  }

  const handleAcceptBooking = (bookingId: number) => {
    const booking = bookings.find((b) => b.id === bookingId)
    if (!booking) return

    // Если бронь зарезервирована, открываем сканер QR
    if (booking.reserved) {
      console.log("[v0] accept:clicked", {
        bookingId,
        amount: booking.amount,
        timestamp: new Date().toISOString(),
      })
      handleOpenBookingScanner(bookingId)
    }
  }
  const handleReserveBooking = (bookingId: number) => {
  if (areSeatsLocked) {
    console.log("[v0] ui:blocked", { action: "reserveBooking", reason: "seatsLocked" })
    toast({
      title: t.error,
      description: language === "ru" ? "Сначала начните подготовку рейса" : "Start trip preparation first",
      variant: "destructive",
    })
    return
  }

  const booking = bookings.find((b) => b.id === bookingId)
  if (!booking) return

  // Проверяем наличие свободных мест
  const freeSeatsCount = 6 - manualOccupied - acceptedBookingsCount
  const bookingCount = booking.count || 1

  if (freeSeatsCount < bookingCount) {
    console.log("[v0] ui:blocked", { action: "reserveBooking", reason: "noFreeSeats" })
    toast({
      title: t.error,
      description: language === "ru" ? "Недостаточно свободных мест" : "Not enough free seats",
      variant: "destructive",
    })
    return
  }

  console.log("[v0] booking:reserved", {
    bookingId,
    count: bookingCount,
    timestamp: new Date().toISOString(),
  })

  setBookings(
    bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            reserved: true,
            accepted: true, // ДОБАВЛЕНО: устанавливаем accepted при резервировании
          }
        : b,
    ),
  )

  toast({
    title: language === "ru" ? "Бронь принята" : "Booking reserved",
    description: `${booking.passengerName} - ${language === "ru" ? "место зарезервировано" : "seat reserved"}`,
  })
}

  const handleRejectBooking = (bookingId: number) => {
    const booking = bookings.find((b) => b.id === bookingId)
    if (!booking) return

    console.log("[v0] booking:rejected", {
      bookingId,
      reason: "driver_rejected",
      timestamp: new Date().toISOString(),
    })

    setBookings(bookings.filter((b) => b.id !== bookingId))

    toast({
      title: language === "ru" ? "Бронь отклонена" : "Booking rejected",
      description: booking.passengerName,
      variant: "destructive",
    })
  }
  const handleCancelBooking = (bookingId: number, isOnCurrentStop: boolean) => {
  setCancelBookingId(bookingId)
  setCancelReason("")
  // Сохраняем информацию, это бронь на текущей остановке или нет
  setBookings((prev) =>
    prev.map((b) =>
      b.id === bookingId
        ? { ...b, cancelContext: isOnCurrentStop ? 'boarding' : 'future_stop' }
        : b
    )
  )
  setShowCancelDialog(true)
}

  const confirmCancelBooking = () => {
    if (!cancelBookingId || !cancelReason) return

    const booking = bookings.find((b) => b.id === cancelBookingId)
    if (!booking) return

    console.log("[v0] booking:cancelled", {
      bookingId: cancelBookingId,
      reason: cancelReason,
      timestamp: new Date().toISOString(),
    })

    setBookings(bookings.filter((b) => b.id !== cancelBookingId))

    toast({
      title: language === "ru" ? "Бронь отменена" : "Booking cancelled",
      description: `${booking.passengerName} - ${cancelReason}`,
      variant: "destructive",
    })

    setShowCancelDialog(false)
    setCancelBookingId(null)
    setCancelReason("")
  }
  const handleAcceptBookingQR = (bookingId: number) => {
    const booking = bookings.find((b) => b.id === bookingId)
    if (!booking || !booking.qrData) return

    console.log("[v0] accept:clicked", {
      bookingId: bookingId,
      amount: booking.amount,
      timestamp: new Date().toISOString(),
    })

    const bookingCount = booking.count || 1
    const updatedSeats = [...seats]
    let seatsToOccupy = bookingCount

    for (let i = 0; i < updatedSeats.length && seatsToOccupy > 0; i++) {
      if (updatedSeats[i].status === "free") {
        updatedSeats[i] = {
          ...updatedSeats[i],
          status: "occupied",
          passengerName: booking.passengerName,
          fromStop: booking.fromStopIndex,
          toStop: booking.toStopIndex,
          paymentMethod: "qr",
          amountPaid: booking.amount / bookingCount,
        }
        seatsToOccupy--
      }
    }

    setSeats(updatedSeats)
    setBalance(balance + booking.amount)

    // ИСПРАВЛЕНИЕ: Не удаляем, а помечаем как отсканированный
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, scanned: true, accepted: true, showQRButtons: false } : b)),
    )

    toast({
      title: language === "ru" ? "Бронь принята" : "Booking accepted",
      description: `${booking.passengerName} - ${formatCurrency(booking.amount)} RUB`,
    })
  }

  const handleRejectBookingQR = (bookingId: number) => {
    const booking = bookings.find((b) => b.id === bookingId)
    if (!booking) return

    console.log("[v0] reject:clicked", {
      bookingId: bookingId,
      reason: "driver_rejected_valid_qr",
      timestamp: new Date().toISOString(),
    })

    setBookings(bookings.filter((b) => b.id !== bookingId))

    toast({
      title: language === "ru" ? "Бронь отклонена" : "Booking rejected",
      description: booking.passengerName,
      variant: "destructive",
    })
  }

  const handleRevertBookingQR = (bookingId: number) => {
    console.log("[v0] Reverting booking QR:", bookingId)
    setBookings(bookings.map((b) => (b.id === bookingId ? { ...b, showQRButtons: false, qrData: undefined } : b)))
  }

  const handleRevertPassengerQR = (passengerId: number) => {
    console.log("[v0] Reverting passenger QR:", passengerId)
    const passenger = queuePassengers.find((p) => p.id === passengerId)
    if (!passenger) return

    // Revert seat occupancy
    const seatsToFree = passenger.ticketCount
    setSeats((prevSeats) => {
      const occupiedSeats = prevSeats.filter((s) => s.status === "occupied" && s.passengerName === passenger.name)
      const seatsToUpdate = occupiedSeats.slice(0, seatsToFree)
      return prevSeats.map((seat) =>
        seatsToUpdate.find((s) => s.id === seat.id)
          ? {
              ...seat,
              status: "free" as const,
              passengerName: undefined,
              fromStop: undefined,
              toStop: undefined,
              paymentMethod: undefined,
              amountPaid: undefined,
            }
          : seat,
      )
    })

    // Reset passenger state
    setQueuePassengers(
      queuePassengers.map((p) => (p.id === passengerId ? { ...p, showQRButtons: false, qrData: undefined } : p)),
    )
  }

  const handleConfirmQR = () => {
    if (tempBookingId !== null && tempBookingId !== undefined) {
      const booking = bookings.find((b) => b.id === tempBookingId)
      if (!booking) return

      console.log("[v0] scan:result", {
        bookingId: tempBookingId,
        stopId: booking.fromStopIndex,
        match: true,
        timestamp: new Date().toISOString(),
      })

      const mockQRData = {
        sum: booking.amount,
        recipient: language === "ru" ? "Водитель Иванов И.И." : "Driver Ivanov I.",
        created_at: formatDateTime(new Date(Date.now() - Math.floor(Math.random() * 3600000))),
      }

      setBookings(
        bookings.map((b) =>
          b.id === tempBookingId
            ? {
                ...b,
                showQRButtons: true,
                qrData: mockQRData,
                qrError: undefined,
                scanned: true, // Added: mark as scanned
              }
            : b,
        ),
      )

      setTimeout(() => {
        setShowCashQRDialog(false)
        setIsScanningLocked(false)
      }, 1500)
    } else if (scanningForQueue || currentQueueScanId !== null) {
      const passenger = queuePassengers.find((p) => p.id === currentQueueScanId)
      if (!passenger) return

      console.log("[v0] scan:result", {
        passengerId: currentQueueScanId,
        match: true,
        timestamp: new Date().toISOString(),
      })

      const mockQRData = {
        sum: passenger.ticketCount * 320,
        recipient: language === "ru" ? "Водитель Иванов И.И." : "Driver Ivanov I.",
        created_at: formatDateTime(new Date(Date.now() - Math.floor(Math.random() * 3600000))),
      }

      setQueuePassengers(
        queuePassengers.map((p) =>
          p.id === currentQueueScanId
            ? {
                ...p,
                showQRButtons: true,
                qrData: mockQRData,
                qrError: undefined,
                scanned: true, // Added: mark as scanned
              }
            : p,
        ),
      )

      setTimeout(() => {
        setShowCashQRDialog(false)
        setIsScanningLocked(false)
      }, 1500)
    }
  }

  const handleInvalidQR = () => {
    console.log("[v0] scan:error", {
      bookingId: tempBookingId || currentQueueScanId,
      error: "Invalid QR",
      timestamp: new Date().toISOString(),
    })
    // Added feedback for invalid QR
    toast({
      title: t.scanError,
      description: t.invalidQR,
      variant: "destructive",
    })
  }

  const handleQRNotFoundForBooking = () => {
    console.log("[v0] qr:not_found_clicked", {
      bookingId: tempBookingId || currentQueueScanId,
      timestamp: new Date().toISOString(),
    })

    if (tempBookingId !== null && tempBookingId !== undefined) {
      setBookings(
        bookings.map((b) =>
          b.id === tempBookingId
            ? {
                ...b,
                qrError: language === "ru" ? "QR не найден" : "QR not found", // Added error message
                showRejectButton: true,
              }
            : b,
        ),
      )
    } else if (currentQueueScanId !== null) {
      setQueuePassengers(
        queuePassengers.map((p) =>
          p.id === currentQueueScanId
            ? {
                ...p,
                qrError: language === "ru" ? "QR не найден" : "QR not found", // Added error message
                showRejectButton: true,
              }
            : p,
        ),
      )
    }

    setShowCashQRDialog(false)
    setIsScanningLocked(false)
  }

  // Added accept/reject for queue passengers after QR scan
  const handleAcceptQueueQR = (passengerId: number) => {
    const passenger = queuePassengers.find((p) => p.id === passengerId)
    if (!passenger || !passenger.qrData) return

    console.log("[v0] accept:clicked", {
      passengerId: passengerId,
      count: passenger.ticketCount,
      timestamp: new Date().toISOString(),
    })

    const passengerCount = passenger.ticketCount || 1
    setManualOccupied((prev) => prev + passengerCount)

    // Find available seats and mark them as occupied
    let seatsToOccupy = passengerCount
    const updatedSeats = [...seats]

    for (let i = 0; i < updatedSeats.length && seatsToOccupy > 0; i++) {
      if (updatedSeats[i].status === "free") {
        updatedSeats[i] = {
          ...updatedSeats[i],
          status: "occupied",
          passengerName: passenger.name,
          paymentMethod: "qr",
          fromStop: stops.findIndex((s) => s.id === 0), // Assuming start stop for queue passengers
          toStop: stops.length - 1, // Assuming end stop for queue passengers
        }
        seatsToOccupy--
      }
    }

    setSeats(updatedSeats)
    setQueuePassengers(queuePassengers.filter((p) => p.id !== passengerId))
    setQrScannedData(null) // Clear scanned data

    toast({
      title: language === "ru" ? "Пассажир принят" : "Passenger accepted",
      description: `${passenger.name}`,
    })
  }

  // Added reject for queue passengers after QR scan
  const handleRejectQueueQR = (passengerId: number) => {
    console.log("[v0] reject:clicked", {
      passengerId: passengerId,
      timestamp: new Date().toISOString(),
    })

    setQueuePassengers(queuePassengers.filter((p) => p.id !== passengerId))
    setQrScannedData(null)

    toast({
      title: language === "ru" ? "Пассажир отклонён" : "Passenger rejected",
      variant: "destructive",
    })
  }

  const handleQRScanError = () => {
    toast({
      title: t.scanError,
      description: t.invalidQR,
      variant: "destructive",
    })
  }

  const handleLogout = () => {
    localStorage.removeItem("driverAuthenticated")
    localStorage.removeItem("userStatus")
    setIsAuthenticated(false)
    setUserStatus("pending") // Reset to default
    setTripStatus(STATE.PREP_IDLE)
    setTripId("")
    setSelectedTrip("")
    setAreSeatsLocked(true) // Lock seats on logout
  }

  const handleToggleDirection = () => {
    setIsDirectionReversed(!isDirectionReversed)
    setStops([...stops].reverse())
  }

  const handleRejectQRNotFoundBooking = (bookingId: number) => {
    const booking = bookings.find((b) => b.id === bookingId)
    if (!booking) return

    console.log("[v0] reject:clicked", {
      bookingId: bookingId,
      reason: "qr_not_found",
      timestamp: new Date().toISOString(),
    })

    const currentBooking = bookings.find((b) => b.id === bookingId)
    if (currentBooking) {
      const stopBookings = bookings.filter(
        (b) => b.fromStopIndex === currentBooking.fromStopIndex && b.id !== bookingId && !b.accepted && !b.qrError,
      )

      if (stopBookings.length > 0 && highlightedBookingId) {
        const nextBooking = stopBookings.find((b) => b.id === highlightedBookingId)
        if (nextBooking) {
          console.log("[v0] Opening scanner for highlighted booking:", nextBooking.id)

          // Remove rejected booking
          setBookings(bookings.filter((b) => b.id !== bookingId))

          // Open scanner for highlighted booking
          setTimeout(() => {
            setTempBookingId(nextBooking.id)
            setScanningForQueue(false)
            setCurrentQueueScanId(null)
            setShowCashQRDialog(true)
          }, 300)

          return
        }
      }
    }

    // If no highlighted booking, just remove the rejected one
    setBookings(bookings.filter((b) => b.id !== bookingId))
    setHighlightedBookingId(null)

    toast({
      title: language === "ru" ? "Бронь отклонена" : "Booking rejected",
      description: booking.passengerName,
      variant: "destructive",
    })
  }

  const handleRejectQueuePassenger = (passengerId: number) => {
    const passenger = queuePassengers.find((p) => p.id === passengerId)
    if (!passenger) return

    console.log("[v0] Rejecting queue passenger with QR error:", passengerId)

    // Find next unprocessed passenger
    const nextPassenger = queuePassengers.find((p) => !p.scanned && !p.qrError)

    // Remove rejected passenger
    setQueuePassengers(queuePassengers.filter((p) => p.id !== passengerId))

    if (nextPassenger) {
      console.log("[v0] Opening scanner for next queue passenger:", nextPassenger.id)

      toast({
        title: language === "ru" ? "Пассажир отклонён" : "Passenger rejected",
        description: language === "ru" ? `Следующий: ${nextPassenger.name}` : `Next: ${nextPassenger.name}`,
      })

      // Open scanner for next passenger
      setTimeout(() => {
        setCurrentQueueScanId(nextPassenger.id)
        setScanningForQueue(true)
        setTempBookingId(null)
        setShowCashQRDialog(true)
      }, 300)
    } else {
      toast({
        title: language === "ru" ? "Пассажир отклонён" : "Passenger rejected",
        description: passenger.name,
        variant: "destructive",
      })
    }
  }

  const handleSelectRoute = (tripNumber: string) => {
    if (userStatus !== "confirmed") {
      console.log("[v0] ui:blocked", { action: "selectRoute", reason: "accountUnconfirmed" })
      toast({
        title: t.error,
        description: language === "ru" ? "Аккаунт не подтвержден" : "Account not confirmed",
        variant: "destructive",
      })
      return
    }

    setSelectedTrip(tripNumber)
    const selectedRouteData = tripRoutes[tripNumber as keyof typeof tripRoutes] // Use tripRoutes directly
    if (selectedRouteData) {
      setStops(selectedRouteData.stops)
    }
  }

  useEffect(() => {
    if (!selectedTrip) return
    const currentRoute = tripRoutes[selectedTrip as keyof typeof tripRoutes]
    if (currentRoute) {
      setStops(isDirectionReversed ? [...currentRoute.stops].reverse() : currentRoute.stops)
    }
  }, [selectedTrip, isDirectionReversed])

  useEffect(() => {
    const actualOccupied = seats.filter((s) => s.status === "occupied").length
    setManualOccupied(actualOccupied)
  }, [seats])
  useEffect(() => {
    // Блокируем дропдаун с момента начала таймера до завершения рейса
    setIsRouteDropdownDisabled(tripStatus !== STATE.PREP_IDLE)
  }, [tripStatus])
  const handleScanQueueQR = () => {
    if (areSeatsLocked) {
      console.log("[v0] ui:blocked", {
        action: "openQueueScanner",
        reason: "seatsLocked",
      })
      return
    }

    // Check if scan is already in progress to prevent duplicate events
    if (scanInProgressRef.current) {
      console.log("[v0] ui:blocked", {
        action: "openQueueScanner",
        reason: "scanAlreadyInProgress",
      })
      return
    }

    // Find the next unscanned passenger without error
    const nextPassenger = queuePassengers.find((p) => !p.scanned && !p.qrError)
    if (!nextPassenger) {
      toast({
        title: language === "ru" ? "Нет пассажиров для сканирования" : "No passengers to scan",
        description: language === "ru" ? "Все пассажиры в очереди обработаны" : "All passengers in queue processed",
      })
      return
    }

    setCurrentQueueScanId(nextPassenger.id)
    scanInProgressRef.current = true
    setIsScanningLocked(true)

    console.log("[v0] scan:start", {
      passengerId: nextPassenger.id,
      timestamp: new Date().toISOString(),
    })

    setShowCashQRDialog(true)
  }

  const handleQueuePassengerScan = (qrResult: {
    match: boolean
    ticketId?: string
    sum?: number
    recipient?: string
    created_at?: string
  }) => {
    if (!currentQueueScanId) {
      setIsScanningLocked(false)
      scanInProgressRef.current = false
      return
    }

    const passengerIndex = queuePassengers.findIndex((p) => p.id === currentQueueScanId)
    if (passengerIndex === -1) {
      setIsScanningLocked(false)
      scanInProgressRef.current = false
      return
    }

    const updatedPassengers = [...queuePassengers]
    const passenger = updatedPassengers[passengerIndex]

    if (qrResult.match) {
      console.log("[v0] scan:result", {
        passengerId: currentQueueScanId,
        match: true,
        ticketId: qrResult.ticketId,
        timestamp: new Date().toISOString(),
      })

      updatedPassengers[passengerIndex] = {
        ...passenger,
        scanned: true,
        qrError: false,
        qrData: {
          amount: qrResult.sum || 0,
          recipient: qrResult.recipient || "",
          createdAt: qrResult.created_at || "",
        },
      }
      setQueuePassengers(updatedPassengers)

      setQrScannedData({
        amount: qrResult.sum || 0,
        recipient: qrResult.recipient || "",
        createdAt: qrResult.created_at || "",
        scannedPassengerId: currentQueueScanId,
      })
    } else {
      console.log("[v0] scan:error", {
        passengerId: currentQueueScanId,
        error: "QR не найден",
        timestamp: new Date().toISOString(),
      })

      updatedPassengers[passengerIndex] = {
        ...passenger,
        qrError: true,
        scanned: false,
      }
      setQueuePassengers(updatedPassengers)

      toast({
        title: language === "ru" ? "QR не найден" : "QR not found",
        description: language === "ru" ? "Неверный или недействительный QR-код" : "Invalid or expired QR code",
        variant: "destructive",
      })

      console.log("[v0] qr:not_found_clicked", {
        passengerId: currentQueueScanId,
        timestamp: new Date().toISOString(),
      })
    }

    // Reset scan state to allow next scan
    setCurrentQueueScanId(null)
    setIsScanningLocked(false)
    scanInProgressRef.current = false
  }

  const handleOpenPassengerScanner = (passengerId: number) => {
    if (areSeatsLocked) {
      // Check if seats are locked
      console.log("[v0] ui:blocked", { action: "openPassengerScanner", reason: "seatsLocked" })
      toast({
        title: t.error,
        description: language === "ru" ? "Сначала начните подготовку рейса" : "Start trip preparation first",
        variant: "destructive",
      })
      return
    }

    if (isScanningLocked) {
      console.log("[v0] ui:blocked", { action: "openPassengerScanner", reason: "scanningInProgress" })
      return
    }

    if (userStatus !== "confirmed") {
      console.log("[v0] ui:blocked", { action: "openPassengerScanner", reason: "accountUnconfirmed" })
      toast({
        title: t.error,
        description: language === "ru" ? "Аккаунт не подтвержден" : "Account not confirmed",
        variant: "destructive",
      })
      return
    }

    console.log("[v0] scan:start", { passengerId, timestamp: new Date().toISOString() })
    setIsScanningLocked(true)
    setCurrentQueueScanId(passengerId)
    setScanningForQueue(true)
    setTempBookingId(null)
    setShowCashQRDialog(true)

    setTimeout(() => setIsScanningLocked(false), 300)
  }

  const occupiedCount = manualOccupied
  const acceptedBookingsCount = bookings.filter((b) => b.accepted).reduce((sum, b) => sum + (b.count || 1), 0)
  const freeCount = 6 - occupiedCount - acceptedBookingsCount
  const pendingBookingsCount = bookings.filter((b) => !b.accepted).reduce((sum, b) => sum + (b.count || 1), 0)

  const getRouteDisplayName = () => {
    if (!selectedTrip) return t.selectTrip
    const route = tripRoutes[selectedTrip as keyof typeof tripRoutes]
    if (isDirectionReversed) {
      return `${route.end} → ${route.start}`
    }
    return `${route.start} → ${route.end}`
  }

  const renderPassengerIcons = (count: number) => {
    const iconCount = Math.min(count, 3)
    return Array(iconCount)
      .fill(0)
      .map((_, i) => <User key={i} className="h-4 w-4" />)
  }

  const isPanelsDisabled = (() => {
    // Пользователь не подтвержден - всегда блокируем
    if (userStatus !== "confirmed") return true

    // Проверяем состояние гонки
    const raceState = TRIP_STATUS_TO_RACE_STATE[tripStatus]
    const panelVisibility = RACE_STATE_TO_PANELS[raceState]

    // Если панели должны быть видны по FSM, проверяем areSeatsLocked
    if (panelVisibility.reservation || panelVisibility.queue) {
      return areSeatsLocked
    }

    // В остальных случаях блокируем
    return true
  })()

  const canStartTrip = selectedTrip !== "" && tripStatus === STATE.PREP_IDLE && userStatus === "confirmed"

  if (!isAuthenticated) {
    if (showRegister) {
      return (
        <RegisterForm
          onRegister={() => {
            // Mock: new users are pending by default
            setUserStatus("pending")
            setShowRegister(false)
            setIsAuthenticated(true)
            localStorage.setItem("driverAuthenticated", "true")
            localStorage.setItem("userStatus", "pending")
          }}
          onBackToLogin={() => setShowRegister(false)}
          language={language}
        />
      )
    }

    return (
      <LoginForm
        onLogin={() => {
          setIsAuthenticated(true)
          localStorage.setItem("driverAuthenticated", "true")
          // Test account is always approved
          setUserStatus("confirmed")
          localStorage.setItem("userStatus", "confirmed")
        }}
        onRegister={() => setShowRegister(true)}
        language={language}
        onLanguageChange={handleLanguageChange}
      />
    )
  }

  if (isAuthenticated && userStatus !== "confirmed") {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="mx-auto max-w-md space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ru" ? "Аккаунт не подтвержден" : "Account Not Confirmed"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {language === "ru"
                  ? "Ваш аккаунт ожидает подтверждения администратором. Пожалуйста, попробуйте позже."
                  : "Your account is awaiting admin confirmation. Please try again later."}
              </p>
              <Button
                onClick={() => {
                  // Refresh account status (mock)
                  toast({
                    title: language === "ru" ? "Обновлено" : "Refreshed",
                    description: language === "ru" ? "Статус аккаунта обновлен" : "Account status refreshed",
                  })
                }}
                className="w-full"
              >
                {language === "ru" ? "Обновить статус" : "Refresh Status"}
              </Button>
              <Button
                onClick={() => {
                  setIsAuthenticated(false)
                  localStorage.removeItem("driverAuthenticated")
                  localStorage.removeItem("userStatus")
                }}
                variant="outline"
                className="w-full"
              >
                {language === "ru" ? "Выйти" : "Logout"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      <div className="bg-card border-b border-border px-4 py-4 sticky top-0 z-10 shadow-sm rounded-lg mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-1">
            <Select value={selectedTrip} onValueChange={handleSelectRoute} disabled={userStatus !== "confirmed"}>
              <SelectTrigger
                className={`${isRouteDropdownDisabled || (selectedTrip && tripStatus === STATE.PREP_IDLE) ? "w-auto min-w-40 max-w-full" : "w-auto min-w-48 max-w-full"} h-auto min-h-10 ${
                  isRouteDropdownDisabled ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <SelectValue placeholder={t.selectTrip}>
                  <span className="whitespace-normal leading-tight break-words">
                    {selectedTrip && getRouteDisplayName()}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="247">
                  {tripRoutes["247"].start} → {tripRoutes["247"].end}
                </SelectItem>
                <SelectItem value="248">
                  {tripRoutes["248"].start} → {tripRoutes["248"].end}
                </SelectItem>
                <SelectItem value="249">
                  {tripRoutes["249"].start} → {tripRoutes["249"].end}
                </SelectItem>
              </SelectContent>
            </Select>
            {tripStatus === STATE.PREP_IDLE && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleToggleDirection}
                disabled={!selectedTrip || userStatus !== "confirmed"}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={tripStatus !== STATE.PREP_IDLE ? "default" : "secondary"} className="text-2xl px-3 py-1">
              {getTripStatusEmoji()}
            </Badge>
            <Link href="/balance">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                disabled={userStatus !== "confirmed"}
                onClick={(e) => {
                  if (userStatus !== "confirmed") {
                    e.preventDefault()
                    console.log("[v0] ui:blocked", { action: "navigateToBalance", reason: "accountUnconfirmed" })
                    toast({
                      title: t.error,
                      description: language === "ru" ? "Аккаунт не подтвержден" : "Account not confirmed",
                      variant: "destructive",
                    })
                  }
                }}
              >
                <Wallet className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-9 w-9">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {tripId && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground">
              {t.tripId}: {tripId}
            </p>
          </div>
        )}

        {userStatus === "pending" ? (
          <Card className="p-6 border-2 border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10">
            <div className="flex items-start gap-4">
              <div className="text-4xl">⏳</div>
              <div className="flex-1 space-y-3">
                <h3 className="font-semibold text-lg">
                  {language === "ru"
                    ? "Ожидание подтверждения администратора"
                    : language === "fr"
                      ? "En attente de confirmation de l'administrateur"
                      : language === "ar"
                        ? "في انتظار تأكيد المسؤول"
                        : "Awaiting Admin Confirmation"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === "ru"
                    ? "Вы зарегистрированы, ждите подтверждения ваших данных администратором. Обычно это занимает 1 рабочий день."
                    : language === "fr"
                      ? "Vous êtes enregistré, veuillez attendre la confirmation de vos données par l'administrateur. Cela prend généralement 1 jour ouvrable."
                      : language === "ar"
                        ? "أنت مسجل، يرجى انتظار تأكيد بياناتك من قبل المسؤول. عادة ما يستغرق ذلك يوم عمل واحد."
                        : "You are registered, please wait for confirmation of your data by the administrator. This usually takes 1 business day."}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Mock status refresh
                    toast({
                      title: language === "ru" ? "Статус проверен" : "Status checked",
                      description: language === "ru" ? "Ожидание подтверждения" : "Awaiting confirmation",
                    })
                  }}
                >
                  🔄 {language === "ru" ? "Обновить статус" : "Refresh Status"}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <>
            {userStatus === "confirmed" && (
              <>
                {tripStatus === "FINISHED" && (
                  <div className="flex items-center gap-2 w-full">
                    <Button
                      onClick={() => {
                        if (userStatus !== "confirmed") {
                          console.log("[v0] ui:blocked", { action: "finishTrip", reason: "accountUnconfirmed" })
                          toast({
                            title: t.error,
                            description: language === "ru" ? "Аккаунт не подтвержден" : "Account not confirmed",
                            variant: "destructive",
                          })
                          return
                        }
                        clickFinish()
                      }}
                      className="flex-1"
                      size="lg"
                    >
                      {t.finishTrip}
                    </Button>

                    <GeoTrackerIndicator isActive={isGeoTrackerActive} language={language} />
                  </div>
                )}

                {tripStatus !== "FINISHED" && (
                  <div className="flex items-center gap-2 w-full">
                    <Button
                      onClick={() => {
                        if (userStatus !== "confirmed") {
                          console.log("[v0] ui:blocked", { action: "tripStatusButton", reason: "accountUnconfirmed" })
                          toast({
                            title: t.error,
                            description: language === "ru" ? "Аккаунт не подтвержден" : "Account not confirmed",
                            variant: "destructive",
                          })
                          return
                        }
                        handleTripButton()
                      }}
                      disabled={tripStatus === STATE.PREP_IDLE && !canStartTrip}
                      className="flex-1"
                      size="lg"
                    >
                      {getTripButtonText()}
                    </Button>

                    {/* ИЗМЕНЕНИЕ: Добавлена кнопка реверса направления в статусе PREP_IDLE */}
                    {tripStatus === STATE.PREP_IDLE && (
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleToggleDirection}
                        disabled={!selectedTrip || userStatus !== "confirmed"}
                        className="px-4 bg-transparent"
                      >
                        <ArrowLeftRight className="h-5 w-5" />
                      </Button>
                    )}

                    {tripStatus === STATE.PREP_TIMER && (
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={clickCancelPrep}
                        className="whitespace-nowrap bg-transparent"
                      >
                        {language === "ru" ? "Отмена" : "Cancel"}
                      </Button>
                    )}

                    {(tripStatus === STATE.BOARDING ||
                      tripStatus === STATE.ROUTE_READY ||
                      tripStatus === STATE.IN_ROUTE) && (
                      <div className="flex flex-col items-end gap-1">
                        {tripStatus === STATE.ROUTE_READY && currentStopIndex > 0 && (
                          <span className="text-xs text-muted-foreground font-medium">
                            {stops[currentStopIndex]?.name}
                          </span>
                        )}
                        <GeoTrackerIndicator isActive={isGeoTrackerActive} language={language} />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="px-2 pt-4 space-y-6">
        {selectedTrip && panelVisibility.cash && ( // ИЗМЕНЕНО: добавлено panelVisibility.cash
  <Card className={`p-4 border-2 border-border ${isPanelsDisabled ? "opacity-50 pointer-events-none" : ""}`}>
    <h2 className="text-lg font-bold text-foreground mb-4">{t.seats}</h2>
    <div className="grid grid-cols-4 gap-3">
      <div className="text-center p-4 rounded-lg bg-secondary">
        <div className="flex items-center justify-center gap-1 mb-2">
          <Button
            size="icon"
            variant="outline"
            className="h-6 w-6 bg-transparent flex-shrink-0"
            onClick={() => setManualOccupied(Math.max(0, manualOccupied - 1))}
            disabled={manualOccupied === 0 || isPanelsDisabled}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <div className="text-2xl font-bold text-primary min-w-[2rem]">{occupiedCount}</div>
          <Button
            size="icon"
            variant="outline"
            className="h-6 w-6 bg-transparent flex-shrink-0"
            onClick={() => setManualOccupied(Math.min(6, manualOccupied + 1))}
            disabled={manualOccupied === 6 || isPanelsDisabled}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">{t.occupied}</div>
      </div>
      <div className="text-center p-4 rounded-lg bg-secondary">
        <div className="text-2xl font-bold text-blue-600">
          {acceptedBookingsCount}:{pendingBookingsCount}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{t.bookingsShort}</div>
      </div>
      <div className="text-center p-4 rounded-lg bg-secondary">
        <div className="text-2xl font-bold text-accent">{freeCount}</div>
        <div className="text-xs text-muted-foreground mt-1">{t.free}</div>
      </div>
      <div className="text-center p-4 rounded-lg bg-secondary">
        <div className="text-2xl font-bold text-foreground">6</div>
        <div className="text-xs text-muted-foreground mt-1">{t.total}</div>
      </div>
    </div>
  </Card>
)}

        {/* CHANGE: Fixed conditional check and removed backslashes */}
        {panelVisibility.queue && selectedTrip && 6 - manualOccupied - acceptedBookingsCount > 0 && (
          <Card className={`p-4 border-2 border-border ${isPanelsDisabled ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">{t.queue}</h2>
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {queuePassengers.length}
              </Badge>
            </div>

            <QueueQRScanner
              passengers={queuePassengers}
              onUpdate={setQueuePassengers}
              onAccept={(passengerId) => {
                const passenger = queuePassengers.find((p) => p.id === passengerId)
                if (!passenger) return

                const seatCountToAdd = passenger.ticketCount || 1
                setManualOccupied((prev) => prev + seatCountToAdd)
                setQueuePassengers(queuePassengers.filter((p) => p.id !== passengerId))

                // logFSMEvent("accept:success", {
                //   passengerId,
                //   seatsAdded: seatCountToAdd,
                // })

                toast({
                  title: language === "ru" ? "Пассажир принят" : "Passenger accepted",
                  description: passenger.name,
                })
              }}
              onReject={(passengerId) => {
                const passenger = queuePassengers.find((p) => p.id === passengerId)
                setQueuePassengers(queuePassengers.filter((p) => p.id !== passengerId))

                // logFSMEvent("reject:success", { passengerId })

                toast({
                  title: language === "ru" ? "Пассажир отклонён" : "Passenger rejected",
                  description: passenger?.name,
                  variant: "destructive",
                })
              }}
              onReturn={(passengerId) => {
                const passenger = queuePassengers.find((p) => p.id === passengerId)
                if (!passenger) return

                const seatCountToRevert = passenger.ticketCount || 1

                setQueuePassengers(
                  queuePassengers.map((p) =>
                    p.id === passengerId
                      ? {
                          ...p,
                          showQRButtons: false,
                          qrData: undefined,
                          scanned: false,
                          qrError: false,
                        }
                      : p,
                  ),
                )

                if (passenger.scanned) {
                  setManualOccupied((prev) => Math.max(0, prev - seatCountToRevert))
                }

                // logFSMEvent("return:success", {
                //   passengerId,
                //   seatsReverted: seatCountToRevert,
                // })

                toast({
                  title: language === "ru" ? "Возврат" : "Return",
                  description: language === "ru" ? "Операция отменена" : "Operation canceled",
                })
              }}
              disabled={isPanelsDisabled}
              language={language}
              t={t}
            />
          </Card>
        )}

        {panelVisibility.reservation && selectedTrip && (
          <Card className={`p-4 border-2 border-border ${isPanelsDisabled ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">{t.stops}</h2>
              {tripStatus === STATE.IN_ROUTE && currentStopIndex > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setShowStopHistory(!showStopHistory)}>
                  {showStopHistory
                    ? language === "ru"
                      ? "Скрыть историю"
                      : "Hide history"
                    : language === "ru"
                      ? "Показать историю"
                      : "Show history"}
                </Button>
              )}
            </div>
            <div className="space-y-1">
              {stops
                .slice(showStopHistory ? 0 : currentStopIndex, -1)
                .map((stop, index, array) => {
                  const stopBookings = bookings.filter((b) => b.fromStopIndex === stop.id)

                  // Посажено: те, у кого scanned: true
                  const historyBoarded = stopBookings
                    .filter((b) => b.scanned)
                    .reduce((sum, b) => sum + (b.passengerCount || b.count || 1), 0)

                  // Зарезервировано: те, кто есть в списке броней, но еще не scanned
                  const historyReserved = stopBookings
                    .filter((b) => !b.scanned)
                    .reduce((sum, b) => sum + (b.passengerCount || b.count || 1), 0)

                  // И в блоке отрисовки карточек добавьте фильтр !booking.scanned,
                  // чтобы севшие пассажиры исчезали из списка "активных" на остановке:
                  const visibleBookings = stopBookings.filter((b) => {
                    return !b.scanned && (b.reserved || freeCount >= (b.count || 1))
                  })

                  const isPastStop = visitedStops.has(stop.id) && stop.id < currentStopIndex

                  // НОВАЯ ЛОГИКА: Показываем остановку если:
                  // 1. Это прошедшая остановка (isPastStop)
                  // 2. Есть хоть какие-то бронирования (stopBookings.length > 0)
                  // 3. Это текущая остановка (stop.id === currentStopIndex)

                  // Скрываем только:
                  // - Начальную остановку БЕЗ броней
                  // - Будущие остановки БЕЗ броней
                  if (stop.id === 0 && stopBookings.length === 0) {
                    return null
                  }

                  // Если это не прошлая остановка И нет никаких бронирований - скрываем
                  if (!isPastStop && stopBookings.length === 0) {
                    return null
                  }

                  return (
                    <div key={stop.id} className={isPastStop ? "opacity-50" : ""}>
                      <div className="flex items-start gap-3 py-2">
                        <div className="flex-shrink-0 mt-1">
                          <div className="flex items-center gap-1">
                            {isPastStop && <span className="text-xs mr-1">✓</span>}
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-semibold text-muted-foreground">{stop.time}</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h3 className="font-semibold text-base text-foreground">{stop.name}</h3>

                              {/* ИСТОРИЯ: Показываем для прошедших остановок */}
                              {isPastStop && (
                                <div className="text-xs text-muted-foreground mt-1 font-medium">
                                  {(() => {
                                    const history = stopHistoryMap.get(stop.id)
                                    if (history) {
                                      return language === "ru"
                                        ? `Зарезервировано: ${history.reserved}, Посажено: ${history.boarded}`
                                        : `Reserved: ${history.reserved}, Boarded: ${history.boarded}`
                                    }
                                    // Fallback
                                    return language === "ru"
                                      ? `Зарезервировано: ${historyReserved}, Посажено: ${historyBoarded}`
                                      : `Reserved: ${historyReserved}, Boarded: ${historyBoarded}`
                                  })()}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Карточки бронирований показываем только на АКТУАЛЬНОЙ остановке */}
                          {visibleBookings.length > 0 && !isPastStop && (
                            // ... остальной код карточек без изменений
                            <div className="space-y-2 mt-3">
                              {visibleBookings.map((booking) => (
                                <div
                                  key={booking.id}
                                  className={`p-3 rounded-lg bg-secondary border ${
                                    highlightedBookingId === booking.id
                                      ? "border-green-500 ring-2 ring-green-500/50 bg-green-50 dark:bg-green-900/20"
                                      : booking.qrError
                                        ? "border-red-500"
                                        : booking.reserved
                                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                          : "border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                      {booking.qrError && <X className="h-4 w-4 text-red-500" />}
                                      {booking.reserved && <span className="text-xs">✓</span>}
                                      {booking.passengerName}
                                    </h4>
                                    <span className="text-xs text-muted-foreground font-semibold">
                                      {booking.count} {t.bookings}
                                    </span>
                                  </div>

                                  {booking.qrError && (
                                    <div className="space-y-2">
                                      <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
                                        <p className="text-xs text-destructive">{booking.qrError}</p>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={() => handleRejectQRNotFoundBooking(booking.id)}
                                          className="flex-1 h-9 text-sm font-semibold"
                                          variant="destructive"
                                          size="sm"
                                          disabled={isPanelsDisabled}
                                        >
                                          {t.reject}
                                        </Button>
                                        <Button
                                          onClick={() => handleReturnBooking(booking.id)}
                                          className="h-9 w-9"
                                          variant="outline"
                                          size="icon"
                                          title={language === "ru" ? "Вернуть" : "Return"}
                                          disabled={isPanelsDisabled}
                                        >
                                          <Undo2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  )}

                                  {!booking.qrError && booking.showQRButtons && booking.qrData && (
                                    <div>
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={() => handleAcceptBookingQR(booking.id)}
                                          className="flex-1 h-9 text-sm font-semibold"
                                          variant="default"
                                          size="sm"
                                          disabled={isPanelsDisabled}
                                        >
                                          {t.accept}
                                        </Button>
                                        <Button
                                          onClick={() => handleRejectBookingQR(booking.id)}
                                          className="flex-1 h-9 text-sm font-semibold"
                                          variant="destructive"
                                          size="sm"
                                          disabled={isPanelsDisabled}
                                        >
                                          {t.reject}
                                        </Button>
                                        <Button
                                          onClick={() => handleReturnBooking(booking.id)}
                                          className="h-9 w-9"
                                          variant="outline"
                                          size="icon"
                                          title={language === "ru" ? "Вернуть" : "Return"}
                                          disabled={isPanelsDisabled}
                                        >
                                          <Undo2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  )}

                                  {!booking.qrError && !booking.showQRButtons && !booking.reserved && (
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={() => handleReserveBooking(booking.id)}
                                        className="flex-1 h-9 text-sm font-semibold"
                                        variant="default"
                                        size="sm"
                                        disabled={isPanelsDisabled}
                                      >
                                        {language === "ru" ? "Взять" : "Reserve"}
                                      </Button>
                                      <Button
  onClick={() => handleCancelBooking(booking.id, stop.id === currentStopIndex)}
                                        className="h-9 w-auto px-3 text-sm font-semibold"
                                        variant="outline"
                                        size="sm"
                                        disabled={isPanelsDisabled}
                                        style={{ backgroundColor: "#fbbf24", borderColor: "#fbbf24" }}
                                      >
                                        {language === "ru" ? "Отменить" : "Cancel"}
                                      </Button>
                                    </div>
                                  )}

                                  {!booking.qrError && !booking.showQRButtons && booking.reserved && (
                                    <div className="flex gap-2">
                                      <Button
  onClick={() => handleAcceptBooking(booking.id)}
  className="flex-1 h-9 text-sm font-semibold"
  variant="default"
  size="sm"
  disabled={isPanelsDisabled || stop.id !== currentStopIndex} // ДОБАВЛЕНО: проверка остановки
>
  <QrCode className="mr-2 h-4 w-4" />
  {t.scanQR}
</Button>
                                      <Button
  onClick={() => handleCancelBooking(booking.id, stop.id === currentStopIndex)}
                                        className="h-9 w-auto px-3 text-sm font-semibold"
                                        variant="outline"
                                        size="sm"
                                        disabled={isPanelsDisabled}
                                        style={{ backgroundColor: "#fbbf24", borderColor: "#fbbf24" }}
                                      >
                                        {language === "ru" ? "Отменить" : "Cancel"}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {visibleBookings.length === 0 && !isPastStop && stopBookings.length > 0 && (
                            <div className="text-xs text-muted-foreground italic mt-2">
                              {language === "ru"
                                ? "Нет свободных мест для новых броней"
                                : "No free seats for new bookings"}
                            </div>
                          )}
                        </div>
                      </div>
                      {index < array.length - 1 && (
                        <div className="ml-2">
                          <div className="w-px h-8 bg-border" />
                        </div>
                      )}
                    </div>
                  )
                })
                .filter(Boolean)}
            </div>
          </Card>
        )}
      </div>

      <CashQRDialog
        open={showCashQRDialog}
        onOpenChange={(isOpen) => {
          setShowCashQRDialog(isOpen)
          if (!isOpen) {
            setIsScanningLocked(false)
            setScanningForQueue(false)
            setCurrentQueueScanId(null)
            setTempBookingId(null)
            setQrScannedData(null)
            scanInProgressRef.current = false
          }
        }}
        driverName={language === "ru" ? "Водитель Иванов И.И." : "Driver Ivanov I."}
        amount={320}
        currency="RUB"
        onConfirm={handleConfirmQR}
        onInvalid={handleInvalidQR}
        language={language}
        showNotFoundButton={true}
        onQRNotFound={handleQRNotFoundForBooking}
        onQueuePassengerScan={handleQueuePassengerScan}
      />

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
  <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
    <DialogHeader>
      <DialogTitle>{language === "ru" ? "Причина отмены" : "Cancellation reason"}</DialogTitle>
    </DialogHeader>
    <div className="space-y-3">
      {(() => {
        const booking = bookings.find((b) => b.id === cancelBookingId)
        const isBoardingStop = booking?.cancelContext === 'boarding'
        
        const boardingReasons = [
          { value: "big_queue", label: language === "ru" ? "Большая очередь" : "Big queue" },
          { value: "group_full", label: language === "ru" ? "Группа на все места" : "Group for all seats" },
          { value: "other", label: language === "ru" ? "Иное" : "Other" },
        ]
        
        const futureStopReasons = [
          { value: "not_found", label: language === "ru" ? "Не найден на остановке" : "Not found at stop" },
          { value: "accident", label: language === "ru" ? "Авария" : "Accident" },
          { value: "conflict", label: language === "ru" ? "Конфликтная ситуация" : "Conflict situation" },
          { value: "other", label: language === "ru" ? "Иное" : "Other" },
        ]
        
        const reasons = isBoardingStop ? boardingReasons : futureStopReasons
        
        return reasons.map((reason) => (
          <Button
            key={reason.value}
            onClick={() => setCancelReason(reason.label)}
            variant={cancelReason === reason.label ? "default" : "outline"}
            className="w-full justify-start"
          >
            {reason.label}
          </Button>
        ))
      })()}
    </div>
    <div className="flex gap-2 pt-4">
      <Button
        onClick={confirmCancelBooking}
        disabled={!cancelReason}
        className="flex-1"
      >
        {language === "ru" ? "OK" : "OK"}
      </Button>
      <Button
        onClick={() => {
          setShowCancelDialog(false)
          setCancelBookingId(null)
          setCancelReason("")
        }}
        variant="outline"
        className="flex-1"
      >
        {language === "ru" ? "Отмена" : "Cancel"}
      </Button>
    </div>
  </DialogContent>
</Dialog>
    </div>
  )
}
