import "dotenv/config";
import jwt from "jsonwebtoken";
import type { Role } from "../generated/prisma/enums";

const JWT_SECRET = process.env.JWT_SECRET ?? "";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

export type AuthTokenPayload = {
  userId: string;
  role: Role;
};

export function createAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "8h",
  });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET);

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.userId !== "string" ||
    typeof decoded.role !== "string"
  ) {
    throw new Error("Invalid authentication token payload");
  }

  return {
    userId: decoded.userId,
    role: decoded.role as Role,
  };
}