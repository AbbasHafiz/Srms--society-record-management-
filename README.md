# Society Property & Records Management System

Production-oriented web app for society plot ownership, transfers, documents, physical file lockers, open-file/dealer tracking, fees, staff, and water tankers.

## Core principle

**Never overwrite historical ownership, membership, payment, document, or file-location records.**  
Every transfer creates a new ownership record and marks the previous membership as `TRANSFERRED`.

## Stack

- Next.js 16 (App Router) + TypeScript
- PostgreSQL + Prisma ORM 7
- Tailwind CSS + custom UI primitives
- NextAuth (credentials) + role-based access control
- Immutable audit log

## Modules

Dashboard, Plots (profile with ownership timeline), Transfers (guided wizard), Owners, Documents, Possession, NOC, NEC, Bank/Mortgage, Open Files (renewals + fee config), Payments, Physical Files (location movement history), Employees, Attendance / Guard shifts, Water Tankers, Vehicles, Reports, Audit Logs, Settings (fee configuration).

## Prerequisites

- Node.js 20+
- PostgreSQL 14+

## Setup

```bash
cp .env.example .env
# edit DATABASE_URL and AUTH_SECRET

npm install
npx prisma db push
npm run db:seed
npm run dev
```

App runs at [http://127.0.0.1:43127](http://127.0.0.1:43127).

### Demo logins

| Email | Password | Role |
|-------|----------|------|
| admin@society.local | password123 | SUPER_ADMIN |
| transfer@society.local | password123 | TRANSFER_OFFICER |
| finance@society.local | password123 | FINANCE |
| records@society.local | password123 | RECORD_MANAGER |
| gm@society.local | password123 | GM |
| secretary@society.local | password123 | SECRETARY |
| security@society.local | password123 | SECURITY |

## Notable demo data

- **Plot E-17/3-123** — full ownership history (3 owners), documents per owner, file movement, completed transfers
- **Plot E-17/5-456** — active HBL mortgage (blocks transfer completion)
- **Plot F-11/2-789** — open file expiring in ~12 days
- Fee configs for open file (Rs. 21,000 / 3 months) and annual charges with historical rate snapshots

## Transfer workflow

1. Search plot → verify seller identity (personal appearance)
2. Purchaser details → transfer fee / PO
3. Finance verifies payment
4. Approval → complete transfer
5. System generates new membership + allotment, closes old ownership as `TRANSFERRED`, writes audit log

Active mortgages block completion until bank clearance.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server on port 43127 |
| `npm run build` | Production build |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Reset schema + reseed |

## Architecture notes

- Plot IDs are permanent internal keys
- Membership / allotment numbers are allocated from `NumberSequence` and never reused
- Fee changes create new `FeeConfiguration` rows; prior bills keep `rateSnapshot`
- Physical file moves append `FileMovement` rows (old location retained)
- Documents attach to plot + ownership (+ transfer/mortgage/open-file when relevant) with versioning
