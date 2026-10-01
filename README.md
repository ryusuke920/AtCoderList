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
  反復回数は 2 万回に抑えている（5 万回は M 系 Mac で約 6ms だったが、本番の Workers では CPU 11〜28ms と上限を超えた）。その分を以下で補っている:
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

- `problems.score`: 配点。AtCoder から自動取得するか手入力（古いコンテストなど配点がない問題は NULL）。
- `atcoder_contests` / `atcoder_tasks`: AtCoder から取得した問題一覧・配点のキャッシュ。

詳細は `migrations/`（0001 は GitHub OAuth 版の初期スキーマ、0002 でパスワード認証に、0003 で AtCoder 連携を追加）。

## AtCoder からの自動入力

追加フォームの「AtCoder から入力」でコンテスト名や ID を打つと候補が出る（ABC/ARC/AGC/AHC/企業コンなど、アーカイブにある全コンテスト）。選んで問題を押すと URL・問題名・配点が入る。

- AtCoder に公式 API はないため、公開ページ（コンテストアーカイブ・問題一覧・各問題ページ）の HTML を読んでいる。robots.txt で禁止されていないページのみ
- **AtCoder は Cloudflare からのアクセスを 403 で拒否する**ため、Worker からは取得しない。手元の Mac で `scripts/sync-atcoder.ts` を実行して本番 D1 に書き込み、Worker はそれを返すだけ
- Mac の launchd で毎朝 7:00 に自動実行する。1 回あたり最大 300 アクセス（3 秒間隔、約 15 分）で、次の順に進める
  1. アーカイブ 1 ページ目（直近約 50 回）の問題一覧・配点
  2. アーカイブ 2 ページ目以降のコンテスト一覧（約 1,450 回。初回のみ）
  3. 過去回の問題一覧（新しい順）
  4. 過去回の配点（新しい順）
- 過去回の問題一覧はおよそ 1 週間、配点はおよそ 1 ヶ月でそろう見込み。進捗は実行ログの最後に出る
- 問題一覧がまだのコンテストは候補に「問題取り込み待ち」と出る。急ぐときは手動で取り込む
- 問題文は AtCoder の著作物なので取得・保存しない
- Difficulty は AtCoder Problems 独自の推定値で AtCoder 公式には存在しないため、自動入力しない

```sh
npm run atcoder:sync                # 毎朝の取り込みと同じ
npm run atcoder:sync -- --all       # 上限なしで最後まで取り込む（5 秒間隔。過去分の一括取り込み用）
npm run atcoder:sync abc400 arc190  # 指定したコンテストの問題一覧と配点を取り込む（ID は大文字小文字を区別）
```

### 自動実行（launchd）

```sh
# インストール
cp scripts/launchd/com.ryusuke920.atcoder-list-sync.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ryusuke920.atcoder-list-sync.plist

# 今すぐ 1 回実行 / ログ確認
launchctl kickstart gui/$(id -u)/com.ryusuke920.atcoder-list-sync
cat ~/Library/Logs/atcoder-list-sync.log

# アンインストール
launchctl bootout gui/$(id -u)/com.ryusuke920.atcoder-list-sync
rm ~/Library/LaunchAgents/com.ryusuke920.atcoder-list-sync.plist
```

- 初回実行時に macOS が「node が"書類"フォルダへのアクセスを求めています」と聞いてくるので許可する
- Mac がスリープ中だった場合は起きたときに実行される。電源オフだった日はスキップ
- `wrangler login` の認証を使うので、ログインが切れていると失敗する（ログに出る）

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
