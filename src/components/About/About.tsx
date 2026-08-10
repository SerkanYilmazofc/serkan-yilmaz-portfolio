import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/useLanguage";
import { Reveal } from "../Reveal/Reveal";
import "./About.css";

function AnimatedStat({ value, label, delay }: { value: string; label: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const numeric = value.match(/^(\d+)/);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!shown || !numeric) return;
    const target = Number(numeric[1]);
    const duration = 900;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, numeric]);

  const display = numeric ? `${count}${value.slice(numeric[1].length)}` : value;

  return (
    <div
      ref={ref}
      className={`about-stat glass-panel${shown ? " is-in" : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="about-stat__value">{display}</div>
      <div className="about-stat__label">{label}</div>
    </div>
  );
}

export function About() {
  const { t } = useLanguage();

  return (
    <section className="about section" id="about">
      <Reveal as="h2" className="about__title section-title">
        {t.about.title}
      </Reveal>

      <div className="about__grid">
        <div className="about__copy">
          <Reveal direction="up" delay={80}>
            <p>{t.about.body}</p>
          </Reveal>
        </div>

        <div className="about__stats">
          {t.about.stats.map((stat, i) => (
            <AnimatedStat
              key={stat.label}
              value={stat.value}
              label={stat.label}
              delay={i * 100}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
