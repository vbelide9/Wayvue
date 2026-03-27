import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Map, CloudSun, Target, MapPin, Calendar, ArrowRightLeft, MoveRight, Zap, Camera } from 'lucide-react';

export function WayvueIntelligenceDock({ onFocusChange }: { onFocusChange?: (focused: boolean) => void }) {
  const [activeTab, setActiveTab] = useState<'route' | 'weather' | 'savings'>('route');
  const [isFocused, setIsFocusedState] = useState(false);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [isScenic, setIsScenic] = useState(true);

  const setIsFocused = (focused: boolean) => {
    setIsFocusedState(focused);
    if (onFocusChange) onFocusChange(focused);
  };
  
  // Weather mini-forecast tracking
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showWeather, setShowWeather] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  const handleWeatherMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="flex flex-col items-center w-full max-w-3xl mx-auto pointer-events-auto">
      
      {/* Expanded Omni-Input Routing Bar */}
      <div 
        className={`relative w-full transition-all duration-700 ease-out mb-6 ${isFocused ? 'scale-[1.02]' : 'scale-100'}`}
        onMouseEnter={() => setIsFocused(true)}
        onMouseLeave={() => setIsFocused(false)}
      >
        <div className={`absolute inset-0 rounded-[2rem] bg-[#FF5F1F] blur-2xl transition-opacity duration-700 ${isFocused ? 'opacity-30' : 'opacity-0'}`} />
        
        <div className="relative flex flex-col bg-black/40 backdrop-blur-xl border border-white/10 border-t-white/20 rounded-[2rem] p-4 overflow-hidden group hover:border-[#FF5F1F]/50 transition-colors duration-500 shadow-2xl">
          
          {/* Top Row: Merged Tabs Navigation */}
          <div className="flex items-center gap-2 mb-4 px-2 pb-4 border-b border-white/10">
            <TabButton 
              icon={<Map className="w-4 h-4" />} 
              label="Route" 
              active={activeTab === 'route'} 
              onClick={() => setActiveTab('route')} 
            />
            <div 
              onMouseEnter={() => setShowWeather(true)}
              onMouseLeave={() => setShowWeather(false)}
              onMouseMove={handleWeatherMouseMove}
            >
              <TabButton 
                icon={<CloudSun className="w-4 h-4" />} 
                label="Weather" 
                active={activeTab === 'weather'} 
                onClick={() => setActiveTab('weather')} 
              />
            </div>
            <TabButton 
              icon={<Target className="w-4 h-4" />} 
              label="Savings" 
              active={activeTab === 'savings'} 
              onClick={() => setActiveTab('savings')} 
            />
          </div>

          {/* Middle Row: Multi-Segment Inputs */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
            
            {/* Start Location */}
            <div className="flex items-center flex-1 w-full px-4 py-2 bg-transparent hover:bg-white/5 focus-within:bg-white/10 rounded-2xl transition-colors cursor-text">
              <MapPin className="w-5 h-5 text-[#FF5F1F] mr-3 shrink-0" />
              <div className="flex flex-col w-full">
                <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Origin</span>
                <input 
                  type="text"
                  placeholder="Where from?"
                  className="w-full bg-transparent text-white text-lg placeholder:text-white/30 focus:outline-none"
                />
              </div>
            </div>

            <div className="hidden md:block w-[1px] h-10 bg-white/10 shrink-0" />

            {/* Destination Location */}
            <div className="flex items-center flex-1 w-full px-4 py-2 bg-transparent hover:bg-white/5 focus-within:bg-white/10 rounded-2xl transition-colors cursor-text">
              <MapPin className="w-5 h-5 text-white/50 mr-3 shrink-0" />
              <div className="flex flex-col w-full">
                <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Destination</span>
                <input 
                  type="text"
                  placeholder="Where to?"
                  className="w-full bg-transparent text-white text-lg placeholder:text-white/30 focus:outline-none"
                />
              </div>
            </div>

            <div className="hidden md:block w-[1px] h-10 bg-white/10 shrink-0" />

            {/* Date/Time Segment */}
            <div className="flex items-center flex-1 w-full px-4 py-2 bg-transparent hover:bg-white/5 focus-within:bg-white/10 rounded-2xl transition-colors cursor-text">
              <Calendar className="w-5 h-5 text-white/50 mr-3 shrink-0" />
              <div className="flex flex-col w-full">
                <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Departure &mdash; Return</span>
                <input 
                  type="text"
                  placeholder="Add Dates"
                  className="w-full bg-transparent text-white text-lg placeholder:text-white/30 focus:outline-none"
                />
              </div>
            </div>

            {/* Search Action / Fluid Button */}
            <button className="relative flex items-center justify-center w-14 h-14 md:mx-2 rounded-full text-white bg-gradient-to-r from-[#FF5F1F] to-[#FF7A45] hover:from-[#FF7A45] hover:to-[#FF9500] hover:scale-110 transition-all duration-300 shadow-[0_4px_20px_rgba(255,95,31,0.5)] shrink-0 group/btn overflow-hidden">
              {/* Radial pulse layer */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.4)_0%,transparent_60%)] opacity-0 group-hover/btn:opacity-100 mix-blend-overlay transition-opacity duration-300 pointer-events-none" />
              <Search className="w-6 h-6 relative z-10" />
            </button>

          </div>

          {/* Bottom Row: Toggles */}
          <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t border-white/10 px-4">
            
            {/* Trip Type Toggle */}
            <div className="flex items-center gap-2 bg-white/5 rounded-full p-1 border border-white/5">
              <button 
                onClick={() => setIsRoundTrip(false)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${!isRoundTrip ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
              >
                <MoveRight className="w-3 h-3" /> One-way
              </button>
              <button 
                onClick={() => setIsRoundTrip(true)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${isRoundTrip ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
              >
                <ArrowRightLeft className="w-3 h-3" /> Round-trip
              </button>
            </div>

            {/* Route Preference Toggle */}
            <div className="flex items-center gap-2 bg-white/5 rounded-full p-1 border border-white/5">
              <button 
                onClick={() => setIsScenic(false)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${!isScenic ? 'bg-white/10 text-[#FF5F1F]' : 'text-white/40 hover:text-white/70'}`}
              >
                <Zap className="w-3 h-3" /> Fastest
              </button>
              <button 
                onClick={() => setIsScenic(true)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${isScenic ? 'bg-white/10 text-[#FF5F1F]' : 'text-white/40 hover:text-white/70'}`}
              >
                <Camera className="w-3 h-3" /> Scenic
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Intelligence Dock Tabs */}
      <div 
        ref={dockRef}
        className="flex p-2 bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl gap-2 shadow-2xl"
      >
        <TabButton 
          icon={<Map className="w-5 h-5" />} 
          label="Route" 
          active={activeTab === 'route'} 
          onClick={() => setActiveTab('route')} 
        />
        <div 
          onMouseEnter={() => setShowWeather(true)}
          onMouseLeave={() => setShowWeather(false)}
          onMouseMove={handleWeatherMouseMove}
        >
          <TabButton 
            icon={<CloudSun className="w-5 h-5" />} 
            label="Weather" 
            active={activeTab === 'weather'} 
            onClick={() => setActiveTab('weather')} 
          />
        </div>
        <TabButton 
          icon={<Target className="w-5 h-5" />} 
          label="Savings" 
          active={activeTab === 'savings'} 
          onClick={() => setActiveTab('savings')} 
        />
      </div>

      {/* Weather Mini-Forecast Portal (tracks mouse) */}
      <AnimatePresence>
        {showWeather && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed pointer-events-none z-[1000]"
            style={{ 
              left: mousePos.x, 
              top: mousePos.y,
              transform: 'translate(-50%, -120%)' // Offset above the cursor
            }}
          >
            <div className="flex items-center gap-4 bg-zinc-900/90 backdrop-blur-xl border border-white/20 p-4 rounded-xl shadow-2xl">
              <div className="flex flex-col">
                <span className="text-white/60 text-xs uppercase tracking-widest font-bold">En Route</span>
                <span className="text-white font-serif italic text-lg">Clear Skies</span>
              </div>
              <div className="w-[1px] h-8 bg-white/20 mx-2" />
              <div className="flex flex-col items-end">
                <span className="text-[#FF5F1F] font-bold text-2xl leading-none">72°</span>
                <span className="text-white/40 text-[10px] uppercase tracking-wider">Visibility Optimal</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-all duration-300 overflow-hidden ${
        active ? 'text-white bg-white/10' : 'text-white/50 hover:text-white hover:bg-white/5'
      }`}
    >
      {active && (
        <motion.div 
          layoutId="activeTab" 
          className="absolute inset-0 bg-[#FF5F1F]/20 rounded-xl"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10">{label}</span>
    </button>
  );
}
