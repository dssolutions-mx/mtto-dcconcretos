"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format, parse, isValid } from "date-fns"
import { es } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DateInputProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DateInput({ value, onChange, placeholder = "dd/mm/aaaa", disabled, className }: DateInputProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [isValidInput, setIsValidInput] = React.useState(true)
  const [calendarYear, setCalendarYear] = React.useState(() => value?.getFullYear() || new Date().getFullYear())
  const [isUserTyping, setIsUserTyping] = React.useState(false)

  // Update input value when external value changes
  React.useEffect(() => {
    if (value && !isUserTyping) {
      setInputValue(format(value, "dd/MM/yyyy"))
      setIsValidInput(true)
      setCalendarYear(value.getFullYear())
    } else if (!value && !isUserTyping) {
      setInputValue("")
      setIsValidInput(true)
    }
  }, [value, isUserTyping])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setIsUserTyping(true)

    // Try to parse the date as user types
    if (newValue.trim() === "") {
      onChange(undefined)
      setIsValidInput(true)
      return
    }

    // Don't attempt to parse incomplete inputs that look like they're being typed
    if (newValue.length < 6) {
      setIsValidInput(true)
      return
    }

    // Check if input looks like a complete date before trying to parse
    const isCompleteDateFormat = 
      (newValue.includes('/') && newValue.split('/').length === 3 && newValue.split('/')[2].length >= 4) || 
      (newValue.includes('-') && newValue.split('-').length === 3 && newValue.split('-')[2].length >= 4) || 
      (newValue.includes('.') && newValue.split('.').length === 3 && newValue.split('.')[2].length >= 4) ||
      /^\d{4}$/.test(newValue); // Complete year

    if (!isCompleteDateFormat) {
      // User is still typing, don't try to parse yet
      setIsValidInput(true)
      return;
    }

    // Try different date formats
    const formats = ["dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy", "dd.MM.yyyy", "d.M.yyyy", "yyyy-MM-dd"]
    let parsedDate: Date | null = null

    for (const dateFormat of formats) {
      try {
        const parsed = parse(newValue, dateFormat, new Date())
        if (isValid(parsed)) {
          parsedDate = parsed
          break
        }
      } catch {
        // Continue to next format
      }
    }

    // Try to parse as a year (yyyy) entry
    if (!parsedDate && /^\d{4}$/.test(newValue)) {
      try {
        const year = parseInt(newValue, 10);
        if (year >= 1900 && year <= 2100) {
          parsedDate = new Date(year, 0, 1);
          setCalendarYear(year);
        }
      } catch {
        // Ignore parsing errors
      }
    }

    if (parsedDate && isValid(parsedDate)) {
      // Only update the date if we have a complete, valid date
      onChange(parsedDate)
      setCalendarYear(parsedDate.getFullYear())
      setIsValidInput(true)
    } else if (newValue.length >= 8) {
      // Only show invalid state if input seems complete
      setIsValidInput(false)
    } else {
      setIsValidInput(true)
    }
  }

  const handleInputBlur = () => {
    setIsUserTyping(false)
    
    // Format the input if we have a valid date
    if (value && isValid(value)) {
      setInputValue(format(value, "dd/MM/yyyy"))
      setIsValidInput(true)
    }
  }

  // Simplify key handling to allow any characters needed for date input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow all necessary characters for date input
    const allowedKeys = [
      // Numbers
      ...[...Array(10)].map((_, i) => i + 48), // 0-9
      ...[...Array(10)].map((_, i) => i + 96), // Numpad 0-9
      // Date separators
      191, // forward slash (/)
      111, // numpad slash
      189, // dash (-)
      109, // numpad dash
      190, // period (.)
      110, // numpad period
      173, // hyphen
      // Control keys
      8,   // backspace
      9,   // tab
      13,  // enter
      27,  // escape
      46,  // delete
      // Arrow keys
      37, 38, 39, 40,
      // Home, end
      35, 36,
    ];
    
    // Allow control combinations
    if (e.ctrlKey) {
      return;
    }
    
    if (!allowedKeys.includes(e.keyCode)) {
      e.preventDefault();
    }
  }

  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    onChange(selectedDate)
    setIsOpen(false)
    setIsUserTyping(false)
    if (selectedDate) {
      setInputValue(format(selectedDate, "dd/MM/yyyy"))
      setIsValidInput(true)
    }
  }

  // Calculate from and to dates for the calendar
  const fromDate = new Date(1900, 0, 1)
  const toDate = new Date(2100, 11, 31)

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center relative">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "pr-10",
            !isValidInput && "border-red-500 focus-visible:ring-red-500"
          )}
        />
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-0 h-[calc(100%-2px)] my-[1px] mx-[1px] px-2 border-l rounded-l-none"
              disabled={disabled}
              type="button"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleCalendarSelect}
              initialFocus
              defaultMonth={value || new Date(calendarYear, 0, 1)}
              fromDate={fromDate}
              toDate={toDate}
              captionLayout="dropdown"
              locale={es}
            />
          </PopoverContent>
        </Popover>
      </div>
      {!isValidInput && (
        <p className="text-xs text-red-500 mt-1">
          Formato de fecha inválido. Use dd/mm/aaaa (ej: 15/03/2024)
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-1">
        Escriba la fecha o use el calendario. Formatos: dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa, aaaa-mm-dd
      </p>
    </div>
  )
} 