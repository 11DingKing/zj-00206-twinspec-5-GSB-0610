-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "featureCount" INTEGER;
ALTER TABLE "Vehicle" ADD COLUMN "modelSeries" TEXT;

-- CreateTable
CREATE TABLE "ChainComparison" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modelSeries" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "vehicleClass" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChainComparisonItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chainComparisonId" INTEGER NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "powerType" TEXT NOT NULL,
    "curbWeight" INTEGER NOT NULL,
    "weightFromPrevious" INTEGER,
    "weightFromBase" INTEGER,
    "batteryKwh" INTEGER,
    "sequence" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChainComparisonItem_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChainComparisonItem_chainComparisonId_fkey" FOREIGN KEY ("chainComparisonId") REFERENCES "ChainComparison" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VehiclePair" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modelName" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "vehicleClass" TEXT NOT NULL,
    "pairType" TEXT NOT NULL DEFAULT 'ICE_EV',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "matchScore" INTEGER,
    "iceVehicleId" INTEGER,
    "phevVehicleId" INTEGER,
    "evVehicleId" INTEGER,
    "weightDiffKg" INTEGER,
    "weightGainPct" REAL,
    "normalizedDiff" REAL,
    "sizeDiffMm" INTEGER,
    "batteryContributionKg" REAL,
    "sizeContributionKg" REAL,
    "featureContributionKg" REAL,
    "primaryCause" TEXT,
    "causeTags" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VehiclePair_iceVehicleId_fkey" FOREIGN KEY ("iceVehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VehiclePair_phevVehicleId_fkey" FOREIGN KEY ("phevVehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VehiclePair_evVehicleId_fkey" FOREIGN KEY ("evVehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VehiclePair" ("brand", "createdAt", "evVehicleId", "iceVehicleId", "id", "modelName", "normalizedDiff", "notes", "platform", "status", "updatedAt", "vehicleClass", "weightDiffKg", "weightGainPct") SELECT "brand", "createdAt", "evVehicleId", "iceVehicleId", "id", "modelName", "normalizedDiff", "notes", "platform", "status", "updatedAt", "vehicleClass", "weightDiffKg", "weightGainPct" FROM "VehiclePair";
DROP TABLE "VehiclePair";
ALTER TABLE "new_VehiclePair" RENAME TO "VehiclePair";
CREATE UNIQUE INDEX "VehiclePair_iceVehicleId_evVehicleId_key" ON "VehiclePair"("iceVehicleId", "evVehicleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ChainComparisonItem_chainComparisonId_vehicleId_key" ON "ChainComparisonItem"("chainComparisonId", "vehicleId");
