import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  applyTheme,
  readStoredTheme,
  THEMES,
} from "../../theme/themes";
import "./ThemeGate.css";

type Props = {
  onDismissed?: () => void;
};

function shortestDelta(fromRot: number, toIndex: number, step: number): number {
  const target = -toIndex * step;
  const currentMod = ((fromRot % 360) + 360) % 360;
  const base = currentMod === 0 ? 0 : fromRot % 360;
  let delta = target - base;
  delta = (((delta % 360) + 540) % 360) - 180;
  return delta;
}

export function ThemeGate({ onDismissed }: Props) {
  const initialIndex = Math.max(
    0,
    THEMES.findIndex((t) => t.id === readStoredTheme()),
  );
  const n = THEMES.length;
  const step = 360 / n;

  const [rot, setRot] = useState(-initialIndex * step);
  const [active, setActive] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [gone, setGone] = useState(false);
  const dismissedRef = useRef(false);

  const theme = THEMES[active] ?? THEMES[0]!;
  const g = theme.gate;

  const goTo = useCallback(
    (idx: number) => {
      const next = ((idx % n) + n) % n;
      setRot((prev) => prev + shortestDelta(prev, next, step));
      setActive(next);
      applyTheme(THEMES[next]!.id);
    },
    [n, step],
  );

  useEffect(() => {
    applyTheme(THEMES[initialIndex]?.id ?? "obsidian");
  }, [initialIndex]);

  useEffect(() => {
    const onScroll = () => {
      const max = Math.max(180, window.innerHeight * 0.55);
      const p = Math.min(1, window.scrollY / max);
      setProgress(p);
      if (p >= 0.98 && !dismissedRef.current) {
        dismissedRef.current = true;
        setGone(true);
        onDismissed?.();
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onDismissed]);

  if (gone) return null;

  const blur = progress * 28;
  const opacity = 1 - progress;
  const lift = progress * -48;

  const gateVars = {
    opacity,
    filter: `blur(${blur}px)`,
    transform: `translate3d(0, ${lift}px, 0)`,
    pointerEvents: progress > 0.75 ? "none" : "auto",
    ["--brand"]: theme.accent,
    ["--gate-bg-inner"]: g.bgInner,
    ["--gate-bg-outer"]: g.bgOuter,
    ["--gate-face-inner"]: g.faceInner,
    ["--gate-face-outer"]: g.faceOuter,
    ["--gate-ink"]: g.ink,
    ["--gate-muted"]: g.muted,
    ["--gate-on-accent"]: g.onAccent,
    ["--gate-stop-bg"]: g.stopBg,
    ["--gate-stop-border"]: g.stopBorder,
    ["--gate-stop-text"]: g.stopText,
    ["--gate-wheel-border"]: g.wheelBorder,
  } as CSSProperties;

  return (
    <div
      className="theme-gate"
      data-gate-theme={theme.id}
      style={gateVars}
      aria-hidden={progress > 0.9}
    >
      <section className="ccm-11" aria-label="Theme selection">
        <div className="ccm-11__stage">
          <p className="ccm-11__eyebrow">SERKAN.YILMAZ // PROTOCOL</p>
          <h2 className="ccm-11__title">SELECT THEME</h2>

          <div className="ccm-11__pointer" aria-hidden="true" />

          <nav
            className="ccm-11__machine"
            style={{ ["--n" as string]: n }}
            aria-label="Themes"
          >
            <ul
              className="ccm-11__wheel"
              style={{ ["--rot" as string]: `${rot}deg` }}
            >
              {THEMES.map((t, i) => (
                <li key={t.id} style={{ ["--i" as string]: i }}>
                  <button
                    type="button"
                    className={`ccm-11__stop${i === active ? " is-active" : ""}`}
                    aria-pressed={i === active}
                    data-cursor="hover"
                    data-theme-stop={t.id}
                    style={
                      {
                        ["--stop-accent"]: t.accent,
                        ["--stop-bg"]: t.gate.stopBg,
                        ["--stop-border"]: t.gate.stopBorder,
                        ["--stop-text"]: t.gate.stopText,
                        ["--stop-on"]: t.gate.onAccent,
                      } as CSSProperties
                    }
                    onClick={() => goTo(i)}
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>

            <div className="ccm-11__face">
              <em>Now browsing</em>
              <strong className="ccm-11__current">{theme.name}</strong>
              <span className="ccm-11__tagline">{theme.tagline}</span>
              <div className="ccm-11__steer">
                <button
                  type="button"
                  className="ccm-11__prev"
                  aria-label="Previous theme"
                  data-cursor="hover"
                  onClick={() => goTo(active - 1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="ccm-11__next"
                  aria-label="Next theme"
                  data-cursor="hover"
                  onClick={() => goTo(active + 1)}
                >
                  →
                </button>
              </div>
            </div>

            <p className="ccm-11__live" aria-live="polite">
              {theme.name} selected
            </p>
          </nav>

          <p className="ccm-11__hint">
            {progress < 0.05
              ? "Tema seç · aşağı kaydırarak devam et"
              : "Devam ediliyor…"}
          </p>
        </div>
      </section>
    </div>
  );
}
