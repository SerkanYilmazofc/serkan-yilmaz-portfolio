import { useLanguage } from "../../i18n/useLanguage";
import "./Marquee.css";

export function Marquee() {
  const { t } = useLanguage();
  const text = `${t.marquee} • `;

  return (
    <section className="marquee" aria-hidden="true">
      <div className="marquee__track">
        <div className="marquee__content">{text}</div>
        <div className="marquee__content" aria-hidden="true">
          {text}
        </div>
      </div>
    </section>
  );
}
