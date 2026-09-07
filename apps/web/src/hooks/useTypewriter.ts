import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../lib/motion';

/**
 * Reveal `text` one character at a time. When the text changes the
 * effect restarts from empty, so a new nowcast status types itself in.
 * Under prefers-reduced-motion the full string is returned immediately.
 */
export function useTypewriter(text: string, speed = 26): { shown: string; done: boolean } {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced ? text : '');
  const [done, setDone] = useState(reduced);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current !== null) window.clearInterval(timer.current);

    if (reduced || !text) {
      setShown(text);
      setDone(true);
      return;
    }

    setShown('');
    setDone(false);
    let i = 0;
    timer.current = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        if (timer.current !== null) window.clearInterval(timer.current);
        setDone(true);
      }
    }, speed);

    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [text, speed, reduced]);

  return { shown, done };
}
