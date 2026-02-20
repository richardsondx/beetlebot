import { fail, fromError, ok } from "@/lib/api/http";
import { isIntegrationProvider, testIntegration } from "@/lib/repositories/integrations";

type Params = { params: Promise<{ provider: string }> };

export async function POST(_: Request, { params }: Params) {
  try {
    const { provider } = await params;
    if (!isIntegrationProvider(provider)) {
      return fail(`Unsupported provider: ${provider}`, 404);
    }
    const data = await testIntegration(provider);
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}
