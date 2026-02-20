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
      let decrypted = decryptIfPresent(copy[field] as string);
      // Backward compatibility: old writes could double-encrypt integration secrets.
      decrypted = decryptIfPresent(decrypted as string);
      (copy as Record<string, unknown>)[field] = decrypted;
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
