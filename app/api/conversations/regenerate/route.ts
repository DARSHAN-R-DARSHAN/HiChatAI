import { prisma } from "../../../../lib/prisma";
import { getCurrentUser } from "../../../../lib/current-user";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { conversationId } = await request.json();

    if (
      typeof conversationId !== "string" ||
      !conversationId.trim()
    ) {
      return Response.json(
        { error: "Invalid conversation ID" },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: user.id,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!conversation) {
      return Response.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const latestAssistantMessage = conversation.messages.find(
      (message) => message.role === "assistant"
    );

    if (latestAssistantMessage) {
      await prisma.message.delete({
        where: {
          id: latestAssistantMessage.id,
        },
      });
    }

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error("REGENERATE ERROR:", error);

    return Response.json(
      { error: "Failed to regenerate response" },
      { status: 500 }
    );
  }
}