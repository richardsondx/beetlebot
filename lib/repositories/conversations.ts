import { db } from "@/lib/db";
import type { RichBlock } from "@/lib/chat/rich-message";
import { sanitiseBlocks } from "@/lib/chat/safety";

export const CONVERSATION_HISTORY_LIMIT = 8;

export async function createConversationThread(title?: string) {
  return db.conversationThread.create({
    data: { title: title?.slice(0, 120) || null },
  });
}

export async function getConversationThread(threadId: string) {
  return db.conversationThread.findUnique({
    where: { id: threadId },
  });
}

export async function getRecentConversationThreads(limit = 8) {
  return db.conversationThread.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });
}

export async function addConversationMessage(input: {
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  blocksJson?: string;
}) {
  return db.conversationMessage.create({
    data: {
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      blocksJson: input.blocksJson ?? null,
    },
  });
}

export async function getConversationMessages(
  threadId: string,
  limit = CONVERSATION_HISTORY_LIMIT,
) {
  const messages = await db.conversationMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return messages.reverse();
}

/** Parse the serialised blocks from a stored message, returning null if absent or malformed. */
export function parseMessageBlocks(blocksJson: string | null): RichBlock[] | null {
  if (!blocksJson) return null;
  try {
    const raw = JSON.parse(blocksJson) as unknown[];
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const safe = sanitiseBlocks(raw);
    return safe.length > 0 ? safe : null;
  } catch {
    return null;
  }
}
