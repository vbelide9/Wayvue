import { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Search, Navigation, Sun, DollarSign, Zap, Camera, CloudRain, Fuel, Users, TrendingDown, Clock } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { LocationInput } from '@/components/LocationInput';
import { CombinedDateTimePicker } from './CustomDateTimePicker';

interface PlannerCardProps {
  start: string;
  destination: string;
  onStartChange: (val: string) => void;
  onDestinationChange: (val: string) => void;
  onStartSelect: (coords: { lat: number; lng: number; display_name: string }) => void;
  onDestSelect: (coords: { lat: number; lng: number; display_name: string }) => void;

  departureDate: string;
  departureTime: string;
  onDepartureDateChange: (val: string) => void;
  onDepartureTimeChange: (val: string) => void;

  returnDate: string;
  returnTime: string;
  onReturnDateChange: (val: string) => void;
  onReturnTimeChange: (val: string) => void;

  isRoundTrip: boolean;
  onRoundTripToggle: () => void;

  routePreference: 'fastest' | 'scenic';
  onPreferenceChange: (pref: 'fastest' | 'scenic') => void;

  loading: boolean;
  onSubmit: () => void;
  error: string | null;
}

// ── Extracted paths for re-use ──
const PatternPaths = ({ color, glow }: { color: string; glow?: boolean }) => (
  <>
    <g stroke={color} strokeWidth={glow ? "0.8" : "0.4"} fill="none">
      <path d="M0 150 C 100 120, 200 180, 400 150" />
      <path d="M0 170 C 120 140, 220 200, 400 170" />
      <path d="M0 190 C 140 160, 240 220, 400 190" />
      <path d="M150 0 C 180 100, 120 200, 150 400" />
      <path d="M170 0 C 200 120, 140 220, 170 400" />
    </g>
    <g fill={color} stroke={color} strokeWidth={glow ? "0.4" : "0.3"} className={glow ? "filter drop-shadow-[0_0_2px_rgba(251,191,36,0.8)]" : ""}>
      {/* Cluster A */}
      <circle stroke="none" cx="50" cy="50" r={glow ? "2" : "1.5"} />
      <circle stroke="none" cx="80" cy="30" r={glow ? "1.5" : "1"} />
      <circle stroke="none" cx="110" cy="60" r={glow ? "1.8" : "1.2"} />
      <circle stroke="none" cx="90" cy="90" r={glow ? "2" : "1.5"} />
      <line x1="50" y1="50" x2="80" y2="30" />
      <line x1="80" y1="30" x2="110" y2="60" />
      <line x1="110" y1="60" x2="90" y2="90" />
      <line x1="90" y1="90" x2="50" y2="50" />

      {/* Cluster B */}
      <g transform="translate(180, 150)">
        <circle stroke="none" cx="20" cy="20" r={glow ? "1.5" : "1"} />
        <circle stroke="none" cx="60" cy="10" r={glow ? "2" : "1.5"} />
        <circle stroke="none" cx="40" cy="50" r={glow ? "1.5" : "1"} />
        <line x1="20" y1="20" x2="60" y2="10" />
        <line x1="60" y1="10" x2="40" y2="50" />
      </g>

      {/* Floating "Data" Points */}
      <circle stroke="none" cx="250" cy="40" r={glow ? "1.2" : "0.8"} opacity={glow ? "0.8" : "0.5"} />
      <circle stroke="none" cx="220" cy="280" r={glow ? "1.2" : "0.8"} opacity={glow ? "0.8" : "0.5"} />
      <circle stroke="none" cx="20" cy="250" r={glow ? "1.2" : "0.8"} opacity={glow ? "0.8" : "0.5"} />
    </g>
  </>
);

