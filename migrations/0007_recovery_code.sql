-- パスワードを忘れたときの復旧コード（HMAC-SHA256 のみ保存。コード自体は登録時・再発行時に一度だけ表示する）
ALTER TABLE users ADD COLUMN recovery_hash TEXT;
