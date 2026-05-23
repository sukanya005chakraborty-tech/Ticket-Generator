# API Flow Documentation — TicketAI

## Table of Contents
1. [Authentication Flow](#authentication-flow)
2. [Ticket Generation Flow](#ticket-generation-flow)
3. [Request / Response Examples](#request--response-examples)

---

## Authentication Flow

### 1. User Registration

```
Client                         Nginx                      Express API                 MongoDB
  │                              │                              │                         │
  │  POST /api/auth/register     │                              │                         │
  │  { name, email, password }   │                              │                         │
  │─────────────────────────────►│                              │                         │
  │                              │  Forward (rate limited)      │                         │
  │                              │─────────────────────────────►│                         │
  │                              │                              │  Validate input          │
  │                              │                              │  (express-validator)     │
  │                              │                              │                         │
  │                              │                              │  findOne({ email })     │
  │                              │                              │────────────────────────►│
  │                              │                              │◄────────────────────────│
  │                              │                              │  (null — not taken)      │
  │                              │                              │                         │
  │                              │                              │  bcrypt.hash(password)  │
  │                              │                              │  users.create(...)      │
  │                              │                              │────────────────────────►│
  │                              │                              │◄────────────────────────│
  │                              │                              │  { _id, email, name }   │
  │                              │                              │                         │
  │                              │                              │  sign accessToken (15m) │
  │                              │                              │  sign refreshToken (7d) │
  │                              │                              │                         │
  │  201 Created                 │                              │                         │
  │  { accessToken, refreshToken, user }                        │                         │
  │◄─────────────────────────────────────────────────────────────                         │
```

### 2. User Login

```
Client                         Express API                  MongoDB
  │                              │                              │
  │  POST /api/auth/login        │                              │
  │  { email, password }         │                              │
  │─────────────────────────────►│                              │
  │                              │  Validate fields             │
  │                              │  findOne({ email })          │
  │                              │─────────────────────────────►│
  │                              │◄─────────────────────────────│
  │                              │  user doc (with passwordHash)│
  │                              │                              │
  │                              │  bcrypt.compare(password, hash)
  │                              │  ↓ match                     │
  │                              │  sign accessToken (15m TTL)  │
  │                              │  sign refreshToken (7d TTL)  │
  │                              │  update user.refreshTokenHash│
  │                              │─────────────────────────────►│
  │                              │                              │
  │  200 OK                      │                              │
  │  { accessToken, refreshToken, user }                        │
  │◄─────────────────────────────│                              │
  │                              │                              │
  │  [Client stores tokens in    │                              │
  │   memory / Zustand store]    │                              │
```

### 3. Accessing a Protected Endpoint

```
Client                         Express API
  │                              │
  │  GET /api/tickets            │
  │  Authorization: Bearer <AT>  │
  │─────────────────────────────►│
  │                              │  verifyToken middleware
  │                              │  jwt.verify(token, JWT_SECRET)
  │                              │  ↓ valid
  │                              │  req.user = { id, email, role }
  │                              │  → next()
  │                              │
  │                              │  ticketController.getAll()
  │                              │  ticketRepository.findByUser(userId)
  │                              │
  │  200 OK { tickets, total, page }
  │◄─────────────────────────────│
```

### 4. Token Refresh

```
Client                         Express API                  MongoDB
  │                              │                              │
  │  [Access token expired]      │                              │
  │                              │                              │
  │  POST /api/auth/refresh      │                              │
  │  { refreshToken: "..." }     │                              │
  │─────────────────────────────►│                              │
  │                              │  jwt.verify(refreshToken)    │
  │                              │  Decode payload → userId     │
  │                              │  findById(userId)            │
  │                              │─────────────────────────────►│
  │                              │◄─────────────────────────────│
  │                              │  user (with refreshTokenHash)│
  │                              │                              │
  │                              │  bcrypt.compare(incoming token, stored hash)
  │                              │  ↓ match                     │
  │                              │  sign new accessToken (15m)  │
  │                              │  sign new refreshToken (7d)  │
  │                              │  update refreshTokenHash     │
  │                              │─────────────────────────────►│
  │                              │                              │
  │  200 OK { accessToken, refreshToken }
  │◄─────────────────────────────│                              │
  │                              │                              │
  │  [Client retries original    │                              │
  │   request with new AT]       │                              │
```

### 5. Logout

```
Client                         Express API                  MongoDB
  │                              │                              │
  │  POST /api/auth/logout       │                              │
  │  Authorization: Bearer <AT>  │                              │
  │─────────────────────────────►│                              │
  │                              │  verifyToken (validates AT)  │
  │                              │  Clear refreshTokenHash      │
  │                              │─────────────────────────────►│
  │                              │  users.updateOne({ refreshTokenHash: null })
  │                              │◄─────────────────────────────│
  │  200 OK { message: "Logged out successfully" }             │
  │◄─────────────────────────────│                              │
  │                              │                              │
  │  [Client clears tokens from  │                              │
  │   memory / Zustand store]    │                              │
```

---

## Ticket Generation Flow

The ticket generation endpoint is the core feature of TicketAI. Here is the complete step-by-step pipeline from form submission to stored ticket.

```
Step 1: Browser
  User fills the Generate form:
  - rawInput: "Login button doesn't work on mobile safari..."
  - environment: "production"
  - browser: "Safari 17"
  - device: "iPhone 15 Pro"

Step 2: API Request
  POST /api/tickets/generate
  Authorization: Bearer <accessToken>
  Content-Type: application/json

Step 3: Nginx
  - Applies api_limit rate limiting zone (20 req/s, burst 50)
  - Forwards to backend:5000

Step 4: verifyToken middleware
  - Extracts token from Authorization header
  - jwt.verify(token, process.env.JWT_SECRET)
  - Attaches req.user = { id, email, role }
  - Calls next()

Step 5: Input Validation middleware
  - rawInput: string, minLength(20), maxLength(2000), required
  - environment: optional enum ['development', 'staging', 'production', 'unknown']
  - browser: optional string, maxLength(100)
  - device: optional string, maxLength(100)
  - If validation fails → 422 Unprocessable Entity with error details

Step 6: ticketController.generate
  - Extracts { rawInput, environment, browser, device } from req.body
  - Calls ticketService.generateTicket(req.user.id, { rawInput, environment, browser, device })

Step 7: ticketService — prompt construction
  - Loads system prompt template from prompts/systemPrompt.js
  - Builds user prompt: injects rawInput, environment, browser, device into template
  - Estimated input tokens: ~800-1200 tokens

Step 8: openAIService.generateTicket
  - Calls openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      max_tokens: 4096,
      temperature: 0.3
    })

Step 9: Retry logic (on transient failure)
  - Attempt 1: immediate
  - Attempt 2: wait 1 second, retry
  - Attempt 3: wait 2 seconds, retry
  - Attempt 4: wait 4 seconds, retry
  - After 3 failures: throw ServiceUnavailableError

Step 10: Response parsing
  - JSON.parse(response.choices[0].message.content)
  - Validates required fields: title, description, priority, severity, type
  - Validates arrays: stepsToReproduce, acceptanceCriteria, testCases, labels
  - Falls back to empty arrays if AI omitted optional array fields

Step 11: ticketRepository.create
  - Creates new Ticket document with:
    - All AI-generated fields
    - createdBy: req.user.id
    - status: 'Open'
    - rawInput: original user input (stored for audit)
    - promptVersion: current prompt template version

Step 12: aiLogRepository.create (non-blocking, does not delay response)
  - Stores: promptTokens, completionTokens, model, durationMs, ticketId, userId

Step 13: activityLogRepository.create (non-blocking)
  - Stores: action='ticket.generated', userId, ticketId, metadata

Step 14: ticketController
  - Returns 201 Created { success: true, data: populatedTicket }

Step 15: Browser
  - React Query mutation onSuccess callback
  - Invalidates 'tickets' query cache → list refreshes automatically
  - Navigates to TicketDetailPage for the new ticket
```

---

## Request / Response Examples

### POST /api/auth/register

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Priya Sharma",
    "email": "priya@example.com",
    "password": "SecurePass123!"
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "_id": "665f1a2b3c4d5e6f7a8b9c01",
      "name": "Priya Sharma",
      "email": "priya@example.com",
      "role": "user",
      "createdAt": "2024-06-04T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI2NjVmMWEyYjNjNGQ1ZTZmN2E4YjljMDEiLCJlbWFpbCI6InByaXlhQGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3MTc0OTI4MDAsImV4cCI6MTcxNzQ5MzcwMH0.example",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI2NjVmMWEyYjNjNGQ1ZTZmN2E4YjljMDEiLCJpYXQiOjE3MTc0OTI4MDAsImV4cCI6MTcxODA5NzYwMH0.example"
  }
}
```

**Response (409 Conflict — email already registered):**
```json
{
  "success": false,
  "error": "EMAIL_TAKEN",
  "message": "An account with this email address already exists"
}
```

---

### POST /api/auth/login

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "priya@example.com",
    "password": "SecurePass123!"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "665f1a2b3c4d5e6f7a8b9c01",
      "name": "Priya Sharma",
      "email": "priya@example.com",
      "role": "user"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9..."
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "The email or password you entered is incorrect"
}
```

---

### POST /api/tickets/generate

**Request:**
```bash
curl -X POST http://localhost:5000/api/tickets/generate \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "rawInput": "Login button doesnt work on mobile safari when user has dark mode enabled. Tapping the button does nothing, no error message shown. Happens every time on iOS 17 with Safari 17. Works fine on Chrome mobile.",
    "environment": "production",
    "browser": "Safari 17",
    "device": "iPhone 15 Pro (iOS 17)"
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "title": "[BUG] Login button unresponsive on Mobile Safari 17 with Dark Mode enabled (iOS 17)",
    "description": "Users running iOS 17 with system-level dark mode enabled experience a complete login failure on Mobile Safari 17. Tapping the login button produces no visual feedback, no network request, and no error message. The issue is isolated to Safari on iOS — Chrome Mobile on the same device works as expected. This suggests a CSS or JavaScript compatibility issue specific to WebKit with dark mode media queries active.",
    "stepsToReproduce": [
      "Enable dark mode on iPhone 15 Pro (Settings → Display & Brightness → Dark)",
      "Open Safari 17 and navigate to the TicketAI login page",
      "Enter a valid email address and password",
      "Tap the 'Log In' button",
      "Observe that nothing happens — no loading state, no redirect, no error"
    ],
    "acceptanceCriteria": [
      "The login button must respond to tap events on Safari 17 with dark mode enabled",
      "A loading state (spinner or disabled button) must appear immediately upon tap",
      "Successful authentication must redirect the user to the dashboard",
      "Failed authentication must display a descriptive error message",
      "The fix must be verified on iPhone 12, 13, 14, and 15 with iOS 16 and 17"
    ],
    "testCases": [
      {
        "scenario": "Login with valid credentials on Safari 17, dark mode ON",
        "expectedResult": "User is authenticated and redirected to /dashboard",
        "testType": "functional"
      },
      {
        "scenario": "Login with invalid credentials on Safari 17, dark mode ON",
        "expectedResult": "Error message 'Invalid email or password' is displayed",
        "testType": "functional"
      },
      {
        "scenario": "Login on Safari 17, dark mode OFF",
        "expectedResult": "Login works normally (regression check)",
        "testType": "regression"
      },
      {
        "scenario": "Login on Chrome Mobile, dark mode ON",
        "expectedResult": "Login works normally (cross-browser regression check)",
        "testType": "regression"
      }
    ],
    "priority": "Critical",
    "severity": "Critical",
    "type": "Bug",
    "status": "Open",
    "environment": "production",
    "browser": "Safari 17",
    "device": "iPhone 15 Pro (iOS 17)",
    "effortEstimate": "3",
    "labels": ["mobile", "safari", "dark-mode", "login", "ios", "webkit"],
    "rawInput": "Login button doesnt work on mobile safari when user has dark mode enabled...",
    "createdBy": "665f1a2b3c4d5e6f7a8b9c01",
    "promptVersion": "1.2.0",
    "createdAt": "2024-06-04T10:30:00.000Z",
    "updatedAt": "2024-06-04T10:30:00.000Z"
  }
}
```

**Response (422 Unprocessable Entity — validation error):**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    {
      "field": "rawInput",
      "message": "rawInput must be at least 20 characters long"
    }
  ]
}
```

---

### GET /api/tickets

**Request:**
```bash
curl -X GET "http://localhost:5000/api/tickets?page=1&limit=10&status=Open&priority=Critical&sortBy=createdAt&sortOrder=desc" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..."
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "_id": "665f1a2b3c4d5e6f7a8b9c0d",
        "title": "[BUG] Login button unresponsive on Mobile Safari 17",
        "priority": "Critical",
        "severity": "Critical",
        "type": "Bug",
        "status": "Open",
        "environment": "production",
        "labels": ["mobile", "safari", "login"],
        "createdAt": "2024-06-04T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 47,
      "page": 1,
      "limit": 10,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

