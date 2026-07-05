import { MapPin, Search, Zap, Camera, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LocationInput } from '@/components/LocationInput';
import { CombinedDateTimePicker } from './CustomDateTimePicker';
import { TopographyBackground } from './TopographyBackground';

interface PlannerCardProps {
  start: string;
  destination: string;
  onStartChange: (val: string) => void;
  onDestinationChange: (val: string) => void;
  onStartSelect: (coords: { lat: number; lng: number; display_name: string }) => void;
  onDestSelect: (coords: { lat: number; lng: number; display_name: string }) => void;

  waypoints: { name: string; lat?: number; lng?: number }[];
  onWaypointsChange: (waypoints: { name: string; lat?: number; lng?: number }[]) => void;

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



const SearchButton = ({ onClick, isCalculating, disabled, label }: { onClick: () => void, isCalculating: boolean, disabled: boolean, label?: string }) => {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      aria-label={isCalculating ? 'Planning your trip' : (label || 'Plan trip')}
      whileHover={disabled ? {} : { scale: 1.05, boxShadow: "0 0 20px rgba(249, 115, 22, 0.4)" }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      className={`relative group flex items-center justify-center ${label ? 'w-auto px-6 gap-2' : 'w-12'} h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 shadow-orange-glow border border-white/10 transition-all duration-300 overflow-hidden self-center disabled:cursor-not-allowed`}
    >
      {/* Specular Highlight */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 -translate-x-full group-hover:translate-x-full" />

      {/* Intelligence Pulse */}
      {isCalculating && (
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute inset-0 bg-orange-300/20 rounded-full blur-md"
        />
      )}

      {/* The Icon Layer */}
      <AnimatePresence mode="wait">
        {isCalculating ? (
          <motion.div
            key="loading"
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="flex items-center gap-2"
          >
            {label && <span className="text-sm font-bold text-white uppercase tracking-tighter">{label}</span>}
            <Zap size={18} className="text-white fill-white/20" />
          </motion.div>
        ) : (
          <motion.div
            key="icon"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center relative gap-2"
          >
            {label && <span className="text-sm font-bold text-white uppercase tracking-tighter">{label}</span>}
            <div className="relative">
              <Search size={18} strokeWidth={2.5} className="text-white drop-shadow-md" />
              <div className="absolute top-[2px] left-[2px] w-1 h-1 bg-white/50 rounded-full blur-[0.5px]" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

export function PlannerCard({
  start,
  destination,
  onStartChange,
  onDestinationChange,
  onStartSelect,
  onDestSelect,
  waypoints,
  onWaypointsChange,
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

  // ── Handle Search — triggers the real API call and navigates to the trip view ──
  const handleSearchClick = () => {
    onSubmit();
  };

  // ── Waypoint (multi-stop) handlers ──
  const addWaypoint = () => {
    onWaypointsChange([...waypoints, { name: '' }]);
  };
  const updateWaypoint = (index: number, patch: Partial<{ name: string; lat: number; lng: number }>) => {
    const next = waypoints.map((wp, i) => (i === index ? { ...wp, ...patch } : wp));
    onWaypointsChange(next);
  };
  const removeWaypoint = (index: number) => {
    onWaypointsChange(waypoints.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-5xl font-sans">

      {/* ═══ THE DYNAMIC PANEL ═══ */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full group/planner rounded-[24px] bg-[#141414]/55 backdrop-blur-2xl border border-white/12 shadow-2xl min-h-[220px]"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0px rgba(255, 255, 255, 0.1)',
        }}
      >
        <TopographyBackground />
        <div className="relative z-10 p-6 md:p-8 pointer-events-none">
          <div className="pointer-events-auto flex flex-col w-full h-full">
            {/* ── Error Display ── */}
            <AnimatePresence>
              {error && (
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
                <motion.div
                  key="form"
                  initial={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col gap-8"
                >
                  {/* ═══ Tab Content ═══ */}
                  <AnimatePresence mode="wait">
                      <motion.div
                        key="route"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex flex-col gap-4"
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto_auto] md:grid-cols-2 gap-4 items-center">
                        {/* Origin */}
                        <div className="flex flex-col gap-1 px-4 lg:border-r border-white/5 relative z-50">
                          <div className="flex items-center gap-2 text-[10px] font-semibold tracking-widest text-white/50 uppercase">
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
                        <div className="flex flex-col gap-1 px-4 lg:border-r border-white/5 relative z-40">
                          <div className="flex items-center gap-2 text-[10px] font-semibold tracking-widest text-white/50 uppercase">
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
                          <div className="grid grid-cols-2 gap-3 h-full">
                            <CombinedDateTimePicker
                              dateValue={departureDate}
                              onDateChange={onDepartureDateChange}
                              timeValue={departureTime}
                              onTimeChange={onDepartureTimeChange}
                              minDate={today}
                              maxDate={maxDate}
                              label="Departure"
                              className="h-full"
                              isActive={true}
                            />
                            <div
                              className={`transition-all duration-300 h-full ${!isRoundTrip ? 'opacity-40 blur-[0.5px] saturate-50 hover:opacity-100 hover:blur-none hover:saturate-100 cursor-pointer' : 'opacity-100'
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
                                label="Return"
                                className="h-full"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Primary CTA */}
                        <SearchButton
                          label="Plan trip"
                          onClick={handleSearchClick}
                          isCalculating={loading}
                          disabled={loading}
                        />
                        </div>

                        {/* ═══ Multi-Stop Waypoints ═══ */}
                        <div className="px-4">
                          <AnimatePresence initial={false}>
                            {waypoints.map((wp, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-visible mb-3"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-2 text-[10px] font-semibold tracking-widest text-white/40 uppercase w-14 shrink-0">
                                    Stop {i + 1}
                                  </div>
                                  <div className="flex-1 min-w-0 relative z-30">
                                    <LocationInput
                                      value={wp.name}
                                      onChange={(val) => updateWaypoint(i, { name: val })}
                                      onSelect={(coords) => updateWaypoint(i, { name: coords.display_name, lat: coords.lat, lng: coords.lng })}
                                      label={`Stop ${i + 1}`}
                                      variant="minimal"
                                      placeholder="Add a stop along the way"
                                      icon="destination"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeWaypoint(i)}
                                    className="p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                                    title="Remove stop"
                                    aria-label={`Remove stop ${i + 1}`}
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>

                          <button
                            type="button"
                            onClick={addWaypoint}
                            className="flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white transition-colors mt-1"
                          >
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/10">
                              <Plus size={13} />
                            </span>
                            Add stop
                          </button>
                        </div>
                      </motion.div>
                  </AnimatePresence>

                  {/* ═══ Secondary Toggles ═══ */}
                  <div className="flex flex-wrap items-center justify-between border-t border-white/5 pt-6 gap-3">
                    {/* One-Way / Round-Trip */}
                    <div className="flex gap-1 p-1 rounded-full bg-black/40 backdrop-blur-md">
                      <button
                        onClick={() => { if (isRoundTrip) onRoundTripToggle(); }}
                        className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${!isRoundTrip ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'
                          }`}
                      >
                        → One-way
                      </button>
                      <button
                        onClick={() => { if (!isRoundTrip) onRoundTripToggle(); }}
                        className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${isRoundTrip ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'
                          }`}
                      >
                        ⇄ Round-trip
                      </button>
                    </div>

                    {/* Fastest / Scenic */}
                    <div className="flex gap-1 p-1 rounded-full bg-black/40 backdrop-blur-md">
                      <button
                        onClick={() => onPreferenceChange('fastest')}
                        className={`flex items-center gap-2 px-6 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${routePreference === 'fastest'
                            ? 'bg-white text-black shadow-sm'
                            : 'text-white/50 hover:text-white'
                          }`}
                      >
                        <Zap size={14} /> Fastest
                      </button>
                      <button
                        onClick={() => onPreferenceChange('scenic')}
                        className={`flex items-center gap-2 px-6 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${routePreference === 'scenic'
                            ? 'bg-white text-black shadow-sm'
                            : 'text-white/50 hover:text-white'
                          }`}
                      >
                        <Camera size={14} /> Scenic
                      </button>
                    </div>
                  </div>
                </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
