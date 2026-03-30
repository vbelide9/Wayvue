import { RefreshCw, Navigation, Zap, Camera, ArrowRight, Send } from 'lucide-react';
import { motion } from 'framer-motion';
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className="max-w-2xl w-full mx-auto relative"
    >
      {/* Outer glow / ambient halo */}
      <div className="absolute -inset-6 rounded-3xl pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 70% 60% at 50% 50%, rgba(56, 189, 248, 0.04) 0%, transparent 70%),
            radial-gradient(ellipse 60% 50% at 30% 70%, rgba(230, 126, 34, 0.04) 0%, transparent 60%)
          `
        }}
      />

      {/* Main glass panel */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: `
            linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.04) 100%)
          `,
          backdropFilter: 'blur(40px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.3)',
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.08),
            inset 0 1px 0 rgba(255,255,255,0.1),
            0 25px 60px -12px rgba(0,0,0,0.5),
            0 0 80px rgba(56,189,248,0.03),
            0 0 80px rgba(230,126,34,0.03)
          `
        }}
      >
        {/* Specular highlight — top edge */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Inner glow accents */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-cyan-400/[0.04] blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 rounded-full bg-amber-500/[0.05] blur-[80px] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 p-7 sm:p-9">

          {/* Eyebrow label */}
          <p className="text-[10px] sm:text-[11px] text-center tracking-[0.35em] uppercase text-white/30 font-medium mb-3">
            Wayvue &nbsp;|&nbsp; Intelligence Engine
          </p>

          {/* Headline */}
          <div className="text-center mb-1">
            <h2 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight leading-tight">
              Plan Your Next Chapter
            </h2>
          </div>

          {/* Subheadline */}
          <p className="text-[13px] text-white/40 text-center font-medium mb-7">
            Unlock real-time route optimization &amp; safety insight
          </p>

          {/* Separator */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-6" />

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium"
            >
              {error}
            </motion.div>
          )}

          {/* Form */}
          <div className="space-y-3">

            {/* Origin */}
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-cyan-400/70 font-semibold mb-1.5 pl-1">
                Origin
              </label>
              <LocationInput
                value={start}
                onChange={onStartChange}
                onSelect={onStartSelect}
                label="Origin"
                variant="minimal"
                placeholder="Departure city or address"
                icon="start"
              />
            </div>

            {/* Destination */}
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-amber-400/70 font-semibold mb-1.5 pl-1">
                Destination
              </label>
              <LocationInput
                value={destination}
                onChange={onDestinationChange}
                onSelect={onDestSelect}
                label="Destination"
                variant="minimal"
                placeholder="Where are you headed?"
                icon="destination"
              />
            </div>

            {/* Date/Time Row */}
            <div className="pt-1">
              <div className="grid grid-cols-2 gap-3">
                {/* Departure date/time */}
                <div>
                  <label className="block text-[10px] tracking-[0.2em] uppercase text-cyan-400/60 font-semibold mb-1.5 pl-1">
                    Dep.
                  </label>
                  <CombinedDateTimePicker
                    dateValue={departureDate}
                    onDateChange={onDepartureDateChange}
                    timeValue={departureTime}
                    onTimeChange={onDepartureTimeChange}
                    minDate={today}
                    maxDate={maxDate}
                    label="Departure"
                  />
                </div>

                {/* Return date/time */}
                <div
                  className={`transition-all duration-300 ${
                    !isRoundTrip ? 'opacity-40 hover:opacity-60' : 'opacity-100'
                  }`}
                  onClick={() => {
                    if (!isRoundTrip) onRoundTripToggle();
                  }}
                >
                  <label className="block text-[10px] tracking-[0.2em] uppercase text-amber-400/60 font-semibold mb-1.5 pl-1">
                    Ret.
                  </label>
                  {!isRoundTrip && (
                    <div className="absolute inset-0 z-20 cursor-pointer" title="Click to Add Return" />
                  )}
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
                    label={isRoundTrip ? 'Return' : 'Add Return'}
                  />
                </div>
              </div>
            </div>

            {/* Separator */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            {/* Route Preference + Trip Type */}
            <div className="flex items-center gap-2 pt-0.5">
              {/* Fastest */}
              <button
                onClick={() => onPreferenceChange('fastest')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                  routePreference === 'fastest'
                    ? 'bg-cyan-500/15 border-cyan-400/30 text-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.1)]'
                    : 'border-white/[0.06] text-white/35 hover:text-white/60 hover:border-white/12'
                }`}
              >
                <Zap className={`w-3.5 h-3.5 ${routePreference === 'fastest' ? 'text-cyan-400' : ''}`} />
                Fastest
              </button>

              {/* Scenic */}
              <button
                onClick={() => onPreferenceChange('scenic')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                  routePreference === 'scenic'
                    ? 'bg-amber-500/15 border-amber-400/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
                    : 'border-white/[0.06] text-white/35 hover:text-white/60 hover:border-white/12'
                }`}
              >
                <Camera className={`w-3.5 h-3.5 ${routePreference === 'scenic' ? 'text-amber-400' : ''}`} />
                Scenic
              </button>

              <div className="flex-1" />

              {/* Trip Type */}
              <button
                onClick={onRoundTripToggle}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-200 ${
                  isRoundTrip
                    ? 'bg-emerald-500/10 border-emerald-400/25 text-emerald-400'
                    : 'border-white/[0.06] text-white/35 hover:text-white/60'
                }`}
              >
                {isRoundTrip ? (
                  <RefreshCw className="w-3 h-3 text-emerald-400" />
                ) : (
                  <ArrowRight className="w-3 h-3 text-amber-500" />
                )}
                {isRoundTrip ? 'Round' : 'One Way'}
              </button>
            </div>

            {/* CTA Button */}
            <button
              onClick={onSubmit}
              disabled={loading}
              className="w-full mt-2 py-4 rounded-xl
                bg-gradient-to-r from-[#E67E22] to-[#D35400]
                text-white font-bold text-sm uppercase tracking-[0.1em]
                hover:from-[#F39C12] hover:to-[#E67E22]
                active:scale-[0.98]
                transition-all duration-200
                shadow-[0_0_30px_rgba(230,126,34,0.25),0_4px_20px_rgba(230,126,34,0.2)]
                hover:shadow-[0_0_40px_rgba(230,126,34,0.35),0_4px_25px_rgba(230,126,34,0.25)]
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2.5
                relative overflow-hidden group"
            >
              {/* Button inner glow */}
              <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <span className="relative z-10 flex items-center gap-2.5">
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing Routes...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Generate Trip Intelligence
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </span>
            </button>

            {/* Fine Print */}
            <p className="text-[10px] text-white/25 text-center pt-1 tracking-[0.05em]">
              score includes: <span className="text-white/40 font-semibold">Weather</span> + <span className="text-white/40 font-semibold">Cost</span> + <span className="text-white/40 font-semibold">Safety</span>
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
