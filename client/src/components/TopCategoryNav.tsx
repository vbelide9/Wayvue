import { useState, useEffect } from 'react';
import { Bed, Car, Map, Compass } from 'lucide-react';
import { motion } from 'framer-motion';

const CATEGORIES = [
    { id: 'hotels', label: 'Hotels', icon: Bed },
    { id: 'rentals', label: 'Rental Cars', icon: Car },
    { id: 'experiences', label: 'Experiences', icon: Compass },
    { id: 'destinations', label: 'Destinations', icon: Map },
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
            <div className="bg-[#0a0a0f]/90 backdrop-blur-3xl border border-white/5 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-[2rem] p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none max-w-2xl w-full sm:w-auto relative overflow-hidden">
                {/* Subtle inner animated gradient border */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-20 animate-pulse pointer-events-none" />

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
                                ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}
                            `}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="nav_pill_bg_premium"
                                    className="absolute inset-0 bg-primary/15 rounded-full border border-primary/30 shadow-[inset_0_0_12px_rgba(59,130,246,0.2)]"
                                    initial={false}
                                    transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
                                />
                            )}
                            <Icon className={`w-4 h-4 relative z-10 transition-colors ${isActive ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : ''}`} />
                            <span className="relative z-10 tracking-wide">{cat.label}</span>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
