import { prisma } from "../../../../lib/prisma";
import { getCurrentUser } from "../../../../lib/current-user";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { title } = await request.json();

  const conversation = await prisma.conversation.create({
    data: {
      title,
      userId: user.id,
    },
  });

  return Response.json(conversation);
}