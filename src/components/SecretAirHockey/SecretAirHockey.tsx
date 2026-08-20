import { useEffect, useState } from "react";
import "./SecretAirHockey.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SecretAirHockey({ open, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setVisible(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "airhockey-close") onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prev;
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKey);
      setVisible(false);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`secret-airhockey${visible ? " is-visible" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Air Hockey"
    >
      <iframe
        className="secret-airhockey__frame"
        title="Air Hockey"
        src="/games/air-hockey/index.html"
        allow="autoplay"
      />
    </div>
  );
}
