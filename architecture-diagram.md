# Architecture Diagram

This document contains the architecture diagrams for the CronCruise scheduler system.

## System Workflow & Operations

```mermaid
flowchart TD
    %% User Flow
    subgraph Client ["Client / Browser Dashboard"]
        U["User Client"]
    end

    subgraph Vercel ["Vercel Serverless Hosting"]
        subgraph Frontend ["Next.js Frontend / App Router"]
            API["API Routes (CRUD Operations)"]
            Dashboard["Dashboard UI (Polling every 5s)"]
        end
        
        subgraph CronExecutor ["Vercel Cron Trigger"]
            Cron["Vercel Cron Service (Every 1m)"]
            CronRoute["/api/cron/execute"]
        end
    end

    subgraph Database ["Neon Serverless Postgres"]
        DB[(Postgres Tables)]
    end

    %% Client Interactions
    U -->|Interacts| Dashboard
    Dashboard -->|HTTP GET / POST| API
    API -->|SQL queries (Stateless HTTP)| DB

    %% Cron / Executor Operations
    Cron -->|Triggers sweep| CronRoute
    
    %% Executor Pipeline inside /api/cron/execute
    subgraph ExecutionPipeline ["Cron Route Internals (/api/cron/execute)"]
        HB["Worker Heartbeat registration (Upsert to 'workers' table)"]
        Claim["Atomic Claim (CTE SELECT SKIP LOCKED & UPDATE jobs status to RUNNING)"]
        Loop["Sequential Execution Loop (Iterate through claimed jobs)"]
        Safety["Safety Time Budget Check (Break if elapsed > 50s)"]
        Resched["Reschedule / Update Database (Set COMPLETED / Reschedule recurring jobs / DLQ on failure)"]
    end

    CronRoute --> HB
    HB -->|SQL Upsert| DB
    HB --> Claim
    Claim -->|Postgres SKIP LOCKED & Concurrency checks| DB
    Claim --> Loop
    Loop --> Safety
    Loop --> Resched
    Resched -->|SQL Updates| DB
```
