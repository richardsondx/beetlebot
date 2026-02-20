import { fromError, ok } from "@/lib/api/http";
import { rejectApprovalSchema } from "@/lib/api/schemas";
import { reject } from "@/lib/repositories/misc";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = rejectApprovalSchema.parse(await request.json().catch(() => ({})));
    const data = await reject(id, body.reason);
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

