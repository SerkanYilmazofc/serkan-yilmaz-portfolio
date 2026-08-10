import { useLanguage } from "../../i18n/useLanguage";
import { Reveal } from "../Reveal/Reveal";
import { useMagnetic } from "../../hooks/useMagnetic";
import type { RefObject } from "react";
import "./Contact.css";

export function Contact() {
  const { t } = useLanguage();
  const magnetic = useMagnetic(0.18);
  const mailHref = `mailto:${t.contact.email}`;

  return (
    <section className="contact section" id="contact">
      <Reveal as="p" className="contact__eyebrow" delay={40}>
        {t.contact.eyebrow}
      </Reveal>

      <Reveal as="h2" className="contact__title" delay={120}>
        {t.contact.title}
      </Reveal>

      <Reveal delay={200}>
        <a className="contact__email" href={mailHref} data-cursor="hover">
          {t.contact.email}
        </a>
      </Reveal>

      <Reveal delay={280} direction="up" className="contact__cta-wrap">
        <a
          ref={magnetic.ref as RefObject<HTMLAnchorElement>}
          className="btn btn--primary contact__cta"
          href={mailHref}
          data-cursor="hover"
          onMouseMove={magnetic.onMove}
          onMouseLeave={magnetic.onLeave}
        >
          {t.contact.cta}
        </a>
      </Reveal>
    </section>
  );
}
