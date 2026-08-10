import { useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";

export function useMagnetic(strength = 0.12) {
  const ref = useRef<HTMLElement | null>(null);
  const raf = useRef(0);

  const onMove = useCallback(
    (e: ReactMouseEvent) => {
      const el = ref.current;
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (window.matchMedia("(hover: none)").matches) return;

      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * strength;
      const y = (e.clientY - rect.top - rect.height / 2) * strength;

      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        el.style.transition = "transform 0.12s ease-out";
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    },
    [strength],
  );

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(raf.current);
    el.style.transition = "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)";
    el.style.transform = "translate3d(0, 0, 0)";
  }, []);

  return { ref, onMove, onLeave };
}
