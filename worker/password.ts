// PBKDF2-SHA256 によるパスワードハッシュ。
// Workers 無料枠の CPU 上限（10ms/リクエスト）に収まるよう反復回数を抑え、
// その分をサーバー側だけが持つペッパー（PASSWORD_PEPPER）で補う。

const ALGORITHM = "pbkdf2-sha256";
const ITERATIONS = 50_000;
const encoder = new TextEncoder();

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));

/** ペッパーで HMAC してから PBKDF2 にかける */
async function derive(password: string, pepper: string, salt: Uint8Array, iterations: number) {
  const hmacKey = await crypto.subtle.importKey("raw", encoder.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const peppered = await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(password));
  const key = await crypto.subtle.importKey("raw", peppered, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, pepper: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, pepper, salt, ITERATIONS);
  return `${ALGORITHM}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string, pepper: string): Promise<boolean> {
  const [algorithm, iterations, salt, hash] = stored.split("$");
  if (algorithm !== ALGORITHM) return false;
  const expected = fromBase64(hash);
  const actual = await derive(password, pepper, fromBase64(salt), Number(iterations));
  // 定数時間比較
  let diff = expected.length ^ actual.length;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i % actual.length];
  return diff === 0;
}

/** 存在しないユーザーへのログインでも同じだけ時間をかけ、ユーザー名の有無を推測されにくくするためのダミー */
export const DUMMY_HASH = `${ALGORITHM}$${ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;
