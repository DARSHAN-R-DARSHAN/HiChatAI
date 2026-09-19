/*
  Add Clerk ID to existing users safely.
*/

-- 1. Add the column as nullable first
ALTER TABLE "User"
ADD COLUMN "clerkId" TEXT;

-- 2. Give the existing user a temporary Clerk ID
UPDATE "User"
SET "clerkId" = 'user_3JXFm9CnsvFuWSJjYHIxbX8XV1T'
WHERE "clerkId" IS NULL;

-- 3. Make the column required
ALTER TABLE "User"
ALTER COLUMN "clerkId" SET NOT NULL;

-- 4. Add the unique constraint
CREATE UNIQUE INDEX "User_clerkId_key"
ON "User"("clerkId");