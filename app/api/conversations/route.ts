import { auth } from "@clerk/nextjs/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      user: {
        clerkId: clerkUserId,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      messages: true,
    },
  });

  return Response.json(conversations);
}