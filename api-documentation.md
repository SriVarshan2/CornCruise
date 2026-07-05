# API Documentation

This document contains the detailed API route specifications for the CronCruise project.

---

## Authentication Endpoints

### 1. `POST /api/auth/signup`
* **Description:** Create a new user account, sign a JWT, and set a session cookie.
* **Authentication:** None.
* **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword",
    "name": "User Name" (optional)
  }
  ```
* **Response Body (201 Created):**
  ```json
  {
    "token": "jwt-token-string",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "User Name"
    }
  }
  ```
* **Cookies Set:** `token=jwt-token-string` (HttpOnly, Secure in production, Lax, Max Age 24h).

### 2. `POST /api/auth/login`
* **Description:** Verify user credentials, sign a JWT, and set a session cookie.
* **Authentication:** None.
* **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword"
  }
  ```
* **Response Body (200 OK):**
  ```json
  {
    "token": "jwt-token-string",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "User Name"
    }
  }
  ```
* **Cookies Set:** `token=jwt-token-string` (HttpOnly, Secure in production, Lax, Max Age 24h).

### 3. `POST /api/auth/logout`
* **Description:** Clear the session token cookie.
* **Authentication:** None.
* **Request Body:** Empty.
* **Response Body (200 OK):**
  ```json
  {
    "success": true
  }
  ```
* **Cookies Cleared:** `token` (HttpOnly, set to expire immediately).

---

## Tenant / Workspace Endpoints

### 4. `GET /api/organizations`
* **Description:** List all organizations where the logged-in user is a member.
* **Authentication:** JWT Session Cookie.
* **Response Body (200 OK):**
  ```json
  [
    {
      "id": 1,
      "name": "Organization Name",
      "createdAt": "2026-07-05T12:00:00.000Z"
    }
  ]
  ```

### 5. `POST /api/organizations`
* **Description:** Create a new organization and make the creator the owner.
* **Authentication:** JWT Session Cookie.
* **Request Body:**
  ```json
  {
    "name": "Organization Name"
  }
  ```
* **Response Body (200 OK):**
  ```json
  {
    "id": 1,
    "name": "Organization Name",
    "createdAt": "2026-07-05T12:00:00.000Z"
  }
  ```

### 6. `GET /api/projects`
* **Description:** List all projects inside a specific organization.
* **Authentication:** JWT Session Cookie.
* **Query Parameters:**
  * `orgId` (Required, integer)
* **Response Body (200 OK):**
  ```json
  [
    {
      "id": 1,
      "orgId": 1,
      "name": "Project Name",
      "createdAt": "2026-07-05T12:00:00.000Z"
    }
  ]
  ```

### 7. `POST /api/projects`
* **Description:** Create a new project inside an organization.
* **Authentication:** JWT Session Cookie.
* **Request Body:**
  ```json
  {
    "name": "Project Name",
    "orgId": 1
  }
  ```
* **Response Body (201 Created):**
  ```json
  {
    "id": 1,
    "orgId": 1,
    "name": "Project Name",
    "createdAt": "2026-07-05T12:00:00.000Z"
  }
  ```

---

## Retry Policies & Queues

### 8. `GET /api/retry-policies`
* **Description:** Fetch all retry policies for an organization.
* **Authentication:** JWT Session Cookie.
* **Query Parameters:**
  * `orgId` (Required, integer)
* **Response Body (200 OK):**
  ```json
  [
    {
      "id": 1,
      "orgId": 1,
      "name": "Policy Name",
      "type": "FIXED" | "LINEAR" | "EXPONENTIAL",
      "baseDelayMs": 5000,
      "maxDelayMs": 60000,
      "createdAt": "2026-07-05T12:00:00.000Z"
    }
  ]
  ```

### 9. `POST /api/retry-policies`
* **Description:** Create a new retry policy for an organization.
* **Authentication:** JWT Session Cookie.
* **Request Body:**
  ```json
  {
    "orgId": 1,
    "name": "Policy Name",
    "type": "FIXED" | "LINEAR" | "EXPONENTIAL",
    "baseDelayMs": 5000,
    "maxDelayMs": 60000 (optional)
  }
  ```
* **Response Body (201 Created):**
  ```json
  {
    "id": 1,
    "orgId": 1,
    "name": "Policy Name",
    "type": "FIXED" | "LINEAR" | "EXPONENTIAL",
    "baseDelayMs": 5000,
    "maxDelayMs": 60000,
    "createdAt": "2026-07-05T12:00:00.000Z"
  }
  ```

### 10. `GET /api/queues`
* **Description:** Fetch all queues belonging to a project.
* **Authentication:** JWT Session Cookie.
* **Query Parameters:**
  * `projectId` (Required, integer)
* **Response Body (200 OK):**
  ```json
  {
    "data": [
      {
        "id": 1,
        "projectId": 1,
        "retryPolicyId": 2,
        "name": "Queue Name",
        "priority": 1,
        "concurrencyLimit": 10,
        "maxRetries": 3,
        "isPaused": false,
        "createdAt": "2026-07-05T12:00:00.000Z"
      }
    ]
  }
  ```

