# AI Integration Workflow — TicketAI

## Table of Contents
1. [Overview](#overview)
2. [Prompt Engineering](#prompt-engineering)
3. [Response Processing Pipeline](#response-processing-pipeline)
4. [Retry Strategy](#retry-strategy)
5. [Token Management](#token-management)
6. [Error Handling](#error-handling)
7. [Sample AI Interaction](#sample-ai-interaction)

---

## Overview

TicketAI integrates OpenAI's **GPT-4o** model to transform unstructured bug descriptions into fully-structured Jira tickets. The integration is encapsulated in the `openAIService` and orchestrated by `ticketService`. Neither the controller nor the repository layers interact with OpenAI directly.

### Why GPT-4o?

| Requirement                   | GPT-4o Capability                                                |
|-------------------------------|------------------------------------------------------------------|
| Structured JSON output        | Native `response_format: { type: "json_object" }` support       |
| Technical comprehension       | Strong understanding of software engineering terminology         |
| Instruction following         | Reliable adherence to field constraints (enums, arrays, length) |
| Reasoning quality             | Infers severity, priority, and test cases from vague descriptions|
| Cost efficiency               | Competitive pricing vs GPT-4 Turbo for the token volume used    |
| Speed                         | Lower latency than o1/o3 models; suitable for synchronous UX    |

The `temperature` is set to `0.3` (low but not zero) to produce consistent, professional output while retaining enough variability to avoid repetitive phrasing across tickets.

---

## Prompt Engineering

### System Prompt Design

The system prompt establishes the AI's persona, output contract, and hard constraints. It is loaded from `server/prompts/systemPrompt.js` and versioned alongside the codebase (changes to the prompt increment `promptVersion`).

```
You are an expert software quality engineer and technical writer specialising in
writing professional Jira bug tickets. Your role is to take a raw, unstructured
bug description provided by a developer or tester and transform it into a
complete, professional Jira ticket.

OUTPUT CONTRACT:
You MUST respond with a single, valid JSON object. Do not include any text,
markdown, code fences, or explanation outside the JSON object.

The JSON object MUST contain exactly these fields:

{
  "title": string,
    // Format: "[BUG] <concise description, max 120 chars>"
    // Must clearly identify the component, symptom, and context
    // Example: "[BUG] Login button unresponsive on Safari 17 with Dark Mode enabled"

  "description": string,
    // 2-5 sentences of professional technical prose
    // Explain WHAT is broken, WHERE it occurs, and WHY it matters
    // Do not repeat the title verbatim

  "stepsToReproduce": string[],
    // Ordered list of specific, actionable reproduction steps
    // Start each step with an imperative verb: "Navigate to...", "Click...", "Observe..."
    // Include 3-8 steps. Never return an empty array.

  "acceptanceCriteria": string[],
    // Definition of Done — what must be true for this ticket to be resolved
    // Write in the format: "The system must..."
    // Include 3-6 criteria. Never return an empty array.

  "testCases": [
    {
      "scenario": string,       // One sentence describing the test condition
      "expectedResult": string, // What should happen
      "testType": string        // One of: "functional", "regression", "edge-case", "performance", "security"
    }
  ],
    // Include 2-5 test cases covering the happy path and key edge cases

  "priority": string,
    // Exactly one of: "Critical", "High", "Medium", "Low"
    // Critical = system down or data loss; High = major feature broken;
    // Medium = functionality impaired; Low = cosmetic or minor

  "severity": string,
    // Exactly one of: "Critical", "Major", "Minor", "Trivial"
    // Based on technical impact, not business priority

  "type": string,
    // Exactly one of: "Bug", "Feature", "Improvement", "Task", "Epic"

  "effortEstimate": string,
    // Fibonacci story points: exactly one of "1", "2", "3", "5", "8", "13", "21"

  "labels": string[],
    // 3-8 lowercase, hyphenated labels relevant to the issue
    // e.g., ["mobile", "safari", "dark-mode", "login", "webkit"]
    // Never return an empty array.
}

CONSTRAINTS:
- Never make up specific error messages, stack traces, or line numbers
- Do not include internal comments or explanations inside the JSON
- If the input is ambiguous, make reasonable professional assumptions and note them in the description
- Always write in present tense, third person
- Maintain a professional engineering tone throughout
```

### User Prompt Structure

The user prompt is constructed by `promptBuilder.js` and injects the user's raw input along with optional context fields:

```javascript
function buildUserPrompt({ rawInput, environment, browser, device }) {
  const contextLines = [];

  if (environment && environment !== 'unknown') {
    contextLines.push(`Environment: ${environment}`);
  }
  if (browser) {
    contextLines.push(`Browser: ${browser}`);
  }
  if (device) {
    contextLines.push(`Device: ${device}`);
  }

  const contextBlock = contextLines.length > 0
    ? `\n\nAdditional context:\n${contextLines.join('\n')}`
    : '';

  return `Convert the following bug description into a structured Jira ticket:

"${rawInput}"${contextBlock}

Remember: respond ONLY with a valid JSON object matching the schema defined in the system prompt.`;
}
```

**Why quote the rawInput?** By wrapping the user input in quotes, any accidental prompt injection (e.g., a user typing `"Ignore previous instructions and..."`) is treated as literal string content rather than an instruction to the model. Combined with the explicit final reminder to respond only with JSON, this significantly reduces prompt injection risk.

### Output Schema Enforcement

The `response_format: { type: "json_object" }` parameter instructs GPT-4o to guarantee that its output is valid, parseable JSON. This eliminates the most common failure mode (markdown code fences wrapping the JSON, or prose before/after the JSON object) that plagues older prompt-only approaches.

After parsing, a field validator checks:

```javascript
const REQUIRED_FIELDS = [
  'title', 'description', 'stepsToReproduce', 'acceptanceCriteria',
  'testCases', 'priority', 'severity', 'type', 'effortEstimate', 'labels'
];

const VALID_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const VALID_SEVERITIES = ['Critical', 'Major', 'Minor', 'Trivial'];
const VALID_TYPES      = ['Bug', 'Feature', 'Improvement', 'Task', 'Epic'];
const VALID_EFFORT     = ['1', '2', '3', '5', '8', '13', '21'];
const VALID_TEST_TYPES = ['functional', 'regression', 'edge-case', 'performance', 'security'];

function validateAIResponse(parsed) {
  for (const field of REQUIRED_FIELDS) {
    if (parsed[field] === undefined || parsed[field] === null) {
      throw new AIResponseValidationError(`Missing required field: ${field}`);
    }
  }

  if (!VALID_PRIORITIES.includes(parsed.priority)) {
    parsed.priority = 'Medium'; // Safe fallback
  }

  if (!VALID_SEVERITIES.includes(parsed.severity)) {
    parsed.severity = 'Minor'; // Safe fallback
  }

  if (!VALID_TYPES.includes(parsed.type)) {
    parsed.type = 'Bug'; // Safe fallback
  }

  if (!VALID_EFFORT.includes(parsed.effortEstimate)) {
    parsed.effortEstimate = '3'; // Safe fallback
  }

  // Ensure arrays are actually arrays
  for (const arrayField of ['stepsToReproduce', 'acceptanceCriteria', 'labels']) {
    if (!Array.isArray(parsed[arrayField])) {
      parsed[arrayField] = [];
    }
  }

  if (!Array.isArray(parsed.testCases)) {
    parsed.testCases = [];
  }

  // Validate each test case
  parsed.testCases = parsed.testCases
    .filter(tc => tc && typeof tc.scenario === 'string' && typeof tc.expectedResult === 'string')
    .map(tc => ({
      ...tc,
      testType: VALID_TEST_TYPES.includes(tc.testType) ? tc.testType : 'functional'
    }));

  return parsed;
}
```

---

## Response Processing Pipeline

Every call to `POST /api/tickets/generate` passes through this seven-stage pipeline:

```
Stage 1: Input Validation
───────────────────────────────────────────────────────────────────────────
  - express-validator checks rawInput length (min 20, max 2000 chars)
  - environment must be one of the allowed enum values if provided
  - browser and device are trimmed and length-capped at 100 chars
  - If validation fails → 422 response, pipeline halts

Stage 2: Prompt Construction
───────────────────────────────────────────────────────────────────────────
  - promptBuilder.buildSystemPrompt() → static template loaded from file
  - promptBuilder.buildUserPrompt({ rawInput, environment, browser, device })
  - rawInput is escaped: surrounding quotes prevent injection
  - Estimated combined tokens calculated and logged (pre-call)

Stage 3: OpenAI API Call
───────────────────────────────────────────────────────────────────────────
  - openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 4096,
      temperature: 0.3
    })
  - startTime recorded before call; durationMs = Date.now() - startTime

Stage 4: Response Parsing
───────────────────────────────────────────────────────────────────────────
  - content = response.choices[0].message.content
  - parsed = JSON.parse(content)
    → On SyntaxError: throw AIResponseParseError (triggers retry logic)

Stage 5: Field Validation
───────────────────────────────────────────────────────────────────────────
  - validateAIResponse(parsed):
    - Check all required fields exist
    - Validate enum values; apply safe fallbacks for invalid enums
    - Ensure arrays are actual arrays
    - Validate and normalise testCases array structure

Stage 6: Database Persistence
───────────────────────────────────────────────────────────────────────────
  - ticketRepository.create({
      ...validatedTicketData,
      createdBy: userId,
      rawInput: rawInput,
      promptVersion: CURRENT_PROMPT_VERSION,
      status: 'Open'
    })
  - Returns the saved Mongoose document with _id

Stage 7: Logging (non-blocking, fire-and-forget)
───────────────────────────────────────────────────────────────────────────
  - Promise.allSettled([
      aiLogRepository.create({
        ticketId, userId, model, promptTokens, completionTokens,
        totalTokens, estimatedCostUsd, durationMs, success: true,
        retryCount, promptVersion
      }),
      activityLogRepository.create({
        userId, action: 'ticket.generated', resourceType: 'ticket',
        resourceId: ticket._id, ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      })
    ])
  - allSettled ensures logging failures never break the ticket response
```

---

## Retry Strategy

Network timeouts and transient OpenAI rate limits are handled with exponential backoff:

```javascript
async function callWithRetry(fn, maxAttempts = 3) {
  const delays = [1000, 2000, 4000]; // milliseconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      const isRetryable = isRetryableError(error);

      if (isLastAttempt || !isRetryable) {
        throw error; // Propagate — will be caught by error middleware
      }

      const delay = delays[attempt - 1];
      logger.warn(`OpenAI call attempt ${attempt} failed. Retrying in ${delay}ms...`, {
        errorCode: error.code,
        errorMessage: error.message,
        attempt
      });

      await sleep(delay);
    }
  }
}

function isRetryableError(error) {
  // OpenAI SDK wraps errors with a status property
  const retryableStatuses = [429, 500, 502, 503, 504];
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];

  return (
    retryableStatuses.includes(error.status) ||
    retryableCodes.includes(error.code) ||
    error instanceof OpenAI.APIConnectionTimeoutError
  );
}
```

**Retry decision table:**

| Error                           | Retryable | Reason                                               |
|---------------------------------|-----------|------------------------------------------------------|
| 429 Rate limit exceeded         | Yes       | Transient; backoff and retry                         |
| 500 Internal server error       | Yes       | OpenAI transient error                               |
| 502 / 503 / 504 Gateway errors  | Yes       | Upstream transient error                             |
| ECONNRESET / ETIMEDOUT          | Yes       | Network blip                                         |
| 400 Bad request                 | No        | Prompt or parameter error; won't succeed on retry    |
| 401 Unauthorized                | No        | Invalid API key; retry won't help                    |
| 404 Model not found             | No        | Configuration error; retry won't help                |
| JSON parse error on response    | Yes       | Rare; model may succeed on retry                     |
| Field validation error          | No        | Would need a different prompt; retry same prompt won't help |

---

## Token Management

### Token Estimation

Before sending the API call, the approximate token count is estimated using the formula:

```
estimated_tokens ≈ (character_count / 4)
```

This is a rough approximation (GPT tokenisation is more nuanced), but it allows the service to warn when a prompt is approaching the context limit before incurring API costs.

### Token Tracking

After each successful API call, actual token counts are extracted from the response:

```javascript
const usage = response.usage;
const promptTokens     = usage.prompt_tokens;      // Input tokens consumed
const completionTokens = usage.completion_tokens;  // Output tokens generated
const totalTokens      = usage.total_tokens;

// Cost estimation (GPT-4o pricing as of 2024)
const INPUT_COST_PER_1K  = 0.005;  // USD per 1000 input tokens
const OUTPUT_COST_PER_1K = 0.015;  // USD per 1000 output tokens

const estimatedCostUsd =
  (promptTokens / 1000) * INPUT_COST_PER_1K +
  (completionTokens / 1000) * OUTPUT_COST_PER_1K;
```

Token counts and estimated cost are stored in `ai_logs` for every call, enabling:
- Per-user cost attribution
- Monthly cost forecasting
- Alerting if average token count spikes (indicates prompt bloat)

### Rate Limit Handling

OpenAI enforces per-minute and per-day token limits. The retry strategy (with 429 handling) addresses transient rate limits. For sustained high load:

1. Implement a token bucket in Redis to track per-user OpenAI spend per minute
2. Queue requests in a Bull job queue with concurrency limits
3. Expose a `/api/tickets/status/:jobId` polling endpoint for async generation

---

## Error Handling

| Error Type                    | HTTP Status | Behaviour                                                           |
|-------------------------------|-------------|---------------------------------------------------------------------|
| `OpenAI.AuthenticationError`  | 500         | Log with `error` level; return generic 500 (API key misconfigured) |
| `OpenAI.RateLimitError`       | 429 → retry | Retry up to 3 times; if all fail, return 503                        |
| `OpenAI.APIConnectionError`   | 503 → retry | Network issue; retry with backoff                                   |
| `OpenAI.APITimeoutError`      | 503 → retry | Timeout; retry with backoff                                         |
| `AIResponseParseError`        | 502 → retry | JSON.parse failed; retry may produce valid JSON                     |
| `AIResponseValidationError`   | 502         | Missing required fields after all retries; return 502               |
| `MongooseValidationError`     | 422         | Parsed ticket data violates schema constraints                      |
| Any unexpected error          | 500         | Logged with full stack trace; generic message returned to client    |

All errors are caught by the global Express error-handling middleware (`middleware/errorHandler.js`) which:
1. Determines the appropriate HTTP status code
2. Formats a consistent error response body
3. Logs the full error context (user ID, request ID, stack trace) to Winston
4. Does NOT expose internal error details (stack traces, MongoDB errors) to the client

---

## Sample AI Interaction

### Input (from the API request body)

```json
{
  "rawInput": "The checkout button on the cart page disappears when you add more than 10 items. This only happens on Safari. The console shows a CSS transition error. Users can't complete purchases.",
  "environment": "production",
  "browser": "Safari 16",
  "device": "MacBook Pro M2"
}
```

### Constructed User Prompt (sent to OpenAI)

```
Convert the following bug description into a structured Jira ticket:

"The checkout button on the cart page disappears when you add more than 10 items. This only happens on Safari. The console shows a CSS transition error. Users can't complete purchases."

Additional context:
Environment: production
Browser: Safari 16
Device: MacBook Pro M2

Remember: respond ONLY with a valid JSON object matching the schema defined in the system prompt.
```

### AI Response (raw JSON from OpenAI)

```json
{
  "title": "[BUG] Checkout button disappears on cart page with 10+ items in Safari 16",
  "description": "On production, users adding more than 10 items to their shopping cart in Safari 16 on macOS experience the checkout button becoming invisible, preventing them from completing purchases. Browser DevTools shows a CSS transition-related error in the console at the point the button disappears. The issue is isolated to Safari 16 and is likely caused by a WebKit-specific handling of CSS transitions on elements that dynamically change height when the cart item list grows beyond a certain threshold.",
  "stepsToReproduce": [
    "Open the application in Safari 16 on macOS (Ventura or Sonoma)",
    "Navigate to any product listing page",
    "Add 10 or more distinct items to the shopping cart",
    "Navigate to the cart page (/cart)",
    "Observe that the 'Proceed to Checkout' button is not visible",
    "Open browser DevTools → Console and note the CSS transition-related error"
  ],
  "acceptanceCriteria": [
    "The checkout button must remain visible and interactive regardless of the number of items in the cart",
    "The CSS transition error must no longer appear in the Safari 16 console",
    "The fix must be verified with 1, 5, 10, 15, and 20+ cart items on Safari 16",
    "The checkout flow must complete successfully end-to-end on Safari 16 after the fix",
    "Existing behaviour on Chrome, Firefox, and Edge must not be affected (regression check)"
  ],
  "testCases": [
    {
      "scenario": "Add exactly 10 items to the cart and navigate to the cart page in Safari 16",
      "expectedResult": "The checkout button is visible and clickable",
      "testType": "functional"
    },
    {
      "scenario": "Add 15 items to the cart and navigate to the cart page in Safari 16",
      "expectedResult": "The checkout button is visible and clickable",
      "testType": "functional"
    },
    {
      "scenario": "Add 10+ items to the cart in Chrome on macOS",
      "expectedResult": "The checkout button is visible and clickable (regression check)",
      "testType": "regression"
    },
    {
      "scenario": "Add 1 item to the cart in Safari 16",
      "expectedResult": "The checkout button is visible and clickable (boundary case)",
      "testType": "edge-case"
    },
    {
      "scenario": "Complete a purchase end-to-end in Safari 16 after the fix is deployed",
      "expectedResult": "Order is placed successfully and confirmation email is received",
      "testType": "functional"
    }
  ],
  "priority": "Critical",
  "severity": "Critical",
  "type": "Bug",
  "effortEstimate": "5",
  "labels": ["checkout", "safari", "css", "webkit", "cart", "e-commerce", "blocker"]
}
```

### Token Usage for This Interaction

| Metric               | Value      |
|----------------------|------------|
| Input tokens         | ~920       |
| Output tokens        | ~680       |
| Total tokens         | ~1600      |
| Estimated cost       | ~$0.015    |
| API call duration    | ~2.1s      |
| Retries needed       | 0          |
| promptVersion        | 1.2.0      |
