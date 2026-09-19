import { auth } from "@clerk/nextjs/server";
import { prisma } from "../../../../lib/prisma";

export async function POST(request: Request) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { conversationId, role, content } = await request.json();

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      user: {
        clerkId: clerkUserId,
      },
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
      role,
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