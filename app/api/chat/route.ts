import { convertToModelMessages, streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getCurrentUser } from "../../../lib/current-user";
import { rateLimit } from "../../../lib/rate-limit";


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

    const { messages } = await request.json();

    const result = streamText({
      model: openrouter("openrouter/free"),
      messages: await convertToModelMessages(messages),
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