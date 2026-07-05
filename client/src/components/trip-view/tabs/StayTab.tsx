import { useState, useEffect } from 'react';
import { HotelRecommendationCard } from '../../HotelRecommendationCard';
import { Moon, Wallet, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateHotelLinks } from '@/utils/deepLinks';

interface StayTabProps {
    metrics: { distance: string; time: string };
    start?: string;
    destination?: string;
    depDate?: string;
    returnDate?: string;
}

// Helper to get formatted date "YYYY-MM-DD"
const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        return d.toISOString().split('T')[0];
    } catch {
        return "";
    }
};

// Helper to extract City from "Street, City, State Zip" or "City, State"
const extractCity = (address?: string) => {
    if (!address) return "";
    let cleanAddr = address.replace(/,\s*(USA|United States)$/i, '');
    cleanAddr = cleanAddr.replace(/,?\s*\d{5}(-\d{4})?$/g, '');
    const parts = cleanAddr.split(',').map(p => p.trim());
    if (parts.length === 2 && !/^\d/.test(parts[0])) return cleanAddr;
    if (parts.length <= 2) return parts[0];
    if (/^\d/.test(parts[0])) {
        const cityState = parts.slice(1).join(', ').trim();
        return cityState.replace(/\s\d{5}(-\d{4})?$/, '');
    }
    return parts[0];
};

// Add N days to a YYYY-MM-DD date string
const addDays = (dateStr: string, days: number) => {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    } catch {
        return dateStr;
    }
};

export function StayTab({ metrics, start, destination, depDate, returnDate }: StayTabProps) {
    // Filter State
    const [nights, setNights] = useState(1);
    const [budget, setBudget] = useState<'economy' | 'standard' | 'premium'>('standard');
    const [guests, setGuests] = useState(2);

    // Data State
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Deep Link State
    const [links, setLinks] = useState<{ booking: string, kayak: string } | null>(null);

    // Update booking links when trip context or nights change
    useEffect(() => {
        if (destination && depDate) {
            const checkIn = formatDate(depDate);
            // Prefer the return date as checkout if it's after check-in; else check-in + nights
            let checkOut = formatDate(returnDate);
            if (!checkOut || checkOut <= checkIn) {
                checkOut = addDays(checkIn, nights);
            }
            setLinks(generateHotelLinks({
                city: extractCity(destination),
                checkIn,
                checkOut,
                guests
            }));
        }
    }, [start, destination, depDate, returnDate, nights, guests]);

    // Debounced Fetch
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Real check-in/out dates so live pricing (Amadeus) prices the actual stay
                const checkIn = formatDate(depDate) || new Date().toISOString().split('T')[0];
                let checkOut = formatDate(returnDate);
                if (!checkOut || checkOut <= checkIn) checkOut = addDays(checkIn, nights);

                const query = new URLSearchParams({
                    distance: metrics.distance || "0",
                    nights: nights.toString(),
                    budget,
                    guests: guests.toString(),
                    origin: start || "",
                    destination: destination || "",
                    checkIn,
                    checkOut
                });

                const res = await fetch(`/api/trip/hotel-recommendations?${query.toString()}`);
                if (res.ok) {
                    const result = await res.json();
                    setData(result);
                }
            } catch (err) {
                console.error("Failed to fetch hotel recs:", err);
            } finally {
                setLoading(false);
            }
        };

        const timeout = setTimeout(fetchData, 500); // 500ms debounce
        return () => clearTimeout(timeout);
    }, [nights, budget, guests, metrics, start, destination, depDate, returnDate]);

    return (
        <div className="p-4 space-y-6">
            <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight">Where to Stay</h2>
                <p className="text-xs text-muted-foreground">
                    Overnight recommendations matched to your route and budget.
                </p>
            </div>

            {/* Filters */}
            <div className="space-y-4 bg-muted/20 p-4 rounded-xl border border-border/50">
                {/* Nights */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <Moon className="w-3.5 h-3.5" /> Nights
                    </div>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map(num => (
                            <Button
                                key={num}
                                variant={nights === num ? "default" : "outline"}
                                size="sm"
                                onClick={() => setNights(num)}
                                className="h-7 text-xs flex-1 transition-all"
                            >
                                {num}{num === 4 ? '+' : ''}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Budget */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <Wallet className="w-3.5 h-3.5" /> Budget
                    </div>
                    <div className="flex gap-2">
                        {['Economy', 'Standard', 'Premium'].map(t => (
                            <Button
                                key={t}
                                variant={budget === t.toLowerCase() ? "default" : "outline"}
                                size="sm"
                                onClick={() => setBudget(t.toLowerCase() as any)}
                                className="h-7 text-xs flex-1 transition-all"
                            >
                                {t}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Guests */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5" /> Guests
                    </div>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map(num => (
                            <Button
                                key={num}
                                variant={guests === num ? "default" : "outline"}
                                size="sm"
                                onClick={() => setGuests(num)}
                                className="h-7 text-xs flex-1 transition-all"
                            >
                                {num}{num === 4 ? '+' : ''}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[300px] relative">
                {loading && (
                    <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                )}

                {data && <HotelRecommendationCard data={data} links={links} />}

                {!data && !loading && (
                    <div className="text-center text-sm text-muted-foreground py-10">
                        Adjust filters to see recommendations.
                    </div>
                )}
            </div>

            {/* Context Info */}
            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 mt-2">
                <h3 className="font-bold text-xs mb-2 text-primary uppercase tracking-wider">Rest smart</h3>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                    <li>Break long drives (&gt;400 miles) with an overnight stop to reduce fatigue.</li>
                    <li>Book near highway exits for easy morning departures.</li>
                    <li>Free-breakfast properties save time and money on multi-day trips.</li>
                </ul>
            </div>
        </div>
    );
}
