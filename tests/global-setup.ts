import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function safeRemove(filePath: string) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

export default async function globalSetup() {
  const testDbPath = path.resolve(process.cwd(), "test.db");
  process.env.DATABASE_URL = `file:${testDbPath}`;

  safeRemove(testDbPath);
  safeRemove(`${testDbPath}-wal`);
  safeRemove(`${testDbPath}-shm`);
  safeRemove(`${testDbPath}-journal`);

  execSync("npx prisma db push", {
    stdio: "pipe",
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
    },
  });

  return async () => {
    safeRemove(testDbPath);
    safeRemove(`${testDbPath}-wal`);
    safeRemove(`${testDbPath}-shm`);
    safeRemove(`${testDbPath}-journal`);
  };
}
