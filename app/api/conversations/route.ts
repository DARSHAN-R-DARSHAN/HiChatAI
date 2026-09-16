import { prisma } from "../../../lib/prisma";

export async function GET() {
  const conversations = await prisma.conversation.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      messages: true,
    },
  });

  return Response.json(conversations);
}