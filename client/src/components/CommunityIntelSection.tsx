import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface StatItem {
  value: string;
  suffix: string;
  label: string;
  description: string;
}

const STATS: StatItem[] = [
  { value: '14.2', suffix: 'K', label: 'Trips Planned', description: 'Community-shared journeys across the US' },
  { value: '2.4', suffix: 'M', label: 'Scenic Waypoints', description: 'Curated stops, parks, and vistas mapped' },
  { value: '99', suffix: '%', label: 'Route Precision', description: 'Accurate predictions with live traffic data' },
  { value: '4.9', suffix: '★', label: 'User Rating', description: 'Across 3,400+ reviews on the App Store' },
];

const POPULAR_ROUTES = [
  { from: 'New York', to: 'Miami', distance: '1,280 mi', trips: '2.1K trips', tag: 'East Coast Classic' },
  { from: 'Chicago', to: 'Denver', distance: '920 mi', trips: '1.4K trips', tag: 'Mountain Run' },
  { from: 'LA', to: 'San Francisco', distance: '382 mi', trips: '3.8K trips', tag: 'Pacific Coast Hwy' },
];

const AnimatedNumber = ({ value, suffix, inView }: { value: string; suffix: string; inView: boolean }) => {
  // num removed
  return (
    <span className="font-black text-5xl text-white">
      {inView ? value : '0'}
      {suffix}
    </span>
  );
};

export const CommunityIntelSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative bg-[#05050A] py-24 md:py-40 overflow-hidden">
      {/* Glow background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-blue-600/5 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">
        {/* Header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400">
            Community Intelligence
          </span>
          <h2 className="mt-4 text-4xl md:text-6xl font-black text-white leading-tight">
            Millions of miles.<br />
            <span style={{ background: 'linear-gradient(135deg, #60a5fa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              One shared brain.
            </span>
          </h2>
          <p className="mt-4 text-white/40 text-lg max-w-xl mx-auto">
            Every trip planned adds to WayVue's collective intelligence — giving you better routes, smarter stops, and richer insights.
          </p>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="p-6 rounded-2xl group hover:scale-[1.02] transition-all cursor-default"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                backdropFilter: 'blur(20px)',
              }}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1 + 0.3, duration: 0.6 }}
              whileHover={{ borderColor: 'rgba(99,102,241,0.3)', boxShadow: '0 0 30px rgba(99,102,241,0.1)' }}
            >
              <AnimatedNumber value={stat.value} suffix={stat.suffix} inView={inView} />
              <div className="mt-2 text-sm font-bold text-white/70">{stat.label}</div>
              <div className="mt-1 text-[11px] text-white/30 leading-snug">{stat.description}</div>
            </motion.div>
          ))}
        </div>

        {/* Popular routes */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          <div className="text-sm font-bold text-white/30 uppercase tracking-[0.2em] mb-6">
            Trending Routes This Week
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {POPULAR_ROUTES.map((route, i) => (
              <motion.div
                key={i}
                className="p-5 rounded-2xl group cursor-pointer transition-all"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(16px)',
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.12 + 0.8 }}
                whileHover={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(99,102,241,0.2)' }}
              >
                <div className="text-[10px] font-bold text-blue-400/70 uppercase tracking-wider mb-3">
                  {route.tag}
                </div>
                <div className="flex items-center gap-2 text-white font-bold text-lg">
                  <span>{route.from}</span>
                  <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  <span>{route.to}</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs text-white/40">{route.distance}</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-xs text-white/40">{route.trips}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
