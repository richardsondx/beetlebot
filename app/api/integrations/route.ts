import { fromError, ok } from "@/lib/api/http";
import { listIntegrationConnections } from "@/lib/repositories/integrations";

export async function GET() {
  try {
    const data = await listIntegrationConnections();
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}
