import { Car, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';


interface RentalOption {
    name: string;
    features: string;
    price: string;
    link: string;
}

interface RentalRecommendationProps {
    data: {
        showRecommendation: boolean;
        reason: string;
        recommendedVehicle: string;
        provider: string;
        options: RentalOption[];
    } | null;
    // [NEW] Deep Links
    links?: {
        kayak: string;
        expedia: string;
    } | null;
}

export function RentalRecommendationCard({ data, links }: RentalRecommendationProps) {
    if (!data || !data.showRecommendation) return null;

    return (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm mt-4 flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-500">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Car className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground text-base">Smart Vehicle Recommendation</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                Safety Check
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reason */}
            <p className="text-sm text-muted-foreground leading-relaxed">
                {data.reason}
            </p>

            {/* Main Recommendation */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/50 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recommended:</span>
                <span className="text-sm font-bold text-primary">
                    {data.recommendedVehicle}
                </span>
            </div>

            {/* Options List */}
            <div className="flex flex-col gap-3">
                {data.options.map((option, i) => (
                    <div
                        key={i}
                        className="group flex items-center justify-between p-3 bg-secondary/20 hover:bg-secondary/30 border border-border/50 hover:border-primary/50 transition-all rounded-lg cursor-pointer"
                        onClick={() => window.open(option.link, '_blank')}
                    >
                        <div className="flex flex-col gap-1 overflow-hidden mr-3">
                            <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                                {option.name}
                            </h4>
                            <p className="text-[11px] text-muted-foreground">
                                {option.features}
                            </p>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                            {/* <span className="text-sm font-black text-foreground">{option.price}</span> */}

                            {/* Actions */}
                            <div className="flex flex-col gap-1 items-end mt-1 w-full sm:w-auto">
                                <Button
                                    className="h-7 text-[10px] bg-[#FF690F] hover:bg-[#E65500] text-white font-bold w-full sm:w-auto"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(links?.kayak || option.link, '_blank');
                                    }}
                                >
                                    Kayak <ArrowUpRight className="w-3 h-3 ml-1" />
                                </Button>
                                {links?.expedia && (
                                    <Button
                                        className="h-7 text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold w-full sm:w-auto"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(links.expedia, '_blank');
                                        }}
                                    >
                                        Expedia <ArrowUpRight className="w-3 h-3 ml-1" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 text-[10px] text-muted-foreground/80 mt-1 px-1">
                <ShieldCheck className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                <p>
                    Wayvue analyzes route geometry & weather to suggest safer vehicles.
                    Bookings handled by our partners.
                </p>
            </div>
        </div>
    );
}
