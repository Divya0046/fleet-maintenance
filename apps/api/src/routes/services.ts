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

const descriptionSchema = z.object({
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
  status: z.enum(["DUE", "BOOKED", "IN_SERVICE", "COMPLETED"]).optional(),
  technicianId: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["scheduledDate", "status", "updatedAt"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

function getParam(
  value: string | string[] | undefined,
  res: Parameters<Parameters<typeof router.get>[1]>[1],
  message: string,
) {
  if (!value || Array.isArray(value)) {
    res.status(400).json({ error: message });
    return null;
  }

  return value;
}

function canTransition(
  current: ServiceStatus,
  next: ServiceStatus,
): boolean {
  return (
    (current === ServiceStatus.DUE && next === ServiceStatus.BOOKED) ||
    (current === ServiceStatus.BOOKED && next === ServiceStatus.IN_SERVICE) ||
    (current === ServiceStatus.IN_SERVICE && next === ServiceStatus.COMPLETED)
  );
}

function isAssigned(
  record: { technicians: Array<{ technicianId: string }> },
  userId: string,
): boolean {
  return record.technicians.some(
    (assignment) => assignment.technicianId === userId,
  );
}

/**
 * GET /api/services
 *
 * Managers can see all records.
 * Technicians can ONLY see records assigned to themselves.
 *
 * Search/filter/sort/pagination are performed on the server.
 */
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

/**
 * GET /api/services/vehicle/:vehicleId
 *
 * Vehicle service history.
 */
router.get("/vehicle/:vehicleId", requireAuth, async (req, res) => {
  const vehicleId = getParam(
    req.params.vehicleId,
    res,
    "Invalid vehicle id",
  );

  if (!vehicleId) return;

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

/**
 * POST /api/services
 *
 * Only managers can create service records.
 */
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

    const user = (req as AuthenticatedRequest).user;

    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: parsed.data.vehicleId,
      },
    });

    if (!vehicle || vehicle.isArchived) {
      res.status(404).json({
        error: "Active vehicle not found",
      });
      return;
    }

    const cycleNumber = vehicle.currentServiceCycle + 1;

    const existing = await prisma.serviceRecord.findUnique({
      where: {
        vehicleId_cycleNumber: {
          vehicleId: vehicle.id,
          cycleNumber,
        },
      },
    });

    if (existing) {
      res.status(409).json({
        error: "A service record already exists for this service cycle",
      });
      return;
    }

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceRecord.create({
        data: {
          vehicleId: vehicle.id,
          createdById: user.id,
          cycleNumber,
          status: ServiceStatus.DUE,
          description: parsed.data.description,
          dueAt: new Date(
            vehicle.lastServiceAt.getTime() +
              vehicle.serviceIntervalDays * 24 * 60 * 60 * 1000,
          ),
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

/**
 * PATCH /api/services/:id/description
 *
 * Managers can edit any record.
 * Technicians can only edit records assigned to themselves.
 */
router.patch("/:id/description", requireAuth, async (req, res) => {
  const id = getParam(
    req.params.id,
    res,
    "Invalid service record id",
  );

  if (!id) return;

  const parsed = descriptionSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid description",
      details: parsed.error.flatten(),
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

  if (
    user.role === Role.TECHNICIAN &&
    !isAssigned(record, user.id)
  ) {
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
});

/**
 * POST /api/services/:id/transition
 *
 * Enforces:
 * DUE -> BOOKED
 * BOOKED -> IN_SERVICE
 * IN_SERVICE -> COMPLETED
 */
router.post("/:id/transition", requireAuth, async (req, res) => {
  const id = getParam(
    req.params.id,
    res,
    "Invalid service record id",
  );

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

  if (!canTransition(record.status, nextStatus)) {
    res.status(409).json({
      error: `Invalid transition from ${record.status} to ${nextStatus}`,
    });
    return;
  }

  const manager = user.role === Role.FLEET_MANAGER;
  const assigned = isAssigned(record, user.id);

  if (!manager && !assigned) {
    res.status(403).json({
      error: "You are not assigned to this service record",
    });
    return;
  }

  // Booking is a manager operation because it establishes
  // the scheduled date and technician assignments.
  if (nextStatus === ServiceStatus.BOOKED && !manager) {
    res.status(403).json({
      error: "Only a fleet manager can book a service record",
    });
    return;
  }

  if (nextStatus === ServiceStatus.BOOKED) {
    if (
      !parsed.data.scheduledDate ||
      !parsed.data.technicianIds ||
      parsed.data.technicianIds.length === 0
    ) {
      res.status(400).json({
        error: "Booking requires a scheduled date and technician",
      });
      return;
    }

    const technicians = await prisma.user.findMany({
      where: {
        id: {
          in: parsed.data.technicianIds,
        },
        role: Role.TECHNICIAN,
      },
      select: {
        id: true,
      },
    });

    if (technicians.length !== parsed.data.technicianIds.length) {
      res.status(400).json({
        error: "Every assigned user must be a valid technician",
      });
      return;
    }
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
      const completedAt = new Date();
      const completedOdometer = record.vehicle.currentOdometer;

      await tx.serviceRecord.update({
        where: { id },
        data: {
          status: ServiceStatus.COMPLETED,
          completedAt,
          completedOdometer,
        },
      });

      // Completing the service resets BOTH maintenance baselines.
      await tx.vehicle.update({
        where: {
          id: record.vehicleId,
        },
        data: {
          lastServiceAt: completedAt,
          lastServiceOdometer: completedOdometer,
          currentServiceCycle: record.cycleNumber,
        },
      });

      // Create the next service-cycle record as DUE.
      // The actual date/mileage due decision is calculated from
      // the newly reset Vehicle baseline.
      const nextCycle = record.cycleNumber + 1;

      const nextDueAt = new Date(
        completedAt.getTime() +
          record.vehicle.serviceIntervalDays *
            24 *
            60 *
            60 *
            1000,
      );

      const nextRecord = await tx.serviceRecord.create({
        data: {
          vehicleId: record.vehicleId,
          createdById: record.createdById,
          cycleNumber: nextCycle,
          status: ServiceStatus.DUE,
          description: "Next scheduled preventive maintenance",
          dueAt: nextDueAt,
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
});

/**
 * POST /api/services/:id/assign
 *
 * Manager-only technician assignment.
 */
router.post(
  "/:id/assign",
  requireAuth,
  requireRole(Role.FLEET_MANAGER),
  async (req, res) => {
    const id = getParam(
      req.params.id,
      res,
      "Invalid service record id",
    );

    if (!id) return;

    const parsed = assignmentSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid technician assignment",
      });
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

    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.serviceRecordTechnician.upsert({
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

      return assignment;
    });

    res.status(201).json({ assignment: result });
  },
);

/**
 * DELETE /api/services/:id/assign/:technicianId
 *
 * Manager-only unassignment.
 */
router.delete(
  "/:id/assign/:technicianId",
  requireAuth,
  requireRole(Role.FLEET_MANAGER),
  async (req, res) => {
    const id = getParam(
      req.params.id,
      res,
      "Invalid service record id",
    );

    const technicianId = getParam(
      req.params.technicianId,
      res,
      "Invalid technician id",
    );

    if (!id || !technicianId) return;

    const manager = (req as AuthenticatedRequest).user;

    const assignment = await prisma.serviceRecordTechnician.findUnique({
      where: {
        serviceRecordId_technicianId: {
          serviceRecordId: id,
          technicianId,
        },
      },
    });

    if (!assignment) {
      res.status(404).json({
        error: "Technician is not assigned to this record",
      });
      return;
    }

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
      await tx.alert.updateMany({
  where: {
    serviceRecordId: id,
    resolvedAt: null,
  },
  data: {
    resolvedAt: new Date(),
  },
});
    });

    res.status(204).send();
  },
);


export default router;