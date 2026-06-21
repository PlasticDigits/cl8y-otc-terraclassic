import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  w: number;
  h: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

const COLORS = ['#f59e0b', '#fbbf24', '#d97706', '#fb923c', '#fcd34d', '#ffffff', '#34d399'];

function spawnBurst(width: number): Particle[] {
  const originX = width * (0.3 + Math.random() * 0.4);
  const particles: Particle[] = [];

  for (let i = 0; i < 36; i++) {
    const angle = (Math.random() * Math.PI) / 2 + Math.PI * 0.75;
    const speed = Math.random() * 6 + 4;
    particles.push({
      x: originX + (Math.random() - 0.5) * 80,
      y: -12,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: Math.random() * 8 + 5,
      h: Math.random() * 4 + 3,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
    });
  }

  return particles;
}

interface ConfettiCanvasProps {
  active: boolean;
}

export function ConfettiCanvas({ active }: ConfettiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let particles: Particle[] = [];
    let animationId = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles = particles.filter((p) => p.y < canvas.height + 30 && p.opacity > 0.05);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.vx *= 0.99;
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.004;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      animationId = requestAnimationFrame(animate);
    };

    particles.push(...spawnBurst(canvas.width));
    const burstInterval = setInterval(() => {
      particles.push(...spawnBurst(canvas.width));
    }, 1400);

    animationId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      clearInterval(burstInterval);
      cancelAnimationFrame(animationId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9998] pointer-events-none"
      aria-hidden="true"
    />
  );
}
