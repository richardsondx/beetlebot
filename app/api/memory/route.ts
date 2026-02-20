import { fromError, ok } from "@/lib/api/http";
import { listMemory } from "@/lib/repositories/memory";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get("bucket");
    const source = searchParams.get("source");
    const data = await listMemory(bucket, source);
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

