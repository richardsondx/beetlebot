import { fromError, ok, fail } from "@/lib/api/http";
import { updateSafetySettingsSchema } from "@/lib/api/schemas";
import { getSafetySettings, updateSafetySettings } from "@/lib/repositories/settings";

export async function GET() {
  try {
    const data = await getSafetySettings();
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const parsed = updateSafetySettingsSchema.parse(body);
    const data = await updateSafetySettings(parsed);
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}
