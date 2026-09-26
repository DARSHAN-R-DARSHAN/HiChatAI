import { convertToModelMessages, streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getCurrentUser } from "../../../lib/current-user";
import { rateLimit } from "../../../lib/rate-limit";
import { prisma } from "../../../lib/prisma";


const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!rateLimit(user.id)) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { messages, conversationId } = await request.json();

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
    });

    if (!conversation) {
      return Response.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const result = streamText({
      model: openrouter("openrouter/free"),
      messages: await convertToModelMessages(messages),

      onFinish: async ({ text }) => {
        await prisma.message.create({
          data: {
            conversationId,
            role: "assistant",
            content: text,
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
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("CHAT API ERROR:", error);

    return Response.json(
      { error: "Failed to generate AI response" },
      { status: 500 }
    );
  }
}