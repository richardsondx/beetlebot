import { fromError, ok } from "@/lib/api/http";
import { memoryUpsertSchema } from "@/lib/api/schemas";
import { db } from "@/lib/db";
import { upsertMemory } from "@/lib/repositories/memory";

export async function POST(request: Request) {
  try {
    const body = memoryUpsertSchema.parse(await request.json());
    const data = await upsertMemory(body);
    await db.auditEvent.create({
      data: {
        actor: "api:memory",
        action: body.id ? "memory_updated" : "memory_created",
        details: body.key,
      },
    });
    return ok(data, body.id ? 200 : 201);
  } catch (error) {
    return fromError(error);
  }
}

