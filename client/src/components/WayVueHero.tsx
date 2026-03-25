import { useRef } from 'react';
import { motion } from 'framer-motion';

const NAV_LINKS = ['Features', 'Routes', 'Community', 'Pricing'];

export const WayVueHero = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col overflow-hidden bg-[#05050A]"
    >
      {/* ── BACKGROUND LAYERS ── */}
      {/* Radial glow blobs */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[20%] w-[700px] h-[700px] rounded-full bg-blue-600/10 blur-[140px]" />
        <div className="absolute bottom-[-5%] right-[10%] w-[500px] h-[500px] rounded-full bg-emerald-500/8 blur-[120px]" />
        <div className="absolute top-[40%] left-[-5%] w-[400px] h-[400px] rounded-full bg-violet-600/8 blur-[100px]" />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Animated route lines SVG */}
      <svg
        className="absolute inset-0 w-full h-full z-0 opacity-20 pointer-events-none"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <motion.path
          d="M-100 700 C200 650 400 750 650 600 C900 450 1100 550 1600 480"
          stroke="url(#blueGrad)"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="12 16"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 3, ease: 'easeInOut', delay: 0.5 }}
        />
        <motion.path
          d="M-100 200 C300 280 600 180 900 250 C1200 320 1400 200 1600 260"
          stroke="url(#greenGrad)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="8 20"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{ duration: 3.5, ease: 'easeInOut', delay: 1 }}
        />
        <defs>
          <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
            <stop offset="50%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
            <stop offset="50%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* ── NAVBAR ── */}
      <nav className="relative z-30 flex items-center justify-between px-6 md:px-12 py-6">
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <span className="text-white text-sm font-black">W</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">WayVue</span>
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-blue-400/70 px-2 py-0.5 border border-blue-500/20 rounded-full">
            Trip Intelligence
          </span>
        </motion.div>

        <motion.div
          className="hidden md:flex items-center gap-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="text-sm text-white/50 hover:text-white transition-colors font-medium tracking-wide"
            >
              {link}
            </a>
          ))}
        </motion.div>

        <motion.button
          className="relative px-5 py-2.5 rounded-xl text-sm font-bold text-white overflow-hidden group"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))',
            border: '1px solid rgba(99,102,241,0.3)',
            backdropFilter: 'blur(12px)',
          }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <span className="relative z-10">Get Started</span>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-blue-600/20 to-violet-600/20" />
        </motion.button>
      </nav>

      {/* ── HERO CONTENT ── */}
      <div className="relative z-20 flex flex-col items-center justify-center flex-1 text-center px-6 pt-10 pb-24">
        {/* Badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
          style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.25)',
            backdropFilter: 'blur(8px)',
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
          <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-blue-300">
            AI-Powered Road Trip Intelligence
          </span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          className="font-black text-5xl sm:text-7xl lg:text-8xl xl:text-9xl leading-[0.92] tracking-tighter max-w-6xl"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-white">Plan Smarter.</span>
          <br />
          <span
            className="inline-block pb-3"
            style={{
              background: 'linear-gradient(135deg, #60a5fa 0%, #818cf8 40%, #34d399 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Drive Better.
          </span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          className="mt-8 text-lg md:text-xl text-white/50 max-w-2xl leading-relaxed font-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          AI-powered road trip intelligence in real time. Routes, weather, stops, and
          rentals — all intelligently planned before you turn the key.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          className="mt-10 flex flex-wrap gap-4 justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          <motion.button
            className="px-8 py-4 rounded-2xl text-base font-bold text-white relative overflow-hidden group shadow-2xl shadow-blue-500/25"
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            }}
            whileHover={{ scale: 1.04, boxShadow: '0 20px 60px rgba(99,102,241,0.4)' }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="relative z-10 flex items-center gap-2">
              Start Planning
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-blue-400/20 to-violet-400/20" />
          </motion.button>

          <motion.button
            className="px-8 py-4 rounded-2xl text-base font-bold text-white/80 flex items-center gap-2"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(12px)',
            }}
            whileHover={{ scale: 1.04, background: 'rgba(255,255,255,0.08)' }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            Watch Demo
          </motion.button>
        </motion.div>

        {/* Floating UI elements */}
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          {/* Map pin - left */}
          <motion.div
            className="absolute left-[8%] top-[35%]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.8 }}
          >
            <motion.div
              animate={{ y: [-6, 6, -6] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="px-3 py-2 rounded-xl text-xs font-bold text-emerald-300 flex items-center gap-2"
              style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              New York → LA
            </motion.div>
          </motion.div>

          {/* Weather chip - right */}
          <motion.div
            className="absolute right-[8%] top-[28%]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.8 }}
          >
            <motion.div
              animate={{ y: [6, -6, 6] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="px-3 py-2 rounded-xl text-xs font-bold text-blue-300 flex items-center gap-2"
              style={{
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.2)',
                backdropFilter: 'blur(12px)',
              }}
            >
              ⛅ 72°F — Clear skies ahead
            </motion.div>
          </motion.div>

          {/* Trip score chip - bottom left */}
          <motion.div
            className="absolute left-[12%] bottom-[20%] hidden lg:block"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.8, duration: 0.6 }}
          >
            <motion.div
              animate={{ y: [-4, 4, -4] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="px-4 py-3 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">AI Trip Score</div>
              <div className="text-2xl font-black text-white">94<span className="text-sm font-medium text-white/40">/100</span></div>
              <div className="mt-1 h-1 w-24 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
                  initial={{ width: 0 }}
                  animate={{ width: '94%' }}
                  transition={{ delay: 2.2, duration: 1.2, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          </motion.div>

          {/* Route distance chip - bottom right */}
          <motion.div
            className="absolute right-[12%] bottom-[22%] hidden lg:block"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2, duration: 0.6 }}
          >
            <motion.div
              animate={{ y: [5, -5, 5] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
              className="px-4 py-3 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Route</div>
              <div className="text-lg font-black text-white">2,812 mi</div>
              <div className="text-[10px] text-white/40">~38h drive · Scenic mode</div>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 1 }}
        >
          <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">Scroll to explore</span>
          <motion.div
            className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center pt-1.5"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.div
              className="w-1 h-2 rounded-full bg-white/60"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
