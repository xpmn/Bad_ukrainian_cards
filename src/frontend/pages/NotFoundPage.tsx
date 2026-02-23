import { t } from "@lib/i18n";
import { useLang } from "../hooks/useLang";

export default function NotFoundPage() {
  useLang();
  return (
    <div className="center-page" style={{ gap: "var(--sp-lg)" }}>
      <h1 style={{ fontSize: "4rem", fontWeight: 900, opacity: 0.2 }}>404</h1>
      <p className="text-muted">{t("misc.back")}</p>
      <a href="#/" className="btn btn-secondary">{t("misc.back")}</a>
    </div>
  );
}
