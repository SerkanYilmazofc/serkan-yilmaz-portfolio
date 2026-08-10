import { useEffect, useState, type RefObject } from "react";
import { useLanguage } from "../../i18n/useLanguage";
import { useMagnetic } from "../../hooks/useMagnetic";
import "./Hero.css";

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Hero() {
  const { t } = useLanguage();
  const [ready, setReady] = useState(false);
  const primary = useMagnetic(0.12);
  const secondary = useMagnetic(0.12);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section className="hero" id="top" aria-label="Hero">
      <div className={`hero__content${ready ? " is-ready" : ""}`}>
        <h1 className="hero__title">
          <span className="hero__mask">
            <span className="hero__reveal" style={{ transitionDelay: "80ms" }}>
              {t.hero.title}
            </span>
          </span>
        </h1>

        <p className="hero__subtitle">
          <span className="hero__mask">
            <span className="hero__reveal" style={{ transitionDelay: "220ms" }}>
              {t.hero.subtitle}
            </span>
          </span>
        </p>

        <p className="hero__desc">
          <span className="hero__mask">
            <span className="hero__reveal" style={{ transitionDelay: "360ms" }}>
              {t.hero.description}
            </span>
          </span>
        </p>

        <div className="hero__actions">
          <div
            className={`hero__btn${ready ? " is-in" : ""}`}
            style={{ transitionDelay: "480ms" }}
          >
            <a
              ref={primary.ref as RefObject<HTMLAnchorElement>}
              className="btn btn--primary"
              href="#about"
              data-cursor="hover"
              onMouseMove={primary.onMove}
              onMouseLeave={primary.onLeave}
            >
              {t.hero.ctaPrimary}
              <ArrowIcon />
            </a>
          </div>

          <div
            className={`hero__btn${ready ? " is-in" : ""}`}
            style={{ transitionDelay: "560ms" }}
          >
            <a
              ref={secondary.ref as RefObject<HTMLAnchorElement>}
              className="btn btn--ghost"
              href="#contact"
              data-cursor="hover"
              onMouseMove={secondary.onMove}
              onMouseLeave={secondary.onLeave}
            >
              {t.hero.ctaSecondary}
            </a>
          </div>
        </div>
      </div>

      <a
        className="hero__scroll"
        href="#about"
        aria-label={t.hero.scroll}
        data-cursor="hover"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 5v14M6 13l6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </section>
  );
}
