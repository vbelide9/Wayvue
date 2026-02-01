import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock as ClockIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
    value: string;
    onChange: (value: string) => void;
    min?: string;
    max?: string;
    className?: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange, min, max, className = "" }) => {
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
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 h-10 bg-secondary/30 border border-border rounded-lg hover:border-primary/50 transition-all cursor-pointer group"
            >
                <CalendarIcon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-xs font-semibold text-foreground">
                    {value ? parseDate(value).toLocaleDateString() : 'Select Date'}
                </span>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 p-4 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl z-[1000] w-64 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-secondary/50 rounded-md transition-colors">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-bold uppercase tracking-wider">{currentMonthName} {viewDate.getFullYear()}</span>
                        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-secondary/50 rounded-md transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                            <span key={d} className="text-[10px] font-bold text-muted-foreground text-center">{d}</span>
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
                    h-8 w-8 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center
                    ${isSelected ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' :
                                            isToday ? 'bg-secondary/50 text-primary border border-primary/30' :
                                                'hover:bg-secondary/40 text-foreground'}
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
}

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({ value, onChange, className = "" }) => {
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
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 h-10 bg-secondary/30 border border-border rounded-lg hover:border-primary/50 transition-all cursor-pointer group"
            >
                <ClockIcon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-xs font-semibold text-foreground">
                    {value || 'Select Time'}
                </span>
            </div>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 p-2 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl z-[1000] w-64 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex gap-4 p-2 h-48">
                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-1">
                            <div className="text-[10px] font-bold text-muted-foreground mb-2 px-2 uppercase tracking-tight">Hour</div>
                            {hours.map(h => (
                                <button
                                    key={h}
                                    onClick={() => handleTimeSelect(h, currentMin)}
                                    className={`
                    px-2 py-1.5 rounded-lg text-xs font-bold transition-all
                    ${h === currentHour ? 'bg-primary text-white' : 'hover:bg-secondary/40 text-foreground'}
                  `}
                                >
                                    {h}
                                </button>
                            ))}
                        </div>
                        <div className="w-px bg-border/50 self-stretch" />
                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-1">
                            <div className="text-[10px] font-bold text-muted-foreground mb-2 px-2 uppercase tracking-tight">Min</div>
                            {minutes.map(m => (
                                <button
                                    key={m}
                                    onClick={() => {
                                        handleTimeSelect(currentHour, m);
                                        setIsOpen(false);
                                    }}
                                    className={`
                    px-2 py-1.5 rounded-lg text-xs font-bold transition-all
                    ${m === currentMin ? 'bg-primary text-white' : 'hover:bg-secondary/40 text-foreground'}
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
