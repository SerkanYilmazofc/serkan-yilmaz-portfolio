import type { ElementType, ReactNode } from "react";
import { useReveal } from "../../hooks/useReveal";
import "./Reveal.css";

type Props = {
  children: ReactNode;
  className?: string;
  as?: "div" | "h1" | "h2" | "h3" | "p" | "span";
  delay?: number;
  direction?: "up" | "left" | "right" | "mask";
};

export function Reveal({
  children,
  className = "",
  as: Tag = "div",
  delay = 0,
  direction = "mask",
}: Props) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const Inner: ElementType = Tag === "div" ? "div" : "span";

  return (
    <Tag
      ref={ref as never}
      className={`reveal reveal--${direction}${visible ? " is-visible" : ""} ${className}`.trim()}
    >
      <Inner
        className="reveal__inner"
        style={{ transitionDelay: `${delay}ms` }}
      >
        {children}
      </Inner>
    </Tag>
  );
}
