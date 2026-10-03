-- AlterTable: existing announcements were published when they were created.
ALTER TABLE "Notification" ADD COLUMN "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Notification" SET "publishAt" = "createdAt";

-- CreateTable
CREATE TABLE "AnnouncementSettings" (
    "eventId" TEXT NOT NULL,
    "autoUpcoming" BOOLEAN NOT NULL DEFAULT true,
    "leadMinutes" INTEGER NOT NULL DEFAULT 15,

    CONSTRAINT "AnnouncementSettings_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "Notification_eventId_publishAt_idx" ON "Notification"("eventId", "publishAt");

-- AddForeignKey
ALTER TABLE "AnnouncementSettings" ADD CONSTRAINT "AnnouncementSettings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
