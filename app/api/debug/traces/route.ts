import { fromError, ok } from "@/lib/api/http";
import { listDebugTraces } from "@/lib/repositories/misc";

export async function GET() {
  try {
    const data = await listDebugTraces();
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

