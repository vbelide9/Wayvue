import { useEffect, useRef, useState } from "react";
import { useScroll, useTransform, useSpring, motion, AnimatePresence } from "framer-motion";

const FRAME_COUNT = 60;
const BG_COLOR = "#050505";

export default function RoadTripCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Smooth out the scroll to prevent frame jumping
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Text Opacity/Position Mappings
  const opacityA = useTransform(smoothProgress, [0, 0.05, 0.25, 0.35], [0, 1, 1, 0]);
  const yA = useTransform(smoothProgress, [0, 0.35], [40, -40]);

  const opacityB = useTransform(smoothProgress, [0.4, 0.5, 0.7, 0.8], [0, 1, 1, 0]);
  const xB = useTransform(smoothProgress, [0.4, 0.5, 0.7, 0.8], [-30, 0, 0, -30]);

  const opacityC = useTransform(smoothProgress, [0.6, 0.7, 0.9, 1], [0, 1, 1, 0]);
  const xC = useTransform(smoothProgress, [0.6, 0.7, 0.9, 1], [30, 0, 0, 30]);

  // Preload Images
  useEffect(() => {
    let loadedCount = 0;
    const loadedImages = new Array(FRAME_COUNT);

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      // Load 60 frames circularly starting from frame 13 to prevent out-of-bounds 404s
      const frameNumber = ((i + 12) % FRAME_COUNT) + 1;
      img.src = `/sequence/${frameNumber.toString().padStart(4, '0')}.jpg`;
      img.onload = () => {
        loadedCount++;
        setLoadProgress(Math.floor((loadedCount / FRAME_COUNT) * 100));
        loadedImages[i] = img;
        
        // Once all images are downloaded, mark as ready
        if (loadedCount === FRAME_COUNT) {
          setImages([...loadedImages]);
          setIsLoading(false);
        }
      };
      
      img.onerror = () => {
        console.error(`Failed to load frame ${frameNumber}`);
        loadedCount++;
        if (loadedCount === FRAME_COUNT) {
          setImages([...loadedImages]);
          setIsLoading(false);
        }
      };
    }
  }, []);

  // Draw Logic mapped precisely to scroll progress
  useEffect(() => {
    if (images.length < FRAME_COUNT || !canvasRef.current || images.includes(undefined as any)) return;

    const render = (progress: number) => {
      // Adjusted scroll window: give a little static hero setup time, then mapping 100% of frames over rest of scroll
      const adjustedProgress = Math.max(0, (progress - 0.05) * (1 / 0.95));
      const frameIndex = Math.min(
        FRAME_COUNT - 1,
        Math.floor(adjustedProgress * FRAME_COUNT)
      );
      
      const img = images[frameIndex];
      const canvas = canvasRef.current;
      if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      
      // Since the car is uniquely anchored to the far right side of the new generated video,
      // we must align the canvas to the right strictly, rather than center-cropping it.
      const extraWidth = (img.width * scale) - canvas.width;
      const x = -extraWidth; 
      const y = (canvas.height / 2) - (img.height / 2) * scale;

      // Fill context with black to prevent transparent flashes
      context.fillStyle = BG_COLOR;
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw image
      context.drawImage(img, x, y, img.width * scale, img.height * scale);
    };

    const unsubscribe = smoothProgress.on("change", (latest) => {
      render(latest);
    });

    // Initial frame render
    render(0);

    return () => unsubscribe();
  }, [images, smoothProgress]);

  // Handle Resize correctly to fill the screen
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize(); // trigger once on mount
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    // Height is exactly 200vh. 
    // This allows EXACTLY 1 full screen of scrolling to complete the sequence, and beautifully seamlessly unlocks the "Trip Intelligence" search screen below it immediately.
    <div ref={containerRef} className="relative h-[200vh] bg-[#050505]">
      
      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]"
          >
            <div className="w-48 h-[2px] bg-white/10 mb-4 overflow-hidden">
              <motion.div 
                className="h-full bg-white" 
                initial={{ width: 0 }}
                animate={{ width: `${loadProgress}%` }}
              />
            </div>
            <span className="text-[10px] tracking-[0.3em] uppercase text-white/50">Initializing Sequence</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Heat Haze Filter Definitions */}
        <svg style={{ display: "none" }}>
          <filter id="heatHaze">
            <feTurbulence type="fractalNoise" baseFrequency="0.015 0.05" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="B" />
          </filter>
        </svg>

        <canvas ref={canvasRef} className="block w-full h-full object-cover" />

        {/* Heat Haze Overlay block covering bottom 30% of image */}
        <div 
          className="absolute bottom-0 w-full h-[30%] pointer-events-none"
          style={{ backdropFilter: "url(#heatHaze)", opacity: 0.15 }} 
        />

        {/* Cinematic Scrim */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-[#050505] opacity-80" />

        {/* Text Beats */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-10">
          
          {/* Beat A */}
          <motion.div style={{ opacity: opacityA, y: yA }} className="absolute bottom-40 md:bottom-48 left-8 md:left-16 max-w-3xl text-left">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-['Inter_Tight'] font-bold tracking-tighter text-white uppercase drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] leading-[1.1]">Plan Smarter.<br/>Drive Better.</h1>
            <p className="text-white font-bold tracking-[0.4em] uppercase text-xs md:text-sm mt-6 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] text-white/80">Your road trip, powered by real-time intelligence.</p>
          </motion.div>

          {/* Beat B */}
          <motion.div style={{ opacity: opacityB, x: xB }} className="absolute left-10 md:left-24 max-w-md">
            <h2 className="text-5xl font-['Inter_Tight'] font-bold tracking-tighter text-white uppercase leading-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">Engineered Liberty</h2>
            <p className="text-white font-bold mt-4 text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">Unrestricted performance for the long haul.</p>
          </motion.div>

          {/* Beat C */}
          <motion.div style={{ opacity: opacityC, x: xC }} className="absolute right-10 md:right-24 text-right max-w-md">
            <h2 className="text-5xl font-['Inter_Tight'] font-bold tracking-tighter text-white uppercase leading-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">Coastal Flow</h2>
            <p className="text-white font-bold mt-4 text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">Syncing with the rhythm of the tide.</p>
          </motion.div>

        </div>

        {/* Scroll Indicator */}
        <motion.div 
          style={{ opacity: useTransform(scrollYProgress, [0, 0.05], [1, 0]) }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]"
        >
          <span className="text-[10px] tracking-widest uppercase text-white font-bold">Scroll to Drive</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-white to-transparent shadow-[0_2px_4px_rgba(0,0,0,1)]" />
        </motion.div>
      </div>
    </div>
  );
}
