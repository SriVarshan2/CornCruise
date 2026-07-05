# 🛳️ CronCruise: Serverless Micro-Batch Executor

CronCruise is an "At-Least-Once Micro-Batch Executor" built to provide robust, distributed job scheduling strictly within the serverless constraints of Vercel.

Traditional job schedulers rely on long-lived continuous polling daemons and SIGTERM-based graceful shutdowns. Because Vercel automatically kills long-running functions and does not support persistent processes, CronCruise pivots to an event-driven, minute-by-minute execution sweep. It guarantees atomic job claiming, stale-lock reclamation, and tenant-isolated API access.

## 🛠 Tech Stack

* **Framework:** Next.js 16 (App Router) for both the REST APIs and responsive frontend dashboard.
* **Database:** Neon (Serverless Postgres).
* **ORM:** Drizzle ORM.
* **Authentication:** JWT-based auth using the `jose` library (strictly required for Vercel Edge Runtime compatibility).
* **Execution Engine:** Vercel Cron.

## ⚙️ Core Architecture & "Secret Sauce"

### 1. Atomic Claiming (Zero Overlapping Duplicates)

CronCruise prevents duplicate job execution by using Postgres Row-Level Locking (`SELECT ... FOR UPDATE SKIP LOCKED`). If a sweep is currently processing a batch of jobs, the database locks those rows, and any overlapping concurrent sweep will simply bypass them.

### 2. Serverless Heartbeats & Stale-Lock Reclamation

Heartbeats are simulated via timestamps. Each cron invocation upserts a `last_heartbeat_at` timestamp in a `workers` table based on its unique Vercel instance ID (`x-vercel-id`). If a job is stuck in a `RUNNING` state past 5 minutes, the executor automatically reclaims the stale lock.

### 3. Graceful Checkpointing

The executor API tracks its own elapsed execution time against Vercel's `maxDuration` (60s). Once it reaches 50 seconds, it stops claiming new jobs and returns any unstarted jobs back to `QUEUED`.

### 4. Dynamic Retry Policies & DLQ

Failed jobs trigger retry math from a joined `retryPolicies` table, supporting `FIXED`, `LINEAR`, and `EXPONENTIAL` backoffs. Upon exhausting max retries, the job moves to a dedicated Dead Letter Queue (DLQ) table.

## 🧠 Deliberate Engineering Trade-offs

* **Micro-Batch Latency:** 60-second resolution — immediate jobs may take up to ~60 seconds to begin execution.
* **At-Least-Once Delivery:** Not exactly-once. Consumer payloads must be designed idempotently.
* **DLQ Denormalization:** `deadLetterQueue` deliberately has no foreign keys to `jobs`/`queues`, so original records can be deleted without orphaning failure logs.

## 🚀 Getting Started (Local Development)

### 1. Environment Variables

```env
DATABASE_URL="postgres://your_neon_db_url"
JWT_SECRET="your_secure_secret_string"
CRON_SECRET="your_vercel_cron_secret"
```

### 2. Installation & Database Setup

```bash
npm install
npx drizzle-kit push
```

### 3. Run the Development Server

```bash
npm run dev
```

*For local testing of the executor, manually trigger `GET /api/cron/execute` with `Authorization: Bearer <CRON_SECRET>` header, simulating Vercel Cron's minute-by-minute sweeps.*
