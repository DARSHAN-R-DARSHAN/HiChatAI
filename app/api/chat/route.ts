import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getCurrentUser } from "../../../lib/current-user";
import { rateLimit } from "../../../lib/rate-limit";
import { prisma } from "../../../lib/prisma";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const FALLBACK_MESSAGE =
  "I couldn't generate a response this time. Please try again.";


function isSafetyLabelOutput(text: string): boolean {
  const normalized = text.trim();

  return (
    /^User Safety:\s*(safe|unsafe)\s*Response Safety:\s*(safe|unsafe)\s*$/i.test(
      normalized
    ) ||
    /^Response Safety:\s*(safe|unsafe)\s*$/i.test(normalized)
  );
}


function isPotentialSafetyLabelPrefix(text: string): boolean {
  const normalized = text.trimStart().toLowerCase();

  if (!normalized) return true;

  const labels = ["user safety:", "response safety:"];

  return labels.some(
    (label) =>
      label.startsWith(normalized) || normalized.startsWith(label)
  );
}


export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!rateLimit(user.id)) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { messages, conversationId } = await request.json();

    if (typeof conversationId !== "string" || !conversationId.trim()) {
      return Response.json(
        { error: "Invalid conversation ID" },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: user.id },
    });

    if (!conversation) {
      return Response.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const stream = createUIMessageStream({  
    execute: async ({ writer }) => {
      const result = streamText({
        model: openrouter("openrouter/free"),
        messages: await convertToModelMessages(messages),
      });

      const messageId = crypto.randomUUID();
      let generatedText = "";
      let bufferedPrefix = "";
      let decided = false;

      writer.write({ type: "text-start", id: messageId });

      for await (const chunk of result.textStream) {
        generatedText += chunk;

        if (decided) {
          writer.write({
            type: "text-delta",
            id: messageId,
            delta: chunk,
          });
          continue;
        }

        bufferedPrefix += chunk;

        if (!isPotentialSafetyLabelPrefix(bufferedPrefix)) {
          decided = true;

          writer.write({
            type: "text-delta",
            id: messageId,
            delta: bufferedPrefix,
          });

          bufferedPrefix = "";
        }
      }

      const isSafetyOutput = isSafetyLabelOutput(generatedText);
      const finalText = isSafetyOutput
        ? FALLBACK_MESSAGE
        : generatedText;

      // If the opening text could be a safety label, reveal it only
      // after the complete response tells us whether it is a label.
      if (!decided) {
        writer.write({
          type: "text-delta",
          id: messageId,
          delta: finalText,
        });
      }

      writer.write({ type: "text-end", id: messageId });

      await prisma.message.create({
        data: {
          conversationId,
          role: "assistant",
          content: finalText,
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    },

      onError: (error) => {
        console.error("CHAT STREAM ERROR:", error);
        return "Failed to generate AI response";
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("CHAT API ERROR:", error);

    return Response.json(
      { error: "Failed to generate AI response" },
      { status: 500 }
    );
  }
}
