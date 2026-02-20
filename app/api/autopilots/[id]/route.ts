import { fromError, ok } from "@/lib/api/http";
import { updateAutopilotSchema } from "@/lib/api/schemas";
import {
  deleteAutopilot,
  getAutopilot,
  updateAutopilot,
} from "@/lib/repositories/autopilots";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const autopilot = await getAutopilot(id);
    if (!autopilot) return ok({ message: "Not found" }, 404);
    const runs = await db.autopilotRun.findMany({
      where: { autopilotId: id },
      orderBy: { createdAt: "desc" },
    });
    return ok({ autopilot, runs });
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = updateAutopilotSchema.parse(await request.json());
    const autopilot = await updateAutopilot(id, payload);
    return ok(autopilot);
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const removed = await deleteAutopilot(id);
    return ok(removed);
  } catch (error) {
    return fromError(error);
  }
}