### GET /api/analytics/summary

**Request:**
```bash
curl -X GET "http://localhost:5000/api/analytics/summary?period=30d" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..."
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "totalTickets": 47,
    "byStatus": {
      "Open": 23,
      "In Progress": 12,
      "Resolved": 9,
      "Closed": 3
    },
    "byPriority": {
      "Critical": 5,
      "High": 18,
      "Medium": 20,
      "Low": 4
    },
    "byType": {
      "Bug": 31,
      "Feature": 10,
      "Improvement": 6
    },
    "byEnvironment": {
      "production": 28,
      "staging": 12,
      "development": 7
    },
    "averageEffortEstimate": 4.2,
    "generationTrend": [
      { "date": "2024-05-06", "count": 2 },
      { "date": "2024-05-07", "count": 5 },
      { "date": "2024-05-08", "count": 3 }
    ]
  }
}
```

---

### GET /api/health

**Request:**
```bash
curl http://localhost:5000/api/health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2024-06-04T10:30:00.000Z",
  "uptime": 3612.45,
  "services": {
    "database": "connected",
    "openai": "configured"
  },
  "version": "1.0.0"
}
```

---

### Error Response Format

All error responses follow a consistent structure:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable description of the error",
  "details": []
}
```

| HTTP Status | Error Code            | Meaning                                           |
|-------------|-----------------------|---------------------------------------------------|
| 400         | `BAD_REQUEST`         | Malformed request body or missing required fields |
| 401         | `UNAUTHORIZED`        | Missing or invalid access token                   |
| 403         | `FORBIDDEN`           | Token valid but insufficient permissions          |
| 404         | `NOT_FOUND`           | Resource does not exist or belongs to another user |
| 409         | `CONFLICT`            | Resource already exists (e.g., duplicate email)   |
| 422         | `VALIDATION_ERROR`    | Field-level validation failures                   |
| 429         | `RATE_LIMIT_EXCEEDED` | Too many requests from this IP                    |
| 500         | `INTERNAL_ERROR`      | Unexpected server error (logged server-side)      |
| 502         | `AI_SERVICE_ERROR`    | OpenAI API returned an error after all retries    |
| 503         | `SERVICE_UNAVAILABLE` | Dependency (DB or AI) temporarily unreachable     |
