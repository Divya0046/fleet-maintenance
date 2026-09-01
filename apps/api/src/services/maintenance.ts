export function getDateDueAt(
  lastServiceAt: Date,
  intervalDays: number,
): Date {
  const date = new Date(lastServiceAt);
  date.setDate(date.getDate() + intervalDays);
  return date;
}

export function getMileageDueAt(
  lastServiceOdometer: number,
  mileageIntervalKm: number,
): number {
  return lastServiceOdometer + mileageIntervalKm;
}

export function getDueTrigger(input: {
  now: Date;
  lastServiceAt: Date;
  lastServiceOdometer: number;
  currentOdometer: number;
  serviceIntervalDays: number;
  mileageIntervalKm: number;
}) {
  const dateDueAt = getDateDueAt(
    input.lastServiceAt,
    input.serviceIntervalDays,
  );

  const mileageDueAt = getMileageDueAt(
    input.lastServiceOdometer,
    input.mileageIntervalKm,
  );

  const mileageReached =
    input.currentOdometer >= mileageDueAt;

  const dateReached = input.now >= dateDueAt;

  if (!dateReached && !mileageReached) {
    return {
      due: false,
      triggerType: null,
      dueAt: dateDueAt,
    };
  }

  if (
    mileageReached &&
    (!dateReached ||
      new Date(input.now).getTime() <
        dateDueAt.getTime())
  ) {
    return {
      due: true,
      triggerType: "MILEAGE" as const,
      dueAt: input.now,
    };
  }

  return {
    due: true,
    triggerType: "DATE" as const,
    dueAt: dateDueAt,
  };
}

export function getOverdueAt(
  dueAt: Date,
  gracePeriodDays: number,
): Date {
  const overdueAt = new Date(dueAt);
  overdueAt.setDate(
    overdueAt.getDate() + gracePeriodDays,
  );
  return overdueAt;
}

export function isOverdue(input: {
  now: Date;
  dueAt: Date;
  gracePeriodDays: number;
}) {
  return (
    input.now.getTime() >
    getOverdueAt(
      input.dueAt,
      input.gracePeriodDays,
    ).getTime()
  );
}