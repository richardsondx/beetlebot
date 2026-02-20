import { createAutopilotSchema } from "@/lib/api/schemas";
import { fromError, ok } from "@/lib/api/http";
import { createAutopilot, listAutopilots } from "@/lib/repositories/autopilots";

export async function GET() {
  try {
    const data = await listAutopilots();
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = createAutopilotSchema.parse(await request.json());
    const created = await createAutopilot(payload);
    return ok(created, 201);
  } catch (error) {
    return fromError(error);
  }
}

