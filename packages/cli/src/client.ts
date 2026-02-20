import "dotenv/config";

export const baseUrl = process.env.BEETLEBOT_BASE_URL ?? "http://localhost:3000";

export type ApiEnvelope<T> = {
  data?: T;
  error?: string;
  details?: unknown;
};

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed for ${path}`);
  }
  return payload.data as T;
}

export function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

