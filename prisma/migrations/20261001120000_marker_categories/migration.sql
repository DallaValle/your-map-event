-- AlterTable
ALTER TABLE "EventMap" ADD COLUMN     "markerColor" TEXT,
ADD COLUMN     "markerLabel" TEXT NOT NULL DEFAULT 'auto';

-- AlterTable
ALTER TABLE "PointOfInterest" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "color" TEXT;

-- CreateTable
CREATE TABLE "PoiCategory" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoiCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PoiCategory_eventId_idx" ON "PoiCategory"("eventId");

-- CreateIndex
CREATE INDEX "PointOfInterest_categoryId_idx" ON "PointOfInterest"("categoryId");

-- AddForeignKey
ALTER TABLE "PointOfInterest" ADD CONSTRAINT "PointOfInterest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PoiCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoiCategory" ADD CONSTRAINT "PoiCategory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

