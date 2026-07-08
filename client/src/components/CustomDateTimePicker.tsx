import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock as ClockIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { CalendarWithTimePresets } from './ui/calendar-with-time-pressets';

interface CustomDatePickerProps {
    value: string;
    onChange: (value: string) => void;
    min?: string;
    max?: string;
    className?: string;
    renderTrigger?: (value: string, onClick: () => void) => React.ReactNode;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange, min, max, className = "", renderTrigger }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Manual local date parsing to avoid UTC shifts
    const getInitialDate = () => {
        if (value && value.includes('-')) {
            const [y, m, d] = value.split('-').map(Number);
            return new Date(y, m - 1, d);
        }
        return new Date();
    };

    const [viewDate, setViewDate] = useState(getInitialDate());

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const startDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const formatDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const parseDate = (str: string) => {
        if (!str) return new Date();
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDateClick = (day: number) => {
        const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        const dateStr = formatDate(selected);

        // Check min/max
        if (min && dateStr < min) return;
        if (max && dateStr > max) return;

        onChange(dateStr);
        setIsOpen(false);
    };

    const changeMonth = (offset: number) => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
    };

    const currentMonthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(viewDate);

    const days = [];
    const totalDays = daysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const startOffset = startDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());

    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(i);

    return (
        <div className={`relative ${className} ${isOpen ? 'z-[9999]' : 'z-0'}`} ref={containerRef}>
            {renderTrigger ? (
                renderTrigger(value, () => setIsOpen(!isOpen))
            ) : (
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1 xl:gap-2 px-2 h-10 bg-secondary border border-border rounded-lg hover:bg-secondary/70 transition-all cursor-pointer group whitespace-nowrap backdrop-blur-md"
                >
                    <CalendarIcon className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                    <span className="text-[10px] xl:text-xs font-medium text-foreground">
                        {value ? parseDate(value).toLocaleDateString() : 'Select Date'}
                    </span>
                </div>
            )}

            {isOpen && (
                <div style={{ zIndex: 9999 }} className="absolute top-full left-0 mt-2 p-4 bg-card backdrop-blur-3xl border border-border rounded-2xl shadow-soft-lg w-[280px]">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-[12px] font-bold uppercase tracking-widest text-foreground">{currentMonthName} {viewDate.getFullYear()}</span>
                        <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                            <span key={d} className="text-[10px] font-bold text-muted-foreground text-center uppercase">{d}</span>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, i) => {
                            if (day === null) return <div key={`empty-${i}`} />;

                            const currentDayDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                            const dateStr = formatDate(currentDayDate);
                            const isSelected = value === dateStr;
                            const isToday = formatDate(new Date()) === dateStr;
                            const isDisabled = Boolean((min && dateStr < min) || (max && dateStr > max));

                            return (
                                <button
                                    key={i}
                                    disabled={isDisabled}
                                    onClick={() => handleDateClick(day)}
                                    className={`
                    h-8 w-8 text-[11px] font-medium rounded-lg transition-all flex items-center justify-center
                    ${isSelected ? 'bg-primary text-primary-foreground shadow-md scale-105' :
                                            isToday ? 'bg-secondary text-foreground border border-primary/30' :
                                                'hover:bg-secondary text-muted-foreground hover:text-foreground'}
                    ${isDisabled ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

interface CustomTimePickerProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    renderTrigger?: (value: string, onClick: () => void) => React.ReactNode;
}

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({ value, onChange, className = "", renderTrigger }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = ['00', '15', '30', '45'];

    const currentHour = value.split(':')[0];
    const currentMin = value.split(':')[1];

    const handleTimeSelect = (h: string, m: string) => {
        onChange(`${h}:${m}`);
        if (h === currentHour && m !== currentMin) {
            // Just changed minutes, maybe stay open? Or close for better UX.
            // For simplicity, let's close on selection.
        }
    };

    return (
        <div className={`relative ${className} ${isOpen ? 'z-[9999]' : 'z-0'}`} ref={containerRef}>
            {renderTrigger ? (
                renderTrigger(value, () => setIsOpen(!isOpen))
            ) : (
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1 xl:gap-2 px-2 h-10 bg-secondary border border-border rounded-lg hover:bg-secondary/70 transition-all cursor-pointer group whitespace-nowrap backdrop-blur-md"
                >
                    <ClockIcon className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                    <span className="text-[10px] xl:text-xs font-medium text-foreground">
                        {value || 'Time'}
                    </span>
                </div>
            )}

            {isOpen && (
                <div style={{ zIndex: 9999 }} className="absolute top-full right-0 mt-2 p-2 bg-card backdrop-blur-3xl border border-border rounded-2xl shadow-soft-lg w-60">
                    <div className="flex gap-2 p-2 h-56">
                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-1 pr-1">
                            <div className="sticky top-0 bg-card backdrop-blur-md text-[10px] font-bold text-muted-foreground mb-1 py-1 px-2 uppercase tracking-widest z-10">Hour</div>
                            {hours.map(h => (
                                <button
                                    key={h}
                                    onClick={() => handleTimeSelect(h, currentMin)}
                                    className={`
                    px-3 py-2 rounded-xl text-xs font-medium transition-all text-left
                    ${h === currentHour ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-secondary text-muted-foreground hover:text-foreground'}
                  `}
                                >
                                    {h}
                                </button>
                            ))}
                        </div>
                        <div className="w-[1px] bg-border self-stretch my-2" />
                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-1 pl-1">
                            <div className="sticky top-0 bg-card backdrop-blur-md text-[10px] font-bold text-muted-foreground mb-1 py-1 px-2 uppercase tracking-widest z-10">Min</div>
                            {minutes.map(m => (
                                <button
                                    key={m}
                                    onClick={() => {
                                        handleTimeSelect(currentHour, m);
                                        setIsOpen(false);
                                    }}
                                    className={`
                    px-3 py-2 rounded-xl text-xs font-medium transition-all text-left
                    ${m === currentMin ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-secondary text-muted-foreground hover:text-foreground'}
                  `}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

interface CombinedDateTimePickerProps {
    dateValue: string;
    onDateChange: (value: string) => void;
    timeValue: string;
    onTimeChange: (value: string) => void;
    minDate?: string;
    maxDate?: string;
    label?: string;
    className?: string;
    isActive?: boolean;
    compact?: boolean; // single-line pill trigger for tight toolbars (results header)
}

export const CombinedDateTimePicker: React.FC<CombinedDateTimePickerProps> = ({
    dateValue,
    onDateChange,
    timeValue,
    onTimeChange,
    minDate,
    maxDate,
    label,
    className = "",
    isActive = false,
    compact = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (containerRef.current && !containerRef.current.contains(target)) {
                // Ignore clicks in Radix UI Select portals (which render at the end of the body)
                if (target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]')) {
                    return;
                }
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatDisplayDate = (val: string) => {
        if (!val) return 'Select Date';
        const [y, m, d] = val.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const baseCardClass = "relative group flex flex-col rounded-2xl p-3 transition-all duration-300 cursor-pointer";
    const activeClass = isActive
        ? "border border-primary/40 bg-primary/[0.06] shadow-[0_0_20px_rgba(232,106,42,0.10)]"
        : "border border-border bg-secondary/40 hover:bg-secondary";

    // Get a unified Date object from string props
    let combinedDate: Date | undefined = undefined;
    if (dateValue) {
        const [y, m, d] = dateValue.split('-').map(Number);
        combinedDate = new Date(y, m - 1, d);
        if (timeValue) {
            const [hours, mins] = timeValue.split(':').map(Number);
            combinedDate.setHours(hours, mins, 0, 0);
        } else {
            combinedDate.setHours(12, 0, 0, 0); // default noon
        }
    }

    const handleCombinedChange = (newDate: Date | undefined) => {
        if (!newDate) return;
        
        // Extract string values for upward props
        const dateStr = `${newDate.getFullYear()}-${String(newDate.getMonth()+1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
        onDateChange(dateStr);

        const timeStr = `${String(newDate.getHours()).padStart(2, '0')}:${String(newDate.getMinutes()).padStart(2, '0')}`;
        onTimeChange(timeStr);
    };

    const formatDisplayTime = (val: string) => {
        if (!val) return 'Select Time';
        const [hoursStr, mins] = val.split(':');
        let hours = parseInt(hoursStr, 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        return `${hours}:${mins} ${ampm}`;
    };

    return (
        <div className={`relative ${className} ${isOpen ? 'z-[9999]' : 'z-0'}`} ref={containerRef}>
            {compact ? (
                /* Compact single-line pill trigger — fits inline in tight toolbars */
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`h-8 flex items-center gap-2 pl-2.5 pr-2 rounded-lg border text-xs font-bold whitespace-nowrap transition-all ${isOpen ? 'border-primary/50 bg-white/[0.08] text-foreground' : 'bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                >
                    <CalendarIcon strokeWidth={1.5} size={14} className="text-primary flex-shrink-0" />
                    {label && <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</span>}
                    <span className="text-foreground">{formatDisplayDate(dateValue)}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-muted-foreground">{formatDisplayTime(timeValue)}</span>
                    <ChevronDown size={12} className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            ) : (
                <div
                    className={`${baseCardClass} ${activeClass} ${isOpen ? 'border-primary/40 bg-primary/[0.06]' : ''} w-full h-full`}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {label && (
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 pointer-events-none">
                            {label}
                        </div>
                    )}
                    <div className="flex flex-col gap-1.5 relative mt-1 pointer-events-none">
                        <div className="flex items-center gap-2 group">
                            <CalendarIcon strokeWidth={1.25} size={18} className="text-primary transition-colors flex-shrink-0" />
                            <span className="text-[17px] font-bold text-foreground tracking-tight font-sans">
                                {formatDisplayDate(dateValue)}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5">
                            <ClockIcon strokeWidth={1.25} size={15} className="text-muted-foreground transition-colors flex-shrink-0 ml-[1px]" />
                            <span className="text-[13px] font-medium text-muted-foreground tracking-wide left-[1px] relative font-sans">
                                {formatDisplayTime(timeValue)}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {isOpen && (
                <div style={{ zIndex: 9999 }} className="absolute top-full left-0 mt-2 p-2 bg-card backdrop-blur-3xl border border-border rounded-2xl shadow-soft-lg md:min-w-[400px]">
                    <CalendarWithTimePresets 
                        date={combinedDate}
                        setDate={handleCombinedChange}
                        onClose={() => setIsOpen(false)}
                        disabled={(date: Date) => {
                            if (!minDate && !maxDate) return false;
                            const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                            if (minDate && dateStr < minDate) return true;
                            if (maxDate && dateStr > maxDate) return true;
                            return false;
                        }}
                    />
                </div>
            )}
        </div>
    );
};
