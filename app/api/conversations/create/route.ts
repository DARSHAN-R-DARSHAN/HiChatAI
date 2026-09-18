import { prisma } from "../../../../lib/prisma";

export async function POST(request: Request) {
  const { userId, title } = await request.json();

  const conversation = await prisma.conversation.create({
    data: {
      title,
      userId,
    },
  });

  return Response.json(conversation);
}