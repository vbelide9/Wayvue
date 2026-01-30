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
        <div className="absolute top-4 left-4 z-10 w-80 bg-white rounded-lg shadow-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-6">
                <div style={{ backgroundColor: '#E5D9B6', color: '#40513B' }} className="p-2.5 rounded-xl shadow-sm">
                    <Navigation size={22} />
                </div>
                <h1 style={{ color: '#40513B' }} className="text-2xl font-extrabold tracking-tight">Wayvue</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative group">
                    <MapPin className="absolute left-3 top-3.5 text-[#628141]" size={18} />
                    <input
                        type="text"
                        placeholder="Start Location"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#628141] transition-all text-gray-700 font-medium"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                    />
                </div>

                <div className="relative group">
                    <MapPin className="absolute left-3 top-3.5 text-[#E67E22]" size={18} />
                    <input
                        type="text"
                        placeholder="Destination"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E67E22] transition-all text-gray-700 font-medium"
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                    />
                </div>

                <button
                    type="submit"
                    style={{ backgroundColor: '#40513B' }}
                    className="w-full text-[#E5D9B6] font-bold py-3.5 px-4 rounded-xl shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all flex items-center justify-center gap-2 mt-2"
                >
                    <Search size={20} />
                    Search Route
                </button>
            </form>



            <div className="mt-4 text-sm text-gray-500 text-center">
                <p>Enter locations to check weather and road conditions.</p>
            </div>
        </div>
    );
};

export default Sidebar;
