# Decisions

Log the decisions that actually shaped this codebase — the ones where a real alternative existed and
you picked one. At least five entries. For each: what you chose, what you rejected, and why. At least
one entry must be a decision you later reversed — say what changed your mind. It can be any entry
below, not necessarily the last one; add a **Later reversed:** line to whichever one it is.

# Decisions

## Decision 1

- **Chose:** PostgreSQL with Prisma as the database layer.
- **Rejected:** Using a document database such as MongoDB.
- **Why:** The application has strongly related entities such as users, vehicles, service records, technicians, assignments, alerts, and audit events. PostgreSQL provides a good relational model for these relationships, while Prisma keeps database access type-safe and easier to maintain.

## Decision 2

- **Chose:** Enforce roles and business rules on the backend.
- **Rejected:** Relying only on frontend route restrictions or hiding buttons for technicians.
- **Why:** Hiding UI controls does not prevent a user from calling the API directly. The backend therefore performs authentication, role checks, and permission checks so that technician restrictions are enforced regardless of the client being used.

## Decision 3

- **Chose:** Keep service lifecycle transitions explicit on the server.
- **Rejected:** Allowing the frontend to decide whether a status transition is valid.
- **Why:** The service lifecycle has business rules such as DUE → BOOKED → IN_SERVICE → COMPLETED and invalid transitions must be rejected. Keeping these rules in the API gives one authoritative place for validation and prevents inconsistent state.

## Decision 4

- **Chose:** Server-side filtering, sorting, and pagination for service records.
- **Rejected:** Loading all service records into the browser and filtering them with JavaScript.
- **Why:** The assignment specifically requires a server-side list and pagination with a total count. Keeping the query logic on the server also avoids transferring unnecessary records to the browser and will scale better as the service history grows.

## Decision 5

- **Chose:** Use a separate join model for service-record/technician assignments.
- **Rejected:** Storing technicians as a single field on the service record or limiting each service to one technician.
- **Why:** A service record can have any number of technicians, and a technician can be assigned to many service records. A join table represents this many-to-many relationship cleanly and also makes assignment and unassignment auditable.

## Decision 6

- **Chose:** Store audit events as append-only records.
- **Rejected:** Updating one mutable audit record whenever something changes.
- **Why:** The requirement is an immutable timeline showing events such as creation, status changes, technician assignments, and notes. Creating a new record for each event preserves the history and makes it possible to understand what happened over time.

## Decision 7

- **Chose:** Deploy the frontend and API separately using Vercel and Render.
- **Rejected:** Hosting the entire application as one deployment.
- **Why:** The frontend is a Vite/React application while the backend is a Node/Express API. Separate deployments fit the structure of the project, allow each part to use an appropriate hosting environment, and keep the frontend and backend independently deployable.

## Decision 8

- **Chose:** Use direct database schema synchronization with `prisma db push` for the fresh deployment database.
- **Rejected:** Setting up a migration deployment pipeline for this assignment.
- **Why:** The project did not have a Prisma migrations directory, and the Render database was a new empty database. Using `db push` was the simplest way to synchronize the existing schema for the assignment deployment.

## Decision 9

- **Chose:** Use the same PostgreSQL database structure for current records and historical records while marking vehicles as archived.
- **Rejected:** Permanently deleting archived vehicles and their related service history.
- **Why:** The assignment requires archived vehicles to be hidden from normal views while preserving their history. Soft archiving satisfies that requirement without losing historical service information.

**Later reversed:** I initially treated the root workspace dependency setup as sufficient for the API deployment, but the Render build exposed that `csv-parse` needed to be available directly to the API workspace. I moved the dependency into `apps/api/package.json` so the deployed API had an explicit dependency on the package it imports.