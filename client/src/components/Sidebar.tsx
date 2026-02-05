import React, { useState } from 'react';
import { Search, MapPin, RefreshCw, ChevronDown, Check } from 'lucide-react';
import { CombinedDateTimePicker } from './CustomDateTimePicker';

interface SidebarProps {
    onRouteSubmit: (start: string, end: string, date: string, time: string, returnDate?: string, returnTime?: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onRouteSubmit }) => {
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [date, setDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    const [tripType, setTripType] = useState<'one-way' | 'round-trip'>('one-way');
    const [showTripTypeMenu, setShowTripTypeMenu] = useState(false);
    const [returnDate, setReturnDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1); // Default return next day
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [returnTime, setReturnTime] = useState('10:00');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (start && end) {
            onRouteSubmit(
                start,
                end,
                date,
                time,
                tripType === 'round-trip' ? returnDate : undefined,
                tripType === 'round-trip' ? returnTime : undefined
            );
        }
    };

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] w-[95%] max-w-5xl">
            {/* Main Dashboard Card */}
            <div className="bg-[#40513B] rounded-2xl shadow-2xl p-6 border border-[#628141] text-[#E5D9B6]">

                {/* Header Section */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#628141]/50">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#40513B] p-0 rounded-full shadow-md border border-white/5 backdrop-blur-sm overflow-hidden w-12 h-12 flex items-center justify-center">
                            <img src="/logo.svg" alt="Wayvue Logo" className="w-[85%] h-[85%] object-contain" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold font-sans tracking-tight text-white">Wayvue</h1>
                            <p className="text-sm font-medium opacity-70">Trip Intelligence Assistant</p>
                        </div>
                    </div>
                </div>

                {/* Input Section - Grid Layout */}
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">

                    {/* Start Input (3 cols) */}
                    <div className="md:col-span-3 relative group">
                        <label className="block text-xs font-bold uppercase tracking-wider opacity-70 mb-2 ml-1">Starting Point</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#628141] z-10">
                                <MapPin size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder="Start location..."
                                className="w-full pl-11 pr-4 py-3 bg-[#33402F] border border-[#628141] rounded-xl focus:outline-none focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22] text-white placeholder-gray-500 font-medium transition-all shadow-inner"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Destination Input (3 cols) */}
                    <div className="md:col-span-3 relative group">
                        <label className="block text-xs font-bold uppercase tracking-wider opacity-70 mb-2 ml-1">Destination</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#E67E22] z-10">
                                <MapPin size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder="Destination..."
                                className="w-full pl-11 pr-4 py-3 bg-[#33402F] border border-[#628141] rounded-xl focus:outline-none focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22] text-white placeholder-gray-500 font-medium transition-all shadow-inner"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Start Date/Time (Combined) */}
                    <div className={`${tripType === 'round-trip' ? 'md:col-span-2' : 'md:col-span-3'} relative group transition-all duration-300`}>
                        <CombinedDateTimePicker
                            label="Depart"
                            dateValue={date}
                            onDateChange={setDate}
                            timeValue={time}
                            onTimeChange={setTime}
                            minDate={new Date().toISOString().split('T')[0]}
                            maxDate={new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                            className="w-full"
                        />
                    </div>

                    {/* Return Date/Time (Combined, Conditional) */}
                    {tripType === 'round-trip' && (
                        <div className="md:col-span-2 relative group animate-in fade-in slide-in-from-left-4 duration-300">
                            <CombinedDateTimePicker
                                label="Return"
                                dateValue={returnDate}
                                onDateChange={setReturnDate}
                                timeValue={returnTime}
                                onTimeChange={setReturnTime}
                                minDate={date} // Return date must be after start date
                                className="w-full"
                            />
                        </div>
                    )}

                    {/* Trip Type Toggle & Go Button */}
                    <div className="md:col-span-2 flex gap-2">
                        {/* Trip Type Toggle */}
                        <div className="flex-1">
                            <label className="block text-xs font-bold uppercase tracking-wider opacity-70 mb-2 ml-1 text-white opacity-0">Type</label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowTripTypeMenu(!showTripTypeMenu)}
                                    className="w-full bg-[#33402F] border border-[#628141] hover:bg-[#3d4c38] text-white font-bold py-3 px-2 rounded-xl transition-all shadow-inner h-[50px] flex items-center justify-between px-4 text-xs uppercase tracking-wider"
                                >
                                    <span className="flex items-center gap-2">
                                        <RefreshCw size={14} className={tripType === 'round-trip' ? 'text-emerald-400' : 'text-gray-400'} />
                                        {tripType === 'one-way' ? 'One Way' : 'Round Trip'}
                                    </span>
                                    <ChevronDown size={14} className={`transition-transform ${showTripTypeMenu ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Dropdown Menu */}
                                {showTripTypeMenu && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#33402F] border border-[#628141] rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTripType('one-way');
                                                setShowTripTypeMenu(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-between mb-1 transition-colors ${tripType === 'one-way' ? 'bg-[#628141]/30 text-white' : 'text-gray-400 hover:bg-[#628141]/10 hover:text-white'}`}
                                        >
                                            <span>One Way</span>
                                            {tripType === 'one-way' && <Check size={14} className="text-[#E67E22]" />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTripType('round-trip');
                                                setShowTripTypeMenu(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-colors ${tripType === 'round-trip' ? 'bg-[#628141]/30 text-white' : 'text-gray-400 hover:bg-[#628141]/10 hover:text-white'}`}
                                        >
                                            <span>Round Trip</span>
                                            {tripType === 'round-trip' && <Check size={14} className="text-[#E67E22]" />}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Search Button */}
                        <div className="flex-1">
                            <label className="block text-xs font-bold uppercase tracking-wider opacity-70 mb-2 ml-1 text-white opacity-0">Go</label>
                            <button
                                type="submit"
                                className="w-full bg-[#E67E22] hover:bg-[#d35400] text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:translate-y-[-2px] active:translate-y-0 transition-all flex items-center justify-center gap-2 h-[50px]"
                            >
                                <Search size={20} />
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Sidebar;
