import { fromError, ok } from "@/lib/api/http";
import { listCalendarAvailability } from "@/lib/repositories/misc";

export async function GET() {
  try {
    const data = await listCalendarAvailability();
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

