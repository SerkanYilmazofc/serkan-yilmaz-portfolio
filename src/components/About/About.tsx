import { useEffect, useRef, useState, type Ref } from "react";
import { useLanguage } from "../../i18n/useLanguage";
import { Reveal } from "../Reveal/Reveal";
import "./About.css";

type Props = {
  onOpenSecret?: () => void;
  onOpenGame?: () => void;
};

function AnimatedStat({
  value,
  label,
  delay,
  onActivate,
}: {
  value: string;
  label: string;
  delay: number;
  onActivate?: () => void;
}) {
  const ref = useRef<HTMLDivElement | HTMLButtonElement>(null);
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
  const className = `about-stat glass-panel${shown ? " is-in" : ""}${
    onActivate ? " about-stat--secret" : ""
  }`;
  const style = { transitionDelay: `${delay}ms` };

  if (onActivate) {
    return (
      <button
        type="button"
        ref={ref as Ref<HTMLButtonElement>}
        className={className}
        style={style}
        data-cursor="hover"
        onClick={onActivate}
        aria-label={label}
      >
        <div className="about-stat__value">{display}</div>
        <div className="about-stat__label">{label}</div>
      </button>
    );
  }

  return (
    <div ref={ref as Ref<HTMLDivElement>} className={className} style={style}>
      <div className="about-stat__value">{display}</div>
      <div className="about-stat__label">{label}</div>
    </div>
  );
}

export function About({ onOpenSecret, onOpenGame }: Props) {
  const { t } = useLanguage();

  return (
    <section className="about section" id="about">
      <div className="about__title-wrap">
        <Reveal as="h2" className="about__title section-title">
          {t.about.title}
        </Reveal>
        <button
          type="button"
          className="about__secret"
          data-cursor="hover"
          aria-label=" "
          tabIndex={-1}
          onClick={() => onOpenSecret?.()}
        />
      </div>

      <div className="about__grid">
        <div className="about__copy">
          <Reveal direction="up" delay={80}>
            <p>{t.about.body}</p>
          </Reveal>
        </div>

        <div className="about__stats">
          {t.about.stats.map((stat, i) => {
            const isLearning =
              stat.value === "∞" ||
              stat.label.toLocaleLowerCase("tr-TR") === "öğrenme" ||
              stat.label.toLowerCase() === "learning";
            return (
              <AnimatedStat
                key={stat.label}
                value={stat.value}
                label={stat.label}
                delay={i * 100}
                onActivate={isLearning ? onOpenGame : undefined}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
