import { useEffect, useState } from "react";
import { useGame, type Toast as ToastItem } from "../services/gameStore";

export function ToastContainer() {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {useGame().state.toasts.map(t => <ToastEntry key={t.id} toast={t} />)}
    </div>
  );
}

function ToastEntry({ toast }: { toast: ToastItem }) {
  const { dismissToast } = useGame();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer  = setTimeout(() => setLeaving(true), 4600);
    const removeTimer = setTimeout(() => dismissToast(toast.id), 5100);
    return () => { clearTimeout(leaveTimer); clearTimeout(removeTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`toast toast-${toast.type} ${leaving ? "leaving" : ""}`}
      onClick={() => dismissToast(toast.id)}
      role="status"
    >
      {toast.message}
    </div>
  );
}

/** @deprecated use ToastContainer */
export function Toast() {
  return <ToastContainer />;
}
