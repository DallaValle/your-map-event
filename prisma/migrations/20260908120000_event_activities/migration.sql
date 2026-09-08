-- Event operating window for the timeline canvas.
ALTER TABLE "EventMap" ADD COLUMN "startTime" TIMESTAMP(3),
ADD COLUMN "endTime" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "poiId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- Copy existing program sessions onto the event, matching location to a POI title when possible.
INSERT INTO "Activity" ("id", "eventId", "poiId", "name", "type", "startTime", "endTime", "createdAt", "updatedAt")
SELECT
    s."id",
    p."eventId",
    (
        SELECT poi."id"
        FROM "PointOfInterest" poi
        WHERE poi."mapId" = p."eventId" AND poi.title = s.location
        LIMIT 1
    ),
    s.title,
    'other',
    s."startsAt",
    s."endsAt",
    s."createdAt",
    s."updatedAt"
FROM "ProgramSession" s
INNER JOIN "Program" p ON p.id = s."programId";

-- Derive a window from migrated activities when the event has none yet.
UPDATE "EventMap" e
SET
    "startTime" = sub.first_start,
    "endTime" = sub.last_end
FROM (
    SELECT "eventId", MIN("startTime") AS first_start, MAX("endTime") AS last_end
    FROM "Activity"
    WHERE "startTime" IS NOT NULL AND "endTime" IS NOT NULL
    GROUP BY "eventId"
) sub
WHERE e.id = sub."eventId" AND e."startTime" IS NULL;

-- CreateIndex
CREATE INDEX "Activity_eventId_startTime_idx" ON "Activity"("eventId", "startTime");

-- CreateIndex
CREATE INDEX "Activity_poiId_idx" ON "Activity"("poiId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "PointOfInterest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropTable
DROP TABLE "ProgramSession";

-- DropTable
DROP TABLE "Program";
