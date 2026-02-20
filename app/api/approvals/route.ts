import { fromError, ok } from "@/lib/api/http";
import { listApprovals } from "@/lib/repositories/misc";

export async function GET() {
  try {
    const data = await listApprovals();
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

