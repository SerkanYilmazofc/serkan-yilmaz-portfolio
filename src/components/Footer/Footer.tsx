import { useLanguage } from "../../i18n/useLanguage";
import "./Footer.css";

export function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__brand">Serkan Yılmaz</div>

        <a
          className="footer__email"
          href={`mailto:${t.contact.email}`}
          data-cursor="hover"
        >
          {t.contact.email}
        </a>

        <p className="footer__copy">© {year} Serkan Yılmaz</p>
      </div>
    </footer>
  );
}
