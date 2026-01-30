import React, { useState } from 'react';
import { Search, MapPin, Navigation } from 'lucide-react';

interface SidebarProps {
    onRouteSubmit: (start: string, end: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onRouteSubmit }) => {
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (start && end) {
            onRouteSubmit(start, end);
        }
    };

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] w-[95%] max-w-5xl">
            {/* Main Dashboard Card */}
            <div className="bg-[#40513B] rounded-2xl shadow-2xl p-6 border border-[#628141] text-[#E5D9B6]">

                {/* Header Section */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#628141]/50">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#E67E22] p-2 rounded-xl shadow-md">
                            <Navigation size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold font-sans tracking-tight text-white">RouteCast</h1>
                            <p className="text-sm font-medium opacity-70">Weather & Road Conditions</p>
                        </div>
                    </div>
                </div>

                {/* Input Section - Grid Layout */}
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">

                    {/* Start Input (5 cols) */}
                    <div className="md:col-span-5 relative group">
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

                    {/* Destination Input (5 cols) */}
                    <div className="md:col-span-5 relative group">
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
