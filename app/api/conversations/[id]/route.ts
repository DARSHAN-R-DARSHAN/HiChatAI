import { auth } from "@clerk/nextjs/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      user: {
        clerkId: clerkUserId,
      },
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
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

  return Response.json(conversation);
}