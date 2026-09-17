import { prisma } from "../../../../lib/prisma";

export async function POST(request: Request) {
  const { conversationId, role, content } = await request.json();

  const message = await prisma.message.create({
    data: {
      conversationId,
      role,
      content,
    },
  });

  return Response.json(message);
}