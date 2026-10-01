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
| 認証 | GitHub OAuth + 自前セッション（D1） | パスワードを保存しない |

```
worker/      Hono API（/api/*, /auth/*）
src/         React SPA
shared/      フロント・Worker 共通の型 / 定数 / バリデーション
migrations/  D1 スキーマ
```

### なぜこの構成か

- **無料かつ放置しても止まらない**ことを最優先。Supabase / Neon は無料枠でも非アクティブ時に停止・休止があり、Render 無料枠はスリープする。Cloudflare は Workers + D1 ともに常時無料で動く。
- Workers 無料枠は **CPU 時間 10ms/リクエスト**。bcrypt / PBKDF2 によるパスワードハッシュはこれを超えやすいので、パスワード認証をやめて GitHub OAuth にした（競プロ勢はほぼ GitHub アカウントを持っている）。
- フロントと API を 1 つの Worker にまとめているので CORS 不要・デプロイ 1 コマンド。

## DB 設計

```
users ─┬─< sessions
       └─< problems ─< problem_tags
```

- `users`: GitHub ID と 1:1。
- `sessions`: Cookie にはランダムトークン、DB にはその SHA-256 のみ保存（DB が漏れてもセッションを乗っ取れない）。期限 30 日、毎日 Cron で掃除。
- `problems`: difficulty / status は**色ではなく列挙値**で保存（旧版は `rgb(...)` 文字列を保存していた）。`UNIQUE(user_id, url)` で同じ問題の二重登録を防止。
- `problem_tags`: 旧版の「1 問 1 ジャンル」を多対多に。

詳細は `migrations/0001_init.sql`。

### 旧版からの主な改善点

- 他人の問題を編集・削除できてしまう問題（`WHERE id = ?` のみだった）を修正し、全クエリを `user_id` で絞る
- 全ユーザーの問題を取得してテンプレート側で絞っていたのを、SQL で絞るように
- CSRF 対策（Origin チェック + SameSite=Lax Cookie）
- 問題 URL を貼ると問題名を自動入力、タグ複数選択、メモ欄、検索・絞り込み、一覧からワンクリックで状態変更、Difficulty 分布バー、ダークモード、スマホ対応

## ローカル開発

```sh
npm install
cp .dev.vars.example .dev.vars    # DEV_LOGIN=true で GitHub なしでログインできる
npm run db:migrate:local
npm run dev                       # http://localhost:5173 → 「開発用ログイン」
```

## デプロイ手順（初回）

1. Cloudflare アカウントを作成（無料）し、ログイン
   ```sh
   npx wrangler login
   ```
2. D1 データベースを作成し、出力された `database_id` を `wrangler.jsonc` に書き込む
   ```sh
   npx wrangler d1 create atcoder-list
   ```
3. 本番 DB にスキーマを適用
   ```sh
   npm run db:migrate:remote
   ```
4. 一度デプロイして URL（`https://atcoder-list.<subdomain>.workers.dev`）を確定させる
   ```sh
   npm run deploy
   ```
5. GitHub で OAuth App を作成（Settings → Developer settings → OAuth Apps → New）
   - Homepage URL: 上の URL
   - Authorization callback URL: `<上の URL>/auth/github/callback`
6. Client ID / Secret を Worker の Secret に登録
   ```sh
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   ```

以降は `npm run deploy` だけ。スキーマを変えたら `migrations/` に SQL を追加して `npm run db:migrate:remote`。
