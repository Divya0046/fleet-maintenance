import { Router } from "express";
import { Role } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../auth/middleware";

const router = Router();

router.get("/technicians", requireAuth, async (_req, res) => {
  const technicians = await prisma.user.findMany({
    where: {
      role: Role.TECHNICIAN,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  res.json({ technicians });
});

export default router;