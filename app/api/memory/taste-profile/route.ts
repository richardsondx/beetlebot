import { fromError, ok } from "@/lib/api/http";
import { tasteProfile } from "@/lib/repositories/memory";

export async function GET() {
  try {
    const data = await tasteProfile();
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

