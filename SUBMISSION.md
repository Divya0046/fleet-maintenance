# Submission

Fill this in and commit it. This is the first file we open.

## Links

- **GitHub repository:** https://github.com/Divya0046/fleet-maintenance
- **Live application:** https://fleet-maintenance-web-f5cw.vercel.app/

## Notes for the reviewer

<Anything we should know before opening the link — e.g. your host sleeps when idle and the first
request can take up to a minute.>

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@fleetdemo.com | FleetDemo123! |
| Technician | tech1@fleetdemo.com | FleetDemo123! |
| Technician | tech2@fleetdemo.com | FleetDemo123! |
| Technician | tech3@fleetdemo.com | FleetDemo123! |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | React + Vite | Lightweight SPA for the fleet management UI |
| Backend | Node.js + Express + TypeScript | REST API with server-side authorization and business rules |
| Database | PostgreSQL + Prisma | Relational data model for users, vehicles, services, assignments, alerts, and audit events |
| Hosting | Vercel + Render | Vercel for the frontend and Render for the API/database |


## Goal checklist

Mark each honestly. Partial is fine — say what is partial.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts / roles | Done | Email/password authentication with manager and technician roles. Server-side authorization restricts technician capabilities and assigned records. |
| 2 | Vehicles | Done | Managers can create/edit, archive/restore vehicles, configure service intervals, and maintain odometer/service baselines. Archived vehicles are hidden by default while history is preserved. |
| 3 | Service records | Done | Managers create service records for vehicles and assign technicians. Assigned technicians can update permitted service details. Vehicle service history is preserved. |
| 4 | Service lifecycle | Done | DUE → BOOKED → IN_SERVICE → COMPLETED lifecycle is implemented with server-side transition validation, date/mileage due rules, overdue handling, booking, and completion baseline reset. |
| 5 | Technician assignment | Done | Multiple technicians can be assigned to a service record. Managers control assignments and technicians can view their assigned records across vehicles. |
| 6 | Service finding / pagination | Done | Server-side description search, vehicle/status/technician filters, sorting, pagination, and total counts are implemented. |
| 7 | CSV odometer / history | Done | Manager bulk odometer CSV updates provide per-row success/reason handling, reject lower readings, and allow valid rows to apply. Service history CSV export is included. |
| 8 | Dashboard | Done | Dashboard includes vehicles due, in service, completed this week, overdue counts, status/technician breakdowns, and completed services for the last 8 weeks. |
| 9 | Audit timeline | Done | Immutable append-only audit events cover creation, status changes, technician assignment/unassignment, and notes. No edit/delete controls are provided for audit history. |
| 10 | Alerts | Done | Overdue services appear in the alerts area with a navigation count. Managers can dismiss alerts, and a later service cycle can generate a new alert. |


## How much time did you actually spend?
Approximately 12 hours.

## What would you do next, with another 12 hours?
I would improve the UI/UX and responsiveness, add more automated integration tests around lifecycle and authorization rules, improve error handling and loading states, and add stronger deployment/operational documentation.

## What are you least happy with in this codebase, and why?
The main area I would improve is the overall frontend polish and automated test coverage. The core requirements and server-side business rules are implemented, but additional tests and UI refinement would make the application more production-ready and easier to maintain.