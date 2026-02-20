import { fail, fromError, ok } from "@/lib/api/http";
import { checkPackNeeds } from "@/lib/repositories/packs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { needs?: unknown };
    if (!Array.isArray(body.needs)) {
      return fail("needs must be an array of strings", 400);
    }
    const needs = body.needs.filter((n): n is string => typeof n === "string");
    const result = await checkPackNeeds(needs);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
