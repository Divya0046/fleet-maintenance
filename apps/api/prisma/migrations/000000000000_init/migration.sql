-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FLEET_MANAGER', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('DUE', 'BOOKED', 'IN_SERVICE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ServiceTrigger" AS ENUM ('DATE', 'MILEAGE');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'TECHNICIAN_ASSIGNED', 'TECHNICIAN_UNASSIGNED', 'NOTE_ADDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "currentOdometer" INTEGER NOT NULL,
    "serviceIntervalDays" INTEGER NOT NULL,
    "mileageIntervalKm" INTEGER NOT NULL,
    "overdueGracePeriodDays" INTEGER NOT NULL,
    "lastServiceAt" TIMESTAMP(3) NOT NULL,
    "lastServiceOdometer" INTEGER NOT NULL,
    "currentServiceCycle" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'DUE',
    "description" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "triggerType" "ServiceTrigger",
    "scheduledDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedOdometer" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRecordTechnician" (
    "serviceRecordId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRecordTechnician_pkey" PRIMARY KEY ("serviceRecordId","technicianId")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "serviceRecordId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "AuditEventType" NOT NULL,
    "oldStatus" "ServiceStatus",
    "newStatus" "ServiceStatus",
    "technicianId" TEXT,
    "noteText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "serviceRecordId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3),
    "dismissedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registrationNumber_key" ON "Vehicle"("registrationNumber");

-- CreateIndex
CREATE INDEX "Vehicle_isArchived_idx" ON "Vehicle"("isArchived");

-- CreateIndex
CREATE INDEX "Vehicle_currentOdometer_idx" ON "Vehicle"("currentOdometer");

-- CreateIndex
CREATE INDEX "ServiceRecord_status_scheduledDate_idx" ON "ServiceRecord"("status", "scheduledDate");

-- CreateIndex
CREATE INDEX "ServiceRecord_vehicleId_status_idx" ON "ServiceRecord"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "ServiceRecord_updatedAt_idx" ON "ServiceRecord"("updatedAt");

-- CreateIndex
CREATE INDEX "ServiceRecord_createdById_idx" ON "ServiceRecord"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRecord_vehicleId_cycleNumber_key" ON "ServiceRecord"("vehicleId", "cycleNumber");

-- CreateIndex
CREATE INDEX "ServiceRecordTechnician_technicianId_serviceRecordId_idx" ON "ServiceRecordTechnician"("technicianId", "serviceRecordId");

-- CreateIndex
CREATE INDEX "AuditEvent_serviceRecordId_createdAt_idx" ON "AuditEvent"("serviceRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_serviceRecordId_key" ON "Alert"("serviceRecordId");

-- CreateIndex
CREATE INDEX "Alert_vehicleId_dismissedAt_resolvedAt_idx" ON "Alert"("vehicleId", "dismissedAt", "resolvedAt");

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRecordTechnician" ADD CONSTRAINT "ServiceRecordTechnician_serviceRecordId_fkey" FOREIGN KEY ("serviceRecordId") REFERENCES "ServiceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRecordTechnician" ADD CONSTRAINT "ServiceRecordTechnician_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_serviceRecordId_fkey" FOREIGN KEY ("serviceRecordId") REFERENCES "ServiceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_serviceRecordId_fkey" FOREIGN KEY ("serviceRecordId") REFERENCES "ServiceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_dismissedById_fkey" FOREIGN KEY ("dismissedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

