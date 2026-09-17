import { prisma } from "../../../lib/prisma";

export async function GET() {
  const users = await prisma.user.findMany();

  return Response.json(users);
}

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();

    const user = await prisma.user.create({
      data: {
        email,
        name,
      },
    });

    return Response.json(user);
  } catch (error) {
    console.error("CREATE USER ERROR:", error);

    return Response.json(
      {
        error: "Failed to create user",
        details: String(error),
      },
      { status: 500 }
    );
  }
}