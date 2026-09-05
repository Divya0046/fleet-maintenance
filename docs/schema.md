# Schema
# Schema

## Table-by-table structure

The database uses six tables/models: `User`, `Vehicle`, `ServiceRecord`, `ServiceRecordTechnician`, `AuditEvent`, and `Alert`.

### 1. User

| Column | Type | Notes |
|---|---|---|
| `id` | String | Primary key, generated with `cuid()` |
| `email` | String | Unique |
| `passwordHash` | String | Stores the password hash |
| `name` | String | User's name |
| `role` | Role enum | `FLEET_MANAGER` or `TECHNICIAN` |
| `createdAt` | DateTime | Defaults to current time |
| `updatedAt` | DateTime | Automatically updated |

A user can create many service records, be assigned to many service records, create many audit events, be referenced as a technician in audit events, and dismiss alerts. :contentReference[oaicite:0]{index=0}

### 2. Vehicle

| Column | Type | Notes |
|---|---|---|
| `id` | String | Primary key, generated with `cuid()` |
| `registrationNumber` | String | Unique vehicle identifier |
| `make` | String | Vehicle manufacturer |
| `model` | String | Vehicle model |
| `currentOdometer` | Int | Current mileage |
| `serviceIntervalDays` | Int | Date-based maintenance interval |
| `mileageIntervalKm` | Int | Mileage-based maintenance interval |
| `overdueGracePeriodDays` | Int | Grace period for overdue handling |
| `lastServiceAt` | DateTime | Maintenance date baseline |
| `lastServiceOdometer` | Int | Maintenance mileage baseline |
| `currentServiceCycle` | Int | Current maintenance cycle |
| `isArchived` | Boolean | Defaults to `false` |
| `archivedAt` | DateTime? | Set when archived |
| `createdAt` | DateTime | Defaults to current time |
| `updatedAt` | DateTime | Automatically updated |

Vehicles have indexes on archive state and current odometer. :contentReference[oaicite:1]{index=1}

### 3. ServiceRecord

| Column | Type | Notes |
|---|---|---|
| `id` | String | Primary key, generated with `cuid()` |
| `vehicleId` | String | Foreign key to `Vehicle` |
| `createdById` | String | Foreign key to `User` |
| `cycleNumber` | Int | Maintenance cycle number |
| `status` | ServiceStatus enum | `DUE`, `BOOKED`, `IN_SERVICE`, `COMPLETED` |
| `description` | String | Service description |
| `dueAt` | DateTime | When the service became due |
| `triggerType` | ServiceTrigger? | `DATE` or `MILEAGE` |
| `scheduledDate` | DateTime? | Booking date |
| `completedAt` | DateTime? | Completion timestamp |
| `completedOdometer` | Int? | Odometer at completion |
| `createdAt` | DateTime | Defaults to current time |
| `updatedAt` | DateTime | Automatically updated |

There is a unique constraint on `(vehicleId, cycleNumber)` and indexes supporting status/date, vehicle/status, updates, and creator lookups. :contentReference[oaicite:2]{index=2} :contentReference[oaicite:3]{index=3}

### 4. ServiceRecordTechnician

| Column | Type | Notes |
|---|---|---|
| `serviceRecordId` | String | Foreign key to `ServiceRecord` |
| `technicianId` | String | Foreign key to `User` |
| `assignedAt` | DateTime | Defaults to current time |

The pair `(serviceRecordId, technicianId)` is the composite primary key, with an additional index on `(technicianId, serviceRecordId)`. :contentReference[oaicite:4]{index=4}

### 5. AuditEvent

| Column | Type | Notes |
|---|---|---|
| `id` | String | Primary key, generated with `cuid()` |
| `serviceRecordId` | String | Foreign key to `ServiceRecord` |
| `actorId` | String | User who performed the action |
| `type` | AuditEventType | Event category |
| `oldStatus` | ServiceStatus? | Previous status when applicable |
| `newStatus` | ServiceStatus? | New status when applicable |
| `technicianId` | String? | Technician involved when applicable |
| `noteText` | String? | Note content when applicable |
| `createdAt` | DateTime | Defaults to current time |

