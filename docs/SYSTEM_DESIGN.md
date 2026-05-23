# System Design Document — TicketAI

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Component Deep Dives](#component-deep-dives)
3. [Data Flow](#data-flow)
4. [Scalability Considerations](#scalability-considerations)
5. [Security Architecture](#security-architecture)

---

## Architecture Overview

TicketAI follows a three-tier client-server architecture with a clear separation between the presentation layer (React SPA), the application layer (Express API), and the data layer (MongoDB). An Nginx reverse proxy sits at the edge and routes traffic to the appropriate tier.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Client Tier                                                              │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  React 18 SPA                                                        │ │
│  │  Vite Build Tool │ Tailwind CSS │ React Query │ Zustand │ React HF   │ │
│  └──────────────────────────────────┬──────────────────────────────────┘ │
└─────────────────────────────────────│──────────────────────────────────── ┘
                                      │ HTTPS (port 443 in prod / 80 in dev)
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Edge / Proxy Tier                                                        │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Nginx                                                            │   │
│  │  Rate Limiting │ TLS Termination │ Gzip │ Security Headers        │   │
│  │                                                                   │   │
│  │  /api/*  ──────────────────────────────► backend:5000            │   │
│  │  /*      ──────────────────────────────► frontend:80             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
                    │                             │
                    ▼                             ▼
┌─────────────────────────────┐   ┌──────────────────────────────────────┐
│  Application Tier            │   │  Application Tier                    │
│                              │   │                                      │
│  Express.js API              │   │  Nginx (static file server)          │
│  ├── Routes                  │   │  Serves compiled React SPA           │
│  ├── Middleware (auth, rate) │   │  try_files for SPA routing           │
│  ├── Controllers             │   └──────────────────────────────────────┘
│  ├── Services (AI logic)     │
│  ├── Repositories (DB)       │
│  └── Models (Mongoose)       │
│            │        │        │
│            │        │ HTTPS  │
│            ▼        ▼        │
│  ┌──────────┐  ┌──────────┐  │
│  │ MongoDB  │  │ OpenAI   │  │
│  │    7     │  │  GPT-4o  │  │
│  └──────────┘  └──────────┘  │
└──────────────────────────────┘
```

### Design Principles

| Principle                  | How It's Applied                                                                              |
|----------------------------|-----------------------------------------------------------------------------------------------|
| Separation of Concerns     | Routes → Controllers → Services → Repositories → Models; each layer has one responsibility   |
| Fail Fast                  | Input validation at the middleware layer before any business logic executes                    |
| Defence in Depth           | Rate limiting at nginx + express-rate-limit; auth at middleware; validation at controller       |
| Observability              | Winston structured logs; Morgan HTTP logs; AI interaction logs stored in MongoDB              |
| Stateless API              | JWT tokens; no server-side session state; horizontal scaling possible                          |
| Immutable Infrastructure   | Docker images are built once and promoted through environments; no in-place updates            |

---

## Component Deep Dives

### Frontend Architecture

The React client is a single-page application built with Vite. The component tree is organised into three layers:

```
App (React Router root)
├── AuthGuard (redirects unauthenticated users)
├── Layout
│   ├── Sidebar (navigation)
│   ├── Header (user menu, theme toggle)
│   └── Outlet (current route content)
│       ├── DashboardPage      → analytics summary + recent tickets
│       ├── GeneratePage       → ticket generation form + result view
│       ├── HistoryPage        → paginated ticket list with filters
│       ├── TicketDetailPage   → single ticket view with edit capability
│       └── SettingsPage       → user profile and preferences
└── AuthLayout
    ├── LoginPage
    └── RegisterPage
```

**State Management Strategy**

| State Type        | Tool               | Reason                                                     |
|-------------------|--------------------|-------------------------------------------------------------|
| Server state      | React Query v5     | Caching, background refetching, pagination, mutation states |
| Global UI state   | Zustand            | Auth session, theme preference, sidebar open/closed         |
| Form state        | React Hook Form    | Performant forms with Zod schema validation                 |
| URL state         | React Router v6    | Filters, pagination, and current ticket ID in the URL       |

**Data Fetching Pattern**

All API calls go through a central Axios instance (`src/services/api.js`) that:
1. Attaches the `Authorization: Bearer <token>` header automatically
2. Intercepts 401 responses to attempt a token refresh
3. If refresh fails, clears the Zustand auth store and redirects to `/login`

---

### Backend Architecture

The Express API follows a layered architecture where each request passes through a predictable pipeline:

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────┐
│  Middleware Stack (applied globally)    │
│  helmet → cors → morgan → compression  │
│  cookie-parser → express.json()         │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│  Rate Limiter (express-rate-limit)      │
│  General: 100 req/15min per IP          │
│  Auth: 20 req/15min per IP              │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│  Router (routes/index.js)               │
│  /api/auth → authRouter                 │
│  /api/tickets → ticketRouter            │
│  /api/analytics → analyticsRouter       │
│  /api/health → healthRouter             │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│  Auth Middleware (verifyToken)          │
│  Validates JWT, attaches req.user       │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│  Validation Middleware (express-validator│
│  or Joi) — rejects malformed input      │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│  Controller                             │
│  Extracts input, calls service, formats │
│  response, handles errors               │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│  Service Layer                          │
│  Business logic, AI orchestration,      │
│  transaction coordination               │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│  Repository Layer                       │
│  All Mongoose queries centralised here  │
│  Controllers never call Model directly  │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│  MongoDB via Mongoose                   │
│  Schemas, indexes, virtual fields       │
└─────────────────────────────────────────┘
```

---

### Database Architecture

MongoDB is chosen for its:
- **Flexible schema** — AI-generated ticket structures can evolve without migrations
- **Rich query language** — Aggregation pipeline supports complex analytics queries
- **Native JSON** — No ORM impedance mismatch; Mongoose adds schema enforcement on top

Four collections are used: `users`, `tickets`, `ai_logs`, and `activity_logs`. Compound indexes support the most common query patterns (user's tickets by status, user's tickets sorted by date).

---

## Data Flow

### User Login Flow

```
1.  Browser           POST /api/auth/login { email, password }
2.  Nginx             Forwards request to backend; applies auth rate limit
3.  Express           Rate limiter checks IP counter
4.  authRouter        Routes to authController.login
5.  Validation        express-validator checks email format, password length
6.  authController    Calls authService.login(email, password)
7.  authService       Calls userRepository.findByEmail(email)
8.  userRepository    db.users.findOne({ email }) + select +password
9.  authService       bcrypt.compare(password, user.passwordHash)
10. authService       Signs access token (JWT, 15m TTL)
11. authService       Signs refresh token (JWT, 7d TTL)
12. authService       Stores refresh token hash in user document
13. authController    Returns { accessToken, refreshToken, user }
14. Browser           Stores tokens; React Query invalidates all cached queries
```

### Ticket Generation Flow

```
1.  Browser           POST /api/tickets/generate { rawInput, environment, browser, device }
2.  Nginx             Forwards to backend with rate limiting applied
3.  verifyToken       Decodes JWT, attaches req.user = { id, email, role }
4.  Validation        Checks rawInput length (min 20, max 2000 chars)
5.  ticketController  Calls ticketService.generateTicket(req.user.id, body)
6.  ticketService     Builds system prompt + user prompt via promptBuilder
7.  ticketService     Calls openAIService.generateTicket(systemPrompt, userPrompt)
8.  openAIService     Calls openai.chat.completions.create with response_format: json_object
9.  openAIService     On failure: exponential backoff retry (1s → 2s → 4s, max 3 attempts)
10. openAIService     Parses JSON; validates required fields present
11. ticketService     Maps parsed response to Mongoose ticket schema
12. ticketRepository  db.tickets.create({ ...ticketData, createdBy: req.user.id })
13. aiLogRepository   db.ai_logs.create({ prompt, response, tokens, duration, ticketId })
14. activityRepository db.activity_logs.create({ action: 'ticket.generated', user, ticketId })
15. ticketController  Returns { success: true, data: ticket }
16. Browser           React Query mutation callback updates ticket list cache
```

---

## Scalability Considerations

### Horizontal Scaling

The backend is designed to be stateless. Because JWT validation only requires the `JWT_SECRET` environment variable (no shared session store), multiple Express instances can run behind a load balancer without sticky sessions.

**Recommended scaling path:**

```
Phase 1 (current): Single docker-compose stack on one VPS
Phase 2:           docker-compose with replica counts via docker swarm
Phase 3:           Kubernetes deployment with HPA based on CPU/request rate
```

### Caching Strategy

| What                    | Cache Layer              | TTL        | Rationale                                              |
|-------------------------|--------------------------|------------|--------------------------------------------------------|
| Analytics aggregations  | Redis (future)           | 5 minutes  | Expensive MongoDB aggregation; rarely changes         |
| User profile            | React Query              | 5 minutes  | Avoids redundant GET /api/auth/me on every render     |
| Ticket list             | React Query              | 30 seconds | Near-realtime UX; invalidated on mutation             |
| Static assets           | Nginx + CDN              | 1 year     | Vite output filenames are content-hashed              |

### Database Indexing Strategy

Critical indexes defined on the `tickets` collection:

| Index                              | Type     | Query Pattern Served                          |
|------------------------------------|----------|-----------------------------------------------|
| `{ createdBy: 1, createdAt: -1 }` | Compound | User's tickets sorted by newest first         |
| `{ createdBy: 1, status: 1 }`     | Compound | Filter user's tickets by status               |
| `{ createdBy: 1, priority: 1 }`   | Compound | Filter user's tickets by priority             |
| `{ createdAt: -1 }`               | Single   | Admin: all tickets sorted by date             |
| `{ title: 'text', description: 'text' }` | Text | Full-text search across ticket content   |

MongoDB's WiredTiger storage engine with document-level locking handles concurrent writes without collection-level locks.

---

## Security Architecture

### Authentication Token Lifecycle

```
Registration / Login
       │
       ▼
  ┌──────────┐   signs    ┌─────────────────────────────────────┐
  │  Server  │──────────►│  Access Token (JWT, RS256, 15m TTL) │
  │          │──────────►│  Refresh Token (JWT, 7d TTL)        │
  └──────────┘            └──────────┬──────────────────────────┘
                                     │ stored in memory (client)
                                     │ httpOnly cookie (optional)
                          ┌──────────▼──────────────────────────┐
                          │  Client includes access token in     │
                          │  Authorization: Bearer <token>       │
                          │  header on every API request         │
                          └──────────┬──────────────────────────┘
                                     │
                          Access token expires →
                                     │
                          ┌──────────▼──────────────────────────┐
                          │  POST /api/auth/refresh              │
                          │  Body: { refreshToken }              │
                          │  Server validates refresh token,     │
                          │  issues new access + refresh tokens  │
                          │  (refresh token rotation)            │
                          └─────────────────────────────────────┘
```

### Rate Limiting Strategy

| Zone         | Limit              | Burst  | Applied To                        |
|--------------|--------------------|--------|-----------------------------------|
| `api_limit`  | 20 req/s per IP    | 50     | All `/api/*` routes via Nginx     |
| `auth_limit` | 5 req/s per IP     | 10     | `/api/auth/login`, `/register`    |
| Express RL   | 100 req/15min per IP | —   | All routes via express-rate-limit |
| Express RL   | 20 req/15min per IP  | —   | Auth routes only                  |

### Input Sanitisation

All request bodies are:
1. Size-limited at the nginx layer (`client_max_body_size 10m`)
2. Parsed by `express.json()` with a size limit of `1mb`
3. Validated field-by-field via express-validator (type, length, format)
4. Further validated by Joi schemas in service layer where complex rules apply
5. The `rawInput` field sent to OpenAI is explicitly escaped and injected into the prompt as a quoted string, not interpolated into the JSON schema definition
