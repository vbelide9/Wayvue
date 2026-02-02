import React, { useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import { CustomDatePicker, CustomTimePicker } from './CustomDateTimePicker';

interface SidebarProps {
    onRouteSubmit: (start: string, end: string, date: string, time: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onRouteSubmit }) => {
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [date, setDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (start && end) {
            onRouteSubmit(start, end, date, time);
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

                    {/* Start Input (3.5 cols) */}
                    <div className="md:col-span-3.5 relative group">
                        <label className="block text-xs font-bold uppercase tracking-wider opacity-70 mb-2 ml-1">Starting Point</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#628141] z-10">
                                <MapPin size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder="Enter starting location..."
                                className="w-full pl-11 pr-4 py-3 bg-[#33402F] border border-[#628141] rounded-xl focus:outline-none focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22] text-white placeholder-gray-500 font-medium transition-all shadow-inner"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Destination Input (3.5 cols) */}
                    <div className="md:col-span-3.5 relative group">
                        <label className="block text-xs font-bold uppercase tracking-wider opacity-70 mb-2 ml-1">Destination</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#E67E22] z-10">
                                <MapPin size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder="Enter destination..."
                                className="w-full pl-11 pr-4 py-3 bg-[#33402F] border border-[#628141] rounded-xl focus:outline-none focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22] text-white placeholder-gray-500 font-medium transition-all shadow-inner"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Date Input (2 cols) */}
                    <div className="md:col-span-2 relative group">
                        <label className="block text-xs font-bold uppercase tracking-wider opacity-70 mb-2 ml-1 text-white">Date</label>
                        <CustomDatePicker
                            value={date}
                            onChange={setDate}
                            min={new Date().toISOString().split('T')[0]}
                            max={new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                            className="w-full"
                        />
                    </div>

                    {/* Time Input (1.5 cols) */}
                    <div className="md:col-span-1.5 min-w-[125px] relative group">
                        <label className="block text-xs font-bold uppercase tracking-wider opacity-70 mb-2 ml-1 text-white">Time</label>
                        <CustomTimePicker
                            value={time}
                            onChange={setTime}
                            className="w-full"
                        />
                    </div>

                    {/* Search Button (2 cols) */}
                    <div className="md:col-span-2">
                        <button
                            type="submit"
                            className="w-full bg-[#E67E22] hover:bg-[#d35400] text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:translate-y-[-2px] active:translate-y-0 transition-all flex items-center justify-center gap-2 h-[50px]"
                        >
                            <Search size={20} />
                            <span className="hidden md:inline">Go</span>
                            <span className="md:hidden">Search Route</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Sidebar;
