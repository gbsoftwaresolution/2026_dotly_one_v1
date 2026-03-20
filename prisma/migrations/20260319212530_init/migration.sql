-- CreateEnum
CREATE TYPE "PersonaAccessMode" AS ENUM ('PRIVATE', 'CONTROLLED', 'PUBLIC');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "fullName" TEXT,
    "jobTitle" TEXT,
    "companyName" TEXT,
    "tagline" TEXT,
    "profilePhotoUrl" TEXT,
    "accessMode" "PersonaAccessMode" NOT NULL DEFAULT 'CONTROLLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Persona_username_key" ON "Persona"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Persona_publicUrl_key" ON "Persona"("publicUrl");

-- CreateIndex
CREATE INDEX "Persona_userId_idx" ON "Persona"("userId");

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
