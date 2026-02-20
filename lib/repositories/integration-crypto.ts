import type { IntegrationConnection } from "@prisma/client";
import { encryptIfPresent, decryptIfPresent } from "@/lib/crypto";

const ENCRYPTED_FIELDS = ["accessToken", "refreshToken", "configJson"] as const;

type EncryptedField = (typeof ENCRYPTED_FIELDS)[number];

export function decryptConnection<T extends Partial<Pick<IntegrationConnection, EncryptedField>>>(
  row: T,
): T {
  const copy = { ...row };
  for (const field of ENCRYPTED_FIELDS) {
    if (field in copy && copy[field] != null) {
      (copy as Record<string, unknown>)[field] = decryptIfPresent(copy[field] as string);
    }
  }
  return copy;
}

export function encryptConnectionFields(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const copy = { ...data };
  for (const field of ENCRYPTED_FIELDS) {
    if (field in copy && copy[field] != null) {
      copy[field] = encryptIfPresent(copy[field] as string);
    }
  }
  return copy;
}
