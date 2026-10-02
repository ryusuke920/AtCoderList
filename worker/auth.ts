import { Hono, type Context, type MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { validateCredentials, type User } from "../shared/domain";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password";
import type { AppEnv } from "./types";

const SESSION_COOKIE = "session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30;
const MAX_FAILED_LOGINS = 5;
const LOCK_SEC = 15 * 60;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const now = () => Math.floor(Date.now() / 1000);

async function startSession(c: Context<AppEnv>, userId: number) {
  const token = randomToken();
  await c.env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), userId, now() + SESSION_TTL_SEC)
    .run();
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

const USER_COLUMNS = `u.id, u.username, u.atcoder_id AS atcoderId,
  u.submissions_cursor AS submissionsCursor, u.submissions_synced_at AS submissionsSyncedAt,
  u.recovery_hash IS NOT NULL AS hasRecoveryCode`;

type UserRow = Omit<User, "hasRecoveryCode"> & { hasRecoveryCode: number };
const toUser = (row: UserRow | null): User | null => row && { ...row, hasRecoveryCode: row.hasRecoveryCode === 1 };

export async function selectUser(db: D1Database, id: number): Promise<User | null> {
  return toUser(await db.prepare(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?`).bind(id).first<UserRow>());
}

// ---- 復旧コード ----
// 32 種類の紛らわしくない文字 × 20 桁 = 100 ビット。十分長いので PBKDF2 ではなく HMAC で保存する

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join("");
  return chars.match(/.{4}/g)!.join("-");
}

async function recoveryHash(code: string, pepper: string): Promise<string> {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`recovery:${normalized}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 新しい復旧コードを発行して保存し、コードを返す（古いコードは無効になる） */
async function issueRecoveryCode(c: Context<AppEnv>, userId: number): Promise<string> {
  const code = newRecoveryCode();
  await c.env.DB.prepare("UPDATE users SET recovery_hash = ? WHERE id = ?").bind(await recoveryHash(code, pepper(c)), userId).run();
  return code;
}

function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i % b.length);
  return diff === 0;
}

// ---- 失敗回数によるロック（ログイン・復旧・パスワード確認で共通） ----

type SecretRow = { id: number; password_hash: string; recovery_hash: string | null; locked_until: number };

const LOCKED_MESSAGE = "続けて失敗したため、しばらく時間をおいてから再度お試しください";

async function recordFailure(db: D1Database, userId: number) {
  // 連続失敗回数を数え、上限に達したら一定時間ロックする
  await db
    .prepare(
      `UPDATE users
          SET failed_logins = CASE WHEN failed_logins + 1 >= ?1 THEN 0 ELSE failed_logins + 1 END,
              locked_until  = CASE WHEN failed_logins + 1 >= ?1 THEN ?2 ELSE locked_until END
        WHERE id = ?3`,
    )
    .bind(MAX_FAILED_LOGINS, now() + LOCK_SEC, userId)
    .run();
}

const recordSuccess = (db: D1Database, userId: number) =>
  db.prepare("UPDATE users SET failed_logins = 0, locked_until = 0 WHERE id = ?").bind(userId).run();

const selectSecrets = (db: D1Database, where: "id" | "username", value: string | number) =>
  db
    .prepare(`SELECT id, password_hash, recovery_hash, locked_until FROM users WHERE ${where} = ?`)
    .bind(value)
    .first<SecretRow>();

function pepper(c: Context<AppEnv>): string {
  const value = c.env.PASSWORD_PEPPER;
  if (!value) throw new Error("PASSWORD_PEPPER が設定されていません");
  return value;
}

/** Cookie のセッションを検証して c.var.user をセットする（未ログインなら null） */
export const loadUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("user", null);
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const row = await c.env.DB.prepare(
      `SELECT ${USER_COLUMNS}
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > unixepoch()`,
    )
      .bind(await sha256(token))
      .first<UserRow>();
    c.set("user", toUser(row));
  }
  await next();
};

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.var.user) return c.json({ error: "ログインしてください" }, 401);
  await next();
};

