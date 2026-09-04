import { Router } from "express";
import { z } from "zod";
import {
  Role,
  ServiceStatus,
  ServiceTrigger,
} from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import {
  requireAuth,
  requireRole,
} from "../auth/middleware";

const router = Router();

const vehicleSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(30),
  make: z.string().trim().min(1).max(50),
  model: z.string().trim().min(1).max(50),
  currentOdometer: z.number().int().min(0),
  serviceIntervalDays: z.number().int().positive(),
  mileageIntervalKm: z.number().int().positive(),
  overdueGracePeriodDays: z.number().int().positive(),
});

const updateVehicleSchema = vehicleSchema.partial();

function getVehicleId(
  req: Parameters<Parameters<typeof router.get>[1]>[0],
  res: Parameters<Parameters<typeof router.get>[1]>[1],
): string | null {
  const vehicleId = req.params.id;

  if (Array.isArray(vehicleId) || !vehicleId) {
    res.status(400).json({
      error: "Invalid vehicle id",
    });
    return null;
  }

  return vehicleId;
}

router.get("/", requireAuth, async (_req, res) => {
  const vehicles = await prisma.vehicle.findMany({
    where: {
      isArchived: false,
    },
    orderBy: {
      registrationNumber: "asc",
    },
  });

  res.json({
    vehicles,
  });
});

router.post(
  "/",
  requireAuth,
  requireRole(Role.FLEET_MANAGER),
  async (req, res) => {
    const result = vehicleSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: "Invalid vehicle data",
        details: result.error.flatten(),
      });
      return;
    }

    const data = result.data;

    try {
      const vehicle = await prisma.vehicle.create({
        data: {
          ...data,
          lastServiceAt: new Date(),
          lastServiceOdometer: data.currentOdometer,
        },
      });

      res.status(201).json({
        vehicle,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        res.status(409).json({
          error: "A vehicle with that registration number already exists",
        });
        return;
      }

      throw error;
    }
  },
);

router.post(
  "/:id/archive",
  requireAuth,
  requireRole(Role.FLEET_MANAGER),
  async (req, res) => {
    const vehicleId = getVehicleId(req, res);

    if (!vehicleId) {
      return;
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: vehicleId,
      },
    });

    if (!vehicle) {
      res.status(404).json({
        error: "Vehicle not found",
      });
      return;
    }

    const updated = await prisma.vehicle.update({
      where: {
        id: vehicleId,
      },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });

    res.json({
      vehicle: updated,
    });
  },
);

router.patch(
  "/:id",
  requireAuth,
  requireRole(Role.FLEET_MANAGER),
  async (req, res) => {
    const vehicleId = getVehicleId(req, res);

    if (!vehicleId) {
      return;
    }

    const result = updateVehicleSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: "Invalid vehicle data",
        details: result.error.flatten(),
      });
      return;
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: vehicleId,
      },
    });

    if (!vehicle) {
      res.status(404).json({
        error: "Vehicle not found",
      });
      return;
    }

    const newOdometer = result.data.currentOdometer;

    if (
      newOdometer !== undefined &&
      newOdometer < vehicle.currentOdometer
    ) {
      res.status(400).json({
        error: "Odometer reading cannot decrease",
      });
      return;
    }

    const now = new Date();

    try {
      const updated = await prisma.$transaction(async (tx) => {
        /*
         * Update the vehicle.
         */
        const updatedVehicle = await tx.vehicle.update({
          where: {
            id: vehicleId,
          },
          data: result.data,
        });

        /*
         * Handle maintenance trigger when the odometer changes.
         *
         * Mileage becomes the trigger only when this specific update
         * crosses the mileage threshold AND the date threshold has not
         * already been reached.
         */
        if (newOdometer !== undefined) {
          const mileageThreshold =
            vehicle.lastServiceOdometer +
            vehicle.mileageIntervalKm;

          const crossedMileageThreshold =
            vehicle.currentOdometer < mileageThreshold &&
            newOdometer >= mileageThreshold;

          if (crossedMileageThreshold) {
            const dateDueAt = new Date(
              vehicle.lastServiceAt.getTime() +
                vehicle.serviceIntervalDays *
                  24 *
                  60 *
                  60 *
                  1000,
            );

            /*
             * Mileage wins only if it is reached before the date interval.
             */
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
        }

        return updatedVehicle;
      });

      res.json({
        vehicle: updated,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        res.status(409).json({
          error: "A vehicle with that registration number already exists",
        });
        return;
      }

      throw error;
    }
  },
);

export default router;