import { useLanguage } from "../../i18n/useLanguage";
import { Reveal } from "../Reveal/Reveal";
import "./Experience.css";

export function Experience() {
  const { t } = useLanguage();
  const exp = t.experience;

  return (
    <section className="experience section" id="experience">
      <Reveal as="h2" className="experience__title section-title">
        {exp.title}
      </Reveal>

      <Reveal direction="up" delay={100}>
        <article className="experience__card glass-panel">
          <div className="experience__meta">
            <p className="experience__period">{exp.period}</p>
            <h3 className="experience__role">{exp.role}</h3>
            <p className="experience__company">{exp.company}</p>
          </div>
          <p className="experience__desc">{exp.description}</p>
          <ul className="experience__points">
            {exp.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>
      </Reveal>
    </section>
  );
}
