-- AlterTable
ALTER TABLE "EventMap" ADD COLUMN     "slug" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "PointOfInterest" ADD COLUMN     "icon" TEXT;

-- Backfill: derive a slug from the map name; de-dupe within a team by
-- suffixing a row number so the unique index below can be created.
WITH slugged AS (
  SELECT
    id,
    COALESCE(
      NULLIF(
        trim(BOTH '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')),
        ''
      ),
      'map'
    ) AS base,
    ROW_NUMBER() OVER (
      PARTITION BY "teamId",
        COALESCE(
          NULLIF(
            trim(BOTH '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')),
            ''
          ),
          'map'
        )
      ORDER BY "createdAt"
    ) AS rn
  FROM "EventMap"
)
UPDATE "EventMap" m
SET "slug" = CASE WHEN s.rn = 1 THEN s.base ELSE s.base || '-' || s.rn END
FROM slugged s
WHERE m.id = s.id;

-- CreateIndex
CREATE UNIQUE INDEX "EventMap_teamId_slug_key" ON "EventMap"("teamId", "slug");
