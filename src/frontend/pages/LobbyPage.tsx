import { useEffect, useState } from "react";
import { t } from "@lib/i18n";
import { useLang } from "../hooks/useLang";
import { useGame, loadSession, saveSession } from "../services/gameStore";
import { ToastContainer } from "../components/Toast";
import { PlayerList } from "../components/PlayerList";
import GameSettingsPanel from "../components/GameSettings";
import type { GameSettings } from "@lib/types";

interface LobbyPageProps {
  roomId: string;
}

export default function LobbyPage({ roomId }: LobbyPageProps) {
  useLang();
  const { state, connect, disconnect, sendEvent, addToast } = useGame();
  const { room, myPlayer, connectionState } = state;

  const [copied, setCopied]           = useState(false);
  const [editSettings, setEditSettings] = useState(false);
  const [draftSettings, setDraftSettings] = useState<GameSettings | null>(null);
  const [startError, setStartError]   = useState("");

  // ── Connect on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    const session = loadSession();
    if (session && session.roomId === roomId) {
      connect(session.roomId, session.token);
    } else {
      // No session for this room — go home
      window.location.hash = "#/";
    }

    return () => {
      // Don't disconnect on unmount when navigating to game page
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ── Listen to server events for toasts ─────────────────────────────────────
  useEffect(() => {
    if (!room || !myPlayer) return;
    // Current room is in game phase → redirect
    if (room.phase !== "lobby") {
      window.location.hash = `#/game/${roomId}`;
    }
  }, [room, myPlayer, roomId]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function handleCopyLink() {
    const url = `${window.location.origin}${window.location.pathname}#/lobby/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast(t("toast.link_copied"), "success");
    });
  }

  function handleStartGame() {
    setStartError("");
    if (!room) return;
    if (room.players.length < 3) {
      setStartError(t("lobby.min_players"));
      return;
    }
    sendEvent("start_game");
  }

  function handleAddBot() {
    sendEvent("add_bot");
  }

  function handleSaveSettings() {
    if (!draftSettings) return;
    sendEvent("update_settings", { settings: draftSettings });
    setEditSettings(false);
    addToast(t("toast.settings_updated"), "info");
  }

  function publicSettingsToFull(s: Omit<GameSettings, "password"> & { hasPassword: boolean }): GameSettings {
    return { ...s, password: s.hasPassword ? "" : null };
  }

  function handleOpenSettings() {
    if (room) setDraftSettings(publicSettingsToFull(room.settings));
    setEditSettings(true);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const isHost = !!(room && myPlayer && room.hostId === myPlayer.id);
  const canStart = !!(room && room.players.length >= 3);

  const showReconnecting = connectionState === "reconnecting" || connectionState === "connecting";

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

      <div className="lobby-page">
        {/* Header */}
        <div className="lobby-header">
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>{t("lobby.title")}</h1>
            <p className="text-muted text-sm" style={{ marginTop: 4 }}>{t("lobby.waiting")}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="room-code-badge" role="status" aria-label={`${t("lobby.room_code")}: ${room?.id ?? roomId}`}>{room?.id ?? roomId}</div>
            <button className="btn btn-secondary btn-sm" onClick={handleCopyLink} aria-label={copied ? t("lobby.copied") : t("lobby.copy_link")}>
              {copied ? t("lobby.copied") : t("lobby.copy_link")}
            </button>
          </div>
        </div>

        <div className="lobby-grid">
          {/* Left: players + actions */}
          <div>
            {/* Player list */}
            <div className="lobby-section">
              <div className="lobby-section-title">{t("lobby.players")}</div>
              {room ? (
                <PlayerList
                  players={room.players}
                  myPlayerId={myPlayer?.id ?? ""}
                  hostId={room.hostId}
                  hetmanId={room.hetmanId}
                  phase={room.phase}
                  isHost={isHost}
                />
              ) : (
                <div className="anim-pulse text-muted text-sm">{t("misc.loading")}</div>
              )}
            </div>

            {/* Host actions */}
            {isHost && (
              <div className="lobby-section">
                <div className="lobby-actions">
                  {room && room.players.length < 10 && (
                    <button className="btn btn-secondary" onClick={handleAddBot}>
                      + {t("lobby.add_bot")}
                    </button>
                  )}
                  {startError && <p className="field-error">{startError}</p>}
                  <button
                    className="btn btn-primary btn-lg"
                    disabled={!canStart}
                    onClick={handleStartGame}
                  >
                    {t("lobby.start_game")}
                  </button>
                  {!canStart && (
                    <p className="text-muted text-sm">{t("lobby.min_players")}</p>
                  )}
                </div>
              </div>
            )}

            {!isHost && (
              <div className="lobby-section">
                <p className="text-muted text-sm anim-pulse">{t("lobby.waiting")}</p>
              </div>
            )}
          </div>

          {/* Right: settings */}
          <div>
            <div className="lobby-section">
              <div className="lobby-section-title">{t("lobby.settings")}</div>
              {editSettings && draftSettings ? (
                <>
                  <GameSettingsPanel
                    settings={draftSettings}
                    onChange={setDraftSettings}
                    editable
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button className="btn btn-primary btn-sm" onClick={handleSaveSettings}>
                      {t("misc.confirm")}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditSettings(false)}>
                      {t("misc.cancel")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {room && (
                    <GameSettingsPanel
                      settings={publicSettingsToFull(room.settings)}
                      editable={false}
                    />
                  )}
                  {isHost && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: 12 }}
                      onClick={handleOpenSettings}
                    >
                      {t("lobby.edit_settings")}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Leave */}
        <div style={{ marginTop: 32 }}>
          <button
            className="btn btn-ghost text-muted"
            onClick={() => { disconnect(); window.location.hash = "#/"; }}
          >
            ← {t("misc.back")}
          </button>
        </div>
      </div>
    </>
  );
}

