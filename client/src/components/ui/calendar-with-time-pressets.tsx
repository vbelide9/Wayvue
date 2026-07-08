import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { setHours, setMinutes } from "date-fns"

interface CalendarWithTimePresetsProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  disabled?: boolean | ((date: Date) => boolean)
  className?: string
  onClose?: () => void
}

export const CalendarWithTimePresets = ({ date, setDate, disabled, className, onClose }: CalendarWithTimePresetsProps) => {
  const defaultDate = new Date()
  
  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      setDate(undefined)
      return
    }
    
    // Preserve existing time if date changes
    if (date) {
      const newDate = new Date(selectedDate)
      newDate.setHours(date.getHours())
      newDate.setMinutes(date.getMinutes())
      setDate(newDate)
    } else {
      // Default to current time, but min-bounded to future if it's today
      const newDate = new Date(selectedDate)
      const now = new Date()
      if (newDate.toDateString() === now.toDateString()) {
         newDate.setHours(now.getHours())
         newDate.setMinutes(Math.ceil(now.getMinutes() / 15) * 15)
      } else {
         newDate.setHours(12, 0, 0, 0)
      }
      setDate(newDate)
    }
  }

  const handleHourChange = (value: string) => {
    const baseDate = date || defaultDate
    const currentHours = baseDate.getHours()
    const isPM = currentHours >= 12
    let newHours = parseInt(value, 10)
    
    // Convert 12h to 24h
    if (isPM && newHours < 12) newHours += 12
    if (!isPM && newHours === 12) newHours = 0

    setDate(setHours(baseDate, newHours))
  }

  const handleMinuteChange = (value: string) => {
    const baseDate = date || defaultDate
    setDate(setMinutes(baseDate, parseInt(value, 10)))
  }

  const handleAmPmChange = (value: string) => {
    const baseDate = date || defaultDate
    let currentHours = baseDate.getHours()
    
    if (value === "PM" && currentHours < 12) currentHours += 12
    else if (value === "AM" && currentHours >= 12) currentHours -= 12
      
    setDate(setHours(baseDate, currentHours))
  }

  // Formatting helpers for the selects
  const currentHour12 = date ? (date.getHours() % 12 || 12).toString() : "12"
  const currentMinute = date ? Math.floor(date.getMinutes() / 15) * 15 : 0
  const currentMinuteStr = currentMinute.toString().padStart(2, "0")
  const currentAmPm = date ? (date.getHours() >= 12 ? "PM" : "AM") : "PM"

  // Time restriction logic for today
  const isToday = date ? date.toDateString() === new Date().toDateString() : false
  const now = new Date()
  const currentRealHour = now.getHours()
  const currentRealMinute = now.getMinutes()

  return (
    <div className={cn("p-1 flex flex-col md:flex-row gap-4", className)}>
      <div className="flex flex-col">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          disabled={disabled}
          initialFocus
          className="bg-transparent"
          classNames={{
            day_selected: "bg-primary text-primary-foreground hover:bg-primary focus:bg-primary",
            day_today: "bg-secondary text-foreground underline underline-offset-4"
          }}
        />
      </div>

      <div className="w-[1px] bg-border my-4 hidden md:block" />
      <div className="h-[1px] bg-border mx-4 md:hidden" />

      <div className="flex flex-col gap-4 py-2 pr-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Time</h3>
        
        {/* Manual Time Selectors */}
        <div className="flex items-center gap-2">
           <div className="flex items-center bg-secondary rounded-md border border-border overflow-hidden">
             <Select value={currentHour12} onValueChange={handleHourChange}>
               <SelectTrigger className="w-[60px] h-auto border-none bg-transparent focus:ring-0 focus:ring-offset-0 px-3 py-2 text-base text-foreground">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent position="popper">
                 {Array.from({ length: 12 }).map((_, i) => {
                   const hour12 = i + 1;
                   let hour24 = hour12;
                   if (currentAmPm === "PM" && hour12 < 12) hour24 += 12;
                   if (currentAmPm === "AM" && hour12 === 12) hour24 = 0;
                   const isDisabled = isToday && (hour24 < currentRealHour);
                   
                   return (
                     <SelectItem key={i} value={hour12.toString()} disabled={isDisabled}>
                       {hour12}
                     </SelectItem>
                   )
                 })}
               </SelectContent>
             </Select>

             <span className="text-muted-foreground bg-transparent py-2 -mx-2 z-10 font-bold">:</span>
             
             <Select value={currentMinuteStr} onValueChange={handleMinuteChange}>
               <SelectTrigger className="w-[60px] h-auto border-none bg-transparent focus:ring-0 focus:ring-offset-0 px-3 py-2 text-base text-foreground">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent position="popper">
                 {["00", "15", "30", "45"].map((m) => {
                   const minNum = parseInt(m, 10);
                   const isHourSame = date ? date.getHours() === currentRealHour : false;
                   const isDisabled = isToday && isHourSame && (minNum < currentRealMinute);
                   
                   return (
                     <SelectItem key={m} value={m} disabled={isDisabled}>
                       {m}
                     </SelectItem>
                   )
                 })}
               </SelectContent>
             </Select>
           </div>
           
           <div className="flex items-center bg-secondary rounded-md border border-border overflow-hidden">
             <Select value={currentAmPm} onValueChange={handleAmPmChange}>
               <SelectTrigger className="w-[70px] h-auto border-none bg-transparent focus:ring-0 focus:ring-offset-0 px-3 py-2 text-base text-foreground">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent position="popper">
                  {/* Disable AM if it's currently PM today */}
                 <SelectItem value="AM" disabled={isToday && currentRealHour >= 12}>AM</SelectItem>
                 <SelectItem value="PM">PM</SelectItem>
               </SelectContent>
             </Select>
           </div>
        </div>

        <div className="flex-grow flex items-end mt-4">
            <button 
                onClick={(e) => {
                    e.preventDefault();
                    if (onClose) onClose();
                }}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-xl border border-primary/40 transition-colors"
                type="button"
            >
                Apply
            </button>
        </div>

      </div>
    </div>
  )
}
