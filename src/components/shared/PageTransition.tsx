'use client';

import { useEffect, useState } from 'react';

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger the transition on the next frame so the initial state renders first
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="transition-all duration-300 ease-out"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(6px)',
      }}
    >
      {children}
    </div>
  );
}