// ── Intelligence Background (Topographic + Constellation Layers) ──
const IntelligenceBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Mouse tracking values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smoothing the movement
  const smoothX = useSpring(mouseX, { damping: 20, stiffness: 150 });
  const smoothY = useSpring(mouseY, { damping: 20, stiffness: 150 });

  // Creating the CSS mask string
  const maskImage = useTransform(
    [smoothX, smoothY],
    ([x, y]) => `radial-gradient(400px circle at ${x}px ${y}px, black 0%, transparent 100%)`
  );

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const { left, top } = containerRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="absolute inset-0 pointer-events-auto overflow-hidden group"
    >
      {/* LAYER 1: The Dim Base Pattern (Always visible) */}
      <svg width="100%" height="100%" className="absolute inset-0 opacity-[0.05] transition-opacity duration-500 group-hover:opacity-[0.08]">
        <pattern id="topo-dim" width="400" height="400" patternUnits="userSpaceOnUse">
           <PatternPaths color="#fbbf24" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#topo-dim)" />
      </svg>

      {/* LAYER 2: The Spotlight Pattern (Only visible near mouse) */}
      <motion.div 
        style={{ maskImage, WebkitMaskImage: maskImage }}
        className="absolute inset-0"
      >
        <svg width="100%" height="100%" className="absolute inset-0 opacity-40">
          <pattern id="topo-bright" width="400" height="400" patternUnits="userSpaceOnUse">
             <PatternPaths color="#fbbf24" glow />
          </pattern>
          <rect width="100%" height="100%" fill="url(#topo-bright)" />
        </svg>
      </motion.div>
      {/* Subtle radial gradient to fade edges */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 pointer-events-none" />
    </div>
  );
};

// ═══ CONFIDENCE RING ═══
const ConfidenceRing = ({ score }: { score: number }) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-16 h-16">
      <svg className="w-full h-full transform -rotate-90">
        {/* Background track */}
        <circle
          cx="32" cy="32" r={radius}
          stroke="currentColor" strokeWidth="4"
          fill="transparent"
          className="text-white/10"
        />
        {/* Animated progress arc */}
        <motion.circle
          cx="32" cy="32" r={radius}
          stroke="currentColor" strokeWidth="4"
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1], delay: 0.3 }}
          className="text-orange-500"
        />
      </svg>
      <motion.span
        className="absolute inset-0 flex items-center justify-center font-bold text-white text-sm"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        {score}%
      </motion.span>
    </div>
  );
};

// ═══ RESULTS PREVIEW LAYER ═══
const ResultsPreview = ({
  onReset,
  onGoToIntelligence,
}: {
  onReset: () => void;
  onGoToIntelligence: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
    className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8 items-center"
  >
    {/* 1. Trip Confidence */}
    <motion.div
      className="flex items-center gap-4"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1, duration: 0.5 }}
    >
      <ConfidenceRing score={88} />
      <div>
        <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Confidence</div>
        <div className="text-white font-semibold">High / Safe</div>
      </div>
    </motion.div>

    {/* 2. Weather Insight */}
    <motion.div
      className="flex flex-col gap-1 md:border-l border-white/10 md:pl-6"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    >
      <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Weather</div>
      <div className="flex items-center gap-2 text-white font-semibold">
        <Sun size={18} className="text-yellow-400" /> 72°F
        <span className="text-white/30">→</span> 54°F
      </div>
    </motion.div>

    {/* 3. Savings Insight */}
    <motion.div
      className="flex flex-col gap-1 md:border-l border-white/10 md:pl-6"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
    >
      <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Est. Savings</div>
      <div className="flex items-center gap-2 text-green-400 font-bold text-lg">
        <TrendingDown size={18} /> $42.30
      </div>
    </motion.div>

    {/* 4. Actions */}
    <motion.div
      className="flex gap-3 md:justify-end"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
    >
      <button
        onClick={onReset}
        className="p-4 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all duration-200"
        title="Back to search"
      >
        <Clock size={20} />
      </button>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onGoToIntelligence}
        className="flex-1 bg-orange-500 text-white font-bold px-6 py-4 rounded-2xl shadow-orange-glow whitespace-nowrap hover:bg-orange-400 transition-colors"
      >
        Go to Intelligence →
      </motion.button>
    </motion.div>
  </motion.div>
);

