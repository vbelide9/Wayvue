import { useEffect, useRef, useState } from "react";
import { useScroll, useTransform, useSpring, motion, AnimatePresence } from "framer-motion";

const FRAME_COUNT = 46; // Frames 15 through 60 (no wrap-around)
const BG_COLOR = "#050505";

export default function RoadTripCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  // Track the scroll progress through the full 200vh spacer
  // "start start" = progress 0 when container top aligns with viewport top
  // "end start"   = progress 1 when container BOTTOM aligns with viewport TOP
  // This means the fixed overlay stays alive for the ENTIRE 200vh of scrolling,
  // and at progress=1 the spacer is fully scrolled out — next section is at viewport top.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // Smooth out the scroll to prevent frame jumping
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Frame animation plays during the first 40% of scroll,
  // then the canvas fades out during 40-50% to reveal the next section.
  const frameProgress = useTransform(smoothProgress, [0, 0.4], [0, 1]);

  // Text Opacity/Position Mappings (visible during first portion of scroll)
  const opacityA = useTransform(smoothProgress, [0, 0.03, 0.25, 0.35], [0, 1, 1, 0]);
  const yA = useTransform(smoothProgress, [0, 0.35], [40, -40]);

  // Canvas overlay: smooth gradual cross-fade from 60% to 100% of scroll
  const canvasOpacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 1, 0]);
  // Parallax lift — canvas slides up slightly during the fade for a cinematic wipe
  const canvasY = useTransform(scrollYProgress, [0.6, 1], [0, -80]);

  // Preload Images
  useEffect(() => {
    let loadedCount = 0;
    const loadedImages = new Array(FRAME_COUNT);

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      // Load frames 15 through 60 sequentially (no circular wrap)
      const frameNumber = i + 15;
      img.src = `/sequence/ezgif-frame-0${frameNumber.toString().padStart(2, '0')}.jpg`;
      img.onload = () => {
        loadedCount++;
        setLoadProgress(Math.floor((loadedCount / FRAME_COUNT) * 100));
        loadedImages[i] = img;

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
      // Clamp to 0-1
      const clampedProgress = Math.max(0, Math.min(1, progress));
      const frameIndex = Math.min(
        FRAME_COUNT - 1,
        Math.floor(clampedProgress * FRAME_COUNT)
      );

      const img = images[frameIndex];
      const canvas = canvasRef.current;
      if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;
      const context = canvas.getContext("2d");
      if (!context) return;

      const w = canvas.width;
      const h = canvas.height;

      // Cover mode: fill the entire canvas, cropping minimally
      const scale = Math.max(w / img.width, h / img.height);

      // Center the image on the canvas
      const x = (w / 2) - (img.width / 2) * scale;
      const y = (h / 2) - (img.height / 2) * scale;

      context.fillStyle = BG_COLOR;
      context.fillRect(0, 0, w, h);
      context.drawImage(img, x, y, img.width * scale, img.height * scale);
    };

    // Use frameProgress (maps to 0-1 over first 50% of scroll) for frame selection
    const unsubscribe = frameProgress.on("change", (latest) => {
      render(latest);
    });

    // Initial frame render
    render(0);

    return () => unsubscribe();
  }, [images, frameProgress]);

  // Handle Resize with Device Pixel Ratio for 4K crisp rendering
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const w = window.innerWidth;
        const h = window.innerHeight;

        canvasRef.current.width = w * dpr;
        canvasRef.current.height = h * dpr;
        canvasRef.current.style.width = `${w}px`;
        canvasRef.current.style.height = `${h}px`;
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      {/* Scroll spacer: 200vh. The fixed overlay stays visible for the full 200vh scroll. */}
      <div ref={containerRef} className="relative h-[200vh] bg-[#050505]" />

      {/* Fixed full-screen canvas overlay — smooth cross-fade with parallax lift */}
      <motion.div
        style={{ opacity: canvasOpacity, y: canvasY }}
        className="fixed inset-0 z-40"
      >
        {/* Loading Overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]"
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

        {/* Heat Haze Filter Definitions */}
        <svg style={{ display: "none" }}>
          <filter id="heatHaze">
            <feTurbulence type="fractalNoise" baseFrequency="0.015 0.05" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="B" />
          </filter>
        </svg>

        <canvas ref={canvasRef} className="block" />

        {/* Aurora cool color-grade — shifts the warm road sequence toward the blue palette (zoox-style duotone) */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-color"
          style={{ background: "linear-gradient(160deg, #1b3f86 0%, #0c2350 55%, #061024 100%)", opacity: 0.6 }}
        />
        {/* Electric-blue spotlight sheen */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(1100px circle at 70% 30%, rgba(59,123,255,0.22), transparent 60%)" }}
        />

        {/* Heat Haze Overlay */}
        <div
          className="absolute bottom-0 w-full h-[30%] pointer-events-none"
          style={{ backdropFilter: "url(#heatHaze)", opacity: 0.15 }}
        />

        {/* Cinematic Scrim */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-[#050505] opacity-80" />

        {/* Text Beats */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-10">
          <motion.div style={{ opacity: opacityA, y: yA }} className="absolute bottom-40 md:bottom-48 left-8 md:left-16 max-w-3xl text-left">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-['Inter_Tight'] font-bold tracking-tighter text-white uppercase drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] leading-[1.1]">Plan Smarter.<br />Drive Better.</h1>
            <p className="text-white font-bold tracking-[0.4em] uppercase text-xs md:text-sm mt-6 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] text-white/80">Your road trip, powered by real-time intelligence.</p>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          style={{ opacity: useTransform(scrollYProgress, [0, 0.03], [1, 0]) }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]"
        >
          <span className="text-[10px] tracking-widest uppercase text-white font-bold">Scroll to begin your journey</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-white to-transparent shadow-[0_2px_4px_rgba(0,0,0,1)]" />
        </motion.div>
      </motion.div>
    </>
  );
}
