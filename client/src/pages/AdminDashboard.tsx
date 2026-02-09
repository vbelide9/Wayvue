import { useState, useEffect } from 'react';
import { AnalyticsService } from '../services/analytics';
import { Button } from '@/components/ui/button';
import { Lock, RefreshCw, LogOut, ArrowLeft, TrendingUp, Activity, Smartphone, Globe, Users, X, Clock, AlertTriangle, MapPin } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, CartesianGrid, YAxis, LineChart, Line } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        } as const
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: 'spring', stiffness: 100 } as const
    }
};

interface MetricDetail {
    title: string;
    description: string;
    data: any[];
    type: 'list' | 'chart' | 'json';
    renderItem?: (item: any) => React.ReactNode;
}

export const AdminDashboard = () => {
    const [token, setToken] = useState<string | null>(AnalyticsService.getAdminToken());
    const [password, setPassword] = useState('');
    const [data, setData] = useState<any>(null);
    const [avgSession, setAvgSession] = useState<string>('0s');
    const [topLocations, setTopLocations] = useState<any[]>([]);
    const [conversionStats, setConversionStats] = useState<any[]>([]);
    const [featureStats, setFeatureStats] = useState<any[]>([]);
    const [deviceStats, setDeviceStats] = useState<any[]>([]);
    const [retentionRate, setRetentionRate] = useState<string>('0%');
    const [errorRate, setErrorRate] = useState<string>('0%');
    const [loadTimeStats, setLoadTimeStats] = useState<any[]>([]);
    const [latencyStats, setLatencyStats] = useState<any[]>([]);
    const [loadTimeAvg, setLoadTimeAvg] = useState({ overall: 0, daily: 0, weekly: 0 });
    const [latencyAvg, setLatencyAvg] = useState({ overall: 0, daily: 0, weekly: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedMetric, setSelectedMetric] = useState<MetricDetail | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await AnalyticsService.getAnalytics(password);
            AnalyticsService.setAdminToken(password);
            setToken(password);
        } catch (err) {
            setError('Invalid password');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        AnalyticsService.clearAdminToken();
        setToken(null);
        setData(null);
        setPassword('');
    };

    console.log('AdminDashboard rendering. Token:', token);

    const fetchData = async () => {
        if (!token) {
            console.log('No token, skipping fetch');
            return;
        }
        console.log('Fetching data with token...');
        setLoading(true);
        try {
            const result = await AnalyticsService.getAnalytics(token);
            console.log('Data fetched:', result);
            setData(result);

            if (result.recentEvents) {
                // ... (Calculation logic remains same, can be extracted to helper if needed)
                const sessionEnds = result.recentEvents.filter((e: any) => e.eventType === 'session_end');
                if (sessionEnds.length > 0) {
                    const totalDuration = sessionEnds.reduce((acc: number, curr: any) => acc + (curr.metadata.duration || 0), 0);
                    setAvgSession(`${(totalDuration / sessionEnds.length).toFixed(1)}s`); // Duration is already in seconds
                }

                // Top Locations
                const locationEvents = result.recentEvents.filter((e: any) => e.eventType === 'user_location');
                const locationCounts: Record<string, number> = {};
                locationEvents.forEach((e: any) => {
                    const loc = `${e.metadata.city}, ${e.metadata.region}, ${e.metadata.country}`;
                    locationCounts[loc] = (locationCounts[loc] || 0) + 1;
                });
                setTopLocations(Object.entries(locationCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, count]) => ({ name, count })));

                // Conversion
                const searchCount = result.recentEvents.filter((e: any) => e.eventType === 'search_route').length;
                const interactionCount = result.recentEvents.filter((e: any) => ['weather_marker_click', 'toggle_layer_weather', 'toggle_layer_traffic', 'toggle_layer_segments', 'map_interaction'].includes(e.eventType)).length;
                setConversionStats([
                    { name: 'Searches', value: searchCount },
                    { name: 'Interactions', value: interactionCount }
                ]);

                // Feature Adoption
                const searches = result.recentEvents.filter((e: any) => e.eventType === 'search_route');
                let fastest = 0, scenic = 0;
                searches.forEach((s: any) => {
                    if (s.metadata?.preference?.includes('fastest')) fastest++;
                    else if (s.metadata?.preference?.includes('scenic')) scenic++;
                });
                setFeatureStats([
                    { name: 'Fastest', value: fastest },
                    { name: 'Scenic', value: scenic }
                ]);

                // Error Rate
                const errors = result.recentEvents.filter((e: any) => e.eventType === 'error').length;
                const totalOps = searchCount + result.recentEvents.length;
                setErrorRate(totalOps > 0 ? `${((errors / totalOps) * 100).toFixed(1)}%` : '0%');

                // Retention
                const retentionEvents = result.recentEvents.filter((e: any) => e.eventType === 'user_retention');
                const returning = retentionEvents.filter((e: any) => e.metadata?.isReturning).length;
                setRetentionRate(retentionEvents.length > 0 ? `${((returning / retentionEvents.length) * 100).toFixed(1)}%` : '0%');

                // Devices
                const devices = result.recentEvents.filter((e: any) => e.eventType === 'device_info');
                let mobile = 0, desktop = 0;
                devices.forEach((d: any) => d.metadata?.deviceType === 'Mobile' ? mobile++ : desktop++);
                setDeviceStats([
                    { name: 'Mobile', value: mobile },
                    { name: 'Desktop', value: desktop }
                ]);

                // Performance Metrics Grouping & Stats
                const perfEvents = result.recentEvents.filter((e: any) => e.eventType === 'performance');
                console.log('[DEBUG PERF] Raw performance events count:', perfEvents.length);

                const calculateAverages = (metric: string) => {
                    const filtered = perfEvents.filter((e: any) => e.metadata?.metric === metric);
                    if (filtered.length === 0) return { overall: 0, daily: 0, weekly: 0 };

                    const now = new Date().getTime();
                    const dayMs = 24 * 60 * 60 * 1000;
                    const weekMs = 7 * dayMs;

                    // Improved: Filter out clearly incorrect values (e.g. > 1 hour for a page load)
                    const validEvents = filtered.filter((e: any) => {
                        const val = Number(e.metadata?.value) || 0;
                        return val > 0 && val < 3600000; // Cap at 1 hour for safety
                    });

                    if (validEvents.length === 0) return { overall: 0, daily: 0, weekly: 0 };

                    const values = validEvents.map((e: any) => Number(e.metadata?.value) || 0);
                    const overallAvg = values.reduce((a: number, b: number) => a + b, 0) / values.length;

                    const daily = validEvents.filter((e: any) => now - new Date(e.timestamp).getTime() < dayMs);
                    const dailyAvg = daily.length > 0 ? daily.reduce((a: number, b: any) => a + (Number(b.metadata?.value) || 0), 0) / daily.length : 0;

                    const weekly = validEvents.filter((e: any) => now - new Date(e.timestamp).getTime() < weekMs);
                    const weeklyAvg = weekly.length > 0 ? weekly.reduce((a: number, b: any) => a + (Number(b.metadata?.value) || 0), 0) / weekly.length : 0;

                    return {
                        overall: overallAvg / 1000,
                        daily: dailyAvg / 1000,
                        weekly: weeklyAvg / 1000
                    };
                };

                setLoadTimeAvg(calculateAverages('page_load_time'));
                setLatencyAvg(calculateAverages('api_latency'));

                // 1. Page Load Times Chart Data
                const loadTimeData = perfEvents
                    .filter((e: any) => e.metadata?.metric === 'page_load_time')
                    .map((e: any) => {
                        let rawValue = Number(e.metadata?.value) || 0;

                        // SANITY CHECK: If value is absurdly high (e.g. > 100k), we might be 
                        // seeing a bug in how metrics are captured or interpreted.
                        // We will cap it for visualization purposes to keep charts useful.
                        if (rawValue > 300000) {
                            console.warn('[PERF] Absurdly high load time detected:', rawValue, e);
                            rawValue = 300000; // Cap at 5 minutes
                        }

                        return {
                            time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            value: rawValue / 1000
                        };
                    })
                    .reverse();
                setLoadTimeStats(loadTimeData);

                // 2. API Latency Chart Data
                const latencyData = perfEvents
                    .filter((e: any) => e.metadata?.metric === 'api_latency')
                    .map((e: any) => {
                        let rawValue = Number(e.metadata?.value) || 0;

                        if (rawValue > 300000) {
                            console.warn('[PERF] Absurdly high latency detected:', rawValue, e);
                            rawValue = 300000;
                        }

                        return {
                            time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            value: rawValue / 1000
                        };
                    })
                    .reverse();
                setLatencyStats(latencyData);


            }
        } catch (err) {
            setError('Failed to fetch data');
            if ((err as any).response?.status === 403) handleLogout();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (token) fetchData(); }, [token]);

    // Metrics Interactions
    const showTotalEvents = () => {
        setSelectedMetric({
            title: 'Event Log',
            description: 'Recent 50 user actions tracked by the system.',
            type: 'list',
            data: data?.recentEvents?.slice(0, 50) || [],
            renderItem: (e: any) => (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-primary">{e.eventType}</span>
                        <span className="text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono break-all opacity-80">
                        {JSON.stringify(e.metadata || {})}
                    </div>
                </div>
            )
        });
    };

    const showAvgSession = () => {
        const sessions = data?.recentEvents?.filter((e: any) => e.eventType === 'session_end') || [];
        setSelectedMetric({
            title: 'Session Duration Histograms',
            description: 'Distribution of recent session lengths.',
            type: 'list',
            data: sessions,
            renderItem: (e: any) => (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm">Session Duration</span>
                    </div>
                    <span className="font-bold text-emerald-400">{(e.metadata?.duration || 0).toFixed(1)}s</span>
                </div>
            )
        });
    };

    const showErrors = () => {
        const errors = data?.recentEvents?.filter((e: any) => e.eventType === 'error') || [];
        setSelectedMetric({
            title: 'Error Log',
            description: 'Recent application errors and exceptions.',
            type: 'list',
            data: errors,
            renderItem: (e: any) => (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-red-400 font-medium">
                        <AlertTriangle className="w-4 h-4" />
                        {e.metadata?.errorType || 'Unknown Error'}
                    </div>
                    <p className="text-sm text-muted-foreground">{e.metadata?.message || 'No message provided'}</p>
                    <span className="text-xs text-muted-foreground opacity-50">{new Date(e.timestamp).toLocaleString()}</span>
                </div>
            )
        });
    };

    const showPerformance = (metric: 'load' | 'latency') => {
        const title = metric === 'load' ? 'Page Load Times' : 'API Latencies';
        const perfEvents = data?.recentEvents?.filter((e: any) =>
            e.eventType === 'performance' && e.metadata?.metric === (metric === 'load' ? 'page_load_time' : 'api_latency')
        ) || [];

        setSelectedMetric({
            title,
            description: metric === 'load' ? 'Time taken for the initial page and assets to load.' : 'Time taken for route calculation API requests.',
            type: 'list',
            data: perfEvents,
            renderItem: (e: any) => (
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</span>
                        <span className="text-sm font-medium">{e.metadata?.metric === 'page_load_time' ? 'Page Loaded' : 'API Response'}</span>
                    </div>
                    <span className={`font-bold ${metric === 'load' ? 'text-amber-400' : 'text-cyan-400'}`}>
                        {e.metadata?.value ? `${(e.metadata.value / 1000).toFixed(2)}s` : '--'}
                    </span>
                </div>
            )
        });
    };

    const showUserLocations = () => {
        const locations = data?.recentEvents?.filter((e: any) => e.eventType === 'user_location') || [];
        setSelectedMetric({
            title: 'User Locations',
            description: 'Complete list of recent user access locations.',
            type: 'list',
            data: locations,
            renderItem: (e: any) => (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <MapPin className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-medium text-foreground">{e.metadata?.city || 'Unknown'}, {e.metadata?.country}</span>
                            <span className="text-xs text-muted-foreground">{e.metadata?.region}</span>
                        </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleDateString()}</span>
                </div>
            )
        });
    };

    const showConversionDetails = () => {
        const searches = data?.recentEvents?.filter((e: any) => e.eventType === 'search_route') || [];
        const interactions = data?.recentEvents?.filter((e: any) => ['weather_marker_click', 'toggle_layer_weather', 'toggle_layer_traffic', 'toggle_layer_segments', 'map_interaction'].includes(e.eventType)) || [];

        // Combine and sort by timestamp desc
        const combined = [...searches, ...interactions].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setSelectedMetric({
            title: 'Conversion Funnel Activity',
            description: 'Chronological list of Search vs. Interaction events.',
            type: 'list',
            data: combined,
            renderItem: (e: any) => {
                const isSearch = e.eventType === 'search_route';
                return (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${isSearch ? 'bg-orange-500/20' : 'bg-green-500/20'}`}>
                                {isSearch ? <Smartphone className="w-4 h-4 text-orange-400" /> : <Activity className="w-4 h-4 text-green-400" />}
                            </div>
                            <div className="flex flex-col">
                                <span className={`font-medium ${isSearch ? 'text-orange-300' : 'text-green-300'}`}>
                                    {isSearch ? 'Route Search' : 'Map Interaction'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {isSearch
                                        ? (() => {
                                            let s = e.metadata?.start || e.metadata?.from;
                                            let d = e.metadata?.end || e.metadata?.to;
                                            if (s === 'undefined') s = '?';
                                            if (d === 'undefined') d = '?';
                                            return `${s || '?'} → ${d || '?'}`;
                                        })()
                                        : e.eventType === 'map_interaction'
                                            ? `Map Move (${e.metadata?.type})`
                                            : e.eventType.replace('toggle_layer_', 'Toggle: ').replace(/_/g, ' ')
                                    }
                                </span>
                            </div>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleTimeString()}</span>
                    </div>
                );
            }
        });
    };

    const showTopRoutes = () => {
        const searches = data?.recentEvents?.filter((e: any) => e.eventType === 'search_route') || [];
        const routeCounts: Record<string, number> = {};

        searches.forEach((e: any) => {
            let start = e.metadata.start || e.metadata.from || e.metadata.origin;
            let end = e.metadata.end || e.metadata.to || e.metadata.destination;

            // Handle string 'undefined' or 'null' which might have been logged
            if (start === 'undefined' || start === 'null') start = null;
            if (end === 'undefined' || end === 'null') end = null;

            if (start && end) {
                const route = `${start} → ${end}`;
                routeCounts[route] = (routeCounts[route] || 0) + 1;
            }
        });

        const sortedRoutes = Object.entries(routeCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => ({ name, count }));

        setSelectedMetric({
            title: 'Top Requested Routes',
            description: 'Most frequently searched routes by users.',
            type: 'list',
            data: sortedRoutes,
            renderItem: (item: any) => (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <MapPin className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-primary">{item.count} searches</span>
                </div>
            )
        });
    };

    const showTopDestinations = () => {
        const searches = data?.recentEvents?.filter((e: any) => e.eventType === 'search_route') || [];
        const destCounts: Record<string, number> = {};

        searches.forEach((e: any) => {
            let end = e.metadata.end || e.metadata.to || e.metadata.destination;
            if (end === 'undefined' || end === 'null') end = null;

            if (end) {
                destCounts[end] = (destCounts[end] || 0) + 1;
            }
        });

        const sortedDestinations = Object.entries(destCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => ({ name, count }));

        setSelectedMetric({
            title: 'Top Road Trip Destinations',
            description: 'Most popular destinations for road trips.',
            type: 'list',
            data: sortedDestinations,
            renderItem: (item: any) => (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-full">
                            <MapPin className="w-4 h-4 text-purple-400" />
                        </div>
                        <span className="font-medium text-foreground">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-purple-400">{item.count} trips</span>
                </div>
            )
        });
    };

    if (!token) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-muted/20 text-foreground p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md p-8 glass-panel rounded-2xl border border-white/10 shadow-2xl space-y-8 backdrop-blur-xl bg-background/60"
                >
                    <div className="flex flex-col items-center space-y-4">
                        <div className="p-4 bg-primary/20 rounded-full ring-4 ring-primary/5">
                            <Lock className="w-8 h-8 text-primary" />
                        </div>
                        <div className="text-center">
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">Admin Access</h1>
                            <p className="text-muted-foreground mt-2">Enter credentials to view analytics</p>
                        </div>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-border/50 rounded-xl bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
                            placeholder="Password"
                            autoFocus
                        />
                        {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}
                        <Button type="submit" className="w-full h-12 text-md font-medium shadow-lg hover:shadow-primary/25 transition-all" disabled={loading}>
                            {loading ? 'Verifying...' : 'Unlock Dashboard'}
                        </Button>
                    </form>
                    <Button variant="ghost" className="w-full hover:bg-white/5" onClick={() => window.location.href = '/'}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Application
                    </Button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 relative">
            {/* Background Gradient/Mesh for depth */}
            <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background z-[-1]" />

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="max-w-7xl mx-auto px-6 pb-12 space-y-12"
            >
                {/* Modern Floating Header */}
                <motion.div
                    variants={itemVariants}
                    className="sticky top-6 z-50 rounded-2xl bg-black/20 backdrop-blur-xl border border-white/10 shadow-lg px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-primary/10 rounded-xl">
                            <Activity className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
                            <p className="text-sm text-foreground/60">Real-time platform insights</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchData}
                            disabled={loading}
                            className="bg-white/5 border-white/10 hover:bg-white/10 text-foreground"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <div className="h-6 w-px bg-white/10 mx-1" />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.location.href = '/'}
                            className="text-foreground/70 hover:text-foreground hover:bg-white/5"
                        >
                            View App
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLogout}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 px-4 transition-all"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Exit Dashboard
                        </Button>
                    </div>
                </motion.div>

                {/* 1. Overview */}
                <motion.div variants={itemVariants} className="space-y-6">
                    <div className="flex items-center gap-3 px-1">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-semibold tracking-tight text-foreground/90">Platform Overview</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <MetricCard
                            title="Total Events"
                            value={data?.totalEvents || 0}
                            subtitle="Actions tracked"
                            icon={<Activity className="w-4 h-4" />}
                            onClick={showTotalEvents}
                        />
                        <MetricCard
                            title="Avg Session"
                            value={avgSession}
                            subtitle="User engagement"
                            icon={<TrendingUp className="w-4 h-4" />}
                            delay={0.1}
                            onClick={showAvgSession}
                        />
                        <MetricCard
                            title="Retention"
                            value={retentionRate}
                            subtitle="Return rate"
                            icon={<Users className="w-4 h-4" />}
                            delay={0.2}
                        />
                        <MetricCard
                            title="Error Rate"
                            value={errorRate}
                            subtitle="Reliability"
                            isError
                            icon={<Activity className="w-4 h-4" />}
                            delay={0.3}
                            onClick={showErrors}
                        />
                    </div>
                </motion.div>

                {/* 2. User & Geo Analytics */}
                <motion.div variants={itemVariants} className="space-y-6">
                    <div className="flex items-center gap-3 px-1">
                        <Globe className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-semibold tracking-tight text-foreground/90">Geography & Devices</h2>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ChartCard
                            title="User Locations & Routes"
                            subtitle="Top active regions and paths"
                            onClick={showUserLocations}
                            action={
                                <div className="flex gap-2 z-20 relative">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs bg-white/5 border-white/10 hover:bg-white/10"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            showTopRoutes();
                                        }}
                                    >
                                        Top Routes
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20 text-purple-300"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            showTopDestinations();
                                        }}
                                    >
                                        Top Destinations
                                    </Button>
                                </div>
                            }
                        >
                            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                {topLocations.map((loc, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-primary/30 hover:bg-white/10 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/20 text-xs font-bold text-foreground/80 group-hover:bg-primary group-hover:text-black transition-colors">
                                                {index + 1}
                                            </div>
                                            <span className="font-medium text-sm text-foreground/90 truncate max-w-[180px]">{loc.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="h-1.5 w-16 bg-black/20 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary" style={{ width: `${(loc.count / (topLocations[0]?.count || 1)) * 100}%` }} />
                                            </div>
                                            <span className="text-sm font-mono text-foreground/70 min-w-[20px] text-right">{loc.count}</span>
                                        </div>
                                    </div>
                                ))}
                                {topLocations.length === 0 && <div className="h-40 flex items-center justify-center text-foreground/40">No location data needed yet</div>}
                            </div>
                        </ChartCard>

                        <ChartCard title="Device Breakdown" subtitle="Mobile vs Desktop usage">
                            <div className="h-[300px] w-full flex flex-col items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={deviceStats}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={110}
                                            paddingAngle={4}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {deviceStats.map((_entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={['#E77E23', '#628141'][index % 2]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: '#324422', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#E5DAB8' }}
                                            itemStyle={{ color: '#E5DAB8' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex justify-center gap-8 -mt-8 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#E77E23]" />
                                        <span className="text-sm text-foreground/80">Mobile</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#628141]" />
                                        <span className="text-sm text-foreground/80">Desktop</span>
                                    </div>
                                </div>
                            </div>
                        </ChartCard>
                    </div>
                </motion.div>

                {/* 3. Product Engagement */}
                <motion.div variants={itemVariants} className="space-y-6">
                    <div className="flex items-center gap-3 px-1">
                        <Smartphone className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-semibold tracking-tight text-foreground/90">Product Engagement</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ChartCard title="Conversion Funnel" subtitle="Search vs. Interaction Rate" onClick={showConversionDetails}>
                            <div className="h-[300px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={conversionStats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            dy={10}
                                            tick={{ fill: 'rgba(229, 218, 184, 0.6)', fontSize: 12 }}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            dx={-10}
                                            tick={{ fill: 'rgba(229, 218, 184, 0.6)', fontSize: 12 }}
                                        />
                                        <RechartsTooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            contentStyle={{ backgroundColor: '#324422', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                            itemStyle={{ color: '#E5DAB8' }}
                                        />
                                        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={80}>
                                            {conversionStats?.map((_entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#E77E23' : '#628141'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <ChartCard title="Route Preference" subtitle="Fastest vs Scenic">
                            <div className="h-[300px] w-full flex flex-col items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={featureStats}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={70}
                                            outerRadius={100}
                                            paddingAngle={4}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            <Cell fill="#E77E23" />
                                            <Cell fill="#628141" />
                                        </Pie>
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: '#324422', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                            itemStyle={{ color: '#E5DAB8' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex justify-center gap-8 -mt-8 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#E77E23]" />
                                        <span className="text-sm text-foreground/80">Fastest</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#628141]" />
                                        <span className="text-sm text-foreground/80">Scenic</span>
                                    </div>
                                </div>
                            </div>
                        </ChartCard>
                    </div>
                </motion.div>

                {/* 4. System Performance */}
                <motion.div variants={itemVariants} className="space-y-6">
                    <div className="flex items-center gap-3 px-1">
                        <Activity className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-semibold tracking-tight text-foreground/90">System Performance</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ChartCard
                            title="Frontend Performance"
                            subtitle="Page Load Time (s)"
                            onClick={() => showPerformance('load')}
                        >
                            <div className="grid grid-cols-3 gap-3 mt-4">
                                <div className="bg-white/5 p-2 rounded-lg border border-white/10 text-center">
                                    <div className="text-[10px] text-muted-foreground uppercase font-medium">Today</div>
                                    <div className="text-sm font-bold text-amber-400">{loadTimeAvg.daily.toFixed(2)}s</div>
                                </div>
                                <div className="bg-white/5 p-2 rounded-lg border border-white/10 text-center">
                                    <div className="text-[10px] text-muted-foreground uppercase font-medium">7 Days</div>
                                    <div className="text-sm font-bold text-amber-400">{loadTimeAvg.weekly.toFixed(2)}s</div>
                                </div>
                                <div className="bg-white/5 p-2 rounded-lg border border-white/10 text-center">
                                    <div className="text-[10px] text-muted-foreground uppercase font-medium">Overall</div>
                                    <div className="text-sm font-bold text-amber-400">{loadTimeAvg.overall.toFixed(2)}s</div>
                                </div>
                            </div>
                            <div className="h-[200px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={loadTimeStats} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis
                                            dataKey="time"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'rgba(229, 218, 184, 0.4)', fontSize: 10 }}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'rgba(229, 218, 184, 0.4)', fontSize: 10 }}
                                        />
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: '#2a3a1d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                            itemStyle={{ color: '#fbbf24' }}
                                            formatter={(value: any) => [`${Number(value).toFixed(2)}s`, 'Load Time']}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="value"
                                            stroke="#fbbf24"
                                            strokeWidth={3}
                                            dot={{ fill: '#fbbf24', r: 4 }}
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <ChartCard
                            title="Backend Performance"
                            subtitle="API Latency (s)"
                            onClick={() => showPerformance('latency')}
                        >
                            <div className="grid grid-cols-3 gap-3 mt-4">
                                <div className="bg-white/5 p-2 rounded-lg border border-white/10 text-center">
                                    <div className="text-[10px] text-muted-foreground uppercase font-medium">Today</div>
                                    <div className="text-sm font-bold text-cyan-400">{latencyAvg.daily.toFixed(2)}s</div>
                                </div>
                                <div className="bg-white/5 p-2 rounded-lg border border-white/10 text-center">
                                    <div className="text-[10px] text-muted-foreground uppercase font-medium">7 Days</div>
                                    <div className="text-sm font-bold text-cyan-400">{latencyAvg.weekly.toFixed(2)}s</div>
                                </div>
                                <div className="bg-white/5 p-2 rounded-lg border border-white/10 text-center">
                                    <div className="text-[10px] text-muted-foreground uppercase font-medium">Overall</div>
                                    <div className="text-sm font-bold text-cyan-400">{latencyAvg.overall.toFixed(2)}s</div>
                                </div>
                            </div>
                            <div className="h-[200px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={latencyStats} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis
                                            dataKey="time"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'rgba(229, 218, 184, 0.4)', fontSize: 10 }}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'rgba(229, 218, 184, 0.4)', fontSize: 10 }}
                                        />
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: '#2a3a1d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                            itemStyle={{ color: '#22d3ee' }}
                                            formatter={(value: any) => [`${Number(value).toFixed(2)}s`, 'Latency']}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="value"
                                            stroke="#22d3ee"
                                            strokeWidth={3}
                                            dot={{ fill: '#22d3ee', r: 4 }}
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>
                    </div>
                </motion.div>

                <div className="h-12" /> {/* Spacer */}
            </motion.div>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedMetric && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSelectedMetric(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="w-full max-w-2xl max-h-[80vh] bg-[#324422] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-white/10 flex justify-between items-start bg-black/10">
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground">{selectedMetric.title}</h2>
                                    <p className="text-muted-foreground mt-1">{selectedMetric.description}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSelectedMetric(null)}
                                    className="rounded-full hover:bg-white/10"
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
                                {selectedMetric.data.length === 0 ? (
                                    <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                            <Activity className="w-6 h-6 opacity-50" />
                                        </div>
                                        <p>No data recorded for this metric yet.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-white/5">
                                        {selectedMetric.data.map((item, i) => (
                                            <div key={i} className="p-4 hover:bg-white/5 transition-colors">
                                                {selectedMetric.renderItem ? selectedMetric.renderItem(item) : JSON.stringify(item)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-white/10 bg-black/10 flex justify-between items-center text-xs text-muted-foreground">
                                <span>Showing {selectedMetric.data.length} records</span>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedMetric(null)} className="hover:bg-white/5">
                                    Close
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Modern UI Components
const MetricCard = ({ title, value, subtitle, icon, delay = 0, isError = false, onClick }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4 }}
        whileHover={onClick ? { y: -4, scale: 1.02, transition: { duration: 0.2 } } : { y: -4 }}
        onClick={onClick}
        className={`group relative overflow-hidden p-6 rounded-2xl bg-black/20 backdrop-blur-md border border-white/5 hover:border-white/10 hover:bg-black/30 transition-all shadow-sm hover:shadow-lg ${onClick ? 'cursor-pointer ring-offset-2 focus:ring-2 focus:outline-none' : ''}`}
    >
        <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-medium text-foreground/60">{title}</h3>
            <div className={`p-2 rounded-lg ${isError ? 'bg-red-500/10 text-red-400' : 'bg-primary/10 text-primary'}`}>
                {icon}
            </div>
        </div>
        <div className="text-3xl font-bold tracking-tight text-foreground mb-1">
            {value}
        </div>
        <p className="text-xs text-foreground/50">{subtitle}</p>

        {/* Glow Effect */}
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />

        {onClick && (
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-white/10 p-1 rounded-full">
                    <ArrowLeft className="w-3 h-3 rotate-180" />
                </div>
            </div>
        )}
    </motion.div>
);

const ChartCard = ({ title, subtitle, action, children, onClick }: any) => (
    <motion.div
        whileHover={onClick ? { scale: 1.01 } : {}}
        onClick={onClick}
        className={`flex flex-col p-6 rounded-2xl bg-black/20 backdrop-blur-md border border-white/5 hover:border-white/10 transition-all shadow-sm h-full ${onClick ? 'cursor-pointer hover:bg-black/25' : ''}`}
    >
        <div className="mb-6 flex justify-between items-start">
            <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground tracking-tight">{title}</h3>
                {subtitle && <p className="text-sm text-foreground/50">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
                {action}
                {onClick && <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
        </div>
        <div className="flex-1 w-full min-h-0">
            {children}
        </div>
    </motion.div>
);
