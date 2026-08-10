import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/useLanguage";
import "./Navigation.css";

const SECTIONS = ["about", "services", "experience", "contact"] as const;

export function Navigation() {
  const { t, locale, toggleLocale } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id);
        },
        { rootMargin: "-40% 0px -45% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = [
    { id: "about", label: t.nav.about },
    { id: "services", label: t.nav.services },
    { id: "experience", label: t.nav.experience },
    { id: "contact", label: t.nav.contact },
  ] as const;

  const goTo = (id: string) => {
    setOpen(false);
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="nav-wrap">
      <nav
        className={`nav-bar${scrolled ? " is-scrolled" : ""}`}
        aria-label="Primary"
      >
        <a
          className="nav-logo"
          href="#top"
          data-cursor="hover"
          aria-label={t.nav.home}
          onClick={(e) => {
            e.preventDefault();
            setActive("");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          SERKAN YILMAZ
        </a>

        <ul className="nav-links">
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={`#${link.id}`}
                data-cursor="hover"
                className={active === link.id ? "is-active" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  goTo(link.id);
                }}
              >
                {link.label}
                <span className="nav-dot" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>

        <div className="nav-actions">
          <button
            type="button"
            className="nav-lang"
            data-cursor="hover"
            onClick={toggleLocale}
            aria-label={locale === "tr" ? "Switch to English" : "Türkçeye geç"}
          >
            <span className={locale === "en" ? "is-on" : ""}>EN</span>
            <span className="nav-lang__sep">/</span>
            <span className={locale === "tr" ? "is-on" : ""}>TR</span>
          </button>

          <button
            type="button"
            className={`nav-burger${open ? " is-open" : ""}`}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        className={`nav-mobile${open ? " is-open" : ""}`}
        aria-hidden={!open}
      >
        <ul>
          <li style={{ transitionDelay: "80ms" }}>
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              {t.nav.home}
            </a>
          </li>
          {links.map((link, i) => (
            <li key={link.id} style={{ transitionDelay: `${i * 60 + 140}ms` }}>
              <a
                href={`#${link.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  goTo(link.id);
                }}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
