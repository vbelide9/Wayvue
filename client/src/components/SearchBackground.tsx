import { useEffect, useRef } from 'react';

/**
 * SearchBackground — A dark-mode-native animated background for the search page.
 * Uses subtle floating gradient orbs and particle dots on near-black (#05050A)
 * for visual cohesion with the landing page and results page aesthetics.
 */
export const SearchBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = 0;
    let height = 0;

    // Particles
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      opacity: number;
      opacitySpeed: number;
    }

    // Orbs
    interface Orb {
      x: number;
      y: number;
      targetX: number;
      targetY: number;
      radius: number;
      color: string;
      speed: number;
    }

    const particles: Particle[] = [];
    const orbs: Orb[] = [];

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const initParticles = () => {
      particles.length = 0;
      const count = Math.min(80, Math.floor((width * height) / 20000));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.4 + 0.1,
          opacitySpeed: (Math.random() - 0.5) * 0.005,
        });
      }
    };

    const initOrbs = () => {
      orbs.length = 0;
      const orbConfigs = [
        { color: 'rgba(16, 185, 129, 0.06)', radius: 350 },  // Emerald
        { color: 'rgba(230, 126, 34, 0.05)', radius: 300 },   // Amber
        { color: 'rgba(64, 81, 59, 0.07)', radius: 280 },     // Forest green (brand)
        { color: 'rgba(99, 102, 241, 0.04)', radius: 250 },   // Indigo accent
      ];

      orbConfigs.forEach((config) => {
        orbs.push({
          x: Math.random() * width,
          y: Math.random() * height,
          targetX: Math.random() * width,
          targetY: Math.random() * height,
          radius: config.radius,
          color: config.color,
          speed: 0.0003 + Math.random() * 0.0005,
        });
      });
    };

    const drawParticles = () => {
      particles.forEach((p) => {
        // Update
        p.x += p.vx;
        p.y += p.vy;
        p.opacity += p.opacitySpeed;

        if (p.opacity <= 0.05 || p.opacity >= 0.5) p.opacitySpeed *= -1;

        // Wrap
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Draw
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx!.fill();
      });

      // Draw connection lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = `rgba(255, 255, 255, ${0.06 * (1 - dist / 120)})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }
    };

    const drawOrbs = () => {
      orbs.forEach((orb) => {
        // Slowly drift toward target
        orb.x += (orb.targetX - orb.x) * orb.speed;
        orb.y += (orb.targetY - orb.y) * orb.speed;

        // Pick new target when close
        const dx = orb.targetX - orb.x;
        const dy = orb.targetY - orb.y;
        if (Math.sqrt(dx * dx + dy * dy) < 10) {
          orb.targetX = Math.random() * width;
          orb.targetY = Math.random() * height;
        }

        // Draw radial gradient
        const gradient = ctx!.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, 'transparent');

        ctx!.beginPath();
        ctx!.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx!.fillStyle = gradient;
        ctx!.fill();
      });
    };

    const animate = () => {
      ctx!.clearRect(0, 0, width, height);

      // Base color
      ctx!.fillStyle = '#05050A';
      ctx!.fillRect(0, 0, width, height);

      drawOrbs();
      drawParticles();

      animationId = requestAnimationFrame(animate);
    };

    resize();
    initParticles();
    initOrbs();
    animate();

    window.addEventListener('resize', () => {
      resize();
      initParticles();
      initOrbs();
    });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[0] pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
