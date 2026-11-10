# Jappie Coffee Shop Management System

A full-stack coffee shop ordering and staff management application built with React, Express.js, Fetch API and Upstash Redis (key-value NoSQL).

## Features
- Public menu with product descriptions, prices and availability
- Shopping cart with quantity controls
- Customer order placement and unique order number
- Staff API-key authentication
- Add, edit and delete menu items
- View orders and update Pending, Preparing, Ready and Collected statuses
- Daily order count, sales and pending-order summary
- Redis-backed records persist outside the application server

## Requirements
- Node.js 18 or later
- An Upstash Redis database

## 1. Create the Redis database
1. Create an account at https://upstash.com/.
2. Create a Redis database.
3. Copy its REST URL and REST token.
4. Keep these credentials private. Do not commit them to GitHub.

## 2. Run the backend
```bash
cd backend
npm install
```
Copy `.env.example` to `.env`, then fill in the Redis URL, Redis token and a long private `STAFF_API_KEY`.

```bash
npm run dev
```
The API runs at `http://localhost:5000`. Test `http://localhost:5000/api/health`.

## 3. Run the frontend
Open a second terminal:
```bash
cd frontend
npm install
```
Copy `.env.example` to `.env`. The local API URL is already set to `http://localhost:5000`.

```bash
npm run dev
```
Open the local URL printed by Vite, usually `http://localhost:5173`.

## Staff dashboard
Open Staff dashboard and enter the exact `STAFF_API_KEY` from the backend `.env` file. This starter project uses a shared staff key for demonstration; a production system should use individual accounts, hashed passwords and role-based authentication.

## REST API
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check API and Redis |
| GET | `/api/menu` | List menu items |
| GET | `/api/menu/:id` | Get one menu item |
| POST | `/api/menu` | Add menu item (staff key) |
| PUT | `/api/menu/:id` | Update menu item (staff key) |
| DELETE | `/api/menu/:id` | Delete menu item (staff key) |
| GET | `/api/orders` | List orders (staff key) |
| GET | `/api/orders/:id` | Get one order |
| POST | `/api/orders` | Place an order |
| PATCH | `/api/orders/:id/status` | Update order status (staff key) |
| GET | `/api/summary` | Today's summary (staff key) |

Staff requests must include the `x-staff-key` HTTP header. Order creation checks current menu prices and availability on the server.

## Deployment

### Backend on Render
1. Push this project to GitHub.
2. In Render, create a new **Web Service** and select the repository.
3. Set the Root Directory to `backend`.
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `STAFF_API_KEY`, and `FRONTEND_ORIGIN`.
7. Deploy and test `https://YOUR-BACKEND.onrender.com/api/health`.

### Frontend on Vercel
1. Import the same GitHub repository into Vercel.
2. Set the Root Directory to `frontend`.
3. Add environment variable `VITE_API_URL` with your Render backend URL, without a trailing slash.
4. Deploy.
5. After deployment, update Render's `FRONTEND_ORIGIN` to your Vercel website URL and redeploy the backend if needed.

## Key-value data design
- Menu: `menu:<uuid>` => JSON menu record
- Orders: `order:<uuid>` => JSON order record
- Health check: `health:last-check` => timestamp

The Redis database is external to the Express process, so menu and order records remain stored when the backend restarts.

## Important security notes
- Never upload `.env` files or Redis credentials to GitHub.
- Use a strong, private staff key.
- The shared staff key is suitable only as an assignment demonstration. A real production deployment should implement individual staff login and stronger authorisation.
- Configure CORS to allow only your deployed frontend origin.
