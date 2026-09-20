import { prisma } from "../../../lib/prisma";
import { getCurrentUser } from "../../../lib/current-user";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        messages: true,
      },
    });

    return Response.json(conversations);
  } catch (error) {
    console.error("LOAD CONVERSATIONS ERROR:", error);

    return Response.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}