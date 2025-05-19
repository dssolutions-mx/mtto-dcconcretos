"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  // Estilos CSS en línea para ocultar la fila de encabezados
  const customStyles = `
    .rdp-weekdays {
      display: none !important;
    }
  `;

  return (
    <>
      {/* Inyectar estilos CSS para ocultar los encabezados */}
      <style>{customStyles}</style>
      
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn("p-3", className)}
        locale={es}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-2",
          caption: "flex justify-center relative items-center h-8",
          caption_label: "text-sm font-medium mx-1",
          nav: "flex items-center gap-1",
          nav_button: cn(
            buttonVariants({ variant: "outline" }),
            "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100"
          ),
          nav_button_previous: "absolute left-0",
          nav_button_next: "absolute right-0",
          table: "w-full border-collapse space-y-1",
          weekdays: "grid grid-cols-7 mt-2",
          weekday: "text-muted-foreground text-xs font-medium text-center",
          week: "grid grid-cols-7 mt-2",
          day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 flex items-center justify-center",
          day_button: cn(
            buttonVariants({ variant: "ghost" }),
            "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
          ),
          range_end: "day-range-end",
          selected:
            "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          today: "bg-accent text-accent-foreground",
          outside:
            "text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
          disabled: "text-muted-foreground opacity-50",
          range_middle:
            "aria-selected:bg-accent aria-selected:text-accent-foreground",
          hidden: "invisible",
          ...classNames,
        }}
        components={{
          Chevron: ({ orientation }) => {
            return orientation === "left" ? (
              <ChevronLeft className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          },
        }}
        {...props}
      />
    </>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
