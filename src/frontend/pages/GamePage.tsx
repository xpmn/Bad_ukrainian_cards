import { useEffect, useState, useCallback, useRef, useMemo, type KeyboardEvent } from "react";
import { t } from "@lib/i18n";
import { useLang } from "../hooks/useLang";
import { useGame, loadSession } from "../services/gameStore";
import { ToastContainer } from "../components/Toast";
import { PlayerList } from "../components/PlayerList";
import { ScoreBoard } from "../components/ScoreBoard";
import { BlackCard } from "../components/Card/BlackCard";
import { WhiteCard } from "../components/Card/WhiteCard";
import { JudgingPile, RevealPile } from "../components/SubmissionPile";

// ── Fan layout helpers ─────────────────────────────────────────────────────────

/** Compute per-card rotation + translate for a fan arc */
function fanTransform(index: number, total: number): { rotate: string; translateX: string; translateY: string } {
  if (total <= 1) return { rotate: "0deg", translateX: "-50%", translateY: "0px" };
  const maxSpread = Math.min(2, 20 / total); // very subtle rotation
  const mid = (total - 1) / 2;
  const angle = (index - mid) * maxSpread;
  // Wider horizontal spacing so card text is more readable
  const xShift = (index - mid) * Math.min(80, 800 / total);
  // Parabolic vertical drop: edges sit lower than centre
  const distFromMid = Math.abs(index - mid) / (mid || 1);
  const yDrop = distFromMid * distFromMid * 40; // up to 40px drop at edges
  return {
    rotate: `${angle}deg`,
    translateX: `calc(-50% + ${xShift}px)`,
    translateY: `${yDrop}px`,
  };
}

// ── GamePage ───────────────────────────────────────────────────────────────────

interface GamePageProps {
  roomId: string;
}

