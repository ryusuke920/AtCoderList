# AtCoder List v2

AtCoder の「解きたい問題」「復習したい問題」をストックしておける問題管理ツール。
2021 年に Heroku + MySQL + EJS で作った [旧版](https://github.com/ryusuke920/AtCoderList) を、無料で動かし続けられる構成で作り直したもの。

## 構成

| 役割 | 技術 | 備考 |
|---|---|---|
| ホスティング | Cloudflare Workers（Static Assets） | 無料枠: 10 万リクエスト/日。スリープしない |
| DB | Cloudflare D1（SQLite） | 無料枠: 5GB / 500 万行読み取り/日。放置しても停止されない |
| API | Hono | `worker/` |
| フロント | React 19 + Vite | `src/`。Worker と同じオリジンから配信 |
| 認証 | ユーザー名 + パスワード（PBKDF2 + ペッパー）、セッションは D1 | `worker/auth.ts`, `worker/password.ts` |

```
worker/      Hono API（/api/*, /auth/*）
src/         React SPA
shared/      フロント・Worker 共通の型 / 定数 / バリデーション
migrations/  D1 スキーマ
```

### なぜこの構成か

- **無料かつ放置しても止まらない**ことを最優先。Supabase / Neon は無料枠でも非アクティブ時に停止・休止があり、Render 無料枠はスリープする。Cloudflare は Workers + D1 ともに常時無料で動く。
- Workers 無料枠は **CPU 時間 10ms/リクエスト**。bcrypt はネイティブ実装が使えず重すぎるので、WebCrypto の PBKDF2-SHA256 を使う。
  反復回数は 5 万回（M 系 Mac で約 6ms。10 万回だと約 12ms で上限超え）に抑え、その分を以下で補っている:
  - **ペッパー**: Worker の Secret `PASSWORD_PEPPER` を HMAC 鍵としてパスワードに混ぜてから PBKDF2 にかける。DB だけ漏れても総当たりできない
  - **ログイン試行制限**: 5 回連続で失敗するとそのユーザーを 15 分ロック
  - 反復回数はハッシュ文字列に埋め込んでいるので、将来上げても既存ユーザーはそのままログインできる
- フロントと API を 1 つの Worker にまとめているので CORS 不要・デプロイ 1 コマンド。

## DB 設計

```
users ─┬─< sessions
       └─< problems ─< problem_tags
```

- `users`: ユーザー名は大文字小文字を区別せず一意（`COLLATE NOCASE`）。メールアドレスは旧版でも使っていなかったので持たない。
- `sessions`: Cookie にはランダムトークン、DB にはその SHA-256 のみ保存（DB が漏れてもセッションを乗っ取れない）。期限 30 日、毎日 Cron で掃除。
- `problems`: difficulty / status は**色ではなく列挙値**で保存（旧版は `rgb(...)` 文字列を保存していた）。`UNIQUE(user_id, url)` で同じ問題の二重登録を防止。
- `problem_tags`: 旧版の「1 問 1 ジャンル」を多対多に。

詳細は `migrations/0002_password_auth.sql`（0001 は GitHub OAuth 版の初期スキーマ）。

### 旧版からの主な改善点

- 他人の問題を編集・削除できてしまう問題（`WHERE id = ?` のみだった）を修正し、全クエリを `user_id` で絞る
- 全ユーザーの問題を取得してテンプレート側で絞っていたのを、SQL で絞るように
- CSRF 対策（Origin チェック + SameSite=Lax Cookie）
- 問題 URL を貼ると問題名を自動入力、タグ複数選択、メモ欄、検索・絞り込み、一覧からワンクリックで状態変更、Difficulty 分布バー、ダークモード、スマホ対応

## ローカル開発

```sh
npm install
cp .dev.vars.example .dev.vars    # ローカル用の PASSWORD_PEPPER
npm run db:migrate:local
npm run dev                       # http://localhost:5173 → 新規登録
```

## デプロイ手順（初回）

1. Cloudflare にログイン: `npx wrangler login`
2. D1 を作成し、`database_id` を `wrangler.jsonc` に書く: `npx wrangler d1 create atcoder-list`
3. ペッパーを Secret に登録（値は誰も知らなくてよい。**一度決めたら変えない**。変えると全員ログインできなくなる）
   ```sh
   openssl rand -base64 32 | npx wrangler secret put PASSWORD_PEPPER
   ```
4. スキーマ適用とデプロイ
   ```sh
   npm run db:migrate:remote
   npm run deploy
   ```

以降は `npm run deploy` だけ。スキーマを変えたら `migrations/` に SQL を追加して `npm run db:migrate:remote`。
