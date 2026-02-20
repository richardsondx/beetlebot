import { NextResponse } from "next/server";
import { z } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function fromError(error: unknown) {
  if (error instanceof z.ZodError) {
    return fail("Validation failed", 422, error.flatten());
  }
  if (error instanceof Error) {
    return fail(error.message, 500);
  }
  return fail("Unknown error", 500);
}

