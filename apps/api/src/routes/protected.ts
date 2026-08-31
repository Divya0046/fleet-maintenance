import { Router } from "express";
import { Role } from "../generated/prisma/enums";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from "../auth/middleware";

const router = Router();

router.get("/me", requireAuth, (req, res) => {
  const user = (req as AuthenticatedRequest).user;

  res.json({
    id: user.id,
    role: user.role,
  });
});

router.get(
  "/manager-check",
  requireAuth,
  requireRole(Role.FLEET_MANAGER),
  (_req, res) => {
    res.json({
      message: "Manager authorization successful",
    });
  },
);

export default router;