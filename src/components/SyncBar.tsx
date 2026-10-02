import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "../../shared/domain";
import { syncSubmissions } from "../submissionSync";

const AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;

type Props = {
  user: User;
  onUserChange: (user: User) => void;
  /** 状態が更新されたら一覧を読み直す */
  onUpdated: () => void;
  onOpenSettings: () => void;
};

const syncedAtMs = (user: User) => (user.submissionsSyncedAt ? Date.parse(`${user.submissionsSyncedAt.replace(" ", "T")}Z`) : 0);

const formatTime = (user: User) =>
  user.submissionsSyncedAt
    ? new Date(syncedAtMs(user)).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "まだ";

/** AtCoder の提出結果から状態を同期するバー。一覧を開いたときにも（10 分に 1 回まで）自動で同期する */
export function SyncBar({ user, onUserChange, onUpdated, onOpenSettings }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const autoTried = useRef<string | null>(null);

  const sync = useCallback(async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const { updated, user: next, more } = await syncSubmissions(user);
      onUserChange(next);
      if (updated > 0) onUpdated();
      setMessage({
        text:
          (updated > 0 ? `${updated} 問の状態を更新しました` : "状態の変わった問題はありませんでした") +
          (more ? "（提出が多いため続きがあります。もう一度同期してください）" : ""),
      });
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true });
    } finally {
      setSyncing(false);
    }
  }, [user, onUserChange, onUpdated]);

  useEffect(() => {
    if (!user.atcoderId || autoTried.current === user.atcoderId) return;
    autoTried.current = user.atcoderId;
    if (Date.now() - syncedAtMs(user) > AUTO_SYNC_INTERVAL_MS) sync();
  }, [user, sync]);

  if (!user.atcoderId) {
    return (
      <div className="sync-bar">
        <span className="muted">AtCoder ID を設定すると、提出結果から状態を自動で更新できます</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenSettings}>
          設定する
        </button>
      </div>
    );
  }

  return (
    <div className="sync-bar">
      <span className="muted">
        AtCoder: <strong>{user.atcoderId}</strong> · 最終同期 {formatTime(user)}
      </span>
      {message && <span className={message.error ? "sync-error" : "sync-message"}>{message.text}</span>}
      <button type="button" className="btn btn-ghost btn-sm sync-button" onClick={sync} disabled={syncing}>
        {syncing ? "同期中…" : "↻ 同期"}
      </button>
    </div>
  );
}
