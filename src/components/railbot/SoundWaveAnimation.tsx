'use client';

const BARS = [0, 1, 2, 3, 4];
const DELAYS = ['0s', '0.15s', '0.3s', '0.45s', '0.6s'];

export default function SoundWaveAnimation() {
  return (
    <>
      <div className="flex items-center justify-center gap-[3px] h-6 px-1">
        {BARS.map((i) => (
          <div
            key={i}
            className="w-[3px] rounded-full bg-rc-orange animate-soundwave"
            style={{ animationDelay: DELAYS[i] }}
          />
        ))}
      </div>
      {/* Global keyframe - only injected once */}
      <style>{`
        @keyframes soundwave {
          0%, 100% { height: 6px; }
          50% { height: 20px; }
        }
        .animate-soundwave {
          animation: soundwave 1s ease-in-out infinite;
          height: 6px;
        }
      `}</style>
    </>
  );
}
