import { fromError, ok } from "@/lib/api/http";
import { listAudit } from "@/lib/repositories/misc";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.nextUrl.searchParams.get("pageSize") ?? "50", 10) || 50));
    const data = await listAudit(page, pageSize);
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

