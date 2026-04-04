import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

// interface removed

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as any } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

// ── MOCKUP COMPONENTS ──────────────────────────────────────────────────────────

const RouteInputMockup = () => (
  <div
    className="w-full max-w-sm mx-auto p-5 rounded-2xl space-y-3"
    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}
  >
    {['New York, NY', 'Los Angeles, CA'].map((loc, i) => (
      <motion.div
        key={loc}
        className="flex items-center gap-3 p-3 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.2 + 0.3, duration: 0.6 }}
        viewport={{ once: true }}
      >
        <div className={`w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-blue-400 shadow-[0_0_8px_#60a5fa]'}`} />
        <span className="text-sm text-white/80 font-medium">{loc}</span>
      </motion.div>
    ))}
    {/* Animated route line */}
    <div className="relative h-1 mx-3">
      <div className="h-px bg-white/10 rounded" />
      <motion.div
        className="absolute top-0 left-0 h-px rounded"
        style={{ background: 'linear-gradient(90deg, #34d399, #60a5fa, #818cf8)' }}
        initial={{ width: '0%' }}
        whileInView={{ width: '100%' }}
        transition={{ delay: 0.6, duration: 1.2, ease: 'easeOut' }}
        viewport={{ once: true }}
      />
    </div>
    <div className="flex gap-2 pt-1">
      {['2,812 mi', '38h 20m', '52 gal'].map((m) => (
        <div key={m} className="flex-1 text-center py-2 rounded-lg text-[10px] font-bold text-white/50 uppercase tracking-wider"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
          {m}
        </div>
      ))}
    </div>
  </div>
);

const AIScoreMockup = () => (
  <div className="w-full max-w-sm mx-auto space-y-3">
    {/* Score card */}
    <motion.div
      className="p-5 rounded-2xl"
      style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', backdropFilter: 'blur(20px)' }}
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">AI Trip Score</div>
          <div className="text-5xl font-black text-white">94<span className="text-xl text-white/30">/100</span></div>
        </div>
        <div className="px-3 py-1 rounded-full text-[10px] font-bold text-emerald-300 uppercase tracking-widest"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
          Excellent
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #6366f1, #34d399)' }}
          initial={{ width: 0 }} whileInView={{ width: '94%' }}
          transition={{ delay: 0.4, duration: 1.2, ease: 'easeOut' }} viewport={{ once: true }}
        />
      </div>
      <div className="mt-3 text-xs text-white/40 leading-relaxed">
        Optimal departure window detected. Low traffic, clear skies for 85% of the route.
      </div>
    </motion.div>
    {/* Insight chips */}
    {['⚡ Leave by 6AM for best traffic', '🏔️ Scenic detour adds only 45min', '⛽ 3 fuel stops recommended'].map((insight, i) => (
      <motion.div key={i} className="px-4 py-2.5 rounded-xl text-xs text-white/60 font-medium"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.15 + 0.5 }}
        viewport={{ once: true }}
      >
        {insight}
      </motion.div>
    ))}
  </div>
);

