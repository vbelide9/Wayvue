import { useEffect, useRef, useState } from "react";
import { useScroll, useTransform, useSpring, motion, AnimatePresence } from "framer-motion";

const FRAME_COUNT = 150;
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
  const opacityA = useTransform(smoothProgress, [0, 0.05, 0.15, 0.2], [0, 1, 1, 0]);
  const yA = useTransform(smoothProgress, [0, 0.05, 0.15, 0.2], [20, 0, 0, -20]);

  const opacityB = useTransform(smoothProgress, [0.25, 0.3, 0.4, 0.45], [0, 1, 1, 0]);
  const xB = useTransform(smoothProgress, [0.25, 0.3, 0.4, 0.45], [-30, 0, 0, -30]);

  const opacityC = useTransform(smoothProgress, [0.5, 0.55, 0.65, 0.7], [0, 1, 1, 0]);
  const xC = useTransform(smoothProgress, [0.5, 0.55, 0.65, 0.7], [30, 0, 0, 30]);

  const opacityD = useTransform(smoothProgress, [0.8, 0.85, 0.95, 1], [0, 1, 1, 0]);

  // Preload Images
  useEffect(() => {
    const loadedImages: HTMLImageElement[] = [];
    let loadedCount = 0;

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.src = `/sequence/frame_${i}.jpg`; // Scaled up to 150 frames in JPG format
      img.onload = () => {
        loadedCount++;
        setLoadProgress(Math.floor((loadedCount / FRAME_COUNT) * 100));
        if (loadedCount === FRAME_COUNT) {
          setImages(loadedImages);
          setTimeout(() => setIsLoading(false), 500);
        }
      };
      
      // Error handling to prevent infinite loading if a frame is missing
      img.onerror = () => {
        loadedCount++;
        setLoadProgress(Math.floor((loadedCount / FRAME_COUNT) * 100));
        if (loadedCount === FRAME_COUNT) {
          setImages(loadedImages);
          setTimeout(() => setIsLoading(false), 500);
        }
      };
      
      loadedImages[i] = img;
    }
  }, []);

  // Draw Logic
  useEffect(() => {
    if (images.length < FRAME_COUNT || !canvasRef.current || images.includes(undefined as any)) return;

    const context = canvasRef.current.getContext("2d");
    if (!context) return;

    const render = (progress: number) => {
      const frameIndex = Math.min(
        FRAME_COUNT - 1,
        Math.floor(progress * FRAME_COUNT)
      );
      
      const img = images[frameIndex];
      if (!img || !img.complete || img.naturalWidth === 0) return;

      const canvas = canvasRef.current!;
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width / 2) - (img.width / 2) * scale;
      const y = (canvas.height / 2) - (img.height / 2) * scale;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, x, y, img.width * scale, img.height * scale);
    };

    const unsubscribe = smoothProgress.on("change", (latest) => {
      render(latest);
    });

    // Initial frame
    render(0);

    return () => unsubscribe();
  }, [images, smoothProgress]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div ref={containerRef} className="relative h-[500vh] bg-[#050505]">
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
            <span className="text-[10px] tracking-[0.3em] uppercase text-white/50">Initializing Drive</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <canvas ref={canvasRef} className="block w-full h-full object-cover" />

        {/* Text Beats */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-10">
          
          {/* Beat A */}
          <motion.div style={{ opacity: opacityA, y: yA }} className="text-center">
            <h1 className="text-7xl md:text-9xl font-['Inter_Tight'] font-bold tracking-tighter text-white uppercase drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">Departure</h1>
            <p className="text-white font-bold tracking-[0.5em] uppercase text-sm mt-4 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">The city fades in the rearview</p>
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

          {/* Beat D */}
          <motion.div style={{ opacity: opacityD }} className="text-center">
            <h2 className="text-4xl font-['Inter_Tight'] font-medium tracking-tighter italic text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">The destination is a myth.</h2>
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
