import { t } from "@lib/i18n";

interface BlackCardProps {
  text: string;
  /** Animate in on mount */
  animate?: boolean;
  className?: string;
}

export function BlackCard({ text, animate = false, className = "" }: BlackCardProps) {
  return (
    <div
      className={`card card-black ${animate ? "anim-zoom-in" : ""} ${className}`}
      aria-label={text}
      role="region"
      aria-roledescription="black card"
    >
      <span className="card-text">{text}</span>
      <span className="card-logo">{t("app.title")}</span>
    </div>
  );
}
