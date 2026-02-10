
import { useState, useEffect } from 'react';
import { RentalRecommendationCard } from '../../RentalRecommendationCard';
import { Users, Briefcase, Map, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateRentalLinks } from '@/utils/deepLinks';

interface RentalTabProps {
    metrics: { distance: string; time: string };
    weatherData: any[];
    // [NEW] Props for Deep Linking
    start?: string;
    destination?: string;
    depDate?: string;
    returnDate?: string;
    depTime?: string;
    returnTime?: string;
}


// Helper to get formatted date "YYYY-MM-DD"
const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    // If already YYYY-MM-DD
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
    // Attempt parse
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

    // Remove USA/United States
    let cleanAddr = address.replace(/,\s*(USA|United States)$/i, '');

    // Remove Zip Codes (5 digit or 5+4) matches at end of string or parts
    // Regex: look for 5 digits, optionally -4 digits, at the end or preceded by comma/space
    cleanAddr = cleanAddr.replace(/,?\s*\d{5}(-\d{4})?$/g, '');

    const parts = cleanAddr.split(',').map(p => p.trim());

    // Case: "City" or "City, State" -> Return first part or "City, State"
    if (parts.length === 2 && !/^\d/.test(parts[0])) {
        return cleanAddr; // Return full "City, State"
    }

    if (parts.length <= 2) return parts[0];

    // Case: "123 Main St, City, State" 
    // Heuristic: If part 0 starts with digit or "Apt", "Unit", etc, it's street.
    if (/^\d/.test(parts[0])) {
        // Return "City, State" (Start from index 1)
        // Ensure we don't return "City, State Zip" if regex missed it inside string?
        // The earlier regex stripped zip from END of string. 
        // If format is "Street, City, State Zip", cleanAddr should be "Street, City, State".
        const cityState = parts.slice(1).join(', ').trim();
        return cityState.replace(/\s\d{5}(-\d{4})?$/, '');
    }

    // Default: try to be safe and just return the City if it looks like "City, State, Something"
    // Return parts[0] is often best fallback if complex.
    return parts[0];
};

export function RentalTab({ metrics, weatherData, start, destination, depDate, returnDate, depTime, returnTime }: RentalTabProps) {
    // Filter State
    const [passengers, setPassengers] = useState(2);
    const [luggage, setLuggage] = useState(2);
    const [terrain, setTerrain] = useState<'city' | 'highway' | 'mountain'>('highway');

    // Data State
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Deep Link State
    const [links, setLinks] = useState<{ kayak: string, expedia: string } | null>(null);

    // Update links when data changes
    useEffect(() => {
        if (start && destination && depDate) {
            // Default return to next day if not provided
            let finalReturnDate = returnDate;
            if (!finalReturnDate) {
                // Try to calculate next day from depDate
                try {
                    const d = new Date(depDate);
                    d.setDate(d.getDate() + 1);
                    finalReturnDate = d.toISOString().split('T')[0];
                } catch { }
            }

            const linkParams = {
                origin: extractCity(start),
                destination: extractCity(destination),
                pickupDate: formatDate(depDate),
                dropoffDate: formatDate(finalReturnDate || depDate),
                pickupTime: depTime || "10:00",
                dropoffTime: returnTime || "10:00"
            };
            setLinks(generateRentalLinks(linkParams));
        }
    }, [start, destination, depDate, returnDate, depTime, returnTime]);


    // Debounced Fetch
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Determine weather from first segment/day
                const weatherCondition = weatherData?.[0]?.condition || "";

                const query = new URLSearchParams({
                    distance: metrics.distance || "0",
                    weather_condition: weatherCondition,
                    passengers: passengers.toString(),
                    luggage: luggage.toString(),
                    terrain: terrain
                });

                const res = await fetch(`/api/trip/rental-recommendations?${query.toString()}`);
                if (res.ok) {
                    const result = await res.json();
                    setData(result);
                }
            } catch (err) {
                console.error("Failed to fetch rental recs:", err);
            } finally {
                setLoading(false);
            }
        };

        const timeout = setTimeout(fetchData, 500); // 500ms debounce
        return () => clearTimeout(timeout);
    }, [passengers, luggage, terrain, metrics, weatherData]);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-6">
            <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight">Vehicle Recommendation</h2>
                <p className="text-xs text-muted-foreground">
                    Customize your trip parameters to get the perfect vehicle match.
                </p>
            </div>

            {/* Filters */}
            <div className="space-y-4 bg-muted/20 p-4 rounded-xl border border-border/50">
                {/* Passengers */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5" /> Passengers
                    </div>
                    <div className="flex gap-2">
                        {[1, 2, 4, 6].map(num => (
                            <Button
                                key={num}
                                variant={passengers === num ? "default" : "outline"}
                                size="sm"
                                onClick={() => setPassengers(num)}
                                className="h-7 text-xs flex-1 transition-all"
                            >
                                {num}{num === 6 ? '+' : ''}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Luggage */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <Briefcase className="w-3.5 h-3.5" /> Luggage Items
                    </div>
                    <div className="flex gap-2">
                        {[0, 2, 4, 6].map(num => (
                            <Button
                                key={num}
                                variant={luggage === num ? "default" : "outline"}
                                size="sm"
                                onClick={() => setLuggage(num)}
                                className="h-7 text-xs flex-1 transition-all"
                            >
                                {num}{num === 6 ? '+' : ''}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Terrain */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <Map className="w-3.5 h-3.5" /> Terrain
                    </div>
                    <div className="flex gap-2">
                        {['City', 'Highway', 'Mountain'].map(t => (
                            <Button
                                key={t}
                                variant={terrain === t.toLowerCase() ? "default" : "outline"}
                                size="sm"
                                onClick={() => setTerrain(t.toLowerCase() as any)}
                                className="h-7 text-xs flex-1 transition-all"
                            >
                                {t}
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

                {/* Pass links to card if available */}
                {data && <RentalRecommendationCard data={data} links={links} />}

                {!data && !loading && (
                    <div className="text-center text-sm text-muted-foreground py-10">
                        Adjust filters to see recommendations.
                    </div>
                )}
            </div>

            {/* Context Info */}
            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 mt-2">
                <h3 className="font-bold text-xs mb-2 text-primary uppercase tracking-wider">Why upgrade?</h3>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                    <li>Reduce fatigue on long highway stretches (&gt;150 miles).</li>
                    <li>Improve safety with AWD in adverse weather conditions.</li>
                    <li>Avoid wear and tear on your personal vehicle.</li>
                </ul>
            </div>
        </div>
    );
}
