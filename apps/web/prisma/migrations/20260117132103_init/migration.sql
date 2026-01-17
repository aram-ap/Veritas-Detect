-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "auth0Id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT,
    "trustScore" DOUBLE PRECISION NOT NULL,
    "hasMisinformation" BOOLEAN NOT NULL,
    "flaggedTags" TEXT NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_auth0Id_key" ON "UserProfile"("auth0Id");

-- CreateIndex
CREATE INDEX "AnalysisRecord_userId_idx" ON "AnalysisRecord"("userId");

-- CreateIndex
CREATE INDEX "AnalysisRecord_analyzedAt_idx" ON "AnalysisRecord"("analyzedAt");

-- AddForeignKey
ALTER TABLE "AnalysisRecord" ADD CONSTRAINT "AnalysisRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
