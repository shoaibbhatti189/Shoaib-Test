# Payroll + Inventory Backend

A Node.js and Express backend built for a single-business tool to manage employees, attendance, payroll, products, and inventory transactions. 

## Tech Stack
- **Runtime**: Node.js + Express
- **Database**: SQLite (No installation required!)
- **ORM**: Prisma
- **Auth**: JWT & bcrypt

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Database Setup**
   You don't need to install any database server! Just create your local `.env` file.
   ```bash
   cp .env.template .env
   ```

3. **Run Prisma Migrations**
   This will automatically create a local `dev.db` file in your folder with all the tables.
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Start the Server**
   ```bash
   npm run dev
   ```

## Initial Setup & Authentication
Because routes are protected, you need an initial admin user to log in.
Send a POST request to `http://localhost:3000/setup-admin` (only for initial use) to create an admin:
```json
{
  "username": "admin",
  "password": "admin123"
}
```
Then POST to `http://localhost:3000/login` to receive your JWT token. Add this token to the `Authorization` header as `Bearer <token>` for subsequent requests in tools like Postman.

## Features
- **Role-based Auth**: `admin` (full access) and `staff` (restricted view/log access).
- **Payroll**: Run payroll for a period, which automatically calculates hours worked and creates paychecks.
- **Inventory**: All product quantities are dynamically calculated from a transaction log (`inventory_transactions`) to ensure full audit history. No direct quantity modifications are allowed.
- **Soft Deletes**: Employees and Products are deactivated rather than deleted to preserve historical payroll and inventory records.
