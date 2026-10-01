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
    const user = await c.env.DB.prepare(
      `SELECT u.id, u.username
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > unixepoch()`,
    )
      .bind(await sha256(token))
      .first<User>();
    c.set("user", user ?? null);
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
    const user = await c.env.DB.prepare(
      "INSERT INTO users (username, password_hash) VALUES (?, ?) ON CONFLICT (username) DO NOTHING RETURNING id, username",
    )
      .bind(cred.username, hash)
      .first<User>();
    if (!user) return c.json({ error: "このユーザー名は既に使われています" }, 409);

    await startSession(c, user.id);
    return c.json({ user }, 201);
  })
  .post("/login", async (c) => {
    const cred = validateCredentials(await c.req.json().catch(() => null));
    const invalid = () => c.json({ error: "ユーザー名またはパスワードが間違っています" }, 401);
    if (!cred.ok) return invalid();

    const db = c.env.DB;
    const row = await db
      .prepare("SELECT id, username, password_hash, locked_until FROM users WHERE username = ?")
      .bind(cred.username)
      .first<{ id: number; username: string; password_hash: string; locked_until: number }>();

    if (row && row.locked_until > now()) {
      return c.json({ error: "ログインに続けて失敗したため、しばらく時間をおいてから再度お試しください" }, 429);
    }

    const ok = await verifyPassword(cred.password, row?.password_hash ?? DUMMY_HASH, pepper(c));
    if (!row || !ok) {
      if (row) {
        // 連続失敗回数を数え、上限に達したら一定時間ロックする
        await db
          .prepare(
            `UPDATE users
                SET failed_logins = CASE WHEN failed_logins + 1 >= ?1 THEN 0 ELSE failed_logins + 1 END,
                    locked_until  = CASE WHEN failed_logins + 1 >= ?1 THEN ?2 ELSE locked_until END
              WHERE id = ?3`,
          )
          .bind(MAX_FAILED_LOGINS, now() + LOCK_SEC, row.id)
          .run();
      }
      return invalid();
    }

    await db.prepare("UPDATE users SET failed_logins = 0, locked_until = 0 WHERE id = ?").bind(row.id).run();
    await startSession(c, row.id);
    return c.json({ user: { id: row.id, username: row.username } });
  })
  .post("/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 204);
  });

/** 期限切れセッションの掃除（Cron Trigger から呼ぶ） */
export async function purgeExpiredSessions(db: D1Database) {
  await db.prepare("DELETE FROM sessions WHERE expires_at <= unixepoch()").run();
}