export const authRoutes = new Hono<AppEnv>()
  .post("/signup", async (c) => {
    const cred = validateCredentials(await c.req.json().catch(() => null));
    if (!cred.ok) return c.json({ error: cred.error }, 400);

    const hash = await hashPassword(cred.password, pepper(c));
    const created = await c.env.DB.prepare(
      "INSERT INTO users (username, password_hash) VALUES (?, ?) ON CONFLICT (username) DO NOTHING RETURNING id",
    )
      .bind(cred.username, hash)
      .first<{ id: number }>();
    if (!created) return c.json({ error: "このユーザー名は既に使われています" }, 409);

    const recoveryCode = await issueRecoveryCode(c, created.id);
    await startSession(c, created.id);
    return c.json({ user: await selectUser(c.env.DB, created.id), recoveryCode }, 201);
  })
  .post("/login", async (c) => {
    const cred = validateCredentials(await c.req.json().catch(() => null));
    const invalid = () => c.json({ error: "ユーザー名またはパスワードが間違っています" }, 401);
    if (!cred.ok) return invalid();

    const db = c.env.DB;
    const row = await selectSecrets(db, "username", cred.username);
    if (row && row.locked_until > now()) return c.json({ error: LOCKED_MESSAGE }, 429);

    const ok = await verifyPassword(cred.password, row?.password_hash ?? DUMMY_HASH, pepper(c));
    if (!row || !ok) {
      if (row) await recordFailure(db, row.id);
      return invalid();
    }

    await recordSuccess(db, row.id);
    await startSession(c, row.id);
    return c.json({ user: await selectUser(db, row.id) });
  })
  // パスワードを忘れたとき: ユーザー名と復旧コードで新しいパスワードを設定する
  .post("/recover", async (c) => {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const cred = validateCredentials({ username: body?.username, password: body?.newPassword });
    if (!cred.ok) return c.json({ error: cred.error }, 400);
    const code = typeof body?.recoveryCode === "string" ? body.recoveryCode : "";
    const invalid = () => c.json({ error: "ユーザー名または復旧コードが間違っています" }, 401);

    const db = c.env.DB;
    const row = await selectSecrets(db, "username", cred.username);
    if (row && row.locked_until > now()) return c.json({ error: LOCKED_MESSAGE }, 429);
    const given = await recoveryHash(code, pepper(c));
    if (!row || !row.recovery_hash || !timingSafeEqual(given, row.recovery_hash)) {
      if (row) await recordFailure(db, row.id);
      return invalid();
    }

    // パスワードを変え、使ったコードは無効にして新しいコードを出す。ほかの端末のセッションも切る
    await db.batch([
      db.prepare("UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = 0 WHERE id = ?").bind(
        await hashPassword(cred.password, pepper(c)),
        row.id,
      ),
      db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(row.id),
    ]);
    const recoveryCode = await issueRecoveryCode(c, row.id);
    await startSession(c, row.id);
    return c.json({ user: await selectUser(db, row.id), recoveryCode });
  })
  .post("/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 204);
  });

/** ログイン中のユーザーのパスワードを確認する。間違いは失敗回数に数える */
async function confirmPassword(c: Context<AppEnv>): Promise<Response | null> {
  const body = (await c.req.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  const db = c.env.DB;
  const row = await selectSecrets(db, "id", c.var.user!.id);
  if (!row) return c.json({ error: "ユーザーが見つかりません" }, 404);
  if (row.locked_until > now()) return c.json({ error: LOCKED_MESSAGE }, 429);
  if (!(await verifyPassword(password, row.password_hash, pepper(c)))) {
    await recordFailure(db, row.id);
    return c.json({ error: "パスワードが間違っています" }, 401);
  }
  await recordSuccess(db, row.id);
  return null;
}

export const accountRoutes = new Hono<AppEnv>()
  .use("*", requireUser)
  // 復旧コードの再発行（古いコードは無効になる）
  .post("/recovery-code", async (c) => {
    const denied = await confirmPassword(c);
    if (denied) return denied;
    const recoveryCode = await issueRecoveryCode(c, c.var.user!.id);
    return c.json({ user: await selectUser(c.env.DB, c.var.user!.id), recoveryCode });
  })
  // アカウント削除。問題・タグ・提出結果・セッションは外部キーの ON DELETE CASCADE で消える
  .delete("/", async (c) => {
    const denied = await confirmPassword(c);
    if (denied) return denied;
    await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(c.var.user!.id).run();
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 204);
  });

/** 期限切れセッションの掃除（Cron Trigger から呼ぶ） */
export async function purgeExpiredSessions(db: D1Database) {
  await db.prepare("DELETE FROM sessions WHERE expires_at <= unixepoch()").run();
}
