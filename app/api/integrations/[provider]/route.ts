import { fail, fromError, ok } from "@/lib/api/http";
import { getIntegrationConnection, isIntegrationProvider } from "@/lib/repositories/integrations";

type Params = { params: Promise<{ provider: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { provider } = await params;
    if (!isIntegrationProvider(provider)) {
      return fail(`Unsupported provider: ${provider}`, 404);
    }
    const data = await getIntegrationConnection(provider);
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}
