import { Router } from "express";
import {
  AuditEventType,
  Role,
} from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../auth/middleware";

const router = Router();

router.get("/services/:serviceId/timeline", requireAuth, async (req, res) => {
  const serviceId = req.params.serviceId;

  if (Array.isArray(serviceId) || !serviceId) {
    res.status(400).json({ error: "Invalid service record id" });
    return;
  }

  const user = (req as AuthenticatedRequest).user;

  const record = await prisma.serviceRecord.findUnique({
    where: { id: serviceId },
    include: { technicians: true },
  });

  if (!record) {
    res.status(404).json({ error: "Service record not found" });
    return;
  }

  if (
    user.role === Role.TECHNICIAN &&
    !record.technicians.some((x) => x.technicianId === user.id)
  ) {
    res.status(403).json({
      error: "You are not assigned to this service record",
    });
    return;
  }

  const events = await prisma.auditEvent.findMany({
    where: { serviceRecordId: serviceId },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      technician: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  res.json({ events });
});

router.post(
  "/services/:serviceId/notes",
  requireAuth,
  async (req, res) => {
    const serviceId = req.params.serviceId;

    if (Array.isArray(serviceId) || !serviceId) {
      res.status(400).json({ error: "Invalid service record id" });
      return;
    }

    const text =
      typeof req.body?.noteText === "string"
        ? req.body.noteText.trim()
        : "";

    if (!text) {
      res.status(400).json({
        error: "noteText is required",
      });
      return;
    }

    const user = (req as AuthenticatedRequest).user;

    const record = await prisma.serviceRecord.findUnique({
      where: { id: serviceId },
      include: { technicians: true },
    });

    if (!record) {
      res.status(404).json({
        error: "Service record not found",
      });
      return;
    }

    if (
      user.role === Role.TECHNICIAN &&
      !record.technicians.some(
        (x) => x.technicianId === user.id,
      )
    ) {
      res.status(403).json({
        error: "You are not assigned to this service record",
      });
      return;
    }

    const event = await prisma.auditEvent.create({
      data: {
        serviceRecordId: serviceId,
        actorId: user.id,
        type: AuditEventType.NOTE_ADDED,
        noteText: text,
      },
    });

    res.status(201).json({ event });
  },
);

export default router;