import { prisma } from "../../../../lib/prisma";

export async function POST(request: Request) {
  const { userId, title, content } = await request.json();

  const conversation = await prisma.conversation.create({
    data: {
      title,
      userId,
      messages: {
        create: {
          role: "user",
          content,
        },
      },
    },
    include: {
      messages: true,
    },
  });

  return Response.json(conversation);
}