import { useEffect, useRef, useState } from "react";

type Props = {
  code: string;
  onDone: () => void;
};

/** 復旧コードを一度だけ見せる。控えたことを確認するまで閉じられない */
export function RecoveryCodeDialog({ code, onDone }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="dialog dialog-narrow"
      // Esc で閉じて控え忘れることがないようにする
      onCancel={(e) => e.preventDefault()}
    >
      <div className="dialog-body">
        <div className="dialog-head">
          <h2>復旧コードを控えてください</h2>
        </div>
        <p className="settings-note">
          パスワードを忘れたときは、ユーザー名とこのコードで新しいパスワードを設定できます。
          <strong>このコードは今しか表示されません。</strong>
          パスワードマネージャーやメモに保存してください。
        </p>
        <div className="recovery-code">
          <code>{code}</code>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
            {copied ? "コピーしました" : "コピー"}
          </button>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          控えました
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary" disabled={!saved} onClick={onDone}>
            続ける
          </button>
        </div>
      </div>
    </dialog>
  );
}
