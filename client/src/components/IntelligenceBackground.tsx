import { useRef, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export const palettes = [
  ['#E87F24', '#FFC81E', '#FEFDDF', '#73A5CA'],
  ['#A98B76', '#BFA28C', '#F3E4C9', '#BABF94'],
  ['#9AB17A', '#C3CC9B', '#E4DFB5', '#FBE8CE'],
  ['#FAE251', '#D75656', '#BD114A', '#EEEEEE'],
  ['#DB1A1A', '#FFF6F6', '#8CC7C4', '#2C687B'],
  ['#FFC570', '#EFD2B0', '#547792', '#1A3263'],
  ['#FFF8F0', '#C08552', '#8C5A3C', '#4B2E2B'],
  ['#81A6C6', '#AACDDC', '#F3E3D0', '#D2C4B4'],
  ['#F3F4F4', '#853953', '#612D53', '#2C2C2C'],
  ['#87B6BC', '#BED4CB', '#F6F09F', '#B35656'],
  ['#8A7650', '#8E977D', '#ECE7D1', '#DBCEA5'],
  ['#355872', '#7AAACE', '#9CD5FF', '#F7F8F0'],
  ['#F4F0E4', '#44A194', '#537D96', '#EC8F8D'],
  ['#F26076', '#FF9760', '#FFD150', '#458B73'],
  ['#09637E', '#088395', '#7AB2B2', '#EBF4F6'],
  ['#1A3263', '#547792', '#FAB95B', '#E8E2DB'],
  ['#30364F', '#ACBAC4', '#E1D9BC', '#F0F0DB'],
  ['#0C2C55', '#296374', '#629FAD', '#EDEDCE'],
  ['#F63049', '#D02752', '#8A244B', '#111F35'],
  ['#574964', '#9F8383', '#C8AAAA', '#FFDAB3'],
  ['#0F2854', '#1C4D8D', '#4988C4', '#BDE8F5'],
  ['#EBF4DD', '#90AB8B', '#5A7863', '#3B4953'],
  ['#213448', '#547792', '#94B4C1', '#EAE0CF'],
  ['#1B3C53', '#234C6A', '#456882', '#E3E3E3'],
  ['#F1F3E0', '#D2DCB6', '#A1BC98', '#778873']
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
      className="absolute inset-0 z-[0] pointer-events-auto overflow-hidden bg-[#0A0A10]"
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
      <div className="absolute inset-x-0 top-0 h-[10vh] bg-gradient-to-b from-[#05050A] to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-[10vh] bg-gradient-to-t from-[#05050A] to-transparent pointer-events-none" />
    </div>
  );
};
