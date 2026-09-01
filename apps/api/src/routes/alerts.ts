import { Router } from "express";
import { Role } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from "../auth/middleware";
//import { requireAuth, requireRole } from "../auth/middleware";
import { isOverdue } from "../services/maintenance";


const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const now = new Date();

  const dueRecords = await prisma.serviceRecord.findMany({
    where: {
      status: "DUE",
    },
    include: {
      vehicle: true,
      alert: true,
    },
    orderBy: {
      dueAt: "asc",
    },
  });

  const alerts = [];

  for (const record of dueRecords) {
    if (
      !isOverdue({
        now,
        dueAt: record.dueAt,
        gracePeriodDays:
          record.vehicle.overdueGracePeriodDays,
      })
    ) {
      continue;
    }

    const existing = record.alert;

    // A dismissed alert remains dismissed for this service cycle.
    if (existing?.dismissedAt && !existing.resolvedAt) {
      alerts.push({
        ...existing,
        vehicle: record.vehicle,
        serviceRecord: record,
      });
      continue;
    }

    const alert = await prisma.alert.upsert({
      where: {
        serviceRecordId: record.id,
      },
      update: {
        resolvedAt: null,
      },
      create: {
        vehicleId: record.vehicleId,
        serviceRecordId: record.id,
      },
    });

    alerts.push({
      ...alert,
      vehicle: record.vehicle,
      serviceRecord: record,
    });
  }

  res.json({ alerts });
});

router.post(
  "/:id/dismiss",
  requireAuth,
  requireRole(Role.FLEET_MANAGER),
  async (req, res) => {
    const id = req.params.id;

    if (Array.isArray(id) || !id) {
      res.status(400).json({
        error: "Invalid alert id",
      });
      return;
    }

   const user = (req as AuthenticatedRequest).user;

    const alert = await prisma.alert.findUnique({
      where: { id },
    });

    if (!alert) {
      res.status(404).json({
        error: "Alert not found",
      });
      return;
    }

    const updated = await prisma.alert.update({
      where: { id },
      data: {
        dismissedAt: new Date(),
        dismissedById: user.id,
      },
    });

    res.json({ alert: updated });
  },
);

export default router;