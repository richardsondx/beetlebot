import { fromError, ok } from "@/lib/api/http";
import { memoryForgetSchema } from "@/lib/api/schemas";
import { db } from "@/lib/db";
import { forgetMemory } from "@/lib/repositories/memory";

export async function POST(request: Request) {
  try {
    const body = memoryForgetSchema.parse(await request.json());
    const removed = await forgetMemory(body.id, body.key);
    if (!removed) return ok({ message: "Memory not found" }, 404);
    await db.auditEvent.create({
      data: {
        actor: "api:memory",
        action: "memory_forgotten",
        details: removed.key,
      },
    });
    return ok(removed);
  } catch (error) {
    return fromError(error);
  }
}

