import { db } from "@/lib/db";
import { ensureSeedData } from "@/lib/repositories/seed";
import { parseNeedString, resolveNeedAlias } from "@/lib/integrations/aliases";
import { listIntegrationConnections } from "@/lib/repositories/integrations";
import type { IntegrationScope } from "@/lib/integrations/types";
import type { PackDataSource } from "@/lib/types";

const parseJsonArray = (value: string) => {
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
};

const parseDataSources = (value: string): PackDataSource[] => {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as PackDataSource[];
    return [];
  } catch {
    return [];
  }
};

function parsePack(pack: {
  id: string;
  slug: string;
  name: string;
  city: string;
  modes: string;
  style: string;
  budgetRange: string;
  needs: string;
  description: string;
  instructions: string;
  tags: string;
  dataSources: string;
  installed: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...pack,
    modes: parseJsonArray(pack.modes),
    needs: parseJsonArray(pack.needs),
    tags: parseJsonArray(pack.tags),
    dataSources: parseDataSources(pack.dataSources),
  };
}

export async function listPacks(city?: string | null, mode?: string | null) {
  await ensureSeedData();
  const where: { city?: string; modes?: { contains: string } } = {};
  if (city) where.city = city;
  if (mode) where.modes = { contains: mode };

  const packs = await db.pack.findMany({ where, orderBy: { createdAt: "desc" } });
  return packs.map(parsePack);
}

export async function getPackBySlug(slug: string) {
  await ensureSeedData();
  const pack = await db.pack.findUnique({ where: { slug } });
  if (!pack) return null;
  return parsePack(pack);
}

export async function createPack(data: {
  slug: string;
  name: string;
  city: string;
  modes: string[];
  style: string;
  budgetRange: string;
  needs: string[];
  description: string;
  instructions?: string;
  tags?: string[];
  dataSources?: PackDataSource[];
}) {
  const created = await db.pack.create({
    data: {
      slug: data.slug,
      name: data.name,
      city: data.city,
      modes: JSON.stringify(data.modes),
      style: data.style,
      budgetRange: data.budgetRange,
      needs: JSON.stringify(data.needs),
      description: data.description,
      instructions: data.instructions ?? "",
      tags: JSON.stringify(data.tags ?? []),
      dataSources: JSON.stringify(data.dataSources ?? []),
    },
  });
  await db.auditEvent.create({
    data: {
      actor: "api:packs",
      action: "pack_created",
      details: created.slug,
    },
  });
  return parsePack(created);
}

export async function updatePack(
  slug: string,
  data: {
    name?: string;
    city?: string;
    modes?: string[];
    style?: string;
    budgetRange?: string;
    needs?: string[];
    description?: string;
    instructions?: string;
    tags?: string[];
    dataSources?: PackDataSource[];
  },
) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.modes !== undefined) updateData.modes = JSON.stringify(data.modes);
  if (data.style !== undefined) updateData.style = data.style;
  if (data.budgetRange !== undefined) updateData.budgetRange = data.budgetRange;
  if (data.needs !== undefined) updateData.needs = JSON.stringify(data.needs);
  if (data.description !== undefined) updateData.description = data.description;
  if (data.instructions !== undefined) updateData.instructions = data.instructions;
  if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
  if (data.dataSources !== undefined) updateData.dataSources = JSON.stringify(data.dataSources);

  const updated = await db.pack.update({
    where: { slug },
    data: updateData,
  });
  await db.auditEvent.create({
    data: {
      actor: "api:packs",
      action: "pack_updated",
      details: slug,
    },
  });
  return parsePack(updated);
}

export async function deletePack(slug: string) {
  await db.pack.delete({ where: { slug } });
  await db.auditEvent.create({
    data: {
      actor: "api:packs",
      action: "pack_deleted",
      details: slug,
    },
  });
}

export async function installPack(slug: string) {
  const pack = await db.pack.update({
    where: { slug },
    data: { installed: true },
  });
  await db.auditEvent.create({
    data: {
      actor: "api:packs",
      action: "pack_installed",
      details: slug,
    },
  });
  return parsePack(pack);
}

export async function uninstallPack(slug: string) {
  const pack = await db.pack.update({
    where: { slug },
    data: { installed: false },
  });
  await db.auditEvent.create({
    data: {
      actor: "api:packs",
      action: "pack_uninstalled",
      details: slug,
    },
  });
  return parsePack(pack);
}

export async function getInstalledPackInstructions() {
  const packs = await db.pack.findMany({
    where: { installed: true },
    select: { name: true, instructions: true, dataSources: true },
  });
  return packs
    .filter((p) => p.instructions || p.dataSources !== "[]")
    .map((p) => ({
      name: p.name,
      instructions: p.instructions,
      dataSources: parseDataSources(p.dataSources),
    }));
}

export async function checkPackNeeds(
  needs: string[],
): Promise<{ satisfied: boolean; issues: Array<{ need: string; reason: string }> }> {
  const integrations = await listIntegrationConnections();
  const issues: Array<{ need: string; reason: string }> = [];

  for (const need of needs) {
    const parsed = parseNeedString(need);
    if (!parsed) {
      issues.push({ need, reason: "Invalid format (expected integration:scope)" });
      continue;
    }

    const provider = resolveNeedAlias(parsed.alias);
    if (!provider) {
      issues.push({ need, reason: `Unknown integration "${parsed.alias}"` });
      continue;
    }

    const conn = integrations.find((i) => i.provider === provider);
    if (!conn || conn.status !== "connected") {
      issues.push({ need, reason: `${provider} is not connected` });
      continue;
    }

    const granted = conn.grantedScopes as IntegrationScope[];
    if (!granted.includes(parsed.scope as IntegrationScope)) {
      issues.push({
        need,
        reason: `${provider} does not have "${parsed.scope}" permission`,
      });
    }
  }

  return { satisfied: issues.length === 0, issues };
}

