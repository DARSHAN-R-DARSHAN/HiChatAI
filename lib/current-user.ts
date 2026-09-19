import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";

export async function getCurrentUser() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return null;
  }

  let user = await prisma.user.findUnique({
    where: {
      clerkId: clerkUserId,
    },
  });

  if (!user) {
    const clerkUser = await currentUser();

    if (!clerkUser) {
      return null;
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;

    if (!email) {
      throw new Error("Clerk user has no email address");
    }

    user = await prisma.user.create({
      data: {
        clerkId: clerkUserId,
        email,
        name: clerkUser.firstName
          ? `${clerkUser.firstName} ${clerkUser.lastName ?? ""}`.trim()
          : null,
      },
    });
  }

  return user;
}