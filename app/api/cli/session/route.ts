import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    token: `bbt_${randomUUID()}`,
    expiresInSeconds: 3600,
  });
}

