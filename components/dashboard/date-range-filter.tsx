"use client"

import { useState } from "react"
import type { DateRange } from "react-day-picker"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { useDateFilter, type DatePreset, type ComparisonMode } from "@/contexts/date-filter-context"
import { cn } from "@/lib/utils"

const PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: "this_month", label: "Ce mois" },
  { value: "last_month", label: "Mois dernier" },
  { value: "3_months", label: "3 mois" },
  { value: "6_months", label: "6 mois" },
  { value: "this_year", label: "Cette année" },
]

const COMPARISON_OPTIONS: Array<{ value: ComparisonMode; label: string }> = [
  { value: "previous_period", label: "vs période préc." },
  { value: "same_period_last_year", label: "vs N-1" },
  { value: "none", label: "Sans comparaison" },
]

export function DateRangeFilter({ className }: { className?: string }) {
  const { preset, setPreset, comparisonMode, setComparisonMode } = useDateFilter()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [customRange, setCustomRange] = useState<DateRange | undefined>()

  function handleCustomApply() {
    if (customRange?.from && customRange?.to) {
      const fmt = (d: Date) => d.toISOString().split("T")[0]
      setPreset("custom", fmt(customRange.from), fmt(customRange.to))
      setCalendarOpen(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Preset buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            variant={preset === p.value ? "default" : "outline"}
            size="sm"
            className="shrink-0 h-7 text-xs px-2.5"
            onClick={() => setPreset(p.value)}
          >
            {p.label}
          </Button>
        ))}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={preset === "custom" ? "default" : "outline"}
              size="sm"
              className="shrink-0 h-7 text-xs px-2.5"
            >
              <CalendarDays className="size-3 mr-1" />
              Personnalisé
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={customRange}
              onSelect={setCustomRange}
              numberOfMonths={2}
            />
            <div className="p-3 border-t flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCalendarOpen(false)}>
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleCustomApply}
                disabled={!customRange?.from || !customRange?.to}
              >
                Appliquer
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Comparison toggle */}
      <div className="flex items-center gap-1.5">
        {COMPARISON_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setComparisonMode(opt.value)}
            className={cn(
              "text-xs px-2 py-0.5 rounded-full border transition-colors",
              comparisonMode === opt.value
                ? "bg-foreground text-background border-foreground"
                : "text-muted-foreground border-muted-foreground/30 hover:border-foreground/50"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