export default function GamePage({ roomId }: GamePageProps) {
  useLang();
  const { state, connect, disconnect, selectCard, submitSelectedCard, selectWinner, pickBlackCard, addToast, sendEvent } = useGame();
  const { room, myPlayer, myHand, connectionState, selectedCard, lastRoundWinnerId, blackCardChoices } = state;

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  /** Index of the keyboard-focused card in the fan (-1 = none) */
  const [focusedIdx, setFocusedIdx] = useState(-1);
  /** Selected black card choice during hetmanPicking phase */
  const [selectedBlackCard, setSelectedBlackCard] = useState<string | null>(null);

  // ── Connect on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    const session = loadSession();
    if (session && session.roomId === roomId) {
      connect(session.roomId, session.token);
    } else {
      window.location.hash = "#/";
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Reset selected submission when phase changes
  useEffect(() => {
    setSelectedSubmissionId(null);
    setSelectedBlackCard(null);
  }, [room?.phase]);

  // Reset fan focus when hand changes or phase changes
  useEffect(() => {
    setFocusedIdx(-1);
  }, [myHand.length, room?.phase]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const isHetman  = !!(room && myPlayer && room.hetmanId === myPlayer.id);
  const isHost    = !!(room && myPlayer && room.hostId  === myPlayer.id);
  const players   = room?.players ?? [];
  const phase     = room?.phase ?? "lobby";

  const iSubmitted = myPlayer
    ? (room?.players.find(p => p.id === myPlayer.id)?.hasSubmitted ?? false)
    : false;

  const canInteractHand = !isHetman && !iSubmitted && phase === "submitting";

  const playerNames: Record<string, string> = {};
  players.forEach(p => { playerNames[p.id] = p.name; });

  const submittedCount = room?.players.filter(p => !p.isBot && p.id !== room.hetmanId && p.hasSubmitted).length ?? 0;
  const totalSubmitters = room?.players.filter(p => !p.isBot && p.id !== room?.hetmanId).length ?? 0;

  const showReconnecting = connectionState === "reconnecting" || connectionState === "connecting";

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const fanRef = useRef<HTMLDivElement>(null);

  // ── Fan card transforms (memoised) ───────────────────────────────────────────
  const fanStyles = useMemo(
    () => myHand.map((_c, i) => fanTransform(i, myHand.length)),
    [myHand.length],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────

  /** Keyboard handler on the fan container — arrows navigate, Enter activates/submits */
  /** Navigate to an index and immediately activate that card */
  function activateByIndex(idx: number) {
    setFocusedIdx(idx);
    const card = myHand[idx];
    if (card) selectCard(card);
  }

  function handleFanKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!canInteractHand || myHand.length === 0) return;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = focusedIdx < myHand.length - 1 ? focusedIdx + 1 : 0;
      activateByIndex(next);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = focusedIdx > 0 ? focusedIdx - 1 : myHand.length - 1;
      activateByIndex(next);
    } else if (e.key === "Home") {
      e.preventDefault();
      activateByIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      activateByIndex(myHand.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (selectedCard) submitSelectedCard();
    } else if (e.key === "Escape") {
      e.preventDefault();
      selectCard(null);
      setFocusedIdx(-1);
    }
  }

  function handleCardClick(card: string) {
    if (!canInteractHand) return;
    if (selectedCard === card) {
      selectCard(null);
      setFocusedIdx(-1);
    } else {
      const idx = myHand.indexOf(card);
      selectCard(card);
      setFocusedIdx(idx);
    }
  }

  function handleSubmit() {
    if (!selectedCard) return;
    submitSelectedCard();
  }

  function handlePickWinner() {
    if (!selectedSubmissionId) return;
    selectWinner(selectedSubmissionId);
    setSelectedSubmissionId(null);
  }

  function handleLeave() {
    disconnect();
    window.location.hash = "#/";
  }

  function handlePickBlackCard() {
    if (!selectedBlackCard) return;
    pickBlackCard(selectedBlackCard);
    setSelectedBlackCard(null);
  }

  function handlePlayAgain() {
    if (isHost) {
      // window.location.hash = `#/lobby/${roomId}`;
    } else {
      window.location.hash = "#/";
    }
  }

  // ── GAME OVER ────────────────────────────────────────────────────────────────

  if (phase === "gameOver") {
    const winner = players.reduce((a, b) => a.points >= b.points ? a : b, players[0] ?? { name: "?", points: 0, id: "", isBot: false, isConnected: true, isHost: false, hasSubmitted: false });

    return (
      <>
        <ToastContainer />
        <div className="game-over-screen anim-zoom-in" style={{ minHeight: "100vh", justifyContent: "center" }}>
          <h1 style={{ fontSize: "clamp(2rem,5vw,3rem)", fontWeight: 900 }}>
            {t("game.game_over")}
          </h1>
          <p className="text-muted">{t("game.winner_overall")}</p>
          <div style={{ background: "var(--c-bg-surface)", border: "2px solid var(--c-accent)", borderRadius: "var(--radius-md)", padding: "24px 40px", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 900 }}>{winner.name}</div>
            <div className="text-accent" style={{ fontSize: "1.1rem", marginTop: 4 }}>
              {winner.points} {t("game.points")}
            </div>
          </div>

          <ScoreBoard players={players} myPlayerId={myPlayer?.id} title={t("game.final_scores")} />

          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            {/* <button className="btn btn-primary btn-lg" onClick={handlePlayAgain}>
              {isHost ? t("game.play_again") : t("misc.back")}
            </button> */}
            <button className="btn btn-ghost" onClick={handleLeave}>{t("game.leave")}</button>
          </div>
        </div>
      </>
    );
  }

  // ── MAIN GAME LAYOUT ──────────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer />

      {/* Reconnecting overlay */}
      {showReconnecting && (
        <div className="conn-overlay">
          <div className="conn-overlay-inner">
            <div className="spinner" />
            <p style={{ marginTop: 16 }}>{t("conn.reconnecting")}</p>
          </div>
        </div>
      )}

      <div className="game-page">
        {/* ── Header (full-width navbar, constrained content) ── */}
        <header className="game-header" role="banner">
          <div className="game-header-inner">
            <div className="game-header-info">
              <span className="game-header-title">{t("app.title")}</span>
              <span className="game-round-badge">
                {t("game.round")} {room?.currentRound ?? 1} {t("game.of")} {room?.settings.maxRounds ?? 10}
              </span>
            </div>

            <div className="game-header-center">
              <PhaseLabel phase={phase} isHetman={isHetman} />
              {room?.submissionDeadline && phase === "submitting" && (
                <HeaderCountdown
                  deadline={room.submissionDeadline}
                  totalSec={room.settings.submissionTimeLimitSec ?? 60}
                />
              )}
            </div>

            <div className="game-header-right">
              <button className="btn btn-ghost btn-sm text-muted" onClick={handleLeave} aria-label={t("game.leave")}>
                {t("game.leave")}
              </button>
            </div>
          </div>
        </header>

        {/* ── Body: table + sidebar ── */}
        <div className="game-body">
          {/* ── Table (main play area) ── */}
          <main className="game-table" role="main">
            {/* Dealing / loading */}
            {(phase === "dealing" || phase === "lobby" || !room) && (
              <div className="center-page" style={{ minHeight: "unset" }}>
                <div className="spinner" />
                <p className="text-muted text-sm" style={{ marginTop: 12 }}>{t("phase.dealing")}</p>
              </div>
            )}

            {/* Hetman picking black card */}
            {phase === "hetmanPicking" && room && myPlayer && (
              <div style={{ width: "100%", textAlign: "center" }}>
                {isHetman ? (
                  <>
                    <p className="text-accent text-bold" style={{ marginBottom: 16, fontSize: "1.1rem" }}>
                      {t("game.pick_black_card")}
                    </p>
                    <div className="black-card-choices">
                      {blackCardChoices.map((card) => (
                        <div
                          key={card}
                          className={`black-card-choice${selectedBlackCard === card ? " black-card-choice--selected" : ""}`}
                          onClick={() => setSelectedBlackCard(selectedBlackCard === card ? null : card)}
                        >
                          <BlackCard text={card} animate />
                        </div>
                      ))}
                    </div>
                    {selectedBlackCard && (
                      <div style={{ marginTop: 16 }}>
                        <button className="btn btn-primary btn-lg" onClick={handlePickBlackCard}>
                          {t("game.confirm_black_card")}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="center-page" style={{ minHeight: "unset" }}>
                    <div className="spinner" />
                    <p className="text-muted" style={{ marginTop: 12 }}>{t("game.hetman_picking")}</p>
                  </div>
                )}
              </div>
            )}

            {/* Black card + submit action */}
            {room?.currentBlackCard && (
              <div className="game-table-center">
                <BlackCard text={room.currentBlackCard} animate />

                {/* Submit button appears below black card when a card is active */}
                {canInteractHand && selectedCard && (
                  <div className="game-submit-action">
                    <button className="btn btn-primary btn-lg" onClick={handleSubmit}>
                      {t("game.submit")}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => selectCard(null)}>
                      {t("game.cancel")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Submitting status */}
            {phase === "submitting" && (
              <div style={{ textAlign: "center" }}>
                {isHetman ? (
                  <p className="text-muted">{t("game.you_are_hetman")}</p>
                ) : iSubmitted ? (
                  <p className="text-muted anim-pulse">{t("game.you_submitted")}</p>
                ) : (
                  <p className="text-accent text-bold">{t("game.your_turn")}</p>
                )}
                <p className="text-muted text-sm" style={{ marginTop: 4 }}>
                  {t("game.submitted_count", undefined, { count: String(submittedCount), total: String(totalSubmitters) })}
                </p>
                {room?.submissionDeadline && (
                  <CountdownTimer
                    deadline={room.submissionDeadline}
                    totalSec={room.settings.submissionTimeLimitSec ?? 60}
                  />
                )}
              </div>
            )}

            {/* Judging phase */}
            {phase === "judging" && room && myPlayer && (
              <div style={{ width: "100%" }}>
                {isHetman ? (
                  <p className="text-accent text-bold text-center" style={{ marginBottom: 12 }}>
                    {t("game.pick_winner")}
                  </p>
                ) : (
                  <p className="text-muted text-center">{t("game.waiting_hetman")}</p>
                )}

                <JudgingPile
                  submissions={room.submissions}
                  onSelect={id => setSelectedSubmissionId(id)}
                  isHetman={isHetman}
                  selectedId={selectedSubmissionId ?? undefined}
                />

                {isHetman && selectedSubmissionId && (
                  <div style={{ textAlign: "center", marginTop: 16 }}>
                    <button className="btn btn-primary btn-lg" onClick={handlePickWinner}>
                      {t("game.pick_winner")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Reveal phase */}
            {(phase === "reveal" || phase === "roundEnd") && room && myPlayer && (
              <div style={{ width: "100%", textAlign: "center" }}>
                <p className="phase-title">{t("game.winner_round")}</p>
                <RevealPile
                  revealed={room.revealedSubmissions}
                  playerNames={playerNames}
                  myPlayerId={myPlayer.id}
                />
                {phase === "roundEnd" && (
                  <div style={{ marginTop: 24 }}>
                    <ScoreBoard players={players} myPlayerId={myPlayer.id} title={t("game.scores")} />
                  </div>
                )}
              </div>
            )}
          </main>

          {/* ── Sidebar: player list ── */}
          <aside className="game-sidebar" role="complementary" aria-label={t("lobby.players")}>
            <div className="game-sidebar-title">{t("lobby.players")}</div>
            <PlayerList
              players={players}
              myPlayerId={myPlayer?.id ?? ""}
              hostId={room?.hostId ?? ""}
              hetmanId={room?.hetmanId ?? null}
              phase={phase}
              isHost={isHost}
              lastRoundWinnerId={lastRoundWinnerId}
            />
          </aside>
        </div>

        {/* ── Fan hand area ── */}
        {!isHetman && (
          <div className="game-hand-area">
            {myHand.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                <p className="text-muted text-sm anim-pulse">{t("misc.loading")}</p>
              </div>
            ) : (
              <>
                {/* Desktop arrow hints */}
                {canInteractHand && (
                  <div className="fan-arrow fan-arrow-left" aria-hidden="true">◀</div>
                )}
                <div
                  ref={fanRef}
                  className="fan-hand"
                  role="group"
                  aria-label={t("game.your_hand")}
                  tabIndex={canInteractHand ? 0 : undefined}
                  onKeyDown={canInteractHand ? handleFanKeyDown : undefined}
                >
                  {myHand.map((card, i) => {
                  const { rotate, translateX, translateY } = fanStyles[i] ?? { rotate: "0deg", translateX: "-50%", translateY: "0px" };
                  const isActive  = selectedCard === card;
                  const isFocused = focusedIdx === i;

                  const wrapperClass = [
                    "fan-card-wrapper",
                    isFocused ? "fan-focused" : "",
                    isActive  ? "fan-active"  : "",
                  ].filter(Boolean).join(" ");

                  // z-index: left-to-right sequential, bump for focused/active
                  const total = myHand.length;
                  let zIdx = i + 1;
                  if (isFocused) zIdx = total + 1;
                  if (isActive) zIdx = total + 2;

                  return (
                    <div
                      key={`${card}-${i}`}
                      className={wrapperClass}
                      style={{
                        transform: `translateX(${translateX}) translateY(${isActive ? '-60px' : translateY}) rotate(${rotate})`,
                        zIndex: zIdx,
                      }}
                      onClick={() => handleCardClick(card)}
                      aria-label={card}
                    >
                      <WhiteCard
                        text={card}
                        state={
                          iSubmitted  ? "submitted" :
                          isActive    ? "selected"  : "idle"
                        }
                        className="fan-inner-card"
                        animate
                      />
                    </div>
                  );
                })}
                </div>
                {canInteractHand && (
                  <div className="fan-arrow fan-arrow-right" aria-hidden="true">▶</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Phase label helper ─────────────────────────────────────────────────────────

function PhaseLabel({ phase, isHetman }: { phase: string; isHetman: boolean }) {
  useLang();
  const key = `phase.${phase}` as Parameters<typeof t>[0];
  if (phase === "hetmanPicking" && isHetman) {
    return <span className="text-accent text-sm">{t("game.pick_black_card")}</span>;
  }
  if (phase === "submitting" && isHetman) {
    return <span className="text-warning text-sm">{t("game.you_are_hetman")}</span>;
  }
  return <span className="text-muted text-sm">{t(key)}</span>;
}

// ── Countdown timer ────────────────────────────────────────────────────────────

function useSecondsLeft(deadline: number): number {
  const getLeft = useCallback(
    () => Math.max(0, Math.round((deadline - Date.now()) / 1_000)),
    [deadline],
  );
  const [secondsLeft, setSecondsLeft] = useState(getLeft);

  useEffect(() => {
    setSecondsLeft(getLeft());
    const id = setInterval(() => {
      const left = getLeft();
      setSecondsLeft(left);
      if (left === 0) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [deadline, getLeft]);

  return secondsLeft;
}

function CountdownTimer({ deadline, totalSec }: { deadline: number; totalSec: number }) {
  useLang();
  const secondsLeft = useSecondsLeft(deadline);
  const fraction    = totalSec > 0 ? secondsLeft / totalSec : 0;
  const isLow       = fraction <= 0.3;
  const color       = isLow ? "var(--c-error, #e05252)" : fraction <= 0.6 ? "var(--c-warning, #f0a500)" : "var(--c-accent)";

  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span
        style={{
          fontSize: "0.85rem",
          fontWeight: 700,
          color,
          transition: "color 0.3s",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {t("game.time_left", undefined, { n: String(secondsLeft) })}
      </span>
      <div
        style={{
          width: 160,
          height: 4,
          borderRadius: 2,
          background: "var(--c-bg-surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.round(fraction * 100)}%`,
            height: "100%",
            background: color,
            transition: "width 0.5s linear, background 0.3s",
          }}
        />
      </div>
    </div>
  );
}

/** Compact timer pill shown in the game header during submission phase. */
function HeaderCountdown({ deadline, totalSec }: { deadline: number; totalSec: number }) {
  useLang();
  const secondsLeft = useSecondsLeft(deadline);
  const fraction    = totalSec > 0 ? secondsLeft / totalSec : 0;
  const isLow       = fraction <= 0.3;
  const color       = isLow ? "var(--c-error, #e05252)" : fraction <= 0.6 ? "var(--c-warning, #f0a500)" : "var(--c-accent)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: 48,
          height: 3,
          borderRadius: 2,
          background: "var(--c-bg-surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.round(fraction * 100)}%`,
            height: "100%",
            background: color,
            transition: "width 0.5s linear, background 0.3s",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "0.8rem",
          fontWeight: 700,
          color,
          transition: "color 0.3s",
          fontVariantNumeric: "tabular-nums",
          minWidth: "3ch",
        }}
      >
        {secondsLeft}s
      </span>
    </div>
  );
}