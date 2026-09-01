import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../auth/middleware";
import type { AuthenticatedRequest } from "../auth/middleware";

const router = Router();

router.get("/:id/timeline", requireAuth, async (req, res) => {
  const id = req.params.id;

  if (Array.isArray(id) || !id) {
    res.status(400).json({ error: "Invalid service record id" });
    return;
  }

  const user = (req as AuthenticatedRequest).user;

  const record = await prisma.serviceRecord.findUnique({
    where: { id },
    include: { technicians: true },
  });

  if (!record) {
    res.status(404).json({ error: "Service record not found" });
    return;
  }

  if (
    user.role === "TECHNICIAN" &&
    !record.technicians.some((t) => t.technicianId === user.id)
  ) {
    res.status(403).json({ error: "You are not assigned to this record" });
    return;
  }

  const events = await prisma.auditEvent.findMany({
    where: { serviceRecordId: id },
    include: {
      actor: {
        select: { id: true, name: true, email: true },
      },
      technician: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  res.json({ events });
});

export default router;