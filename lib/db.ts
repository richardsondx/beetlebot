import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";

declare global {
  var __beetlebot_prisma: PrismaClient | undefined;
}

function resolveDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

  if (!databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  const sqlitePathWithParams = databaseUrl.slice("file:".length);
  const [sqlitePath, ...queryParts] = sqlitePathWithParams.split("?");
  const query = queryParts.length > 0 ? `?${queryParts.join("?")}` : "";

  // Keep in-memory SQLite URLs untouched.
  if (sqlitePath === ":memory:" || sqlitePath.startsWith(":memory:")) {
    return databaseUrl;
  }

  if (path.isAbsolute(sqlitePath)) {
    return `file:${sqlitePath}${query}`;
  }

  const absoluteSqlitePath = path.resolve(process.cwd(), sqlitePath);
  return `file:${absoluteSqlitePath}${query}`;
}

export const db =
  global.__beetlebot_prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: resolveDatabaseUrl() }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__beetlebot_prisma = db;
}

