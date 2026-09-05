# Plan

# Plan

## How did you break the work into sessions?

I divided the work into small implementation and verification sessions rather than trying to build everything at once. I first focused on the database and core backend structure, then implemented the main vehicle and service workflows, followed by technician assignments, search/pagination, CSV features, dashboard, audit history, and alerts. After the main functionality was complete, I used separate sessions for integration checks, deployment, and documentation.

This helped me catch issues while the related part of the application was still fresh and kept the implementation manageable.

## What order did you build in, and why that order?

I started with the database schema and authentication/roles because almost every other feature depends on users, vehicles, service records, and permissions.

After that I built vehicle management and service records, then implemented the service lifecycle and technician assignment rules. Once the core data and business rules were working, I added service search/filtering/pagination and CSV operations.

I built the dashboard, audit timeline, and alerts after the core workflows because those features depend on service and vehicle data already existing in the system.

Finally, I handled production deployment and documentation after the application was working locally. This order reduced the chance of building frontend features on top of an unstable backend or data model.

## What did you estimate versus what did it actually take?

I treated the assignment as a roughly 12-hour take-home task. My initial expectation was that the core implementation would fit within that time, with the final portion reserved for testing, deployment, and documentation.

In practice, the implementation and debugging work took most of the available time, and deployment required additional troubleshooting. In particular, the Prisma connection issue with Render PostgreSQL and the monorepo dependency issue during the Render build took longer than expected.

Overall, I completed the work in approximately 12 hours.

## What did you cut when you ran short?

I prioritized the assignment's required functionality over additional polish and optional features.

I did not spend significant time on advanced UI animations, extensive visual customization, a separate mobile application, email/SMS notifications, or a large automated test suite. I also kept the deployment architecture simple rather than introducing additional services or background infrastructure.

The goal was to make the required workflows functional, secure, and deployable first, and leave non-essential refinements for a later iteration.