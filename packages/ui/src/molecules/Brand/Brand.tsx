import { AudioLines } from "@craft/icons";
import "../Molecules.css";

export interface BrandProps {
  size?: "small" | "large";
  className?: string;
  href?: string;
  logoSrc?: string;
}

export function Brand({ className, href = "#dubs", logoSrc, size = "small" }: BrandProps) {
  return (
    <a
      className={["brand", `brand--${size}`, className]
        .filter(Boolean)
        .join(" ")}
      aria-label="cre8 home"
      href={href}
    >
      {logoSrc ? (
        <img className="brand__logo" src={logoSrc} alt="Cre8 Messenger · Wear Cre8 DnB" />
      ) : (
        <>
          <AudioLines className="brand__mark" aria-hidden="true" />
          <span className="brand__word">cre8</span>
          <span className="brand__dot" aria-hidden="true" />
        </>
      )}
    </a>
  );
}
