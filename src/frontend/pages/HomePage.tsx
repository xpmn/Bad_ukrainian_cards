import { useState, type FormEvent } from "react";
import { t, setLang, getLang } from "@lib/i18n";
import { useLang } from "../hooks/useLang";
import { useGame } from "../services/gameStore";
import { saveSession } from "../services/gameStore";
import type { GameSettings } from "@lib/types";
import GameSettingsPanel from "../components/GameSettings";

// ── Default create settings ───────────────────────────────────────────────────

const DEFAULT_SETTINGS: GameSettings = {
  maxRounds:              10,
  submissionTimeLimitSec: null,
  allowCustomCards:       false,
  rotateHetman:           true,
  password:               null,
};

// ── HomePage ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  useLang(); // re-render on language change

  const { connect } = useGame();

  // Create form state
  const [createName, setCreateName]     = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings]         = useState<GameSettings>(DEFAULT_SETTINGS);
  const [createError, setCreateError]   = useState("");
  const [creating, setCreating]         = useState(false);

  // Join form state
  const [joinName, setJoinName]     = useState("");
  const [joinCode, setJoinCode]     = useState("");
  const [joinPass, setJoinPass]     = useState("");
  const [joinError, setJoinError]   = useState("");
  const [joining, setJoining]       = useState(false);

  // ── Create room ─────────────────────────────────────────────────────────────

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError("");

    if (!createName.trim()) {
      setCreateError(t("error.name_required"));
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: createName.trim(), settings }),
      });
      const data = await res.json() as { roomId?: string; token?: string; playerId?: string; error?: string };

      if (!res.ok || !data.roomId || !data.token || !data.playerId) {
        setCreateError(data.error ?? t("error.generic"));
        return;
      }

      saveSession(data.roomId, data.token, data.playerId);
      connect(data.roomId, data.token);
      window.location.hash = `#/lobby/${data.roomId}`;
    } catch {
      setCreateError(t("error.generic"));
    } finally {
      setCreating(false);
    }
  }

  // ── Join room ────────────────────────────────────────────────────────────────

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setJoinError("");

    if (!joinName.trim()) {
      setJoinError(t("error.name_required"));
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setJoinError(t("error.code_required"));
      return;
    }
    if (code.length !== 6) {
      setJoinError(t("error.code_length"));
      return;
    }

    setJoining(true);
    try {
      const body: Record<string, string> = { playerName: joinName.trim() };
      if (joinPass.trim()) body["password"] = joinPass.trim();

      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { roomId?: string; token?: string; playerId?: string; error?: string };

      if (!res.ok || !data.token || !data.playerId) {
        const errKey = mapJoinError(data.error ?? "");
        setJoinError(t(errKey as Parameters<typeof t>[0]));
        return;
      }

      const roomId = data.roomId ?? code;
      saveSession(roomId, data.token, data.playerId);
      connect(roomId, data.token);
      window.location.hash = `#/lobby/${roomId}`;
    } catch {
      setJoinError(t("error.generic"));
    } finally {
      setJoining(false);
    }
  }

  function mapJoinError(err: string): string {
    if (err === "ROOM_NOT_FOUND")      return "error.room_not_found";
    if (err === "WRONG_PASSWORD")      return "error.wrong_password";
    if (err === "GAME_ALREADY_STARTED") return "error.game_already_started";
    if (err === "ROOM_FULL")           return "error.room_full";
    return "error.generic";
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="home-page">
      {/* Language switcher */}
      <div style={{ position: "absolute", top: 16, right: 16 }}>
        <div className="lang-switcher">
          <button
            className={`btn btn-ghost btn-sm ${getLang() === "uk" ? "text-accent" : ""}`}
            onClick={() => setLang("uk")}
          >
            {t("app.lang.uk")}
          </button>
          <button
            className={`btn btn-ghost btn-sm ${getLang() === "en" ? "text-accent" : ""}`}
            onClick={() => setLang("en")}
          >
            {t("app.lang.en")}
          </button>
        </div>
      </div>

      {/* Logo */}
      <div className="home-logo anim-slide-up">
        <h1>{t("app.title")}</h1>
        <p>{t("home.hero")}</p>
      </div>

      {/* Forms */}
      <div className="home-forms anim-slide-up" style={{ animationDelay: "0.1s" }}>
        {/* Create room */}
        <form className="home-form-panel" onSubmit={handleCreate}>
          <h2>{t("home.create_room")}</h2>

          <div className="field">
            <label>{t("home.player_name")}</label>
            <input
              className="input"
              type="text"
              placeholder={t("home.player_name.hint")}
              value={createName}
              maxLength={24}
              onChange={e => setCreateName(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSettings(v => !v)}
          >
            {t("lobby.edit_settings")}
          </button>

          {showSettings && (
            <GameSettingsPanel
              settings={settings}
              onChange={setSettings}
              editable
            />
          )}

          {createError && <p className="field-error">{createError}</p>}

          <button type="submit" className="btn btn-primary btn-full" disabled={creating}>
            {creating ? t("misc.loading") : t("home.create")}
          </button>
        </form>

        {/* Join room */}
        <form className="home-form-panel" onSubmit={handleJoin}>
          <h2>{t("home.join_room")}</h2>

          <div className="field">
            <label>{t("home.player_name")}</label>
            <input
              className="input"
              type="text"
              placeholder={t("home.player_name.hint")}
              value={joinName}
              maxLength={24}
              onChange={e => setJoinName(e.target.value)}
            />
          </div>

          <div className="field">
            <label>{t("home.room_code")}</label>
            <input
              className="input"
              type="text"
              placeholder={t("home.room_code.hint")}
              value={joinCode}
              maxLength={6}
              style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace" }}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
            />
          </div>

          <div className="field">
            <label>{t("home.password")} <span className="text-muted text-xs">({t("misc.optional")})</span></label>
            <input
              className="input"
              type="password"
              placeholder={t("home.password.hint")}
              value={joinPass}
              onChange={e => setJoinPass(e.target.value)}
            />
          </div>

          {joinError && <p className="field-error">{joinError}</p>}

          <button type="submit" className="btn btn-primary btn-full" disabled={joining}>
            {joining ? t("misc.loading") : t("home.join")}
          </button>
        </form>
      </div>
    </div>
  );
}

