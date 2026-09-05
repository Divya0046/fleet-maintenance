# AI prompts

I used AI as a productivity tool during the development process for quick explanations, requirement reviews, debugging, and troubleshooting. The prompts were mainly used when I needed a second opinion, wanted to understand an error faster, or needed to check whether a particular implementation matched the assignment requirements.

## Checking requirements and edge cases

### Prompt

"I've been going through the Fleet Maintenance requirements and want to make sure I haven't missed any important details. Can you review the requirements and point out any edge cases or areas I should double-check?"

### What I got

AI highlighted important areas such as role permissions, service lifecycle transitions, technician assignments, server-side pagination, audit history, and alerts.

### What I corrected

I used these points as a checklist while reviewing the corresponding features and made adjustments where they were needed.

## Reviewing the service lifecycle

### Prompt

"I'm checking the service lifecycle implementation. Can you review the DUE, BOOKED, IN_SERVICE and COMPLETED flow and point out any problems with transitions, due rules, overdue handling, or resetting the service baseline?"

### What I got

AI pointed out areas that needed careful validation, particularly around legal status transitions and the maintenance baseline after completion.

### What I corrected

I reviewed the relevant logic and adjusted the lifecycle handling so the required transitions, due rules, and service-cycle reset behaved correctly.

## Reviewing service search and pagination

### Prompt

"I'm checking my service list against the assignment requirements. Review the search, filters, sorting and pagination and tell me whether anything should be handled by the API instead of the browser."

### What I got

AI pointed out that the service list requirements called for server-side filtering, sorting, pagination, and total counts.

### What I corrected

I updated the relevant API and frontend behavior and verified that the service list worked correctly with the required filters and pagination.

## Debugging the Render PostgreSQL connection

### Prompt

"My Render PostgreSQL database accepts a direct pg connection, but Prisma is failing with P1017: 'Server has closed the connection'. Here is the Prisma configuration and seed setup. Help me narrow down the issue."

### What I got

AI suggested checking the PostgreSQL adapter configuration and SSL settings.

### What I corrected

The initial change did not resolve the problem. Further inspection showed that the seed script had its own Prisma adapter configuration. I updated that configuration and then tested Prisma directly with a simple `SELECT 1` query.

After the connection test succeeded, the database seed completed successfully.

## Debugging the Render deployment

### Prompt

"Render is failing to build my API even though the project works locally. Here is the monorepo structure and the deployment log. Help me identify the deployment-specific issue."

### What I got

AI helped identify that the API needed to be built from the `apps/api` workspace with its required dependencies and Prisma generation step.

### What I corrected

I updated the Render configuration to use `apps/api` as the root directory and configured the appropriate build and start commands.

A later deployment error showed that `csv-parse` was not available to the API workspace, so the dependency was added to the API package and the service was redeployed.

## Debugging the Vercel frontend connection

### Prompt

"The production frontend builds successfully, but login cannot connect to the backend. Check the frontend API configuration and help me identify what URL the production build should use."

### What I got

AI helped locate the `VITE_API_URL` configuration and identify that production needed to use the deployed Render API URL rather than the local development URL.

### What I corrected

I configured:

`VITE_API_URL=https://fleet-maintenance-2.onrender.com`

in Vercel and redeployed the frontend. Production login and the dashboard then worked correctly.

## Overall use of AI

AI was mainly useful for reducing debugging time, reviewing requirements, explaining errors, and suggesting areas to investigate. I used it throughout the development process as a reference and troubleshooting aid, especially when dealing with edge cases and deployment issues.