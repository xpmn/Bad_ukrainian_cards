import { useCallback, useRef, type KeyboardEvent } from "react";
import { t } from "@lib/i18n";
import { useLang } from "../hooks/useLang";
import { WhiteCard } from "./Card/WhiteCard";
import { CardBack } from "./Card/CardBack";
import type { AnonymousSubmission, Submission } from "@lib/types";

// ── During judging: anonymous submissions for the Hetman to pick ─────────────

interface JudgingPileProps {
  submissions: AnonymousSubmission[];
  onSelect: (id: string) => void;
  isHetman: boolean;
  selectedId?: string;
}

export function JudgingPile({ submissions, onSelect, isHetman, selectedId }: JudgingPileProps) {
  useLang();
  const pileRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!isHetman) return;
    const cards = pileRef.current?.querySelectorAll<HTMLElement>("[role='button']");
    if (!cards || cards.length === 0) return;

    const focusedIdx = Array.from(cards).findIndex(c => c === document.activeElement);

    let nextIdx = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIdx = focusedIdx < cards.length - 1 ? focusedIdx + 1 : 0;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIdx = focusedIdx > 0 ? focusedIdx - 1 : cards.length - 1;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIdx = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIdx = cards.length - 1;
    }

    if (nextIdx >= 0) cards[nextIdx]?.focus();
  }, [isHetman]);

  if (!isHetman) {
    return (
      <div className="submission-pile" role="status" aria-label={t("game.waiting_hetman")}>
        {submissions.map((s, i) => (
          <CardBack key={s.id} animate={i < 5} />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={pileRef}
      className="submission-pile"
      role="group"
      aria-label={t("game.pick_winner")}
      onKeyDown={handleKeyDown}
    >
      {submissions.map(s => (
        <WhiteCard
          key={s.id}
          text={s.card}
          state={selectedId === s.id ? "selected" : "idle"}
          onClick={() => onSelect(s.id)}
          animate
        />
      ))}
    </div>
  );
}

// ── During reveal: show the winning card ─────────────────────────────────────

interface RevealPileProps {
  revealed: Submission[];
  playerNames: Record<string, string>;
  myPlayerId: string;
}

export function RevealPile({ revealed, playerNames, myPlayerId }: RevealPileProps) {
  useLang();

  return (
    <div className="submission-pile">
      {revealed.map(s => (
        <div key={s.anonymousId} className="submission-card-wrapper">
          <WhiteCard
            text={s.card}
            state="winner"
            animate
          />
          <div style={{ textAlign: "center", marginTop: 8, fontSize: "0.8rem", color: "var(--c-text-muted)" }}>
            {playerNames[s.playerId] ?? "?"}
            {s.playerId === myPlayerId && (
              <span style={{ color: "var(--c-accent)", marginLeft: 4 }}>({t("player.you")})</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** @deprecated use JudgingPile or RevealPile */
export function SubmissionPile() {
  return null;
}
