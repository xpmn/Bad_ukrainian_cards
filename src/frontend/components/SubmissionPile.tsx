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

  if (!isHetman) {
    return (
      <div className="submission-pile">
        {submissions.map((s, i) => (
          <CardBack key={s.id} animate={i < 5} />
        ))}
      </div>
    );
  }

  return (
    <div className="submission-pile">
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
