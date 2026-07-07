import { useRef, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export const palettes = [
  ['#1E2A44', '#3B7BFF', '#E7ECF5', '#22D3EE']
];

function hexToRgb(hex: string) {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    return [
      parseInt(cleanHex[0] + cleanHex[0], 16),
      parseInt(cleanHex[1] + cleanHex[1], 16),
      parseInt(cleanHex[2] + cleanHex[2], 16)
    ];
  }
  return [
    parseInt(cleanHex.slice(0, 2), 16),
    parseInt(cleanHex.slice(2, 4), 16),
    parseInt(cleanHex.slice(4, 6), 16)
  ];
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

export const IntelligenceBackground = ({ forcePaletteIndex }: { forcePaletteIndex?: number } = {}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Random palette index chosen ONCE per mount so it's consistent during lifetime but random on each visit
  const [activePaletteIndex] = useState(() => 
    forcePaletteIndex !== undefined ? forcePaletteIndex : Math.floor(Math.random() * palettes.length)
  );

  const { triangles } = useMemo(() => {
    // Seeded random for consistent structural generation (so mesh doesn't dance wildly on re-renders)
    let s = 1234567;
    const random = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    const width = 1920;
    const height = 1080;
    const cellSize = 150; // Size of triangles
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);

    const points = [];
    for (let y = 0; y <= rows; y++) {
      const row = [];
      for (let x = 0; x <= cols; x++) {
        let px = x * cellSize;
        let py = y * cellSize;

        // Add variance to create the distorted low-poly mesh
        if (x !== 0 && x !== cols) px += (random() - 0.5) * cellSize * 1.5;
        if (y !== 0 && y !== rows) py += (random() - 0.5) * cellSize * 1.5;

        // Pin corners exactly to viewBox outer boundaries
        if (x === 0) px = 0;
        if (x === cols) px = width;
        if (y === 0) py = 0;
        if (y === rows) py = height;

        row.push({ x: px, y: py });
      }
      points.push(row);
    }

    const polys = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tl = points[y][x];
        const tr = points[y][x + 1];
        const bl = points[y + 1][x];
        const br = points[y + 1][x + 1];

        // Diagonal split choice for variety
        const split = random() > 0.5;
        if (split) {
          polys.push([tl, tr, bl]);
          polys.push([tr, br, bl]);
        } else {
          polys.push([tl, tr, br]);
          polys.push([tl, br, bl]);
        }
      }
    }

    const activePaletteStr = palettes[activePaletteIndex];
    const cTL = hexToRgb(activePaletteStr[0]);
    const cTR = hexToRgb(activePaletteStr[1]);
    const cBL = hexToRgb(activePaletteStr[2]);
    const cBR = hexToRgb(activePaletteStr[3]);

    return {
      triangles: polys.map((poly) => {
        // Calculate centroid
        const cx = (poly[0].x + poly[1].x + poly[2].x) / 3;
        const cy = (poly[0].y + poly[1].y + poly[2].y) / 3;

        // Normalized coordinates (0 to 1)
        const nx = cx / width;
        const ny = cy / height;

        // Bilinear interpolation of RGB for base gradient
        const cTop = [
          cTL[0] * (1 - nx) + cTR[0] * nx,
          cTL[1] * (1 - nx) + cTR[1] * nx,
          cTL[2] * (1 - nx) + cTR[2] * nx,
        ];
        const cBottom = [
          cBL[0] * (1 - nx) + cBR[0] * nx,
          cBL[1] * (1 - nx) + cBR[1] * nx,
          cBL[2] * (1 - nx) + cBR[2] * nx,
        ];
        
        const rFinal = cTop[0] * (1 - ny) + cBottom[0] * ny;
        const gFinal = cTop[1] * (1 - ny) + cBottom[1] * ny;
        const bFinal = cTop[2] * (1 - ny) + cBottom[2] * ny;

        let [hue, saturation, baseLightness] = rgbToHsl(rFinal, gFinal, bFinal);

        // "Low poly" facet variance
        const variance = (random() - 0.5) * 15;
        const finalLightness = Math.max(8, Math.min(85, baseLightness + variance));

        const baseColor = `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(finalLightness)}%)`;
        // Make the hover color significantly brighter
        const hoverColor = `hsl(${Math.round(Math.max(0, hue - 10))}, ${Math.round(saturation + 20)}%, ${Math.round(Math.min(95, finalLightness + 30))}%)`;

        return {
          points: `${poly[0].x},${poly[0].y} ${poly[1].x},${poly[1].y} ${poly[2].x},${poly[2].y}`,
          baseColor,
          hoverColor,
        };
      })
    };
  }, [activePaletteIndex]);

  return (
    <div 
      ref={containerRef}
      // Use pointer-events-auto so the background intercepts hover interactions naturally,
      // but keep it on z-[0] so the planner card (z-[50]) rests securely on top untouched.
      className="absolute inset-0 z-[0] pointer-events-auto overflow-hidden bg-[#0C0E14]"
    >
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 opacity-100" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {triangles.map((tri, i) => (
          <motion.polygon
            key={i}
            points={tri.points}
            strokeWidth={1.5}
            // Add a stroke identical to the fill to prevent tiny antialiasing gaps between polygons
            initial={{ fill: tri.baseColor, stroke: tri.baseColor }}
            whileHover={{ 
              fill: tri.hoverColor, 
              stroke: tri.hoverColor,
              // Brief spring scale pop
              scale: 0.98,
              transition: { 
                 duration: 0.15,
                 ease: "easeOut"
              }
            }}
            // Force origin center for scale so they shrink uniformly inward instead of top-left
            style={{ transformOrigin: "center", transformBox: "fill-box" }}
          />
        ))}
      </svg>
      
      {/* Ambient gradient overlays to cleanly blend edges with the global app layout */}
      <div className="absolute inset-x-0 top-0 h-[10vh] bg-gradient-to-b from-[#08090C] to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-[10vh] bg-gradient-to-t from-[#08090C] to-transparent pointer-events-none" />
    </div>
  );
};
