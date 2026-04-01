"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { fr } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={fr}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-2",
        month_caption: "flex justify-center items-center h-8 relative",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: cn(
          "size-7 inline-flex items-center justify-center rounded border",
          "text-muted-foreground bg-transparent hover:bg-accent opacity-60 hover:opacity-100 transition-opacity"
        ),
        button_next: cn(
          "size-7 inline-flex items-center justify-center rounded border",
          "text-muted-foreground bg-transparent hover:bg-accent opacity-60 hover:opacity-100 transition-opacity"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 h-8 flex items-center justify-center text-[0.75rem] font-normal text-muted-foreground",
        weeks: "",
        week: "flex mt-1",
        day: "w-9 h-9 p-0 relative text-center text-sm",
        day_button: cn(
          "absolute inset-0 w-full h-full flex items-center justify-center rounded-md",
          "text-sm font-normal hover:bg-accent transition-colors",
          "disabled:opacity-30 disabled:pointer-events-none"
        ),
        selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
        range_start: "rounded-l-full [&>button]:bg-primary [&>button]:text-primary-foreground",
        range_end: "rounded-r-full [&>button]:bg-primary [&>button]:text-primary-foreground",
        range_middle: "bg-accent/50 [&>button]:rounded-none [&>button]:bg-transparent [&>button]:hover:bg-transparent",
        today: "[&>button]:font-bold [&>button]:underline",
        outside: "[&>button]:text-muted-foreground [&>button]:opacity-40",
        disabled: "[&>button]:opacity-30 [&>button]:pointer-events-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"
export { Calendar }
