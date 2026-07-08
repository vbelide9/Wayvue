import { useMemo } from 'react';

export const TopographyBackground = () => {
    const paths = useMemo(() => {
        const generated = [];
        // Generate a grid of wavy lines
        for(let i = -10; i < 50; i++) {
            const yBase = i * 16;
            let d = `M -100 ${yBase}`;
            for(let x = 0; x <= 1300; x += 30) {
                // Adjusting frequencies to get that organic, flowing contour map look
                const freqX = 0.0035;
                const freqY = 0.04;
                const amplitude = 45;
                
                // Combining sines and cosines with coordinate mixing creates the topographic interference
                const distortion = Math.sin(x * freqX + yBase * freqY) * amplitude 
                                 + Math.cos(x * freqX * 1.5) * (amplitude * 0.6);
                
                // Smooth line segments
                d += ` L ${x} ${yBase + distortion}`;
            }
            generated.push(d);
        }
        return generated;
    }, []);

    return (
        <div className="absolute inset-0 z-0 overflow-hidden rounded-[24px] pointer-events-none transition-all duration-[800ms] ease-out
                        opacity-40 group-hover/planner:opacity-70 flex items-center justify-center">

            {/* The SVG lines — warm amber contour map */}
            <svg
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1500ms] ease-out group-hover/planner:scale-[1.02]"
                viewBox="0 0 1200 400"
                preserveAspectRatio="xMidYMid slice"
                fill="none"
                stroke="hsl(22 84% 52%)"
                strokeOpacity="0.10"
                strokeWidth="1.2"
                style={{ filter: 'blur(0.3px)' }} // Soften lines slightly to match the reference style
            >
                {paths.map((p, i) => (
                    <path key={i} d={p} />
                ))}
            </svg>

            {/* Subtle glow layer that activates on hover */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(232,106,42,0.06)_0%,transparent_60%)]
                            opacity-0 group-hover/planner:opacity-100 transition-opacity duration-1000 pointer-events-none" />

            {/* Vignette mask to fade edges into the light card */}
            <div className="absolute inset-0 rounded-[24px] shadow-[inset_0_0_80px_50px_rgba(255,255,255,0.9)] pointer-events-none" />
        </div>
    );
}
