import { t } from "@lib/i18n";
import { useLang } from "../hooks/useLang";
import { useGame } from "../services/gameStore";
import type { PublicPlayer, GamePhase } from "@lib/types";

interface PlayerListProps {
  players: PublicPlayer[];
  myPlayerId: string;
  hostId: string;
  hetmanId: string | null;
  phase: GamePhase;
  isHost: boolean;
  lastRoundWinnerId?: string | null;
  onReplace?: (playerId: string) => void;
}

export function PlayerList({
  players,
  myPlayerId,
  hostId,
  hetmanId,
  phase,
  isHost,
  lastRoundWinnerId,
  onReplace,
}: PlayerListProps) {
  useLang();
  const { sendEvent } = useGame();

  function initials(name: string): string {
    return name.slice(0, 2).toUpperCase();
  }

  function handleReplace(playerId: string) {
    if (onReplace) {
      onReplace(playerId);
    } else {
      sendEvent("remove_player", { targetPlayerId: playerId });
    }
  }

  return (
    <div className="player-list">
      {players.map(p => {
        const isRoundWinner   = !!lastRoundWinnerId && p.id === lastRoundWinnerId && (phase === "reveal" || phase === "roundEnd");
        const didSubmit       = phase === "submitting" && p.hasSubmitted && p.id !== hetmanId;

        let rowBg = "transparent";
        if (isRoundWinner) rowBg = "rgba(230, 57, 70, 0.15)";
        else if (didSubmit) rowBg = "rgba(45, 198, 83, 0.08)";

        return (
        <div
          key={p.id}
          className="player-row"
          style={{
            background: rowBg,
            borderRadius: "var(--radius-sm)",
            transition: "background 0.3s",
            outline: isRoundWinner ? "1px solid rgba(230,57,70,0.5)" : "none",
          }}
        >
          <div
            className="player-avatar"
            style={{
              background: p.isConnected ? "#2a2a2a" : "#1a1a1a",
              opacity: p.isConnected ? 1 : 0.5,
            }}
          >
            {initials(p.name)}
          </div>

          <span className="player-name" style={{ opacity: p.isConnected ? 1 : 0.55 }}>
            {p.name}
          </span>

          {/* Badges */}
          <div className="flex gap-sm" style={{ flexShrink: 0 }}>
            {p.id === myPlayerId && (
              <span className="player-badge badge-you">{t("player.you")}</span>
            )}
            {p.id === hostId && (
              <span className="player-badge badge-host">{t("player.host")}</span>
            )}
            {p.id === hetmanId && phase !== "lobby" && (
              <span className="player-badge badge-hetman">{t("player.hetman")}</span>
            )}
            {p.isBot && (
              <span className="player-badge badge-bot">{t("player.bot")}</span>
            )}
            {!p.isConnected && !p.isBot && (
              <span className="player-badge badge-offline">{t("player.offline")}</span>
            )}
            {didSubmit && (
              <span className="player-badge badge-submitted">{t("player.submitted")}</span>
            )}
            {isRoundWinner && (
              <span className="player-badge" style={{ background: "var(--c-accent)", color: "#fff" }}>🏆</span>
            )}
          </div>

          {/* Host controls: replace non-self players with bot */}
          {isHost && p.id !== myPlayerId && (
            <button
              className="btn btn-ghost btn-sm"
              title={t("player.replace_with_bot")}
              aria-label={`${t("player.replace_with_bot")}: ${p.name}`}
              onClick={() => handleReplace(p.id)}
              style={{ marginLeft: 4, fontSize: "0.75rem", padding: "2px 6px" }}
            >
              🤖
            </button>
          )}

          {/* Points badge (non-lobby) */}
          {phase !== "lobby" && (
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: isRoundWinner ? "var(--c-accent)" : "#e63946", marginLeft: 4, flexShrink: 0 }}>
              {p.points}pts
            </span>
          )}
        </div>
        );
      })}
    </div>
  );
}
