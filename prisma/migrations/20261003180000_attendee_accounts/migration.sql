-- CreateTable
CREATE TABLE "Attendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendeeAccount" (
    "id" TEXT NOT NULL,
    "attendeeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendeeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendeeSession" (
    "id" TEXT NOT NULL,
    "attendeeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendeeSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendee_eventId_idx" ON "Attendee"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendee_eventId_email_key" ON "Attendee"("eventId", "email");

-- CreateIndex
CREATE INDEX "AttendeeAccount_attendeeId_idx" ON "AttendeeAccount"("attendeeId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendeeAccount_eventId_provider_providerAccountId_key" ON "AttendeeAccount"("eventId", "provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendeeSession_tokenHash_key" ON "AttendeeSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AttendeeSession_attendeeId_idx" ON "AttendeeSession"("attendeeId");

-- AddForeignKey
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendeeAccount" ADD CONSTRAINT "AttendeeAccount_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "Attendee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendeeSession" ADD CONSTRAINT "AttendeeSession_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "Attendee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