const WeatherMockup = () => {
  const cities = [
    { name: 'New York', temp: '68°', icon: '⛅', desc: 'Partly Cloudy' },
    { name: 'Columbus', temp: '72°', icon: '☀️', desc: 'Clear' },
    { name: 'St. Louis', temp: '75°', icon: '🌤️', desc: 'Mostly Sunny' },
    { name: 'Oklahoma', temp: '81°', icon: '☀️', desc: 'Sunny' },
    { name: 'Los Angeles', temp: '76°', icon: '🌞', desc: 'Warm & Clear' },
  ];
  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Route curve */}
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 200" preserveAspectRatio="none">
        <motion.path d="M20 150 C80 80 150 160 200 100 C250 40 320 120 380 60"
          stroke="url(#wGrad)" strokeWidth="2" fill="none" strokeDasharray="6 8"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }}
          transition={{ duration: 2 }} viewport={{ once: true }}
        />
        <defs>
          <linearGradient id="wGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex justify-between">
        {cities.map((city, i) => (
          <motion.div key={city.name}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 + 0.3 }}
            viewport={{ once: true }}
          >
            <span className="text-lg">{city.icon}</span>
            <span className="text-sm font-bold text-white">{city.temp}</span>
            <span className="text-[9px] text-white/40 text-center leading-tight">{city.name}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const StopsMockup = () => {
  const stops = [
    { icon: '🍔', label: 'In-N-Out Burger', tag: 'Food Stop', color: 'text-orange-400', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.2)' },
    { icon: '⛽', label: 'Shell – 40mi ahead', tag: 'Fuel', color: 'text-yellow-400', bg: 'rgba(250,204,21,0.08)', border: 'rgba(250,204,21,0.15)' },
    { icon: '🏔️', label: 'Zion National Park', tag: 'Scenic', color: 'text-emerald-400', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.15)' },
  ];
  const vehicles = ['Economy', 'SUV', 'EV', 'Minivan'];
  return (
    <div className="w-full max-w-sm mx-auto space-y-3">
      {stops.map((s, i) => (
        <motion.div key={s.label} className="flex items-center gap-3 p-3.5 rounded-xl"
          style={{ background: s.bg, border: `1px solid ${s.border}`, backdropFilter: 'blur(12px)' }}
          initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.15 + 0.2 }} viewport={{ once: true }}
        >
          <span className="text-2xl">{s.icon}</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">{s.label}</div>
            <div className={`text-[10px] font-bold uppercase tracking-wider ${s.color}`}>{s.tag}</div>
          </div>
        </motion.div>
      ))}
      <div className="flex gap-2 pt-1">
        {vehicles.map((v, i) => (
          <motion.div key={v}
            className={`flex-1 text-center py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${i === 1 ? 'text-blue-300' : 'text-white/40'}`}
            style={{
              background: i === 1 ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
              border: i === 1 ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.05)',
            }}
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 + 0.6 }} viewport={{ once: true }}
          >
            {v}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ── FEATURE DATA ───────────────────────────────────────────────────────────────

const FEATURES = [
  {
    chapter: '01 / From Start to Destination',
    headline: 'Enter two points.\nGet a full command center.',
    subtext: 'Autocomplete location search, real GPS coordinates, departure time, one-way or round trip — all wired to the AI engine the moment you press Go.',
    accent: '#34d399',
    mockup: <RouteInputMockup />,
    flip: false,
  },
  {
    chapter: '02 / AI Trip Intelligence',
    headline: 'A co-pilot that thinks before you drive.',
    subtext: 'Real-time AI Trip Scores, natural language insights, optimal departure windows, and cached route variant switching — fastest ↔ scenic in milliseconds.',
    accent: '#818cf8',
    mockup: <AIScoreMockup />,
    flip: true,
  },
  {
    chapter: '03 / Weather Along Your Route',
    headline: 'Know the sky before you leave the driveway.',
    subtext: 'Hyper-local weather at every major waypoint along your route — temperature, wind, precipitation — updated in real time as conditions change.',
    accent: '#60a5fa',
    mockup: <WeatherMockup />,
    flip: false,
  },
  {
    chapter: '04 / Smart Stops & Rentals',
    headline: 'The best detours you never knew to take.',
    subtext: 'AI-curated food stops, fuel stations, and scenic spots along your route — plus vehicle rental matching based on your passengers, luggage, and terrain.',
    accent: '#f97316',
    mockup: <StopsMockup />,
    flip: true,
  },
];

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

export const FeatureStorySection = () => {
  return (
    <section className="relative bg-[#05050A] py-12">
      {/* Top fade */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black to-transparent pointer-events-none z-10" />

      <div className="relative z-20 space-y-32 md:space-y-48">
        {FEATURES.map((feat, idx) => {
          const ref = useRef<HTMLDivElement>(null);
          const inView = useInView(ref, { once: true, margin: '-100px' });

          return (
            <div
              key={idx}
              ref={ref}
              className={`max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${feat.flip ? 'lg:[&>*:first-child]:order-2' : ''}`}
            >
              {/* Text side */}
              <motion.div
                variants={stagger}
                initial="hidden"
                animate={inView ? 'visible' : 'hidden'}
                className="space-y-6"
              >
                <motion.div variants={fadeUp}>
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.2em]"
                    style={{ color: feat.accent }}
                  >
                    {feat.chapter}
                  </span>
                </motion.div>
                <motion.h2
                  variants={fadeUp}
                  className="text-4xl md:text-5xl font-black leading-tight text-white whitespace-pre-line"
                >
                  {feat.headline}
                </motion.h2>
                <motion.p variants={fadeUp} className="text-white/50 text-lg leading-relaxed max-w-lg">
                  {feat.subtext}
                </motion.p>
                <motion.div variants={fadeUp}>
                  <button
                    className="text-sm font-bold flex items-center gap-2 group"
                    style={{ color: feat.accent }}
                  >
                    Explore feature
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </button>
                </motion.div>
              </motion.div>

              {/* Mockup side */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {feat.mockup}
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
