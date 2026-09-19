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

  const { title } = await request.json();

  const user = await prisma.user.findUnique({
    where: {
      clerkId: clerkUserId,
    },
  });

  if (!user) {
    return Response.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const conversation = await prisma.conversation.create({
    data: {
      title,
      userId: user.id,
    },
  });

  return Response.json(conversation);
}