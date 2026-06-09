-- CreateTable
CREATE TABLE "Vehicle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modelName" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "powerType" TEXT NOT NULL,
    "vehicleClass" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "trimLevel" TEXT NOT NULL,
    "curbWeight" INTEGER NOT NULL,
    "lengthMm" INTEGER NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "wheelbaseMm" INTEGER NOT NULL,
    "batteryKwh" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VehiclePair" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modelName" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "vehicleClass" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "iceVehicleId" INTEGER NOT NULL,
    "evVehicleId" INTEGER NOT NULL,
    "weightDiffKg" INTEGER,
    "weightGainPct" REAL,
    "normalizedDiff" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VehiclePair_iceVehicleId_fkey" FOREIGN KEY ("iceVehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VehiclePair_evVehicleId_fkey" FOREIGN KEY ("evVehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VehiclePair_iceVehicleId_evVehicleId_key" ON "VehiclePair"("iceVehicleId", "evVehicleId");
