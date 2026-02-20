import { fail, fromError, ok } from "@/lib/api/http";
import {
  isIntegrationProvider,
  updateIntegrationScopes,
} from "@/lib/repositories/integrations";
import type { IntegrationScope } from "@/lib/integrations/types";

type Params = { params: Promise<{ provider: string }> };

const VALID_SCOPES: IntegrationScope[] = ["read", "write", "delete"];

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { provider } = await params;
    if (!isIntegrationProvider(provider)) {
      return fail(`Unsupported provider: ${provider}`, 404);
    }

    const body = (await request.json()) as { scopes?: unknown };
    if (!Array.isArray(body.scopes)) {
      return fail("scopes must be an array of scope strings", 400);
    }

    const scopes = body.scopes.filter(
      (s): s is IntegrationScope =>
        typeof s === "string" && VALID_SCOPES.includes(s as IntegrationScope),
    );

    const updated = await updateIntegrationScopes(provider, scopes);
    return ok(updated);
  } catch (error) {
    return fromError(error);
  }
}
