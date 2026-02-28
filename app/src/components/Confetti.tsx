import { useEffect, useState } from 'react';

const COLORS = ['#FF6B6B', '#FFA726', '#26C6DA', '#66BB6A', '#AB47BC', '#FFCA28', '#EF5350', '#42A5F5'];

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  width: number;
  height: number;
  duration: number;
}

export function Confetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }
    setParticles(
      Array.from({ length: 55 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.9,
        width: 6 + Math.random() * 8,
        height: 4 + Math.random() * 6,
        duration: 1.8 + Math.random() * 1.5,
      })),
    );
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 9000,
      }}
    >
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(108vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.x}%`,
            width: `${p.width}px`,
            height: `${p.height}px`,
            backgroundColor: p.color,
            borderRadius: '2px',
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
