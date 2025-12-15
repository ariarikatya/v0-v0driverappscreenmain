// components/geo-tracker-indicator.tsx
"use client"

import { useEffect, useState } from "react"
import { MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface GeoTrackerIndicatorProps {
  isActive: boolean
  language: "ru" | "en" | "fr" | "ar" | string
  className?: string
}

export function GeoTrackerIndicator({ isActive, language, className }: GeoTrackerIndicatorProps) {
  const [isPulsing, setIsPulsing] = useState(false)

  useEffect(() => {
    if (isActive) {
      setIsPulsing(true)
      // Pulse effect every 2 seconds when active
      const interval = setInterval(() => {
        setIsPulsing(false)
        setTimeout(() => setIsPulsing(true), 100)
      }, 2000)
      
      return () => clearInterval(interval)
    } else {
      setIsPulsing(false)
    }
  }, [isActive])

  const getStatusText = () => {
    if (language === "ru") {
      return isActive ? "Геотрекер" : "Геотрекер откл."
    } else if (language === "fr") {
      return isActive ? "Géotracker" : "Géotracker off"
    } else if (language === "ar") {
      return isActive ? "المتتبع" : "المتتبع معطل"
    } else {
      return isActive ? "Geotracker" : "Geotracker off"
    }
  }

  return (
    <Badge
      variant={isActive ? "default" : "secondary"}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 transition-all duration-200",
        isActive && "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700",
        !isActive && "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700",
        className
      )}
    >
      <div className="relative">
        <MapPin 
          className={cn(
            "h-3.5 w-3.5",
            isActive && "text-green-600 dark:text-green-400",
            !isActive && "text-red-600 dark:text-red-400"
          )} 
        />
        {isActive && (
          <span 
            className={cn(
              "absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500",
              isPulsing && "animate-ping"
            )}
          />
        )}
      </div>
      <span className="text-xs font-medium whitespace-nowrap">
        {getStatusText()}
      </span>
    </Badge>
  )
}
