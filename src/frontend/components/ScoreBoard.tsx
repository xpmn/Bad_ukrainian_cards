import { t } from "@lib/i18n";
import { useLang } from "../hooks/useLang";
import type { PublicPlayer } from "@lib/types";

interface ScoreBoardProps {
  players: PublicPlayer[];
  myPlayerId?: string;
  title?: string;
}

export function ScoreBoard({ players, myPlayerId, title }: ScoreBoardProps) {
  useLang();

  const sorted = [...players].sort((a, b) => b.points - a.points);

  return (
    <div className="scoreboard">
      {title && (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--c-border)", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-muted)" }}>
          {title}
        </div>
      )}
      {sorted.map((p, i) => (
        <div
          key={p.id}
          className="scoreboard-row"
          style={p.id === myPlayerId ? { background: "rgba(230,57,70,.06)" } : undefined}
        >
          <span className="scoreboard-rank">{i + 1}.</span>
          <span className="scoreboard-name" style={{ opacity: p.isConnected ? 1 : 0.55 }}>
            {p.name}
            {p.id === myPlayerId && <span style={{ color: "var(--c-text-muted)", fontSize: "0.75rem", marginLeft: 4 }}>({t("player.you")})</span>}
            {p.isBot && <span style={{ color: "var(--c-text-muted)", fontSize: "0.75rem", marginLeft: 4 }}>({t("player.bot")})</span>}
          </span>
          <span className="scoreboard-points">
            {p.points} {t("game.points")}
          </span>
        </div>
      ))}
    </div>
  );
}
