# Architecture

## What are the moving pieces, and how do they talk to each other?

The application is a web-based full-stack system with three main pieces: a React frontend, an TypeScript backend API, and a PostgreSQL database.

The frontend is responsible for the user interface for managers and technicians. It communicates with the backend through HTTP API requests and sends the authentication token with protected requests.

The backend contains the application logic and is responsible for authentication, role-based authorization, vehicle management, service records, service lifecycle rules, technician assignments, dashboards, CSV operations, audit events, and alerts. It validates permissions and business rules on the server instead of relying on the frontend.

The backend uses Prisma to access PostgreSQL. The database stores users, vehicles, service records, technician assignments, audit events, alerts, and the related service-cycle information.

The frontend never accesses the database directly. The communication flow is:

React frontend → Express API → Prisma → PostgreSQL

and responses come back through the same layers.

## Where does each piece run?

The frontend is deployed on Vercel as a Vite/React application.

The backend API is deployed on Render as a Node.js/Express service.

The PostgreSQL database is hosted by Render PostgreSQL.

During local development, the frontend and backend can run locally while connecting to the configured PostgreSQL database.

The deployed production flow is therefore:

User browser → Vercel frontend → Render API → Render PostgreSQL

## What is the request path for one representative user action, end to end?

A representative action is a manager viewing the service list with filters and pagination.

1. The manager opens the Services page in the React frontend.
2. The frontend sends an authenticated HTTP request to the Express API with the selected filters, sorting options, page, and page size.
3. The API verifies the authentication token and checks that the user is authorized to access the requested records.
4. The API builds the database query using the supplied search, vehicle, status, technician, sorting, and pagination parameters.
5. Prisma sends the query to PostgreSQL and retrieves only the records required for that page, along with the total matching count.
6. The API returns the service records and pagination information as JSON.
7. The React frontend updates the table and pagination controls using the response.

This keeps filtering and pagination on the server rather than downloading the complete service history into the browser.

## What did you decide not to build, and why?

I focused on the requirements in the assignment and did not build features that were outside the required scope.

I did not add a separate mobile application because the assignment only required a web application.

I did not build a separate background job or notification service. The required overdue alerts are handled within the application and database model rather than introducing another infrastructure component.

I also did not add a complex external notification system such as email or SMS because it was not required. Keeping these out reduced infrastructure complexity and kept the implementation focused on the required fleet maintenance workflows.