### 11. `POST /api/queues`
* **Description:** Create a new execution queue inside a project.
* **Authentication:** JWT Session Cookie.
* **Request Body:**
  ```json
  {
    "projectId": 1,
    "name": "Queue Name",
    "retryPolicyId": 2 (optional),
    "priority": 1 (optional),
    "concurrencyLimit": 10 (optional),
    "maxRetries": 3 (optional)
  }
  ```
* **Response Body (201 Created):**
  ```json
  {
    "id": 1,
    "projectId": 1,
    "retryPolicyId": 2,
    "name": "Queue Name",
    "priority": 1,
    "concurrencyLimit": 10,
    "maxRetries": 3,
    "isPaused": false,
    "createdAt": "2026-07-05T12:00:00.000Z"
  }
  ```

### 12. `PATCH /api/queues/[id]`
* **Description:** Update parameters on an execution queue (e.g., priority, concurrency limits, or pause/resume state).
* **Authentication:** JWT Session Cookie.
* **Request Body (One or more of):**
  ```json
  {
    "priority": 5,
    "concurrencyLimit": 15,
    "maxRetries": 5,
    "isPaused": true
  }
  ```
* **Response Body (200 OK):**
  ```json
  {
    "id": 1,
    "projectId": 1,
    "retryPolicyId": 2,
    "name": "Queue Name",
    "priority": 5,
    "concurrencyLimit": 15,
    "maxRetries": 5,
    "isPaused": true,
    "createdAt": "2026-07-05T12:00:00.000Z"
  }
  ```

---

## Jobs & Dead Letter Queue

### 13. `GET /api/jobs`
* **Description:** List, filter, and paginate jobs under a specific queue.
* **Authentication:** JWT Session Cookie.
* **Query Parameters:**
  * `queueId` (Required, integer)
  * `status` (Optional: `QUEUED`, `SCHEDULED`, `RUNNING`, `COMPLETED`, `FAILED`)
  * `page` (Optional, default `1`)
  * `pageSize` (Optional, default `20`)
* **Response Body (200 OK):**
  ```json
  {
    "data": [
      {
        "id": 1,
        "queueId": 1,
        "parentJobId": null,
        "status": "QUEUED",
        "payload": { "key": "value" },
        "attempts": 0,
        "scheduledFor": "2026-07-05T12:00:00.000Z",
        "cronExpression": null,
        "lockedAt": null,
        "lockedByWorkerId": null,
        "checkpointData": null,
        "createdAt": "2026-07-05T12:00:00.000Z",
        "updatedAt": "2026-07-05T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 1,
      "totalPages": 1
    }
  }
  ```

### 14. `POST /api/jobs`
* **Description:** Enqueue a new execution job. Supports delayed, immediate, recurring, and batch jobs.
* **Authentication:** JWT Session Cookie.
* **Request Body:**
  ```json
  {
    "queueId": 1,
    "payload": { "key": "value" } | [{ "batch_payload": 1 }],
    "type": "immediate" | "delayed" | "recurring" | "batch",
    "delaySeconds": 30 (optional, for "delayed"),
    "cronExpression": "*/5 * * * *" (optional, for "recurring"),
    "batchPayloads": "[{...}, {...}]" (optional, for "batch")
  }
  ```
* **Response Body (201 Created):**
  ```json
  {
    "message": "Job created",
    "jobId": 1
  }
  ```

### 15. `GET /api/jobs/[id]`
* **Description:** Retrieve details of a specific job, including its full execution history log.
* **Authentication:** JWT Session Cookie.
* **Response Body (200 OK):**
  ```json
  {
    "job": {
      "id": 1,
      "queueId": 1,
      "status": "COMPLETED",
      "payload": { "key": "value" }
    },
    "executions": [
      {
        "id": 1,
        "jobId": 1,
        "workerId": 2,
        "status": "COMPLETED",
        "errorLog": null,
        "startedAt": "2026-07-05T12:00:00.000Z",
        "completedAt": "2026-07-05T12:00:05.000Z"
      }
    ]
  }
  ```

### 16. `GET /api/dlq`
* **Description:** Fetch and filter the Dead Letter Queue logs.
* **Authentication:** JWT Session Cookie.
* **Query Parameters:**
  * `projectId` (Required, integer)
  * `page` (Optional, default `1`)
  * `pageSize` (Optional, default `20`)
* **Response Body (200 OK):**
  ```json
  {
    "data": [
      {
        "id": 1,
        "jobId": 12,
        "queueId": 1,
        "originalPayload": { "key": "val" },
        "failureReason": "Error details",
        "attemptsMade": 3,
        "movedAt": "2026-07-05T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 1,
      "totalPages": 1
    }
  }
  ```

---

## Cron Execution Endpoints

### 17. `GET /api/cron/execute`
* **Description:** Sweep and execute pending tasks. Invoked minutely by Vercel Cron.
* **Authentication:** Authorization Header `Bearer <CRON_SECRET>`.
* **Response Body (200 OK):**
  ```json
  {
    "workerId": 1,
    "claimed": 2,
    "completed": 1,
    "retried": 1,
    "deadLettered": 0,
    "recurringRescheduled": 0,
    "stoppedEarly": false
  }
  ```
