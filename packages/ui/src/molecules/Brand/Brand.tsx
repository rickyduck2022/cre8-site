import { AudioLines } from "@craft/icons";
import { VaultLabel } from "../../atoms/VaultLabel/VaultLabel";
import "../Molecules.css";

export interface BrandProps {
  size?: "small" | "large";
  className?: string;
  href?: string;
  logoSrc?: string;
  descriptor?: string;
}

export function Brand({ className, descriptor, href = "#dubs", logoSrc, size = "small" }: BrandProps) {
  const mark = logoSrc ? (
    <img className="brand__logo" src={logoSrc} alt="Cre8 DnB silhouette mark" />
  ) : (
    <>
      <AudioLines className="brand__mark" aria-hidden="true" />
      <span className="brand__word">cre8</span>
      <span className="brand__dot" aria-hidden="true" />
    </>
  );
  return (
    <a
      className={["brand", `brand--${size}`, descriptor && "brand--described", className]
        .filter(Boolean)
        .join(" ")}
      aria-label="cre8 home"
      href={href}
    >
      {descriptor ? <><span className="brand__visual">{mark}</span><VaultLabel className="brand__descriptor">{descriptor}</VaultLabel></> : mark}
    </a>
  );
}
