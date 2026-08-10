import type { MouseEvent } from "react";
import { useLanguage } from "../../i18n/useLanguage";
import { Reveal } from "../Reveal/Reveal";
import "./Services.css";

export function Services() {
  const { t } = useLanguage();

  const onMove = (e: MouseEvent<HTMLElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  return (
    <section className="services section" id="services">
      <Reveal as="h2" className="services__title section-title" direction="right">
        {t.services.title}
      </Reveal>

      <div className="services__grid">
        {t.services.items.map((item, i) => (
          <Reveal
            key={item.id}
            direction="up"
            delay={i * 90}
            className="services__reveal"
          >
            <article
              className={`service-card glass-panel service-card--v${(i % 5) + 1}`}
              data-cursor="hover"
              onMouseMove={onMove}
            >
              <div className="service-card__index">{item.id}</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
