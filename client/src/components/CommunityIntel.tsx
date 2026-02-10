import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Globe, ShieldCheck, Users } from 'lucide-react';

interface CommunityStats {
    activeUsers: number;
    topDestinations: { name: string; count: number }[];
    totalSafeMiles: number;
    recentActivity: { action: string; details: string; timestamp: string }[];
}

export const CommunityIntel = () => {
    const [stats, setStats] = useState<CommunityStats | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/community-stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error("Failed to load community intel", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        // Poll every 30 seconds for live updates
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading Community Data...</div>;

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-card/50 to-background/50 backdrop-blur-md overflow-hidden">
            {/* HEADER */}
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-2 mb-1 text-primary">
                    <Globe className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Global Intelligence</span>
                </div>
                <h2 className="text-2xl font-black text-white">Live Pulse</h2>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">

                {/* STAT 1: ACTIVE PLANNERS */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-primary/5 blur-xl group-hover:bg-primary/10 transition-colors" />
                    <div className="relative p-5 rounded-2xl border border-white/5 bg-black/20">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Planners</span>
                            <Users className="w-4 h-4 text-primary" />
                        </div>
                        <div className="text-4xl font-black text-white mb-1 flex items-baseline gap-2">
                            {stats?.activeUsers}
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                        </div>
                        <p className="text-[10px] text-white/40">Users planning trips right now</p>
                    </div>
                </div>

                {/* STAT 2: SAFE MILES */}
                <div className="p-5 rounded-2xl border border-white/5 bg-black/20">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Safe Miles Generated</span>
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-3xl font-black text-white mb-1">
                        {stats?.totalSafeMiles.toLocaleString()}
                    </div>
                    <p className="text-[10px] text-white/40">Cumulative distance of AI-verified routes</p>
                </div>

                {/* STAT 3: TRENDING */}
                <div>
                    <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Trending Destinations
                    </h3>
                    <div className="space-y-3">
                        {stats?.topDestinations.map((dest, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-primary text-black' : 'bg-white/10 text-white'}`}>
                                        {i + 1}
                                    </div>
                                    <span className="text-sm font-bold text-white">{dest.name}</span>
                                </div>
                                <span className="text-xs font-mono text-primary/80">{dest.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* FEED */}
                <div>
                    <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Live Activity</h3>
                    <div className="space-y-4 border-l border-white/10 ml-2 pl-6 relative">
                        {stats?.recentActivity.length === 0 && <p className="text-xs text-muted-foreground italic">No recent activity.</p>}
                        <AnimatePresence>
                            {stats?.recentActivity.map((activity, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="relative"
                                >
                                    <div className="absolute -left-[29px] top-1.5 w-1.5 h-1.5 rounded-full bg-primary/50 ring-4 ring-black" />
                                    <p className="text-xs text-white/80 leading-relaxed">
                                        Using <span className="text-primary font-bold">Wayvue</span> {activity.action} <span className="text-white font-bold">{activity.details}</span>.
                                    </p>
                                    <span className="text-[10px] text-white/30 font-mono mt-1 block">Just now</span>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* FOOTER */}
            <div className="p-6 border-t border-white/5 bg-black/20">
                <p className="text-[10px] text-center text-white/30 leading-relaxed">
                    Aggregated anonymized data from the Wayvue Intelligence Network.
                </p>
            </div>
        </div>
    );
};
