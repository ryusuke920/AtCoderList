import { Hono, type Context, type MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "./types";

const SESSION_COOKIE = "session";
const STATE_COOKIE = "oauth_state";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isSecure(c: Context) {
  return new URL(c.req.url).protocol === "https:";
}

async function startSession(c: Context<AppEnv>, userId: number) {
  const token = randomToken();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  await c.env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), userId, expiresAt)
    .run();
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure(c),
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

async function upsertUser(db: D1Database, githubId: number, username: string, avatarUrl: string | null) {
  const row = await db
    .prepare(
      `INSERT INTO users (github_id, username, avatar_url) VALUES (?, ?, ?)
       ON CONFLICT (github_id) DO UPDATE SET username = excluded.username, avatar_url = excluded.avatar_url
       RETURNING id`,
    )
    .bind(githubId, username, avatarUrl)
    .first<{ id: number }>();
  return row!.id;
}

/** Cookie のセッションを検証して c.var.user をセットする（未ログインなら null） */
export const loadUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("user", null);
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const user = await c.env.DB.prepare(
      `SELECT u.id, u.username, u.avatar_url AS avatarUrl
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > unixepoch()`,
    )
      .bind(await sha256(token))
      .first<{ id: number; username: string; avatarUrl: string | null }>();
    c.set("user", user ?? null);
  }
  await next();
};

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.var.user) return c.json({ error: "ログインしてください" }, 401);
  await next();
};

export const authRoutes = new Hono<AppEnv>()
  .get("/github/login", (c) => {
    if (!c.env.GITHUB_CLIENT_ID) return c.text("GITHUB_CLIENT_ID が設定されていません", 500);
    const state = randomToken();
    setCookie(c, STATE_COOKIE, state, { httpOnly: true, secure: isSecure(c), sameSite: "Lax", path: "/auth", maxAge: 600 });
    const params = new URLSearchParams({
      client_id: c.env.GITHUB_CLIENT_ID,
      redirect_uri: new URL("/auth/github/callback", c.req.url).toString(),
      state,
      allow_signup: "true",
    });
    return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
  })
  .get("/github/callback", async (c) => {
    const { code, state } = c.req.query();
    const expected = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: "/auth" });
    if (!code || !state || state !== expected) return c.text("不正なログインリクエストです", 400);

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: c.env.GITHUB_CLIENT_ID,
        client_secret: c.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const { access_token } = await tokenRes.json<{ access_token?: string }>();
    if (!access_token) return c.text("GitHub 認証に失敗しました", 400);

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${access_token}`, "User-Agent": "atcoder-list", Accept: "application/vnd.github+json" },
    });
    if (!userRes.ok) return c.text("GitHub ユーザー情報の取得に失敗しました", 502);
    const gh = await userRes.json<{ id: number; login: string; avatar_url: string | null }>();

    const userId = await upsertUser(c.env.DB, gh.id, gh.login, gh.avatar_url);
    await startSession(c, userId);
    return c.redirect("/");
  })
  // ローカル開発専用: DEV_LOGIN=true のときだけ GitHub なしでログインできる
  .get("/dev-login", async (c) => {
    if (c.env.DEV_LOGIN !== "true") return c.notFound();
    const userId = await upsertUser(c.env.DB, -1, "dev-user", null);
    await startSession(c, userId);
    return c.redirect("/");
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
