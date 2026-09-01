import { Router } from "express";
import { z } from "zod";
import {
  Role,
  ServiceStatus,
  ServiceTrigger,
  AuditEventType,
} from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from "../auth/middleware";

const router = Router();

const createSchema = z.object({
  vehicleId: z.string().min(1),
  description: z.string().trim().min(1).max(2000),
});

const updateDescriptionSchema = z.object({
  description: z.string().trim().min(1).max(2000),
});

const transitionSchema = z.object({
  status: z.enum(["BOOKED", "IN_SERVICE", "COMPLETED"]),
  scheduledDate: z.coerce.date().optional(),
  technicianIds: z.array(z.string().min(1)).optional(),
});

const assignmentSchema = z.object({
  technicianId: z.string().min(1),
});

const listSchema = z.object({
  vehicleId: z.string().optional(),
  status: z
    .enum(["DUE", "BOOKED", "IN_SERVICE", "COMPLETED"])
    .optional(),
  technicianId: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z
    .enum(["scheduledDate", "status", "updatedAt"])
    .default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

function getId(req: Parameters<Parameters<typeof router.get>[1]>[0], res: Parameters<Parameters<typeof router.get>[1]>[1]) {
  const id = req.params.id;

  if (Array.isArray(id) || !id) {
    res.status(400).json({ error: "Invalid service record id" });
    return null;
  }

  return id;
}

function isValidTransition(
  current: ServiceStatus,
  next: ServiceStatus,
): boolean {
  return (
    (current === ServiceStatus.DUE && next === ServiceStatus.BOOKED) ||
    (current === ServiceStatus.BOOKED &&
      next === ServiceStatus.IN_SERVICE) ||
    (current === ServiceStatus.IN_SERVICE &&
      next === ServiceStatus.COMPLETED)
  );
}

router.get("/", requireAuth, async (req, res) => {
  const parsed = listSchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid service filters" });
    return;
  }

  const {
    vehicleId,
    status,
    technicianId,
    search,
    page,
    pageSize,
    sortBy,
    sortOrder,
  } = parsed.data;

  const user = (req as AuthenticatedRequest).user;

  const where = {
    ...(vehicleId ? { vehicleId } : {}),
    ...(status ? { status: status as ServiceStatus } : {}),
    ...(search
      ? {
          description: {
            contains: search,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(user.role === Role.TECHNICIAN
      ? {
          technicians: {
            some: {
              technicianId: user.id,
            },
          },
        }
      : technicianId
        ? {
            technicians: {
              some: {
                technicianId,
              },
            },
          }
        : {}),
  };

  const [records, total] = await Promise.all([
    prisma.serviceRecord.findMany({
      where,
      include: {
        vehicle: true,
        technicians: {
          include: {
            technician: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.serviceRecord.count({ where }),
  ]);

  res.json({
    records,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

router.get("/vehicle/:vehicleId", requireAuth, async (req, res) => {
  const vehicleId = req.params.vehicleId;

  if (Array.isArray(vehicleId) || !vehicleId) {
    res.status(400).json({ error: "Invalid vehicle id" });
    return;
  }

  const user = (req as AuthenticatedRequest).user;

  const records = await prisma.serviceRecord.findMany({
    where: {
      vehicleId,
      ...(user.role === Role.TECHNICIAN
        ? {
            technicians: {
              some: {
                technicianId: user.id,
              },
            },
          }
        : {}),
    },
    include: {
      technicians: {
        include: {
          technician: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  res.json({ records });
});

router.post(
  "/",
  requireAuth,
  requireRole(Role.FLEET_MANAGER),
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid service record data",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { vehicleId, description } = parsed.data;
    const user = (req as AuthenticatedRequest).user;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle || vehicle.isArchived) {
      res.status(404).json({
        error: "Active vehicle not found",
      });
      return;
    }

    const cycleNumber = vehicle.currentServiceCycle + 1;

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceRecord.create({
        data: {
          vehicleId,
          createdById: user.id,
          cycleNumber,
          status: ServiceStatus.DUE,
          description,
          dueAt: new Date(),
        },
      });

      await tx.auditEvent.create({
        data: {
          serviceRecordId: created.id,
          actorId: user.id,
          type: AuditEventType.CREATED,
        },
      });

      return created;
    });

    res.status(201).json({ record });
  },
);

router.patch(
  "/:id/description",
  requireAuth,
  async (req, res) => {
    const id = getId(req, res);

    if (!id) return;

    const parsed = updateDescriptionSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid description",
      });
      return;
    }

    const user = (req as AuthenticatedRequest).user;

    const record = await prisma.serviceRecord.findUnique({
      where: { id },
      include: {
        technicians: true,
      },
    });

    if (!record) {
      res.status(404).json({
        error: "Service record not found",
      });
      return;
    }

    const allowed =
      user.role === Role.FLEET_MANAGER ||
      record.technicians.some(
        (assignment) => assignment.technicianId === user.id,
      );

    if (!allowed) {
      res.status(403).json({
        error: "You are not assigned to this service record",
      });
      return;
    }

    const updated = await prisma.serviceRecord.update({
      where: { id },
      data: {
        description: parsed.data.description,
      },
    });

    res.json({ record: updated });
  },
);

router.post(
  "/:id/transition",
  requireAuth,
  async (req, res) => {
    const id = getId(req, res);

    if (!id) return;

    const parsed = transitionSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid transition data",
        details: parsed.error.flatten(),
      });
      return;
    }

    const user = (req as AuthenticatedRequest).user;

    const record = await prisma.serviceRecord.findUnique({
      where: { id },
      include: {
        vehicle: true,
        technicians: true,
      },
    });

    if (!record) {
      res.status(404).json({
        error: "Service record not found",
      });
      return;
    }

    const nextStatus = parsed.data.status as ServiceStatus;

    if (!isValidTransition(record.status, nextStatus)) {
      res.status(409).json({
        error: `Invalid transition from ${record.status} to ${nextStatus}`,
      });
      return;
    }

    const isManager = user.role === Role.FLEET_MANAGER;
    const isAssigned = record.technicians.some(
      (assignment) => assignment.technicianId === user.id,
    );

    if (!isManager && !isAssigned) {
      res.status(403).json({
        error: "You are not assigned to this service record",
      });
      return;
    }

    if (nextStatus === ServiceStatus.BOOKED && !isManager) {
      res.status(403).json({
        error: "Only a fleet manager can book a service record",
      });
      return;
    }

    if (
      nextStatus === ServiceStatus.BOOKED &&
      (!parsed.data.scheduledDate ||
        !parsed.data.technicianIds ||
        parsed.data.technicianIds.length === 0)
    ) {
      res.status(400).json({
        error: "Booking requires a scheduled date and technician",
      });
      return;
    }

    if (
      parsed.data.technicianIds &&
      parsed.data.technicianIds.length > 0 &&
      !isManager
    ) {
      res.status(403).json({
        error: "Only a fleet manager can assign technicians",
      });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      if (
        nextStatus === ServiceStatus.BOOKED &&
        parsed.data.technicianIds
      ) {
        await tx.serviceRecordTechnician.deleteMany({
          where: {
            serviceRecordId: id,
          },
        });

        await tx.serviceRecordTechnician.createMany({
          data: parsed.data.technicianIds.map((technicianId) => ({
            serviceRecordId: id,
            technicianId,
          })),
        });
      }

      if (nextStatus === ServiceStatus.COMPLETED) {
        const completedOdometer = record.vehicle.currentOdometer;

        await tx.serviceRecord.update({
          where: { id },
          data: {
            status: ServiceStatus.COMPLETED,
            completedAt: new Date(),
            completedOdometer,
          },
        });

        await tx.vehicle.update({
          where: {
            id: record.vehicleId,
          },
          data: {
            lastServiceAt: new Date(),
            lastServiceOdometer: completedOdometer,
            currentServiceCycle: record.cycleNumber,
          },
        });

        const nextCycle = record.cycleNumber + 1;

        const nextDue = new Date();
        nextDue.setDate(
          nextDue.getDate() + record.vehicle.serviceIntervalDays,
        );

        const nextRecord = await tx.serviceRecord.create({
          data: {
            vehicleId: record.vehicleId,
            createdById: record.createdById,
            cycleNumber: nextCycle,
            status: ServiceStatus.DUE,
            description: "Next scheduled preventive maintenance",
            dueAt: nextDue,
            triggerType: ServiceTrigger.DATE,
          },
        });

        await tx.auditEvent.createMany({
          data: [
            {
              serviceRecordId: id,
              actorId: user.id,
              type: AuditEventType.STATUS_CHANGED,
              oldStatus: record.status,
              newStatus: ServiceStatus.COMPLETED,
            },
            {
              serviceRecordId: nextRecord.id,
              actorId: user.id,
              type: AuditEventType.CREATED,
            },
          ],
        });

        return nextRecord;
      }

      const updated = await tx.serviceRecord.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(nextStatus === ServiceStatus.BOOKED
            ? {
                scheduledDate: parsed.data.scheduledDate,
              }
            : {}),
        },
      });

      await tx.auditEvent.create({
        data: {
          serviceRecordId: id,
          actorId: user.id,
          type: AuditEventType.STATUS_CHANGED,
          oldStatus: record.status,
          newStatus: nextStatus,
        },
      });

      return updated;
    });

    res.json({ result });
  },
);

router.post(
  "/:id/assign",
  requireAuth,
  requireRole(Role.FLEET_MANAGER),
  async (req, res) => {
    const id = getId(req, res);

    if (!id) return;

    const parsed = assignmentSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid technician assignment" });
      return;
    }

    const technician = await prisma.user.findFirst({
      where: {
        id: parsed.data.technicianId,
        role: Role.TECHNICIAN,
      },
    });

    if (!technician) {
      res.status(404).json({
        error: "Technician not found",
      });
      return;
    }

    const manager = (req as AuthenticatedRequest).user;

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceRecordTechnician.upsert({
        where: {
          serviceRecordId_technicianId: {
            serviceRecordId: id,
            technicianId: technician.id,
          },
        },
        update: {},
        create: {
          serviceRecordId: id,
          technicianId: technician.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          serviceRecordId: id,
          actorId: manager.id,
          type: AuditEventType.TECHNICIAN_ASSIGNED,
          technicianId: technician.id,
        },
      });

      return created;
    });

    res.status(201).json({ assignment });
  },
);

router.delete(
  "/:id/assign/:technicianId",
  requireAuth,
  requireRole(Role.FLEET_MANAGER),
  async (req, res) => {
    const id = req.params.id;
    const technicianId = req.params.technicianId;

    if (
      Array.isArray(id) ||
      !id ||
      Array.isArray(technicianId) ||
      !technicianId
    ) {
      res.status(400).json({
        error: "Invalid id",
      });
      return;
    }

    const manager = (req as AuthenticatedRequest).user;

    await prisma.$transaction(async (tx) => {
      await tx.serviceRecordTechnician.delete({
        where: {
          serviceRecordId_technicianId: {
            serviceRecordId: id,
            technicianId,
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          serviceRecordId: id,
          actorId: manager.id,
          type: AuditEventType.TECHNICIAN_UNASSIGNED,
          technicianId,
        },
      });
    });

    res.status(204).send();
  },
);

export default router;