export function PlannerCard({
  start,
  destination,
  onStartChange,
  onDestinationChange,
  onStartSelect,
  onDestSelect,
  departureDate,
  departureTime,
  onDepartureDateChange,
  onDepartureTimeChange,
  returnDate,
  returnTime,
  onReturnDateChange,
  onReturnTimeChange,
  isRoundTrip,
  onRoundTripToggle,
  routePreference,
  onPreferenceChange,
  loading,
  onSubmit,
  error,
}: PlannerCardProps) {
  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState<'Route' | 'Weather' | 'Savings'>('Route');
  const [isCalculating, setIsCalculating] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Track when external loading completes to continue our flow
  const wasCalculating = useRef(false);

  useEffect(() => {
    // If we initiated the calculation and loading just finished, show results
    if (wasCalculating.current && !loading) {
      wasCalculating.current = false;
      setIsCalculating(false);
      setShowResults(true);
    }
  }, [loading]);

  // ── Handle Search Orb Click ──
  // Phase 1: Show local "computing" animation (1.8s)
  // Phase 2: Transition to ResultsPreview
  const handleSearchClick = () => {
    if (!start || !destination) {
      // Let the parent handle validation — just call onSubmit directly
      onSubmit();
      return;
    }
    setIsCalculating(true);
    // Simulate the "Intelligence Engine crunching" phase
    setTimeout(() => {
      setIsCalculating(false);
      setShowResults(true);
    }, 1800);
  };

  // ── "Go to Intelligence →" triggers the real API call ──
  const handleGoToIntelligence = () => {
    setShowResults(false);
    wasCalculating.current = true;
    onSubmit();
  };

  // ── Reset back to form ──
  const handleReset = () => {
    setShowResults(false);
    setIsCalculating(false);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-5xl font-sans">

      {/* ═══ THE DYNAMIC PANEL ═══ */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full rounded-[2.5rem] bg-white/10 backdrop-blur-3xl border border-white/20 shadow-2xl overflow-hidden min-h-[220px]"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
        }}
      >
        <IntelligenceBackground />

        <div className="relative z-10 p-8 pointer-events-none">
          <div className="pointer-events-auto flex flex-col w-full h-full">
            {/* ── Error Display ── */}
            <AnimatePresence>
            {error && !showResults && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-6"
              >
                <div className="px-4 py-3 rounded-2xl text-sm font-medium bg-red-500/10 border border-red-500/20 text-red-400">
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {!showResults ? (
              <motion.div
                key="form"
                initial={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35 }}
                className="flex flex-col gap-8"
              >
                {/* ═══ Tab Content ═══ */}
                <AnimatePresence mode="wait">
                  {activeTab === 'Route' && (
                    <motion.div
                      key="route"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto_auto] md:grid-cols-2 gap-4 items-center"
                    >
                      {/* Origin */}
                      <div className="flex flex-col gap-1 px-4 lg:border-r border-white/10">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-orange-400 uppercase">
                          <MapPin size={12} /> Origin
                        </div>
                        <div className="min-w-0">
                          <LocationInput
                            value={start}
                            onChange={onStartChange}
                            onSelect={onStartSelect}
                            label="Origin"
                            variant="minimal"
                            placeholder="Where from?"
                            icon="start"
                          />
                        </div>
                      </div>

                      {/* Destination */}
                      <div className="flex flex-col gap-1 px-4 lg:border-r border-white/10">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-white/50 uppercase">
                          <MapPin size={12} /> Destination
                        </div>
                        <div className="min-w-0">
                          <LocationInput
                            value={destination}
                            onChange={onDestinationChange}
                            onSelect={onDestSelect}
                            label="Destination"
                            variant="minimal"
                            placeholder="Where to?"
                            icon="destination"
                          />
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="flex flex-col gap-1 px-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-white/50 uppercase">
                          <Calendar size={12} /> Departure — Return
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <CombinedDateTimePicker
                            dateValue={departureDate}
                            onDateChange={onDepartureDateChange}
                            timeValue={departureTime}
                            onTimeChange={onDepartureTimeChange}
                            minDate={today}
                            maxDate={maxDate}
                            label=""
                          />
                          <div
                            className={`transition-opacity duration-300 ${
                              !isRoundTrip ? 'opacity-30 hover:opacity-50 cursor-pointer' : 'opacity-100'
                            }`}
                            onClick={() => { if (!isRoundTrip) onRoundTripToggle(); }}
                          >
                            <CombinedDateTimePicker
                              dateValue={returnDate}
                              onDateChange={(val) => {
                                onReturnDateChange(val);
                                if (!isRoundTrip) onRoundTripToggle();
                              }}
                              timeValue={returnTime}
                              onTimeChange={(val) => {
                                onReturnTimeChange(val);
                                if (!isRoundTrip) onRoundTripToggle();
                              }}
                              minDate={departureDate}
                              maxDate={maxDate}
                              label=""
                            />
                          </div>
                        </div>
                      </div>

                      {/* Search Orb */}
                      <motion.button
                        whileHover={{ scale: isCalculating ? 1 : 1.05 }}
                        whileTap={{ scale: isCalculating ? 1 : 0.95 }}
                        onClick={handleSearchClick}
                        disabled={isCalculating || loading}
                        className="p-4 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-orange-500 shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:bg-white/10 hover:border-orange-500/50 hover:shadow-orange-glow transition-all duration-300 disabled:cursor-not-allowed self-center relative overflow-hidden group"
                      >
                        <AnimatePresence mode="wait">
                          {isCalculating ? (
                            <motion.div
                              key="loader"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1, rotate: 360 }}
                              exit={{ opacity: 0 }}
                              transition={{ rotate: { repeat: Infinity, duration: 0.8, ease: 'linear' }, opacity: { duration: 0.2 } }}
                            >
                              <Zap size={24} />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="search-icon"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Search size={24} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </motion.div>
                  )}

                  {activeTab === 'Weather' && (
                    <motion.div
                      key="weather"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_auto] gap-6 items-center"
                    >
                      <div className="flex flex-col gap-1 px-4 md:border-r border-white/10">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-blue-400 uppercase">
                          <CloudRain size={12} /> Forecast Sensitivity
                        </div>
                        <select className="bg-transparent text-white focus:outline-none text-lg appearance-none cursor-pointer">
                          <option className="bg-neutral-900">Avoid All Precipitation</option>
                          <option className="bg-neutral-900">Light Rain OK</option>
                          <option className="bg-neutral-900">Prioritize Clear Skies</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1 px-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-white/50 uppercase">
                          Temp Preference
                        </div>
                        <div className="flex gap-4 text-white text-lg">
                          <span className="text-orange-400">70°F+</span>
                          <span className="opacity-30">Any</span>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: isCalculating ? 1 : 1.05 }}
                        whileTap={{ scale: isCalculating ? 1 : 0.95 }}
                        onClick={handleSearchClick}
                        disabled={isCalculating || loading}
                        className="flex items-center gap-3 pl-6 pr-6 py-4 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-orange-500 shadow-[0_0_15px_rgba(0,0,0,0.5)] font-bold hover:bg-white/10 hover:border-orange-500/50 hover:shadow-orange-glow transition-all duration-300 disabled:cursor-not-allowed self-center relative overflow-hidden group"
                      >
                        <AnimatePresence mode="wait">
                          {isCalculating ? (
                            <motion.div
                              key="loader"
                              className="flex items-center gap-3"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
                                <Zap size={20} />
                              </motion.div>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="label"
                              className="flex items-center gap-3"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <span className="text-sm uppercase tracking-tighter">Scan Weather</span>
                              <Search size={20} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </motion.div>
                  )}

                  {activeTab === 'Savings' && (
                    <motion.div
                      key="savings"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-center"
                    >
                      <div className="flex flex-col gap-1 px-4 md:border-r border-white/10">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-green-400 uppercase">
                          <Fuel size={12} /> Fuel Type
                        </div>
                        <select className="bg-transparent text-white focus:outline-none text-lg appearance-none">
                          <option className="bg-neutral-900">Premium Gas</option>
                          <option className="bg-neutral-900">Electric (EV)</option>
                          <option className="bg-neutral-900">Hybrid</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1 px-4 md:border-r border-white/10">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-white/50 uppercase">
                          <Users size={12} /> Passengers
                        </div>
                        <input type="number" defaultValue="2" className="bg-transparent text-white focus:outline-none text-lg w-full" />
                      </div>
                      <div className="flex flex-col gap-1 px-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-white/50 uppercase">
                          Target MPG
                        </div>
                        <input placeholder="e.g. 30" className="bg-transparent text-white placeholder:text-white/30 focus:outline-none text-lg" />
                      </div>
                      <motion.button
                        whileHover={{ scale: isCalculating ? 1 : 1.05 }}
                        whileTap={{ scale: isCalculating ? 1 : 0.95 }}
                        onClick={handleSearchClick}
                        disabled={isCalculating || loading}
                        className="flex items-center gap-3 pl-6 pr-6 py-4 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-orange-500 shadow-[0_0_15px_rgba(0,0,0,0.5)] font-bold hover:bg-white/10 hover:border-orange-500/50 hover:shadow-orange-glow transition-all duration-300 disabled:cursor-not-allowed self-center relative overflow-hidden group"
                      >
                        <AnimatePresence mode="wait">
                          {isCalculating ? (
                            <motion.div
                              key="loader"
                              className="flex items-center gap-3"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
                                <Zap size={20} />
                              </motion.div>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="label"
                              className="flex items-center gap-3"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <span className="text-sm uppercase tracking-tighter">Calculate</span>
                              <Search size={20} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ═══ Secondary Toggles ═══ */}
                <div className="flex flex-wrap items-center justify-between border-t border-white/10 pt-6 gap-3">
                  {/* One-Way / Round-Trip */}
                  <div className="flex gap-2 p-1 rounded-full bg-black/30 backdrop-blur-md">
                    <button
                      onClick={() => { if (isRoundTrip) onRoundTripToggle(); }}
                      className={`px-6 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        !isRoundTrip ? 'bg-white/10 text-white shadow-inner' : 'text-white/30 hover:text-white'
                      }`}
                    >
                      → One-way
                    </button>
                    <button
                      onClick={() => { if (!isRoundTrip) onRoundTripToggle(); }}
                      className={`px-6 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        isRoundTrip ? 'bg-white/10 text-white shadow-inner' : 'text-white/30 hover:text-white'
                      }`}
                    >
                      ⇄ Round-trip
                    </button>
                  </div>

                  {/* Fastest / Scenic */}
                  <div className="flex gap-2 p-1 rounded-full bg-black/30 backdrop-blur-md">
                    <button
                      onClick={() => onPreferenceChange('fastest')}
                      className={`flex items-center gap-2 px-6 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        routePreference === 'fastest'
                          ? 'bg-white/10 text-white'
                          : 'text-white/30 hover:text-white'
                      }`}
                    >
                      <Zap size={14} /> Fastest
                    </button>
                    <button
                      onClick={() => onPreferenceChange('scenic')}
                      className={`flex items-center gap-2 px-6 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        routePreference === 'scenic'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'text-white/30 hover:text-white'
                      }`}
                    >
                      <Camera size={14} /> Scenic
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* ═══ RESULTS PREVIEW ═══ */
              <ResultsPreview
                onReset={handleReset}
                onGoToIntelligence={handleGoToIntelligence}
              />
            )}
          </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* ═══ NAVIGATION DOCK — hidden when results are shown ═══ */}
      <AnimatePresence>
        {!showResults && (
          <motion.div
            className="flex gap-4"
            initial={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            {([
              { name: 'Route' as const, icon: Navigation },
              { name: 'Weather' as const, icon: Sun },
              { name: 'Savings' as const, icon: DollarSign },
            ]).map((tab) => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`flex items-center gap-3 px-10 py-4 rounded-2xl transition-all duration-300 ${
                  activeTab === tab.name
                    ? 'bg-[#1a1414] text-white border border-white/10 shadow-orange-glow'
                    : 'bg-black/40 text-white/40 backdrop-blur-md hover:text-white hover:bg-black/60'
                }`}
              >
                <tab.icon size={20} className={activeTab === tab.name ? 'text-orange-500' : ''} />
                <span className="font-bold tracking-wide">{tab.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
