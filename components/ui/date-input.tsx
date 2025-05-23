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

  // Update input value when external value changes
  React.useEffect(() => {
    if (value) {
      setInputValue(format(value, "dd/MM/yyyy"))
      setIsValidInput(true)
    } else {
      setInputValue("")
      setIsValidInput(true)
    }
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // Try to parse the date as user types
    if (newValue.trim() === "") {
      onChange(undefined)
      setIsValidInput(true)
      return
    }

    // Try different date formats
    const formats = ["dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy", "dd.MM.yyyy", "d.M.yyyy"]
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

    if (parsedDate && isValid(parsedDate)) {
      onChange(parsedDate)
      setIsValidInput(true)
    } else if (newValue.length >= 8) {
      // Only show invalid state if input seems complete
      setIsValidInput(false)
    } else {
      setIsValidInput(true)
    }
  }

  const handleInputBlur = () => {
    // Format the input if we have a valid date
    if (value && isValid(value)) {
      setInputValue(format(value, "dd/MM/yyyy"))
      setIsValidInput(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter
    if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        // Allow: home, end, left, right
        (e.keyCode >= 35 && e.keyCode <= 39)) {
      return
    }
    // Allow: numbers and separators
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && 
        (e.keyCode < 96 || e.keyCode > 105) &&
        e.keyCode !== 191 && // forward slash
        e.keyCode !== 189 && // dash
        e.keyCode !== 190) { // period
      e.preventDefault()
    }
  }

  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    onChange(selectedDate)
    setIsOpen(false)
    if (selectedDate) {
      setInputValue(format(selectedDate, "dd/MM/yyyy"))
      setIsValidInput(true)
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div className="flex">
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
              className="absolute right-0 top-0 h-full px-3 border-l-0 rounded-l-none"
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
        Escriba la fecha o use el calendario. Formatos: dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa
      </p>
    </div>
  )
} 