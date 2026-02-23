import { useEffect, useState } from "react";
import { t } from "@lib/i18n";
import { useLang } from "../hooks/useLang";
import { useGame, loadSession } from "../services/gameStore";
import { ToastContainer } from "../components/Toast";
import { PlayerList } from "../components/PlayerList";
import { ScoreBoard } from "../components/ScoreBoard";
import { BlackCard } from "../components/Card/BlackCard";
import { WhiteCard } from "../components/Card/WhiteCard";
import { JudgingPile, RevealPile } from "../components/SubmissionPile";

// ── GamePage ───────────────────────────────────────────────────────────────────

interface GamePageProps {
  roomId: string;
}

export default function GamePage({ roomId }: GamePageProps) {
  useLang();
  const { state, connect, disconnect, selectCard, submitSelectedCard, selectWinner, addToast, sendEvent } = useGame();
  const { room, myPlayer, myHand, connectionState, selectedCard } = state;

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

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
  }, [room?.phase]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const isHetman  = !!(room && myPlayer && room.hetmanId === myPlayer.id);
  const isHost    = !!(room && myPlayer && room.hostId  === myPlayer.id);
  const players   = room?.players ?? [];
  const phase     = room?.phase ?? "lobby";

  const iSubmitted = myPlayer
    ? (room?.players.find(p => p.id === myPlayer.id)?.hasSubmitted ?? false)
    : false;

  const playerNames: Record<string, string> = {};
  players.forEach(p => { playerNames[p.id] = p.name; });

  const submittedCount = room?.players.filter(p => !p.isBot && p.id !== room.hetmanId && p.hasSubmitted).length ?? 0;
  const totalSubmitters = room?.players.filter(p => !p.isBot && p.id !== room?.hetmanId).length ?? 0;

  const showReconnecting = connectionState === "reconnecting" || connectionState === "connecting";

  // ── Handlers ─────────────────────────────────────────────────────────────────

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

  function handlePlayAgain() {
    if (isHost) {
      window.location.hash = `#/lobby/${roomId}`;
      // Host can start a new game from lobby — disconnect/reconnect is handled by lobby
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
            <button className="btn btn-primary btn-lg" onClick={handlePlayAgain}>
              {isHost ? t("game.play_again") : t("misc.back")}
            </button>
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
        {/* ── Header ── */}
        <header className="game-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 800, fontSize: "1rem" }}>{t("app.title")}</span>
            <span className="text-muted text-sm">
              {t("game.round")} {room?.currentRound ?? 1} {t("game.of")} {room?.settings.maxRounds ?? 10}
            </span>
          </div>

          <div style={{ flex: 1, textAlign: "center" }}>
            <PhaseLabel phase={phase} isHetman={isHetman} />
          </div>

          <button className="btn btn-ghost btn-sm text-muted" onClick={handleLeave}>
            {t("game.leave")}
          </button>
        </header>

        {/* ── Main area ── */}
        <main className="game-main">
          {/* Dealing / loading */}
          {(phase === "dealing" || phase === "lobby" || !room) && (
            <div className="center-page" style={{ minHeight: "unset" }}>
              <div className="spinner" />
              <p className="text-muted text-sm" style={{ marginTop: 12 }}>{t("phase.dealing")}</p>
            </div>
          )}

          {/* Black card */}
          {room?.currentBlackCard && (
            <BlackCard text={room.currentBlackCard} animate />
          )}

          {/* Submitting phase */}
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
        <aside className="game-sidebar">
          <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-muted)", marginBottom: 8 }}>
            {t("lobby.players")}
          </div>
          <PlayerList
            players={players}
            myPlayerId={myPlayer?.id ?? ""}
            hostId={room?.hostId ?? ""}
            hetmanId={room?.hetmanId ?? null}
            phase={phase}
            isHost={isHost}
          />
        </aside>

        {/* ── Hand ── */}
        {!isHetman && (
          <div className="game-hand">
            {myHand.length === 0 ? (
              <p className="text-muted text-sm text-center anim-pulse">{t("misc.loading")}</p>
            ) : (
              <>
                <div className="hand">
                  {myHand.map((card, i) => (
                    <WhiteCard
                      key={`${card}-${i}`}
                      text={card}
                      state={
                        iSubmitted       ? "submitted" :
                        selectedCard === card ? "selected"  : "idle"
                      }
                      onClick={
                        !iSubmitted && phase === "submitting"
                          ? () => selectCard(selectedCard === card ? null : card)
                          : undefined
                      }
                      animate
                    />
                  ))}
                </div>
                {phase === "submitting" && !iSubmitted && selectedCard && (
                  <div style={{ textAlign: "center", marginTop: 8 }}>
                    <button className="btn btn-primary" onClick={handleSubmit}>
                      {t("game.submit")}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => selectCard(null)}>
                      {t("game.cancel")}
                    </button>
                  </div>
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
  if (phase === "submitting" && isHetman) {
    return <span className="text-warning text-sm">{t("game.you_are_hetman")}</span>;
  }
  return <span className="text-muted text-sm">{t(key)}</span>;
}

