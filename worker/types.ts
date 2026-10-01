import type { User } from "../shared/domain";

export type Bindings = {
  DB: D1Database;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  DEV_LOGIN?: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: { user: User | null };
};
