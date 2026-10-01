import type { User } from "../shared/domain";

export type Bindings = {
  DB: D1Database;
  PASSWORD_PEPPER?: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: { user: User | null };
};
