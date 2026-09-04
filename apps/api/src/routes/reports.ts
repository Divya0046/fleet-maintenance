import { Router } from "express";
//import { Role } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../auth/middleware";
import {
  Role,
  ServiceStatus,
  ServiceTrigger,
} from "../generated/prisma/enums";
const router = Router();

router.get("/dashboard", requireAuth, async (_req, res) => {
  const now = new Date();

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(now.getDate() - 56);
  eightWeeksAgo.setHours(0, 0, 0, 0);

 const [
  vehicles,
  inService,
  completedThisWeek,
  recentServiceRecords,
  technicianAssignments,
] = await Promise.all([
  prisma.vehicle.findMany({
    where: { isArchived: false },
    select: {
      id: true,
      currentOdometer: true,
      lastServiceAt: true,
      lastServiceOdometer: true,
      serviceIntervalDays: true,
      mileageIntervalKm: true,
      overdueGracePeriodDays: true,
    },
  }),

  prisma.serviceRecord.count({
    where: {
      status: "IN_SERVICE",
    },
  }),

  prisma.serviceRecord.count({
    where: {
      status: "COMPLETED",
      completedAt: {
        gte: weekStart,
      },
    },
  }),

  prisma.serviceRecord.findMany({
    where: {
      completedAt: {
        gte: eightWeeksAgo,
      },
    },
    select: {
      status: true,
      completedAt: true,
      technicians: {
        include: {
          technician: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  }),

  prisma.serviceRecordTechnician.findMany({
    select: {
      technician: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  }),
]);


let due = 0;
let overdue = 0;

const dueRecords = await prisma.serviceRecord.findMany({
  where: {
    status: "DUE",
    vehicle: {
      isArchived: false,
    },
  },
  select: {
    dueAt: true,
    vehicle: {
      select: {
        overdueGracePeriodDays: true,
      },
    },
  },
});

for (const record of dueRecords) {
  if (now >= record.dueAt) {
    due += 1;

    const overdueAt = new Date(record.dueAt);
    overdueAt.setDate(
      overdueAt.getDate() +
        record.vehicle.overdueGracePeriodDays,
    );

    if (now > overdueAt) {
      overdue += 1;
    }
  }
}

const byStatus = await prisma.serviceRecord.groupBy({
  by: ["status"],
  _count: {
    _all: true,
  },
});

const technicianCounts = new Map<
  string,
  { technicianId: string; name: string; count: number }
>();

for (const assignment of technicianAssignments) {
  const current = technicianCounts.get(
    assignment.technician.id,
  );

  technicianCounts.set(assignment.technician.id, {
    technicianId: assignment.technician.id,
    name: assignment.technician.name,
    count: (current?.count ?? 0) + 1,
  });
}

  const weeks = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(eightWeeksAgo);
    start.setDate(eightWeeksAgo.getDate() + index * 7);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    const completed = recentServiceRecords.filter(
      (record) =>
        record.status === "COMPLETED" &&
        record.completedAt &&
        record.completedAt >= start &&
        record.completedAt < end,
    ).length;

    return {
      weekStart: start.toISOString(),
      completed,
    };
  });

  res.json({
    headlines: {
      vehiclesDue: due,
      vehiclesInService: inService,
      servicesCompletedThisWeek: completedThisWeek,
      vehiclesOverdue: overdue,
    },
    byStatus: byStatus.map((item) => ({
      status: item.status,
      count: item._count._all,
    })),
    byTechnician: Array.from(technicianCounts.values()),
    completedByWeek: weeks,
  });
});

router.post(
  "/odometer-import",
  requireAuth,
  requireRole(Role.FLEET_MANAGER),
  async (req, res) => {
    const text = typeof req.body?.csv === "string"
      ? req.body.csv
      : "";

    if (!text.trim()) {
      res.status(400).json({
        error: "CSV content is required",
      });
      return;
    }

    const { parse } = await import("csv-parse/sync");

    let rows: Array<Record<string, string>>;

    try {
      rows = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch {
      res.status(400).json({
        error: "Invalid CSV",
      });
      return;
    }

    const results = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];

      const registrationNumber =
        row.registrationNumber?.trim();

      const odometer = Number(row.odometer);

      if (!registrationNumber) {
        results.push({
          row: index + 2,
          success: false,
          reason: "registrationNumber is required",
        });
        continue;
      }

      if (!Number.isInteger(odometer) || odometer < 0) {
        results.push({
          row: index + 2,
          registrationNumber,
          success: false,
          reason: "odometer must be a non-negative integer",
        });
        continue;
      }

      const vehicle = await prisma.vehicle.findUnique({
        where: { registrationNumber },
      });

      if (!vehicle) {
        results.push({
          row: index + 2,
          registrationNumber,
          success: false,
          reason: "vehicle not found",
        });
        continue;
      }

      if (odometer < vehicle.currentOdometer) {
        results.push({
          row: index + 2,
          registrationNumber,
          success: false,
          reason: `reading ${odometer} is lower than current reading ${vehicle.currentOdometer}`,
        });
        continue;
      }
const now = new Date();

const mileageThreshold =
  vehicle.lastServiceOdometer +
  vehicle.mileageIntervalKm;

const crossedMileageThreshold =
  vehicle.currentOdometer < mileageThreshold &&
  odometer >= mileageThreshold;
     await prisma.$transaction(async (tx) => {
  await tx.vehicle.update({
    where: { id: vehicle.id },
    data: {
      currentOdometer: odometer,
    },
  });

  if (crossedMileageThreshold) {
    const dateDueAt = new Date(
      vehicle.lastServiceAt.getTime() +
        vehicle.serviceIntervalDays * 24 * 60 * 60 * 1000,
    );

    if (now < dateDueAt) {
      const activeDueRecord =
        await tx.serviceRecord.findFirst({
          where: {
            vehicleId: vehicle.id,
            status: ServiceStatus.DUE,
          },
          orderBy: {
            cycleNumber: "desc",
          },
        });

      if (activeDueRecord) {
        await tx.serviceRecord.update({
          where: {
            id: activeDueRecord.id,
          },
          data: {
            dueAt: now,
            triggerType: ServiceTrigger.MILEAGE,
          },
        });
      }
    }
  }
});

      results.push({
        row: index + 2,
        registrationNumber,
        success: true,
        odometer,
      });
    }

    res.json({
      total: results.length,
      succeeded: results.filter((r) => r.success).length,
      rejected: results.filter((r) => !r.success).length,
      results,
    });
  },
);

router.get(
  "/service-history.csv",
  requireAuth,
  async (_req, res) => {
    const records = await prisma.serviceRecord.findMany({
      include: {
        vehicle: {
          select: {
            registrationNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const header =
      "registrationNumber,description,status,dueAt,scheduledDate,completedAt,completedOdometer\n";

    const rows = records
      .map((record) =>
        [
          record.vehicle.registrationNumber,
          record.description,
          record.status,
          record.dueAt.toISOString(),
          record.scheduledDate?.toISOString() ?? "",
          record.completedAt?.toISOString() ?? "",
          record.completedOdometer ?? "",
        ]
          .map((value) =>
            `"${String(value).replaceAll('"', '""')}"`,
          )
          .join(","),
      )
      .join("\n");

    res.setHeader(
      "Content-Type",
      "text/csv; charset=utf-8",
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="service-history.csv"',
    );

    res.send(header + rows);
  },
);

export default router;