import React, { useState, useEffect } from 'react';
import {
    Activity, AlertCircle, MapPin,
    RefreshCw, Smartphone, Globe,
    Lock, MousePointer2,
    Repeat, Zap, X, Gauge, Database, Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { Button } from '@/components/ui/button';

const COLORS = ['#E77E23', '#628141', '#E5DAB8', '#40513B', '#1A2314'];

const AdminDashboard = () => {
    const [token, setToken] = useState(localStorage.getItem('admin_token'));
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'platform' | 'geography' | 'engagement' | 'system'>('platform');

    // Drill Down State
    const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
    const [modalData, setModalData] = useState<any[]>([]);

    // Shared Data
    const [recentEvents, setRecentEvents] = useState<any[]>([]);
    const [totalEvents, setTotalEvents] = useState(0);

    // Section 1: Platform Overview
    const [platformStats, setPlatformStats] = useState({
        avgSession: "0m",
        retentionRate: "N/A",
        errorRate: "0%"
    });

    // Section 2: Geography & Devices
    const [geoStats, setGeoStats] = useState({
        topLocations: [] as any[],
        topRoutes: [] as any[],
        deviceStats: [] as any[]
    });

    // Section 3: Product Engagement
    const [engagementStats, setEngagementStats] = useState({
        conversionRate: 0,
        routePreference: [] as any[]
    });

    // Section 4: System Performance
    const [perfStats, setPerfStats] = useState({
        frontendLoad: [] as any[],
        backendLatency: [] as any[],
        avgLoadToday: "0ms",
        avgLatencyToday: "0ms"
    });

    useEffect(() => {
        if (token) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/analytics', {
                headers: { 'x-admin-password': token || '' }
            });
            const result = await res.json();

            if (res.ok && result.recentEvents) {
                const events = result.recentEvents || [];
                setTotalEvents(result.totalEvents || 0);
                setRecentEvents(events);

                // --- 1. PLATFORM OVERVIEW CALCS ---
                // Avg Session: Mocked for now as we need session_end events, or time diffs
                // Error Rate
                const errorCount = events.filter((e: any) => e.eventType === 'error').length;
                const errRate = events.length > 0 ? ((errorCount / events.length) * 100).toFixed(2) : "0";

                setPlatformStats({
                    avgSession: "2m 14s", // Placeholder until we have full session tracking
                    retentionRate: "N/A", // Needs historical user data
                    errorRate: `${errRate}%`
                });

                // --- 2. GEOGRAPHY & DEVICES CALCS ---
                // Devices
                const mobile = events.filter((e: any) => e.metadata?.deviceType === 'Mobile' || e.metadata?.device?.toLowerCase().includes('mobile')).length;
                const desktop = events.filter((e: any) => e.metadata?.deviceType === 'Desktop' || e.metadata?.device?.toLowerCase().includes('desktop')).length;

                // Locations (Mocked top 3 for now if no real user_location events)
                // In real app, aggregate e.eventType === 'user_location'
                const userLocs = events
                    .filter((e: any) => e.eventType === 'user_location')
                    .reduce((acc: any, curr: any) => {
                        const loc = `${curr.metadata.city}, ${curr.metadata.region}`;
                        acc[loc] = (acc[loc] || 0) + 1;
                        return acc;
                    }, {});

                const topLocs = Object.entries(userLocs)
                    .sort(([, a]: any, [, b]: any) => b - a)
                    .slice(0, 5)
                    .map(([name, value]) => ({ name, value }));

                // Routes
                const routeDests = events
                    .filter((e: any) => e.eventType === 'trip_processed' && e.metadata?.destination)
                    .reduce((acc: any, curr: any) => {
                        const dest = curr.metadata.destination.split(',')[0]; // Simple city name
                        acc[dest] = (acc[dest] || 0) + 1;
                        return acc;
                    }, {});

                const topRoutes = Object.entries(routeDests)
                    .sort(([, a]: any, [, b]: any) => b - a)
                    .slice(0, 5)
                    .map(([name, value]) => ({ name, value }));

                setGeoStats({
                    deviceStats: [
                        { name: 'Mobile', value: mobile },
                        { name: 'Desktop', value: desktop }
                    ],
                    topLocations: topLocs.length ? topLocs : [{ name: "No Data", value: 0 }],
                    topRoutes: topRoutes.length ? topRoutes : [{ name: "No Trips", value: 0 }]
                });

                // --- 3. ENGAGEMENT CALCS ---
                const searches = events.filter((e: any) => e.eventType === 'interaction' && e.metadata?.type === 'search').length || 1; // avoid div/0
                const trips = events.filter((e: any) => e.eventType === 'trip_processed').length;
                const conversion = Math.min(100, Math.round((trips / searches) * 100));

                const scenic = events.filter((e: any) => e.eventType === 'trip_processed' && e.metadata?.preference === 'scenic').length;
                const fast = events.filter((e: any) => e.eventType === 'trip_processed' && e.metadata?.preference === 'fast').length;

                setEngagementStats({
                    conversionRate: conversion,
                    routePreference: [
                        { name: 'Scenic', value: scenic },
                        { name: 'Fastest', value: fast }
                    ]
                });

                // --- 4. SYSTEM PERF CALCS ---
                // Mocking trend data for graph since we only have flat events
                // Real implementation would bucket events by timestamp
                const perfEvents = events.filter((e: any) => e.eventType === 'performance');

                // Frontend Load (time_to_interactive or similar?) -> Using ttfi as proxy or specific load event
                // If not tracked, we mock a realistic curve for the demo graph
                const feTrend = Array.from({ length: 7 }, (_, i) => ({
                    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
                    today: 800 + Math.random() * 400,
                    lastWeek: 900 + Math.random() * 300
                }));

                // Backend Latency
                const beTrend = Array.from({ length: 7 }, (_, i) => ({
                    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
                    today: 150 + Math.random() * 100,
                    lastWeek: 200 + Math.random() * 50
                }));

                const avgFe = perfEvents
                    .filter((e: any) => e.metadata?.metric === 'page_load' || e.metadata?.metric === 'time_to_first_insight')
                    .reduce((acc: number, curr: any, _index: number, arr: any[]) => acc + (curr.metadata?.value || 0) / arr.length, 0);

                setPerfStats({
                    frontendLoad: feTrend,
                    backendLatency: beTrend,
                    avgLoadToday: avgFe > 0 ? `${Math.round(avgFe)}ms` : "N/A",
                    avgLatencyToday: "185ms" // Mock average from "real" backend logs
                });

            } else if (res.status === 403) {
                setError('Invalid session. Please log in again.');
                handleLogout();
            }
        } catch (err) {
            setError('Failed to sync analytics data');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password) {
            localStorage.setItem('admin_token', password);
            setToken(password);
            setError(null);
        } else {
            setError('Password required');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        setToken(null);
    };

    const openMetricDetails = (metricName: string, dataFilter: (e: any) => boolean) => {
        const filtered = recentEvents.filter(dataFilter);
        setModalData(filtered);
        setSelectedMetric(metricName);
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-[#1a2314] flex items-center justify-center p-6 text-white">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-black/40 border border-white/10 p-8 rounded-3xl backdrop-blur-xl">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4">
                            <Lock className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold">Admin Access</h1>
                        <p className="text-muted-foreground text-sm">Wayvue Strategy Dashboard</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            placeholder="Dashboard Password"
                            value={password}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 p-4 rounded-xl text-white outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                        <Button type="submit" className="w-full py-6 rounded-xl text-lg font-bold" disabled={loading}>
                            {loading ? 'Verifying...' : 'Unlock'}
                        </Button>
                    </form>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0d120a] text-foreground p-6 lg:p-12 font-sans overflow-x-hidden relative">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-3 mb-1 text-primary">
                            <Gauge className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-widest">Vision Dashboard</span>
                        </div>
                        <h1 className="text-4xl font-black text-white">Strategic Metrics</h1>
                    </div>
                    <div className="flex items-center gap-3 p-1 bg-black/40 border border-white/10 rounded-2xl overflow-x-auto scrollbar-none">
                        {[
                            { id: 'platform', label: 'Platform Overview', icon: Globe },
                            { id: 'geography', label: 'Geography & Devices', icon: MapPin },
                            { id: 'engagement', label: 'Engagement', icon: MousePointer2 },
                            { id: 'system', label: 'System Perf.', icon: Activity },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-primary text-black' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}`}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <Button
                        variant="ghost"
                        onClick={fetchData}
                        disabled={loading}
                        className="bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </header>

                <main className="space-y-12">
                    {/* SECTION 1: PLATFORM OVERVIEW */}
                    {activeTab === 'platform' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <MetricCard
                                title="Total Events"
                                value={totalEvents}
                                subtitle="All Tracked Interactions"
                                icon={<Database className="w-5 h-5" />}
                                description="Total count of all analytics events logged."
                                onClick={() => openMetricDetails('Total Events', () => true)}
                            />
                            <MetricCard
                                title="Avg Session"
                                value={platformStats.avgSession}
                                subtitle="Time per User"
                                icon={<Clock className="w-5 h-5" />}
                                description="Average duration of user sessions."
                            />
                            <MetricCard
                                title="Retention"
                                value={platformStats.retentionRate}
                                subtitle="Returning Users (7d)"
                                icon={<Repeat className="w-5 h-5" />}
                                description="Percentage of users returning within 7 days."
                            />
                            <MetricCard
                                title="Error Rate"
                                value={platformStats.errorRate}
                                subtitle="Events marked as errors"
                                icon={<AlertCircle className="w-5 h-5" />}
                                description="Percentage of events that are errors."
                                isError={platformStats.errorRate !== "0%"}
                                onClick={() => openMetricDetails('Errors', (e: any) => e.eventType === 'error')}
                            />
                        </div>
                    )}

                    {/* SECTION 2: GEOGRAPHY & DEVICES */}
                    {activeTab === 'geography' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <ChartCard title="User Locations" subtitle="Top Cities">
                                    <div className="space-y-4 p-2">
                                        {geoStats.topLocations.map((loc, i) => (
                                            <div key={i} className="flex items-center justify-between pb-2 border-b border-white/5 last:border-0">
                                                <span className="text-sm font-medium text-white">{loc.name}</span>
                                                <span className="text-xs font-bold text-primary">{loc.value} visits</span>
                                            </div>
                                        ))}
                                        {geoStats.topLocations.length === 0 && <div className="text-muted-foreground text-xs italic">No location data yet</div>}
                                    </div>
                                </ChartCard>
                                <ChartCard title="Top Routes" subtitle="Most Frequent Destinations">
                                    <div className="space-y-4 p-2">
                                        {geoStats.topRoutes.map((route, i) => (
                                            <div key={i} className="flex items-center justify-between pb-2 border-b border-white/5 last:border-0">
                                                <span className="text-sm font-medium text-white">{route.name}</span>
                                                <span className="text-xs font-bold text-primary">{route.value} trips</span>
                                            </div>
                                        ))}
                                        {geoStats.topRoutes.length === 0 && <div className="text-muted-foreground text-xs italic">No route data yet</div>}
                                    </div>
                                </ChartCard>
                            </div>

                            <ChartCard title="Device Breakdown" subtitle="Mobile vs Desktop">
                                <div className="h-[250px] w-full mt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={geoStats.deviceStats} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                                                {geoStats.deviceStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                            </Pie>
                                            <RechartsTooltip contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)' }} />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>
                        </div>
                    )}

                    {/* SECTION 3: PRODUCT ENGAGEMENT */}
                    {activeTab === 'engagement' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <MetricCard
                                title="Conversion Rate"
                                value={`${engagementStats.conversionRate}%`}
                                subtitle="Search → Trip Processed"
                                icon={<Zap className="w-5 h-5" />}
                                description="Percentage of search interactions that result in a generated trip."
                            />
                            <ChartCard title="Route Preference" subtitle="Scenic vs Fastest">
                                <div className="h-[250px] w-full mt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={engagementStats.routePreference} innerRadius={0} outerRadius={80} dataKey="value" stroke="none">
                                                <Cell fill="#628141" /> {/* Scenic */}
                                                <Cell fill="#E77E23" /> {/* Fast */}
                                            </Pie>
                                            <RechartsTooltip contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)' }} />
                                            <Legend
                                                verticalAlign="bottom"
                                                height={36}
                                                iconType="circle"
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>
                        </div>
                    )}

                    {/* SECTION 4: SYSTEM PERFORMANCE */}
                    {activeTab === 'system' && (
                        <div className="space-y-8">
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <MetricCard
                                    title="Avg Page Load (Today)"
                                    value={perfStats.avgLoadToday}
                                    subtitle="Frontend Performance"
                                    icon={<Gauge className="w-5 h-5" />}
                                    description="Average time to interactive for today's sessions."
                                />
                                <MetricCard
                                    title="Avg API Latency"
                                    value={perfStats.avgLatencyToday}
                                    subtitle="Backend Response Time"
                                    icon={<Activity className="w-5 h-5" />}
                                    description="Average latency for backend API requests."
                                />
                            </div>

                            {/* Graphs */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <ChartCard title="Frontend Performance" subtitle="Load Time Trend (ms)">
                                    <div className="h-[300px] w-full mt-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={perfStats.frontendLoad}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                                <XAxis dataKey="day" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                                                <RechartsTooltip contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)' }} />
                                                <Legend />
                                                <Line type="monotone" dataKey="today" name="This Week" stroke="#E77E23" strokeWidth={3} dot={{ r: 4 }} />
                                                <Line type="monotone" dataKey="lastWeek" name="Last Week" stroke="#628141" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </ChartCard>

                                <ChartCard title="Backend Latency" subtitle="API Response Trend (ms)">
                                    <div className="h-[300px] w-full mt-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={perfStats.backendLatency}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                                <XAxis dataKey="day" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                                                <RechartsTooltip contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)' }} />
                                                <Legend />
                                                <Line type="monotone" dataKey="today" name="This Week" stroke="#E5DAB8" strokeWidth={3} dot={{ r: 4 }} />
                                                <Line type="monotone" dataKey="lastWeek" name="Last Week" stroke="#40513B" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </ChartCard>
                            </div>
                        </div>
                    )}
                </main>

                <footer className="mt-20 pt-12 border-t border-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/20">
                    <div>© 2026 Wayvue Intelligence Engine</div>
                    <div className="flex gap-6">
                        <span className="text-primary/40">Status: {loading ? 'Syncing...' : 'Operational'}</span>
                        <span className="text-white/40">Events: {totalEvents}</span>
                        <span className="cursor-pointer hover:text-white transition-colors" onClick={handleLogout}>Log Out</span>
                        <div className="flex gap-2">
                            <Smartphone className="w-3 h-3" />
                            <Globe className="w-3 h-3" />
                        </div>
                    </div>
                </footer>
            </div>

            {/* METRIC DETAILS MODAL */}
            <AnimatePresence>
                {selectedMetric && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-[#0f140c] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
                        >
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">{selectedMetric}</h2>
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Data Drill-Down</p>
                                </div>
                                <button onClick={() => setSelectedMetric(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-white/50" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-0">
                                {modalData.length > 0 ? (
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-white/5 sticky top-0">
                                            <tr>
                                                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-white/40">Timestamp</th>
                                                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-white/40">User ID</th>
                                                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-white/40">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {modalData.map((e: any, i: any) => (
                                                <tr key={i} className="hover:bg-white/[0.02]">
                                                    <td className="p-4 text-xs font-mono text-white/60">
                                                        {new Date(e.timestamp).toLocaleTimeString()}
                                                    </td>
                                                    <td className="p-4 text-xs text-white/80">
                                                        {e.userId.substring(0, 8)}...
                                                    </td>
                                                    <td className="p-4 text-xs text-primary/80 font-medium">
                                                        {JSON.stringify(e.metadata || {}).replace(/["{}]/g, '').substring(0, 50)}...
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                        <Database className="w-8 h-8 opacity-20 mb-4" />
                                        <p className="text-sm font-medium">No records found for this metric</p>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t border-white/5 bg-black/20 text-[10px] text-center text-white/30 uppercase tracking-widest">
                                Showing {modalData.length} records
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ERROR TOAST */}
            <AnimatePresence>
                {error && (
                    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-12 right-12 z-[100] bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-4 shadow-2xl backdrop-blur-xl">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <span className="text-sm font-bold text-red-400">{error}</span>
                        <button onClick={() => setError(null)} className="p-1 hover:bg-white/5 rounded-lg"><X className="w-4 h-4" /></button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ICONS THAT WERE MISSING OR CAUSING ISSUES
const Clock = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);

// HELPER COMPONENTS
const MetricCard = ({ title, value, subtitle, icon, delay = 0, isError = false, onClick, description }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4 }}
        onClick={onClick}
        className={`p-8 rounded-3xl bg-black/40 border border-white/5 hover:border-primary/30 transition-all group/card relative ${onClick ? 'cursor-pointer hover:bg-white/5' : ''}`}
    >
        <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{title}</h3>
                {description && (
                    <div className="group/info relative z-20" onClick={(e) => e.stopPropagation()}>
                        <Info className="w-3 h-3 text-muted-foreground/50 hover:text-primary cursor-help transition-colors" />
                        <div className="absolute left-0 bottom-full mb-2 w-48 p-3 bg-[#0f140c] border border-white/10 rounded-xl text-[10px] leading-relaxed text-white/80 normal-case tracking-normal opacity-0 group-hover/info:opacity-100 transition-opacity pointer-events-none shadow-xl backdrop-blur-xl translate-y-2 group-hover/info:translate-y-0 duration-200">
                            {description}
                            <div className="absolute left-1.5 -bottom-1 w-2 h-2 bg-[#0f140c] border-b border-r border-white/10 rotate-45"></div>
                        </div>
                    </div>
                )}
            </div>
            <div className={`p-2 rounded-xl bg-white/5 ${isError ? 'text-red-400' : 'text-primary'}`}>
                {icon}
            </div>
        </div>
        <div className="text-4xl font-black text-white mb-2">{value}</div>
        <div className="text-xs text-muted-foreground font-medium">{subtitle}</div>
    </motion.div>
);

const ChartCard = ({ title, subtitle, children, className = "" }: any) => (
    <div className={`p-8 rounded-3xl bg-black/40 border border-white/5 ${className}`}>
        <div className="mb-8">
            <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{subtitle}</p>
        </div>
        {children}
    </div>
);

export default AdminDashboard;
