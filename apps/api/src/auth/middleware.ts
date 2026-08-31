import type { NextFunction, Request, Response } from "express";
import type { Role } from "../generated/prisma/enums";
import { verifyAuthToken } from "./token";

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    role: Role;
  };
};

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Authentication required",
    });
    return;
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = verifyAuthToken(token);

    (req as AuthenticatedRequest).user = {
      id: payload.userId,
      role: payload.role,
    };

    next();
  } catch {
    res.status(401).json({
      error: "Invalid or expired authentication token",
    });
  }
}

export function requireRole(...allowedRoles: Role[]) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const authenticatedRequest = req as AuthenticatedRequest;

    if (!authenticatedRequest.user) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(authenticatedRequest.user.role)) {
      res.status(403).json({
        error: "You do not have permission to perform this action",
      });
      return;
    }

    next();
  };
}