Indexes support looking up a service record's timeline and an actor's events by creation time. :contentReference[oaicite:5]{index=5}

### 6. Alert

| Column | Type | Notes |
|---|---|---|
| `id` | String | Primary key, generated with `cuid()` |
| `vehicleId` | String | Foreign key to `Vehicle` |
| `serviceRecordId` | String | Unique foreign key to `ServiceRecord` |
| `dismissedAt` | DateTime? | When the alert was dismissed |
| `dismissedById` | String? | User who dismissed it |
| `resolvedAt` | DateTime? | When the alert was resolved |
| `createdAt` | DateTime | Defaults to current time |

There is a unique constraint on `serviceRecordId` and an index supporting vehicle/active-alert lookups. :contentReference[oaicite:6]{index=6}

## Which relationships are one-to-many and which are many-to-many?

The main one-to-many relationships are:

- One `User` can create many `ServiceRecord` records.
- One `Vehicle` can have many `ServiceRecord` records.
- One `ServiceRecord` can have many `AuditEvent` records.
- One `Vehicle` can have many `Alert` records over different service cycles.
- One `User` can dismiss many `Alert` records.
- One `User` can be referenced by many assignment, audit, or service-creation records. :contentReference[oaicite:7]{index=7} :contentReference[oaicite:8]{index=8} :contentReference[oaicite:9]{index=9}

The main many-to-many relationship is between `User` technicians and `ServiceRecord` records. A service can have multiple technicians and a technician can be assigned to multiple services. I represented this with the `ServiceRecordTechnician` join table. :contentReference[oaicite:10]{index=10}

## Which constraints are enforced by the database, and which by application code — and why?

I used the database for structural and referential constraints:

- Primary keys on every main table.
- Unique email addresses for users.
- Unique vehicle registration numbers.
- Unique `(vehicleId, cycleNumber)` for service cycles.
- Composite primary key on service/technician assignments.
- Unique `serviceRecordId` for an alert.
- Foreign-key relationships between the related tables.
- `onDelete` restrictions/cascades where appropriate.
- Indexes for common filtering and lookup patterns. :contentReference[oaicite:11]{index=11} :contentReference[oaicite:12]{index=12} :contentReference[oaicite:13]{index=13} :contentReference[oaicite:14]{index=14}

I kept business rules in application code. Examples include deciding whether a service is due or overdue, determining whether a requested lifecycle transition is legal, checking whether the authenticated user has permission to perform an operation, validating that assigned users are technicians, and deciding when a new service cycle or alert should be created. These rules depend on current application state and user context, so they belong in the API rather than being encoded as database-only constraints. The service transition code, for example, validates technician roles and performs service/vehicle updates together in a transaction. :contentReference[oaicite:15]{index=15} :contentReference[oaicite:16]{index=16}

## What did you deliberately denormalise?

I deliberately kept the schema mostly normalized. I did not duplicate technician names, vehicle information, or user information into service records.

The main intentional duplication is maintenance baseline data on `Vehicle`, such as `lastServiceAt`, `lastServiceOdometer`, and `currentServiceCycle`. These values could theoretically be calculated from historical service records, but storing the current baseline directly on the vehicle makes due-date and mileage calculations much simpler and avoids repeatedly scanning service history for every vehicle. The historical `ServiceRecord` data remains available for reporting and auditing. :contentReference[oaicite:17]{index=17}

## What would break first if this had 100x the data?

The first pressure point would probably be service-list and dashboard queries rather than the core relational model.

Service records would grow much faster than the other tables, so searches, sorting, date/status filtering, dashboard aggregations, and audit timelines would become more expensive. The schema already has indexes for common service-record access patterns, including status/scheduled date, vehicle/status, updated time, and creator. :contentReference[oaicite:18]{index=18}

At 100x the current data size, I would next look at query plans and add or refine indexes based on real query patterns, optimize dashboard aggregation queries, introduce stronger pagination strategies for very large result sets, and potentially archive or partition very old audit/service history if the operational requirements justified it.

The many-to-many assignment table and append-only audit table would also grow significantly, so their indexes and retention strategy would become important before the basic relational design itself became the limiting factor.