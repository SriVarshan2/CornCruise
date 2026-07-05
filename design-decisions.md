# Design Decisions

This document details the architectural choices, trade-offs, and design patterns implemented in **CronCruise** based on the actual codebase.

---

## 1. At-Least-Once Micro-Batch Executor via Vercel Cron
We chose an **At-Least-Once Micro-Batch Executor** model triggered by Vercel Cron (`/api/cron/execute` on a `* * * * *` schedule) rather than a traditional persistent polling worker.
* **Why:** In serverless environments like Vercel, processes are ephemeral and have a maximum execution duration limit (e.g., 60 seconds). Persistent connections or background loops (e.g., `while (true) sleep(1000)`) will trigger serverless timeouts or exceed platform billing constraints.
* **Mechanism:** Every minute, Vercel Cron starts a fresh execution context (a sweep). The sweep claims a batch of up to 20 eligible jobs (respecting priority, pause states, and concurrency limits), processes them sequentially, and exits before the 60-second limit.

---

## 2. Heartbeats and Graceful Shutdown in Serverless
Traditional worker architectures rely on persistent TCP connections or keep-alive signals to confirm worker liveness, and standard OS signals (like `SIGTERM`) to trigger graceful shutdown. In serverless, these had to be reimagined:
* **Heartbeat-as-Timestamp:** Workers register themselves in the `workers` database table on each sweep. Instead of a live websocket or daemon connection, the worker's status is tracked by the `last_heartbeat_at` timestamp.
* **Stale Lock Recovery:** If a worker crashes or is abruptly shut down by the serverless platform, the jobs it held remain locked. The next sweep query automatically identifies and reclaims any jobs in the `RUNNING` status whose `locked_at` timestamp is older than `STALE_LOCK_MINUTES` (5 minutes).
* **Time Budgeting & Safety Margin:** The executor keeps track of its own elapsed execution time (`elapsed() = Date.now() - startedAt`). It stops claiming new jobs once it is within `SAFETY_MARGIN_MS` (10 seconds) of the 60-second hard limit.
* **Checkpoint-as-Defer-to-Next-Sweep:** If a worker runs out of time mid-loop while processing already claimed jobs, the loop breaks. The remaining claimed-but-unprocessed jobs are left in `RUNNING` status with their `locked_at` timestamps intact. They will safely be unlocked and returned to `QUEUED` during the next sweep's stale-lock recovery.
* **Important Constraint:** Mid-job execution checkpointing is not solved generically. It is only resolved at the claim/batch boundary or upon subsequent stale lock recovery.

---

## 3. Delivery Guarantee: At-Least-Once
CronCruise provides **At-Least-Once** delivery guarantees rather than Exactly-Once.
* **SKIP LOCKED:** We utilize Postgres's `SKIP LOCKED` feature inside a CTE claim query to prevent multiple concurrent cron executions or workers from double-claiming the same jobs.
* **Retry on Crash:** If a worker claims a job, completes its execution, but crashes before it can write the status update (e.g., setting the status to `COMPLETED` or updating the executions log) back to the Postgres database, the lock will eventually expire (after 5 minutes). A subsequent worker sweep will then reclaim and re-run the job. This is the classic trade-off of distributed queues: execution status updates are not atomic with the execution itself, leading to potential duplicate deliveries.

---

## 4. The 60-Second Latency Trade-Off
Because Vercel Cron runs on a minutely cron expression (`* * * * *`), sweeps are spaced up to 60 seconds apart. 
* **Latency:** Immediate jobs (or jobs whose delay just expired) may wait up to **60 seconds** to be claimed by the next sweep.
* **Justification:** This trade-off is accepted to allow running a distributed task scheduler purely within a standard serverless model without requiring external, persistent polling hardware.

---

## 5. Neon HTTP Driver Transaction Constraints
We use the `@neondatabase/serverless` serverless HTTP driver to communicate with Neon Postgres.
* **No Transactions:** Unlike WebSockets or persistent TCP pooling drivers, HTTP-based queries to Neon are stateless and do not support traditional interactive Postgres transactions (`BEGIN` / `COMMIT`).
* **Sequential Workarounds:** In operations that require multi-table writes (such as creating an Organization and instantly inserting its owner membership into `organizationMembers`), sequential queries are executed instead.
* **Disclosed Risk:** If the organization is created but the secondary membership insert fails (due to network disruption, uniqueness violations, or constraint checks), the database is left in a **partially created state** (an orphaned organization). The application handles this at the boundary by displaying appropriate errors and relying on application-level checks.

---

## 6. Loose DLQ Relationships and Tenant Isolation
* **No Foreign Key Constraints:** The `deadLetterQueue` table deliberately omits foreign keys referencing the `jobs` or `queues` table on the `job_id` and `queue_id` fields. This is intentional: if a job or its queue is deleted from the active tables, we must preserve the dead letter logs for audit trails rather than cascading deletions.
* **Tenant Isolation Enforcement:** To prevent tenant cross-contamination, access to DLQ logs is validated via explicit JOIN queries through `queues → projects → organizations` using the tenant context associated with the user's authenticated session, rather than direct primary key lookups.

---

## 7. Alternatives Rejected
* **QStash / Inngest / Trigger.dev:** Rejected because outsourcing execution queues to third-party orchestration services would bypass the core distributed systems engineering problems (locking, concurrency control, backoffs, heartbeats) that this project is designed to showcase.
* **WebSockets for Live Updates:** Rejected for backend dashboard updates because serverless functions cannot hold long-lived open connections. Dashboard clients use periodic API polling (every 5 seconds) to fetch job and queue states.

---

## 8. Retry Backoff Calculations
When a job execution fails and its attempts have not yet reached `max_retries`, a backoff delay is calculated according to the queue's attached `retryPolicies` record:
* **FIXED:** `delayMs = baseDelayMs`
* **LINEAR:** `delayMs = baseDelayMs * attempts`
* **EXPONENTIAL:** `delayMs = baseDelayMs * Math.pow(2, attempts - 1)`
* **Capping:** If `maxDelayMs` is defined, the final `delayMs` is capped via `Math.min(delayMs, maxDelayMs)` before updating the job's `scheduled_for` timestamp.
