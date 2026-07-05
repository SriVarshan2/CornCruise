# Entity Relationship (ER) Diagram

This document contains the ER diagram showing all 10 tables in the Drizzle Postgres schema for CronCruise, including the exact foreign key relationships.

```mermaid
erDiagram
    users {
        int id PK
        text email UK
        text password_hash
        text name
        timestamp created_at
    }

    organizations {
        int id PK
        text name
        timestamp created_at
    }

    organizationMembers {
        int id PK
        int org_id FK "References organizations.id (CASCADE)"
        int user_id FK "References users.id (CASCADE)"
        org_role role
    }

    projects {
        int id PK
        int org_id FK "References organizations.id (CASCADE)"
        text name
        timestamp created_at
    }

    retryPolicies {
        int id PK
        int org_id FK "References organizations.id (CASCADE)"
        text name
        retry_type type
        int base_delay_ms
        int max_delay_ms
        timestamp created_at
    }

    queues {
        int id PK
        int project_id FK "References projects.id (CASCADE)"
        int retry_policy_id FK "References retryPolicies.id (SET NULL)"
        text name
        int priority
        int concurrency_limit
        int max_retries
        boolean is_paused
        timestamp created_at
    }

    workers {
        int id PK
        text instance_id UK
        timestamp last_heartbeat_at
        timestamp created_at
    }

    jobs {
        int id PK
        int queue_id FK "References queues.id (CASCADE)"
        int parent_job_id FK "References jobs.id"
        job_status status
        jsonb payload
        int attempts
        timestamp scheduled_for
        varchar cron_expression
        timestamp locked_at
        int locked_by_worker_id FK "References workers.id (SET NULL)"
        jsonb checkpoint_data
        timestamp created_at
        timestamp updated_at
    }

    jobExecutions {
        int id PK
        int job_id FK "References jobs.id (CASCADE)"
        int worker_id FK "References workers.id (SET NULL)"
        job_status status
        text error_log
        timestamp started_at
        timestamp completed_at
    }

    deadLetterQueue {
        int id PK
        int job_id "Deliberately loose (no database FK)"
        int queue_id "Deliberately loose (no database FK)"
        jsonb original_payload
        text failure_reason
        int attempts_made
        timestamp movedAt
    }

    organizations ||--o{ organizationMembers : "contains"
    users ||--o{ organizationMembers : "belongs to"
    organizations ||--o{ projects : "contains"
    organizations ||--o{ retryPolicies : "manages"
    projects ||--o{ queues : "owns"
    retryPolicies ||--o{ queues : "applied to"
    queues ||--o{ jobs : "contains"
    jobs ||--o| jobs : "parent_job_id (self-reference)"
    workers ||--o{ jobs : "locks"
    jobs ||--o{ jobExecutions : "logs"
    workers ||--o{ jobExecutions : "runs"
```

## Note on loose relationships
* **`deadLetterQueue` relationships:** The columns `deadLetterQueue.job_id` and `deadLetterQueue.queue_id` purposefully do not possess direct foreign keys. This guarantees that audit trails are preserved even if a job or its queue is permanently removed. Tenant isolation is maintained by resolving context through an explicit join through `queues → projects → organizations`.
