// White card — implemented in task 3.6
export type WhiteCardState = "idle" | "selected" | "submitted" | "winner";

interface WhiteCardProps {
  text: string;
  state?: WhiteCardState;
  onClick?: () => void;
}

export function WhiteCard({ text, state = "idle", onClick }: WhiteCardProps) {
  return (
    <div className={`white-card white-card--${state}`} onClick={onClick}>
      {text}
    </div>
  );
}
