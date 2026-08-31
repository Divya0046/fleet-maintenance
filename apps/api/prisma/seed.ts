import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  Role,
  ServiceStatus,
  ServiceTrigger,
  AuditEventType,
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const DEMO_PASSWORD = "FleetDemo123!";

async function main() {
  console.log("Seeding Fleet Maintenance database...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // ---------------------------------------------------------
  // USERS
  // ---------------------------------------------------------

  const manager = await prisma.user.upsert({
    where: {
      email: "manager@fleetdemo.com",
    },
    update: {
      name: "Demo Fleet Manager",
      role: Role.FLEET_MANAGER,
      passwordHash,
    },
    create: {
      email: "manager@fleetdemo.com",
      name: "Demo Fleet Manager",
      role: Role.FLEET_MANAGER,
      passwordHash,
    },
  });

  const technicians = await Promise.all([
    prisma.user.upsert({
      where: {
        email: "tech1@fleetdemo.com",
      },
      update: {
        name: "Rahul Sharma",
        role: Role.TECHNICIAN,
        passwordHash,
      },
      create: {
        email: "tech1@fleetdemo.com",
        name: "Rahul Sharma",
        role: Role.TECHNICIAN,
        passwordHash,
      },
    }),

    prisma.user.upsert({
      where: {
        email: "tech2@fleetdemo.com",
      },
      update: {
        name: "Priya Singh",
        role: Role.TECHNICIAN,
        passwordHash,
      },
      create: {
        email: "tech2@fleetdemo.com",
        name: "Priya Singh",
        role: Role.TECHNICIAN,
        passwordHash,
      },
    }),

    prisma.user.upsert({
      where: {
        email: "tech3@fleetdemo.com",
      },
      update: {
        name: "Amit Kumar",
        role: Role.TECHNICIAN,
        passwordHash,
      },
      create: {
        email: "tech3@fleetdemo.com",
        name: "Amit Kumar",
        role: Role.TECHNICIAN,
        passwordHash,
      },
    }),
  ]);

  const [tech1, tech2, tech3] = technicians;

  // ---------------------------------------------------------
  // VEHICLES
  // ---------------------------------------------------------

 
  const vehicleData = [
    {
      registrationNumber: "DL01AB1001",
      make: "Tata",
      model: "Ace",
      currentOdometer: 58000,
      serviceIntervalDays: 180,
      mileageIntervalKm: 10000,
      overdueGracePeriodDays: 7,
      lastServiceAt: new Date("2026-02-01T09:00:00Z"),
      lastServiceOdometer: 48000,
      currentServiceCycle: 1,
    },
    {
      registrationNumber: "DL01AB1002",
      make: "Mahindra",
      model: "Bolero",
      currentOdometer: 63500,
      serviceIntervalDays: 180,
      mileageIntervalKm: 10000,
      overdueGracePeriodDays: 7,
      lastServiceAt: new Date("2026-04-01T09:00:00Z"),
      lastServiceOdometer: 60000,
      currentServiceCycle: 1,
    },
    {
      registrationNumber: "DL01AB1003",
      make: "Ashok Leyland",
      model: "Dost",
      currentOdometer: 72000,
      serviceIntervalDays: 180,
      mileageIntervalKm: 10000,
      overdueGracePeriodDays: 7,
      lastServiceAt: new Date("2026-03-15T09:00:00Z"),
      lastServiceOdometer: 65000,
      currentServiceCycle: 1,
    },
    {
      registrationNumber: "DL01AB1004",
      make: "Tata",
      model: "Intra V30",
      currentOdometer: 41000,
      serviceIntervalDays: 180,
      mileageIntervalKm: 10000,
      overdueGracePeriodDays: 7,
      lastServiceAt: new Date("2026-07-01T09:00:00Z"),
      lastServiceOdometer: 40000,
      currentServiceCycle: 1,
    },
    {
      registrationNumber: "DL01AB1005",
      make: "Maruti Suzuki",
      model: "Super Carry",
      currentOdometer: 91000,
      serviceIntervalDays: 180,
      mileageIntervalKm: 10000,
      overdueGracePeriodDays: 7,
      lastServiceAt: new Date("2026-06-01T09:00:00Z"),
      lastServiceOdometer: 81000,
      currentServiceCycle: 1,
    },
    {
      registrationNumber: "DL01AB1006",
      make: "Mahindra",
      model: "Jeeto",
      currentOdometer: 30500,
      serviceIntervalDays: 180,
      mileageIntervalKm: 10000,
      overdueGracePeriodDays: 7,
      lastServiceAt: new Date("2026-01-15T09:00:00Z"),
      lastServiceOdometer: 25000,
      currentServiceCycle: 1,
    },
  ];

  const vehicles = [];

  for (const data of vehicleData) {
    const vehicle = await prisma.vehicle.upsert({
      where: {
        registrationNumber: data.registrationNumber,
      },
      update: data,
      create: data,
    });

    vehicles.push(vehicle);
  }

  const [
    vehicleDue,
    vehicleBooked,
    vehicleInService,
    vehicleCompleted,
    vehicleOverdue,
    vehicleHistory,
  ] = vehicles;

  // ---------------------------------------------------------
  // SERVICE RECORDS
  // ---------------------------------------------------------

  // Cycle 1: Due
  const dueAtDueVehicle = new Date("2026-08-01T09:00:00Z");

  const dueRecord = await prisma.serviceRecord.upsert({
    where: {
      vehicleId_cycleNumber: {
        vehicleId: vehicleDue.id,
        cycleNumber: 2,
      },
    },
    update: {
      status: ServiceStatus.DUE,
      description: "Routine maintenance - engine oil and filters",
      dueAt: dueAtDueVehicle,
      triggerType: ServiceTrigger.MILEAGE,
      scheduledDate: null,
      completedAt: null,
      completedOdometer: null,
    },
    create: {
      vehicleId: vehicleDue.id,
      createdById: manager.id,
      cycleNumber: 2,
      status: ServiceStatus.DUE,
      description: "Routine maintenance - engine oil and filters",
      dueAt: dueAtDueVehicle,
      triggerType: ServiceTrigger.MILEAGE,
    },
  });

  // Cycle 2: Booked
  const bookedRecord = await prisma.serviceRecord.upsert({
    where: {
      vehicleId_cycleNumber: {
        vehicleId: vehicleBooked.id,
        cycleNumber: 2,
      },
    },
    update: {
      status: ServiceStatus.BOOKED,
      description: "Brake inspection and pad replacement",
      dueAt: new Date("2026-08-15T09:00:00Z"),
      triggerType: ServiceTrigger.DATE,
      scheduledDate: new Date("2026-09-05T09:00:00Z"),
    },
    create: {
      vehicleId: vehicleBooked.id,
      createdById: manager.id,
      cycleNumber: 2,
      status: ServiceStatus.BOOKED,
      description: "Brake inspection and pad replacement",
      dueAt: new Date("2026-08-15T09:00:00Z"),
      triggerType: ServiceTrigger.DATE,
      scheduledDate: new Date("2026-09-05T09:00:00Z"),
    },
  });

  // Cycle 3: In Service
  const inServiceRecord = await prisma.serviceRecord.upsert({
    where: {
      vehicleId_cycleNumber: {
        vehicleId: vehicleInService.id,
        cycleNumber: 2,
      },
    },
    update: {
      status: ServiceStatus.IN_SERVICE,
      description: "Transmission inspection and clutch work",
      dueAt: new Date("2026-08-10T09:00:00Z"),
      triggerType: ServiceTrigger.MILEAGE,
      scheduledDate: new Date("2026-08-28T09:00:00Z"),
    },
    create: {
      vehicleId: vehicleInService.id,
      createdById: manager.id,
      cycleNumber: 2,
      status: ServiceStatus.IN_SERVICE,
      description: "Transmission inspection and clutch work",
      dueAt: new Date("2026-08-10T09:00:00Z"),
      triggerType: ServiceTrigger.MILEAGE,
      scheduledDate: new Date("2026-08-28T09:00:00Z"),
    },
  });

  // Cycle 1: Completed historical record
  const completedRecord = await prisma.serviceRecord.upsert({
    where: {
      vehicleId_cycleNumber: {
        vehicleId: vehicleCompleted.id,
        cycleNumber: 1,
      },
    },
    update: {
      status: ServiceStatus.COMPLETED,
      description: "Full service - oil, filters and tyre rotation",
      dueAt: new Date("2026-05-01T09:00:00Z"),
      triggerType: ServiceTrigger.DATE,
      scheduledDate: new Date("2026-05-03T09:00:00Z"),
      completedAt: new Date("2026-05-04T15:00:00Z"),
      completedOdometer: 81000,
    },
    create: {
      vehicleId: vehicleCompleted.id,
      createdById: manager.id,
      cycleNumber: 1,
      status: ServiceStatus.COMPLETED,
      description: "Full service - oil, filters and tyre rotation",
      dueAt: new Date("2026-05-01T09:00:00Z"),
      triggerType: ServiceTrigger.DATE,
      scheduledDate: new Date("2026-05-03T09:00:00Z"),
      completedAt: new Date("2026-05-04T15:00:00Z"),
      completedOdometer: 81000,
    },
  });

  // Cycle 2 for same vehicle: Due
  const nextDueRecord = await prisma.serviceRecord.upsert({
    where: {
      vehicleId_cycleNumber: {
        vehicleId: vehicleCompleted.id,
        cycleNumber: 2,
      },
    },
    update: {
      status: ServiceStatus.DUE,
      description: "Next scheduled preventive maintenance",
      dueAt: new Date("2026-08-01T09:00:00Z"),
      triggerType: ServiceTrigger.DATE,
      scheduledDate: null,
      completedAt: null,
      completedOdometer: null,
    },
    create: {
      vehicleId: vehicleCompleted.id,
      createdById: manager.id,
      cycleNumber: 2,
      status: ServiceStatus.DUE,
      description: "Next scheduled preventive maintenance",
      dueAt: new Date("2026-08-01T09:00:00Z"),
      triggerType: ServiceTrigger.DATE,
    },
  });

  // Cycle 2: Overdue
  const overdueRecord = await prisma.serviceRecord.upsert({
    where: {
      vehicleId_cycleNumber: {
        vehicleId: vehicleOverdue.id,
        cycleNumber: 2,
      },
    },
    update: {
      status: ServiceStatus.DUE,
      description: "Urgent preventive maintenance - mileage interval reached",
      dueAt: new Date("2026-07-20T09:00:00Z"),
      triggerType: ServiceTrigger.MILEAGE,
      scheduledDate: null,
      completedAt: null,
      completedOdometer: null,
    },
    create: {
      vehicleId: vehicleOverdue.id,
      createdById: manager.id,
      cycleNumber: 2,
      status: ServiceStatus.DUE,
      description: "Urgent preventive maintenance - mileage interval reached",
      dueAt: new Date("2026-07-20T09:00:00Z"),
      triggerType: ServiceTrigger.MILEAGE,
    },
  });

  // Historical completed service for vehicleHistory
  const historyRecord = await prisma.serviceRecord.upsert({
    where: {
      vehicleId_cycleNumber: {
        vehicleId: vehicleHistory.id,
        cycleNumber: 1,
      },
    },
    update: {
      status: ServiceStatus.COMPLETED,
      description: "Oil change and routine inspection",
      dueAt: new Date("2026-05-10T09:00:00Z"),
      triggerType: ServiceTrigger.MILEAGE,
      scheduledDate: new Date("2026-05-12T09:00:00Z"),
      completedAt: new Date("2026-05-12T14:00:00Z"),
      completedOdometer: 25000,
    },
    create: {
      vehicleId: vehicleHistory.id,
      createdById: manager.id,
      cycleNumber: 1,
      status: ServiceStatus.COMPLETED,
      description: "Oil change and routine inspection",
      dueAt: new Date("2026-05-10T09:00:00Z"),
      triggerType: ServiceTrigger.MILEAGE,
      scheduledDate: new Date("2026-05-12T09:00:00Z"),
      completedAt: new Date("2026-05-12T14:00:00Z"),
      completedOdometer: 25000,
    },
  });

  // Silence unused variable warnings in case TypeScript settings become stricter.
  

  // ---------------------------------------------------------
  // TECHNICIAN ASSIGNMENTS
  // ---------------------------------------------------------

  await prisma.serviceRecordTechnician.upsert({
    where: {
      serviceRecordId_technicianId: {
        serviceRecordId: bookedRecord.id,
        technicianId: tech1.id,
      },
    },
    update: {},
    create: {
      serviceRecordId: bookedRecord.id,
      technicianId: tech1.id,
    },
  });

  await prisma.serviceRecordTechnician.upsert({
    where: {
      serviceRecordId_technicianId: {
        serviceRecordId: inServiceRecord.id,
        technicianId: tech2.id,
      },
    },
    update: {},
    create: {
      serviceRecordId: inServiceRecord.id,
      technicianId: tech2.id,
    },
  });

  await prisma.serviceRecordTechnician.upsert({
    where: {
      serviceRecordId_technicianId: {
        serviceRecordId: inServiceRecord.id,
        technicianId: tech3.id,
      },
    },
    update: {},
    create: {
      serviceRecordId: inServiceRecord.id,
      technicianId: tech3.id,
    },
  });

  await prisma.serviceRecordTechnician.upsert({
    where: {
      serviceRecordId_technicianId: {
        serviceRecordId: completedRecord.id,
        technicianId: tech1.id,
      },
    },
    update: {},
    create: {
      serviceRecordId: completedRecord.id,
      technicianId: tech1.id,
    },
  });

  await prisma.serviceRecordTechnician.upsert({
    where: {
      serviceRecordId_technicianId: {
        serviceRecordId: completedRecord.id,
        technicianId: tech2.id,
      },
    },
    update: {},
    create: {
      serviceRecordId: completedRecord.id,
      technicianId: tech2.id,
    },
  });

  await prisma.serviceRecordTechnician.upsert({
    where: {
      serviceRecordId_technicianId: {
        serviceRecordId: historyRecord.id,
        technicianId: tech3.id,
      },
    },
    update: {},
    create: {
      serviceRecordId: historyRecord.id,
      technicianId: tech3.id,
    },
  });

  // ---------------------------------------------------------
  // AUDIT TIMELINE
  // ---------------------------------------------------------

  await prisma.auditEvent.createMany({
    data: [
      {
        serviceRecordId: dueRecord.id,
        actorId: manager.id,
        type: AuditEventType.CREATED,
      },
      {
        serviceRecordId: bookedRecord.id,
        actorId: manager.id,
        type: AuditEventType.CREATED,
      },
      {
        serviceRecordId: bookedRecord.id,
        actorId: manager.id,
        type: AuditEventType.TECHNICIAN_ASSIGNED,
        technicianId: tech1.id,
      },
      {
        serviceRecordId: bookedRecord.id,
        actorId: manager.id,
        type: AuditEventType.STATUS_CHANGED,
        oldStatus: ServiceStatus.DUE,
        newStatus: ServiceStatus.BOOKED,
      },
      {
        serviceRecordId: inServiceRecord.id,
        actorId: manager.id,
        type: AuditEventType.CREATED,
      },
      {
        serviceRecordId: inServiceRecord.id,
        actorId: manager.id,
        type: AuditEventType.TECHNICIAN_ASSIGNED,
        technicianId: tech2.id,
      },
      {
        serviceRecordId: inServiceRecord.id,
        actorId: manager.id,
        type: AuditEventType.TECHNICIAN_ASSIGNED,
        technicianId: tech3.id,
      },
      {
        serviceRecordId: inServiceRecord.id,
        actorId: manager.id,
        type: AuditEventType.STATUS_CHANGED,
        oldStatus: ServiceStatus.DUE,
        newStatus: ServiceStatus.BOOKED,
      },
      {
        serviceRecordId: inServiceRecord.id,
        actorId: manager.id,
        type: AuditEventType.STATUS_CHANGED,
        oldStatus: ServiceStatus.BOOKED,
        newStatus: ServiceStatus.IN_SERVICE,
      },
      {
        serviceRecordId: completedRecord.id,
        actorId: manager.id,
        type: AuditEventType.CREATED,
      },
      {
        serviceRecordId: completedRecord.id,
        actorId: manager.id,
        type: AuditEventType.STATUS_CHANGED,
        oldStatus: ServiceStatus.DUE,
        newStatus: ServiceStatus.BOOKED,
      },
      {
        serviceRecordId: completedRecord.id,
        actorId: manager.id,
        type: AuditEventType.STATUS_CHANGED,
        oldStatus: ServiceStatus.BOOKED,
        newStatus: ServiceStatus.IN_SERVICE,
      },
      {
        serviceRecordId: completedRecord.id,
        actorId: manager.id,
        type: AuditEventType.STATUS_CHANGED,
        oldStatus: ServiceStatus.IN_SERVICE,
        newStatus: ServiceStatus.COMPLETED,
      },
      {
        serviceRecordId: nextDueRecord.id,
        actorId: manager.id,
        type: AuditEventType.CREATED,
      },
      {
        serviceRecordId: overdueRecord.id,
        actorId: manager.id,
        type: AuditEventType.CREATED,
      },
      {
        serviceRecordId: historyRecord.id,
        actorId: manager.id,
        type: AuditEventType.CREATED,
      },
      {
        serviceRecordId: historyRecord.id,
        actorId: manager.id,
        type: AuditEventType.STATUS_CHANGED,
        oldStatus: ServiceStatus.DUE,
        newStatus: ServiceStatus.BOOKED,
      },
      {
        serviceRecordId: historyRecord.id,
        actorId: manager.id,
        type: AuditEventType.STATUS_CHANGED,
        oldStatus: ServiceStatus.BOOKED,
        newStatus: ServiceStatus.IN_SERVICE,
      },
      {
        serviceRecordId: historyRecord.id,
        actorId: manager.id,
        type: AuditEventType.STATUS_CHANGED,
        oldStatus: ServiceStatus.IN_SERVICE,
        newStatus: ServiceStatus.COMPLETED,
      },
    ],
    skipDuplicates: true,
  });

  // ---------------------------------------------------------
  // OVERDUE ALERTS
  // ---------------------------------------------------------

  await prisma.alert.upsert({
    where: {
      serviceRecordId: overdueRecord.id,
    },
    update: {
      vehicleId: vehicleOverdue.id,
      dismissedAt: null,
      dismissedById: null,
      resolvedAt: null,
    },
    create: {
      vehicleId: vehicleOverdue.id,
      serviceRecordId: overdueRecord.id,
    },
  });

  // ---------------------------------------------------------
  // OUTPUT
  // ---------------------------------------------------------

  console.log("");
  console.log("Seed completed successfully.");
  console.log("");
  console.log("Demo credentials:");
  console.log(`Manager:     manager@fleetdemo.com / ${DEMO_PASSWORD}`);
  console.log(`Technician1: tech1@fleetdemo.com / ${DEMO_PASSWORD}`);
  console.log(`Technician2: tech2@fleetdemo.com / ${DEMO_PASSWORD}`);
  console.log(`Technician3: tech3@fleetdemo.com / ${DEMO_PASSWORD}`);
  console.log("");
  console.log(`Vehicles seeded: ${vehicles.length}`);
  console.log("Service records seeded: 7");
  console.log("Overdue alerts seeded: 1");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });