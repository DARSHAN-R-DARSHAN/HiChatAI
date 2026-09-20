import { prisma } from "../../../../lib/prisma";
import { getCurrentUser } from "../../../../lib/current-user";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { conversationId, content } = await request.json();

  if (
    typeof conversationId !== "string" ||
    !conversationId.trim() ||
    typeof content !== "string" ||
    !content.trim()
  ) {
    return Response.json(
      { error: "Invalid assistant message data" },
      { status: 400 }
    );
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId: user.id,
    },
  });

  if (!conversation) {
    return Response.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      role: "assistant",
      content,
    },
  });

  await prisma.conversation.update({
    where: {
      id: conversationId,
    },
    data: {
      updatedAt: new Date(),
    },
  });

  return Response.json(message);
}