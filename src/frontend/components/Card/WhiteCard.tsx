import { t } from "@lib/i18n";

export type WhiteCardState = "idle" | "selected" | "submitted" | "winner";

interface WhiteCardProps {
  text: string;
  state?: WhiteCardState;
  onClick?: () => void;
  animate?: boolean;
  className?: string;
}

export function WhiteCard({ text, state = "idle", onClick, animate = false, className = "" }: WhiteCardProps) {
  const isWinner   = state === "winner";
  const isSelected = state === "selected";
  const isSelectable = !!onClick && state !== "submitted";

  const classes = [
    "card card-white",
    isSelectable ? "selectable" : "",
    isSelected   ? "selected" : "",
    isWinner     ? "anim-winner-glow anim-winner-float" : "",
    animate      ? "anim-deal" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={classes} onClick={isSelectable ? onClick : undefined}>
      <span className="card-text card-text-sm">{text}</span>
      <span className="card-logo">{t("app.title")}</span>
    </div>
  );
}
