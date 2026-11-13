import { createId } from "@/lib/utils/id";
import type { ChatBlock, ChatMessage, ID } from "@/types/models";
import { getDB } from "../db";

/** Keeps the local conversation from growing without bound. */
export const MAX_CHAT_MESSAGES = 200;

export async function addChatMessage(role: ChatMessage["role"], blocks: ChatBlock[], source?: string): Promise<ChatMessage> {
  const db = getDB();
  const message: ChatMessage = { id: createId("msg"), role, blocks, source, createdAt: Date.now() };
  await db.transaction("rw", db.chatMessages, async () => {
    await db.chatMessages.add(message);
    const count = await db.chatMessages.count();
    if (count > MAX_CHAT_MESSAGES) {
      const oldest = await db.chatMessages.orderBy("createdAt").limit(count - MAX_CHAT_MESSAGES).primaryKeys();
      await db.chatMessages.bulkDelete(oldest);
    }
  });
  return message;
}

export async function updateChatBlocks(id: ID, blocks: ChatBlock[]): Promise<void> {
  await getDB().chatMessages.update(id, { blocks });
}

export async function listChat(): Promise<ChatMessage[]> {
  return getDB().chatMessages.orderBy("createdAt").toArray();
}

export async function clearChat(): Promise<void> {
  await getDB().chatMessages.clear();
}
