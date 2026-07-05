import { useState, useEffect } from 'react';
import { Compass, Cloud, MapPin, AlertTriangle, Car, BedDouble } from 'lucide-react';
import { motion } from 'framer-motion';

const CATEGORIES = [
    { id: 'overview', label: 'Overview', icon: Compass },
    { id: 'weather', label: 'Weather forecast', icon: Cloud },
    { id: 'stops', label: 'Stops', icon: MapPin },
    { id: 'road', label: 'Road conditions', icon: AlertTriangle },
    { id: 'rentals', label: 'Rental vehicles', icon: Car },
    { id: 'stay', label: 'Hotels', icon: BedDouble },
];

export function TopCategoryNav({ activeSection, onNavigate }: { activeSection: string, onNavigate: (id: string) => void }) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // We'll track the window or container scroll
            setScrolled(window.scrollY > 100);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className={`sticky top-4 z-[500] flex justify-center w-full px-4 transition-all duration-300 ${scrolled ? 'translate-y-0 opacity-100' : 'translate-y-0 opacity-100'}`}>
            <div className="bg-[#0F1A12]/90 backdrop-blur-3xl border border-[#628141]/10 shadow-[0_0_40px_rgba(64,81,59,0.2)] rounded-[2rem] p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none max-w-2xl w-full sm:w-auto relative overflow-hidden">
                {/* Subtle inner animated gradient border — warm forest */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#628141]/20 to-transparent opacity-20 animate-pulse pointer-events-none" />

                {CATEGORIES.map((cat) => {
                    const isActive = activeSection === cat.id;
                    const Icon = cat.icon;
                    return (
                        <motion.button
                            key={cat.id}
                            onClick={() => onNavigate(cat.id)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`
                                relative flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors duration-300 outline-none select-none shrink-0
                                ${isActive ? 'text-[#E5D9B6]' : 'text-muted-foreground hover:text-foreground'}
                            `}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="nav_pill_bg_premium"
                                    className="absolute inset-0 bg-[#628141]/15 rounded-full border border-[#628141]/30 shadow-[inset_0_0_12px_rgba(98,129,65,0.2)]"
                                    initial={false}
                                    transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
                                />
                            )}
                            <Icon className={`w-4 h-4 relative z-10 transition-colors ${isActive ? 'drop-shadow-[0_0_8px_rgba(98,129,65,0.8)]' : ''}`} />
                            <span className="relative z-10 tracking-wide">{cat.label}</span>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
