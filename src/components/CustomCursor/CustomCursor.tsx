import { useEffect, useRef, useState } from "react";
import { useIsTouch, usePrefersReducedMotion } from "../../hooks/useMediaQuery";
import { useLanguage } from "../../i18n/useLanguage";
import "./CustomCursor.css";

export function CustomCursor() {
  const { t } = useLanguage();
  const isTouch = useIsTouch();
  const reduced = usePrefersReducedMotion();
  const cursorRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const [mode, setMode] = useState<"default" | "hover" | "view">("default");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isTouch || reduced) return;

    const cursor = cursorRef.current;
    if (!cursor) return;

    let raf = 0;

    const tick = () => {
      pos.current.x += (target.current.x - pos.current.x) * 0.22;
      pos.current.y += (target.current.y - pos.current.y) * 0.22;
      cursor.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      setVisible(true);
    };

    const onOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(
        "[data-cursor]",
      ) as HTMLElement | null;
      if (!el) {
        setMode("default");
        return;
      }
      const type = el.dataset.cursor;
      setMode(type === "view" ? "view" : "hover");
    };

    const onLeave = () => setVisible(false);

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [isTouch, reduced]);

  if (isTouch || reduced) return null;

  return (
    <div
      ref={cursorRef}
      className={`custom-cursor custom-cursor--${mode}${visible ? " is-visible" : ""}`}
      aria-hidden="true"
    >
      {mode === "view" && <span className="custom-cursor__label">{t.cursor.view}</span>}
    </div>
  );
}
