import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Compass, Cloud, MapPin, AlertTriangle, Car, BedDouble, Ticket, type LucideIcon } from 'lucide-react';

export interface AccordionCategory {
    id: string;
    title: string;
    subtitle: string;
}

const ICONS: Record<string, LucideIcon> = {
    overview: Compass,
    weather: Cloud,
    stops: MapPin,
    road: AlertTriangle,
    rentals: Car,
    stay: BedDouble,
    activities: Ticket,
};

interface InsightsAccordionProps {
    categories: AccordionCategory[];
    activeId: string;
    onToggle: (id: string) => void;
    badges?: Record<string, number>;
    renderContent: (id: string) => ReactNode;
}

// Vertically stacked, single-open-at-a-time sections — replaces the horizontal
// scrollable tab bar so every category is visible without scrolling sideways.
export function InsightsAccordion({ categories, activeId, onToggle, badges, renderContent }: InsightsAccordionProps) {
    const headerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    // Bring the just-opened section's header to the top of the scroll area — without
    // this, expanding a section further down the list (e.g. Hotels) leaves its content
    // below the fold and the user has to scroll down manually to see it.
    useEffect(() => {
        if (!activeId) return;
        const el = headerRefs.current[activeId];
        if (!el) return;
        const timer = setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 280);
        return () => clearTimeout(timer);
    }, [activeId]);

    return (
        <div className="space-y-2">
            {categories.map((cat) => {
                const isOpen = activeId === cat.id;
                const Icon = ICONS[cat.id] ?? Compass;
                const badge = badges?.[cat.id];
                return (
                    <div key={cat.id} className="glass-surface rounded-2xl overflow-hidden border border-border/60">
                        <button
                            ref={(el) => { headerRefs.current[cat.id] = el; }}
                            onClick={() => onToggle(isOpen ? '' : cat.id)}
                            aria-expanded={isOpen}
                            className={`sticky top-0 z-10 w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${isOpen ? 'bg-primary/10' : 'bg-card hover:bg-muted/40'}`}
                        >
                            <span className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                <Icon className="w-4 h-4" />
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-sm font-semibold text-foreground">{cat.title}</span>
                                <span className="block text-xs text-muted-foreground truncate">{cat.subtitle}</span>
                            </span>
                            {!!badge && badge > 0 && (
                                <span className="shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold leading-none bg-primary/15 text-primary">
                                    {badge}
                                </span>
                            )}
                            <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence initial={false}>
                            {isOpen && (
                                <motion.div
                                    key="content"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: [0.76, 0, 0.24, 1] }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-3 pb-3 pt-1">
                                        {renderContent(cat.id)}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
}
