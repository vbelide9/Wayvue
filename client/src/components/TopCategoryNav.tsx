import { useState, useEffect } from 'react';
import { Compass, Cloud, MapPin, AlertTriangle, Car, BedDouble } from 'lucide-react';
import { motion } from 'framer-motion';

const CATEGORIES = [
    { id: 'overview', label: 'Overview', icon: Compass },
    { id: 'weather', label: 'Weather', icon: Cloud },
    { id: 'stops', label: 'Stops', icon: MapPin },
    { id: 'road', label: 'Road', icon: AlertTriangle },
    { id: 'rentals', label: 'Rentals', icon: Car },
    { id: 'stay', label: 'Hotels', icon: BedDouble },
];

export function TopCategoryNav({ activeSection, onNavigate, badges }: { activeSection: string, onNavigate: (id: string) => void, badges?: Record<string, number> }) {
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
            <div className="bg-card/90 backdrop-blur-3xl border border-border shadow-soft-lg rounded-[2rem] p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none max-w-2xl w-full sm:w-auto relative overflow-hidden">
                {/* Subtle inner animated gradient border — warm amber */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent opacity-20 animate-pulse pointer-events-none" />

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
                                ${isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}
                            `}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="nav_pill_bg_premium"
                                    className="absolute inset-0 bg-primary rounded-full shadow-orange-glow"
                                    initial={false}
                                    transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
                                />
                            )}
                            <Icon className="w-4 h-4 relative z-10 transition-colors" />
                            <span className="relative z-10 tracking-wide">{cat.label}</span>
                            {badges && badges[cat.id] > 0 && (
                                <span className={`relative z-10 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold leading-none ${isActive ? 'bg-white/25 text-primary-foreground' : 'bg-primary/15 text-primary'}`}>
                                    {badges[cat.id]}
                                </span>
                            )}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
