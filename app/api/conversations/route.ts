import { prisma } from "../../../lib/prisma";
import { getCurrentUser } from "../../../lib/current-user";

export async function GET() {
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
}