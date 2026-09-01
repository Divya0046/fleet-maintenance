export function calculateNextDueDate(
  lastServiceAt: Date,
  intervalDays: number,
): Date {
  const next = new Date(lastServiceAt);
  next.setDate(next.getDate() + intervalDays);
  return next;
}

export function calculateNextDueOdometer(
  lastServiceOdometer: number,
  mileageIntervalKm: number,
): number {
  return lastServiceOdometer + mileageIntervalKm;
}

export function isServiceDue(input: {
  now: Date;
  currentOdometer: number;
  lastServiceAt: Date;
  lastServiceOdometer: number;
  serviceIntervalDays: number;
  mileageIntervalKm: number;
}): boolean {
  const dateDue = calculateNextDueDate(
    input.lastServiceAt,
    input.serviceIntervalDays,
  );

  const mileageDue =
    input.currentOdometer >=
    calculateNextDueOdometer(
      input.lastServiceOdometer,
      input.mileageIntervalKm,
    );

  return input.now >= dateDue || mileageDue;
}

export function isServiceOverdue(input: {
  now: Date;
  dueAt: Date;
  gracePeriodDays: number;
}): boolean {
  const overdueAt = new Date(input.dueAt);
  overdueAt.setDate(
    overdueAt.getDate() + input.gracePeriodDays,
  );

  return input.now > overdueAt;
}