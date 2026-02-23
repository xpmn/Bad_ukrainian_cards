import { t } from "@lib/i18n";
import { useLang } from "../hooks/useLang";
import type { GameSettings } from "@lib/types";

interface GameSettingsPanelProps {
  settings: GameSettings;
  onChange?: (s: GameSettings) => void;
  editable?: boolean;
}

export default function GameSettingsPanel({ settings, onChange, editable = false }: GameSettingsPanelProps) {
  useLang();

  function patch(partial: Partial<GameSettings>) {
    onChange?.({ ...settings, ...partial });
  }

  const timeLimitOptions: { label: string; value: number | null }[] = [
    { label: t("settings.time_limit.none"), value: null },
    { label: t("settings.time_limit.30"),  value: 30 },
    { label: t("settings.time_limit.60"),  value: 60 },
    { label: t("settings.time_limit.90"),  value: 90 },
    { label: t("settings.time_limit.120"), value: 120 },
  ];

  return (
    <div className="settings-panel">
      <h3>{t("settings.title")}</h3>

      {/* Max rounds */}
      <div className="field">
        <label>{t("settings.max_rounds")}</label>
        {editable ? (
          <input
            className="input"
            type="number"
            min={1}
            max={30}
            value={settings.maxRounds}
            onChange={e => patch({ maxRounds: Math.max(1, Math.min(30, Number(e.target.value))) })}
          />
        ) : (
          <span>{settings.maxRounds}</span>
        )}
      </div>

      {/* Time limit */}
      <div className="field">
        <label>{t("settings.time_limit")}</label>
        {editable ? (
          <select
            className="select"
            value={settings.submissionTimeLimitSec ?? "none"}
            onChange={e => {
              const v = e.target.value;
              patch({ submissionTimeLimitSec: v === "none" ? null : Number(v) });
            }}
          >
            {timeLimitOptions.map(o => (
              <option key={String(o.value)} value={o.value ?? "none"}>{o.label}</option>
            ))}
          </select>
        ) : (
          <span>{timeLimitOptions.find(o => o.value === settings.submissionTimeLimitSec)?.label}</span>
        )}
      </div>

      {/* Rotate hetman */}
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={settings.rotateHetman}
          disabled={!editable}
          onChange={e => patch({ rotateHetman: e.target.checked })}
        />
        {t("settings.rotate_hetman")}
      </label>

      {/* Password */}
      {editable && (
        <div className="field">
          <label>{t("settings.password")} <span className="text-muted text-xs">({t("misc.optional")})</span></label>
          <input
            className="input"
            type="password"
            placeholder={t("settings.password.hint")}
            value={settings.password ?? ""}
            onChange={e => patch({ password: e.target.value || null })}
          />
        </div>
      )}
    </div>
  );
}
