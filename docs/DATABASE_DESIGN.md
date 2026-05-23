# Database Design Document — TicketAI

## Table of Contents
1. [Overview](#overview)
2. [Collections](#collections)
   - [users](#users)
   - [tickets](#tickets)
   - [ai_logs](#ai_logs)
   - [activity_logs](#activity_logs)
3. [Indexing Strategy](#indexing-strategy)
4. [Data Relationships](#data-relationships)
5. [Schema Evolution Strategy](#schema-evolution-strategy)

---

## Overview

TicketAI uses **MongoDB 7** with **Mongoose 8** as the ODM. MongoDB was selected over a relational database for the following reasons:

- **Schema Flexibility** — AI-generated ticket structures can gain new fields as prompt engineering evolves, without requiring migrations on existing documents
- **Aggregation Pipeline** — Analytics queries (group by priority, trend over time) map naturally to MongoDB's aggregation framework
- **Native JSON** — No impedance mismatch between JavaScript objects and the database wire format
- **TTL Indexes** — Built-in document expiry for log rotation without cron jobs

All string fields that users can search are indexed with text indexes or covered by compound indexes on the query patterns identified during design.

---

## Collections

### `users`

Stores registered accounts. Passwords are never stored in plaintext — only the bcrypt hash is persisted.

**Schema:**

```javascript
{
  _id: ObjectId,                       // Auto-generated MongoDB ID (used as JWT subject)

  name: {
    type: String,
    required: true,
    trim: true,
    minLength: 2,
    maxLength: 100
  },

  email: {
    type: String,
    required: true,
    unique: true,                      // Enforced by index; prevents duplicate registrations
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },

  passwordHash: {
    type: String,
    required: true,
    select: false                      // Never returned in queries unless explicitly selected
  },

  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },

  refreshTokenHash: {
    type: String,
    select: false                      // Stored hash of the current refresh token
  },

  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    defaultEnvironment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'production'
    }
  },

  isActive: {
    type: Boolean,
    default: true                      // Soft-disable accounts without deleting
  },

  lastLoginAt: Date,

  createdAt: Date,                     // Set by Mongoose timestamps: true
  updatedAt: Date
}
```

**Indexes:**

| Index                       | Type   | Options        | Purpose                                        |
|-----------------------------|--------|----------------|------------------------------------------------|
| `{ email: 1 }`              | Single | `unique: true` | Enforce unique emails; fast login lookup       |
| `{ createdAt: -1 }`         | Single |                | Admin: list all users sorted by registration   |

**Constraints & Rationale:**

- `passwordHash` uses `select: false` so it is never accidentally included in API responses. Controllers that need it must explicitly add `.select('+passwordHash')`.
- `refreshTokenHash` is a bcrypt hash of the refresh token stored in the DB. Even if the database is compromised, raw refresh tokens are not exposed.
- `isActive: false` is used for account suspension rather than hard deletion, preserving referential integrity with ticket documents.

---

### `tickets`

The primary collection. Each document represents one AI-generated Jira ticket.

**Schema:**

```javascript
{
  _id: ObjectId,

  // ─── AI-Generated Content ──────────────────────────────────────────────
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 300
  },

  description: {
    type: String,
    required: true,
    maxLength: 5000
  },

  stepsToReproduce: {
    type: [String],
    default: []
  },

  acceptanceCriteria: {
    type: [String],
    default: []
  },

  testCases: [
    {
      scenario: {
        type: String,
        required: true
      },
      expectedResult: {
        type: String,
        required: true
      },
      testType: {
        type: String,
        enum: ['functional', 'regression', 'edge-case', 'performance', 'security'],
        default: 'functional'
      }
    }
  ],

  priority: {
    type: String,
    required: true,
    enum: ['Critical', 'High', 'Medium', 'Low'],
    default: 'Medium'
  },

  severity: {
    type: String,
    required: true,
    enum: ['Critical', 'Major', 'Minor', 'Trivial'],
    default: 'Minor'
  },

  type: {
    type: String,
    required: true,
    enum: ['Bug', 'Feature', 'Improvement', 'Task', 'Epic'],
    default: 'Bug'
  },

  labels: {
    type: [String],
    default: []
  },

  effortEstimate: {
    type: String,
    enum: ['1', '2', '3', '5', '8', '13', '21'],  // Fibonacci story points
    default: '3'
  },

  // ─── Context Provided by User ──────────────────────────────────────────
  environment: {
    type: String,
    enum: ['development', 'staging', 'production', 'unknown'],
    default: 'unknown'
  },

  browser: {
    type: String,
    trim: true,
    maxLength: 100
  },

  device: {
    type: String,
    trim: true,
    maxLength: 100
  },

  rawInput: {
    type: String,
    required: true,
    maxLength: 2000                    // Original description as entered by user
  },

  // ─── Workflow State ────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'In Review', 'Resolved', 'Closed', 'Won\'t Fix'],
    default: 'Open'
  },

  // ─── Metadata ──────────────────────────────────────────────────────────
  createdBy: {
    type: ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  promptVersion: {
    type: String,
    default: '1.0.0'                   // Version of the prompt template used; aids debugging
  },

  isDeleted: {
    type: Boolean,
    default: false                     // Soft delete flag
  },

  deletedAt: Date,

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**

| Index                                      | Type       | Purpose                                              |
|--------------------------------------------|------------|------------------------------------------------------|
| `{ createdBy: 1, createdAt: -1 }`          | Compound   | Primary query: user's tickets sorted newest first    |
| `{ createdBy: 1, status: 1 }`              | Compound   | Filter user's tickets by workflow status             |
| `{ createdBy: 1, priority: 1 }`            | Compound   | Filter user's tickets by priority                    |
| `{ createdBy: 1, type: 1 }`                | Compound   | Filter user's tickets by ticket type                 |
| `{ createdBy: 1, environment: 1 }`         | Compound   | Filter user's tickets by environment                 |
| `{ isDeleted: 1 }`                         | Single     | Efficiently exclude soft-deleted tickets             |
| `{ title: 'text', description: 'text' }`   | Text       | Full-text search across ticket title and description |

**Rationale for Compound Indexes:**

All queries on the `tickets` collection are scoped to a specific `createdBy` user. MongoDB will use the first field in a compound index as the primary filter, then apply the second field to sort or filter within that subset. This means `{ createdBy: 1, createdAt: -1 }` efficiently serves the query `db.tickets.find({ createdBy: userId }).sort({ createdAt: -1 })` without a full collection scan.

---

### `ai_logs`

Stores one document per OpenAI API call. Used for cost tracking, debugging, and performance monitoring. These documents are high-volume and have a finite useful lifespan, making them suitable for TTL-based expiry.

**Schema:**

```javascript
{
  _id: ObjectId,

  ticketId: {
    type: ObjectId,
    ref: 'Ticket',
    required: true,
    index: true
  },

  userId: {
    type: ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  model: {
    type: String,
    required: true,
    default: 'gpt-4o'
  },

  promptTokens: {
    type: Number,
    required: true
  },

  completionTokens: {
    type: Number,
    required: true
  },

  totalTokens: {
    type: Number,
    required: true
  },

  estimatedCostUsd: {
    type: Number                       // Computed: tokens × per-token rate for the model
  },

  durationMs: {
    type: Number,
    required: true                     // Wall-clock time for the OpenAI API call
  },

  success: {
    type: Boolean,
    required: true,
    default: true
  },

  retryCount: {
    type: Number,
    default: 0                         // How many retries were needed before success
  },

  errorCode: {
    type: String                       // OpenAI error code if success === false
  },

  errorMessage: {
    type: String                       // OpenAI error message if success === false
  },

  promptVersion: {
    type: String,
    default: '1.0.0'
  },

  createdAt: Date                      // TTL index applied on this field
}
```

**Indexes:**

| Index                           | Type   | Options                    | Purpose                                              |
|---------------------------------|--------|----------------------------|------------------------------------------------------|
| `{ ticketId: 1 }`               | Single |                            | Lookup AI log for a specific ticket                  |
| `{ userId: 1, createdAt: -1 }` | Compound |                          | User's AI usage history sorted by date               |
| `{ createdAt: 1 }`              | Single | `expireAfterSeconds: 7776000` | TTL: auto-delete logs older than 90 days          |
| `{ success: 1, createdAt: -1 }` | Compound |                          | Admin: list failed AI calls for debugging            |

**TTL Consideration:**

AI logs are primarily useful for debugging (last 30 days) and cost reporting (last quarter). Setting a 90-day TTL (`expireAfterSeconds: 7776000`) ensures the collection does not grow unboundedly. For compliance or billing, export logs to a data warehouse (e.g., BigQuery, S3) before the TTL window.

---

### `activity_logs`

Stores a human-readable audit trail of every significant action in the system. Useful for security audits and user-facing activity feeds.

**Schema:**

```javascript
{
  _id: ObjectId,

  userId: {
    type: ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  action: {
    type: String,
    required: true,
    enum: [
      'user.registered',
      'user.login',
      'user.logout',
      'user.password_changed',
      'user.preferences_updated',
      'ticket.generated',
      'ticket.updated',
      'ticket.deleted',
      'ticket.status_changed'
    ]
  },

  resourceType: {
    type: String,
    enum: ['user', 'ticket'],
    required: true
  },

  resourceId: {
    type: ObjectId,
    required: false                    // null for actions with no associated resource (login)
  },

  metadata: {
    type: Map,
    of: String                         // Flexible key-value pairs for action-specific context
                                       // e.g., { fromStatus: 'Open', toStatus: 'Resolved' }
  },

  ipAddress: {
    type: String,
    maxLength: 45                      // Supports IPv6
  },

  userAgent: {
    type: String,
    maxLength: 500
  },

  createdAt: Date                      // TTL index applied on this field
}
```

**Indexes:**

| Index                                  | Type     | Options                    | Purpose                                           |
|----------------------------------------|----------|----------------------------|---------------------------------------------------|
| `{ userId: 1, createdAt: -1 }`         | Compound |                            | User's activity feed sorted newest first          |
| `{ resourceId: 1, createdAt: -1 }`     | Compound |                            | All activity on a specific ticket                 |
| `{ action: 1, createdAt: -1 }`         | Compound |                            | Admin: filter all events by action type           |
| `{ createdAt: 1 }`                     | Single   | `expireAfterSeconds: 7776000` | TTL: auto-delete activity logs older than 90 days |

---

## Indexing Strategy

### Query Pattern Analysis

| Endpoint                        | Query Pattern                                               | Index Used                             |
|---------------------------------|-------------------------------------------------------------|----------------------------------------|
| GET /api/tickets (list)         | `{ createdBy: userId, isDeleted: false }` sort by createdAt | `{ createdBy:1, createdAt:-1 }`       |
| GET /api/tickets?status=Open    | `{ createdBy: userId, status: 'Open' }`                     | `{ createdBy:1, status:1 }`           |
| GET /api/tickets?priority=High  | `{ createdBy: userId, priority: 'High' }`                   | `{ createdBy:1, priority:1 }`         |
| GET /api/tickets/:id            | `{ _id: ticketId, createdBy: userId }`                      | `_id` (primary key)                   |
| GET /api/analytics/summary      | Aggregation: group by status, priority, type, environment   | `{ createdBy:1, createdAt:-1 }`       |
| GET /api/analytics/trends       | Aggregation: group by date, count                           | `{ createdBy:1, createdAt:-1 }`       |
| Full-text search                | `{ $text: { $search: 'query' }, createdBy: userId }`        | Text index on title + description      |

### Index Size Estimates

At 10,000 tickets with an average of 4 compound indexes, the index memory footprint is approximately 2-8 MB — well within the working set for a dedicated MongoDB instance with 1 GB RAM.

### Covered Queries

The ticket list query can be made a covered query (no document fetch) by projecting only indexed fields. For the paginated list view, only `title`, `priority`, `severity`, `status`, `type`, `environment`, `labels`, and `createdAt` are needed. With a compound index that includes `createdAt`, Mongoose can serve pagination metadata without reading full documents.

---

## Data Relationships

TicketAI uses a reference-based (not embedded) relationship model between collections.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  users                                                                    │
│  ┌──────────┐                                                            │
│  │  _id     │◄──────────────────────────────────────────────────────┐   │
│  │  email   │                                                        │   │
│  │  name    │                                                        │   │
│  └──────────┘                                                        │   │
└──────────────────────────────────────────────────────────────────────│───┘
                                                                       │
                         references (createdBy)                        │
┌──────────────────────────────────────────────────────────────────────│───┐
│  tickets                                                              │   │
│  ┌──────────────┐                                                    │   │
│  │  _id         │◄──────────────────────────────────────────────┐   │   │
│  │  title       │                                                │   │   │
│  │  createdBy ──┼────────────────────────────────────────────────┘   │   │
│  └──────────────┘                                                     │   │
└───────────────────────────────────────────────────────────────────────│───┘
                                                                        │
                         references (ticketId)                          │
┌───────────────────────────────────────────────────────────────────────│───┐
│  ai_logs                                                               │   │
│  ┌──────────────┐                                                      │   │
│  │  _id         │                                                      │   │
│  │  ticketId ───┼──────────────────────────────────────────────────────┘   │
│  │  userId   ───┼────────────────────────────────────────────────────────── │
│  └──────────────┘                                                          │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│  activity_logs                                                              │
│  ┌──────────────┐                                                          │
│  │  _id         │                                                          │
│  │  userId      │  (soft reference — not populated, used for filtering)    │
│  │  resourceId  │  (points to ticket or user _id depending on action)      │
│  └──────────────┘                                                          │
└────────────────────────────────────────────────────────────────────────────┘
```

**Why References (Not Embedding)?**

- Tickets can be updated and queried independently of the user document
- ai_logs and activity_logs grow unboundedly — embedding them in ticket/user would cause document size to exceed MongoDB's 16 MB limit
- Mongoose `.populate()` is used selectively (only when the full user object is needed in a response, not in list views)

---

## Schema Evolution Strategy

### Versioning Approach

Mongoose does not enforce schema versions by default. TicketAI uses the following strategy for backward-compatible schema changes:

**Step 1: Always use optional fields with defaults**

New fields added to a schema should have a `default` value so existing documents without that field return the default rather than `undefined`.

```javascript
// Adding a new field to tickets
assignee: {
  type: ObjectId,
  ref: 'User',
  required: false,   // Not required
  default: null      // Existing tickets get null
}
```

**Step 2: Use `promptVersion` to track AI output structure**

When the prompt template changes in a way that alters the shape of AI-generated content, increment `promptVersion`. This allows queries to distinguish between tickets generated with different prompt strategies for analysis or backfill jobs.

**Step 3: Backfill scripts for breaking changes**

For changes that require populating a new required field on existing documents, write a one-time backfill script in `server/scripts/migrations/`:

```
server/scripts/migrations/
├── 001-add-severity-to-tickets.js
├── 002-add-labels-array.js
└── 003-normalize-priority-casing.js
```

Each script logs progress, is idempotent (safe to run multiple times), and can be executed with `node server/scripts/migrations/001-add-severity-to-tickets.js`.

**Step 4: Monitor for deprecated fields**

When removing a field, first mark it deprecated in comments, deploy and monitor for 2+ weeks, confirm no code reads it, then remove from the schema. MongoDB documents retain the old field harmlessly until a write operation omits it.
