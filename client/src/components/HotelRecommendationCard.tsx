import { BedDouble, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface HotelOption {
    name: string;
    features: string;
    price: string;
    avgPrice?: string;
    total?: string;
    link: string;
}

interface HotelRecommendationProps {
    data: {
        showRecommendation: boolean;
        reason: string;
        recommendedTier: string;
        nights?: number;
        provider: string;
        priceSource?: string | null;
        isLive?: boolean;
        livePricingAvailable?: boolean;
        options: HotelOption[];
    } | null;
    links?: {
        booking: string;
        kayak: string;
    } | null;
}

export function HotelRecommendationCard({ data, links }: HotelRecommendationProps) {
    if (!data || !data.showRecommendation) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.0, ease: [0.76, 0, 0.24, 1] }}
            className="group relative bg-[#0a0a0f]/80 backdrop-blur-3xl border border-white/[0.05] rounded-3xl p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.8)] mt-6 flex flex-col gap-6 overflow-hidden transition-all duration-500 hover:border-primary/30 hover:shadow-[0_8px_64px_rgba(59,130,246,0.15)]"
        >
            {/* Advanced Hover Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-[#FFFFFF]/5 rounded-2xl text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-white/10 group-hover:scale-110 transition-transform duration-500 ease-out">
                        <BedDouble className="w-7 h-7 drop-shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground text-xl tracking-tight">Smart Stay Match</h3>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-[#10b981] bg-[#10b981]/10 px-3 py-1 rounded-full border border-[#10b981]/20 flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                                {data.isLive ? 'Live Rates' : 'Route Matched'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Main Recommendation Highlight */}
                <div className="bg-[#FFFFFF]/[0.02] border border-white/[0.05] rounded-2xl p-4 flex flex-col items-start gap-1 w-full sm:w-auto shadow-inner group-hover:bg-[#FFFFFF]/[0.04] transition-colors duration-300">
                    <span className="text-[10px] font-bold text-primary/80 uppercase tracking-widest">
                        Recommended Tier{data.nights ? ` • ${data.nights} night${data.nights > 1 ? 's' : ''}` : ''}
                    </span>
                    <span className="text-xl font-black text-white tracking-tighter drop-shadow-md">
                        {data.recommendedTier}
                    </span>
                </div>
            </div>

            {/* AI Reasoning block */}
            <div className="relative z-10 text-sm text-foreground/70 leading-relaxed bg-[#000000]/40 p-5 rounded-2xl border border-white/[0.03] shadow-inner font-light tracking-wide">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-transparent rounded-l-2xl opacity-50" />
                {data.reason}
            </div>

            {/* Options List Grid */}
            <div className="grid grid-cols-1 gap-4 mt-2 relative z-10">
                {data.options.map((option, i) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1, duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
                        key={i}
                        className="group/item flex flex-col md:flex-row md:items-center justify-between p-5 bg-[#FFFFFF]/[0.02] hover:bg-[#FFFFFF]/[0.06] border border-white/[0.05] hover:border-primary/40 transition-all duration-300 rounded-2xl cursor-pointer"
                        onClick={() => window.open(links?.booking || option.link, '_blank')}
                    >
                        <div className="flex flex-col gap-2 overflow-hidden md:mr-6 mb-4 md:mb-0">
                            <h4 className="font-bold text-lg text-white group-hover/item:text-primary transition-colors tracking-tight">
                                {option.name}
                            </h4>
                            <p className="text-xs text-muted-foreground font-medium flex flex-wrap items-center gap-2">
                                {option.features.split('•').map((feat, idx, arr) => (
                                    <span key={idx} className="flex items-center gap-1.5 whitespace-nowrap">
                                        {feat.trim()}
                                        {idx < arr.length - 1 && <span className="w-1 h-1 rounded-full bg-border" />}
                                    </span>
                                ))}
                            </p>
                        </div>

                        {/* Pricing Display */}
                        <div className="flex flex-col items-center gap-1 shrink-0 md:mx-4">
                            {option.avgPrice && (
                                <span className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                                    {option.avgPrice}
                                </span>
                            )}
                            {option.total && (
                                <span className="text-[10px] text-primary/70 font-semibold tracking-wide">
                                    {option.total}
                                </span>
                            )}
                            {option.price && (
                                <span className="text-[10px] text-muted-foreground/70 font-medium tracking-wide">
                                    Range: {option.price}
                                </span>
                            )}
                        </div>

                        <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
                            <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto">
                                <Button
                                    className="h-10 text-sm bg-gradient-to-r from-[#003580] to-[#00224f] hover:from-[#00509e] hover:to-[#003580] text-white font-bold w-full md:w-auto shadow-[0_4px_14px_rgba(0,53,128,0.35)] hover:shadow-[0_6px_20px_rgba(0,53,128,0.5)] border-none rounded-xl transition-all duration-300 transform hover:-translate-y-0.5"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(links?.booking || option.link, '_blank');
                                    }}
                                >
                                    Book.com <ArrowUpRight className="w-4 h-4 ml-2 opacity-80" />
                                </Button>
                                {links?.kayak && (
                                    <Button
                                        className="h-10 text-sm bg-gradient-to-r from-[#3B7BFF] to-[#2563EB] hover:from-[#f97316] hover:to-[#ea580c] text-white font-bold w-full md:w-auto shadow-[0_4px_14px_rgba(59,123,255,0.3)] hover:shadow-[0_6px_20px_rgba(59,123,255,0.4)] border-none rounded-xl transition-all duration-300 transform hover:-translate-y-0.5"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(links.kayak, '_blank');
                                        }}
                                    >
                                        Kayak <ArrowUpRight className="w-4 h-4 ml-2 opacity-80" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Price Source Attribution */}
            {data.priceSource && (
                <div className="text-[10px] text-muted-foreground/50 mt-2 tracking-wider uppercase text-center relative z-10">
                    Pricing: {data.priceSource}
                </div>
            )}

            {/* Disclaimer */}
            <div className="flex items-start gap-3 text-xs text-muted-foreground mt-4 pt-4 border-t border-white/5 relative z-10">
                <ShieldCheck className="w-4 h-4 mt-0.5 text-[#10b981]/70 flex-shrink-0" />
                <p className="leading-relaxed font-light">
                    {data.isLive
                        ? 'Live nightly rates retrieved for your dates. Final availability and total confirmed at checkout by the booking partner.'
                        : 'Prices are shown only when live rates are available. These are suggested properties for your route — tap to see real-time availability and pricing on the booking partner.'}
                </p>
            </div>
        </motion.div>
    );
}
