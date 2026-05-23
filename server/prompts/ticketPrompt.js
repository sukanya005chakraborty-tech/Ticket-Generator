'use strict';

/**
 * Ticket Prompt Engineering
 *
 * Builds the OpenAI messages array and provides helpers to parse/validate
 * the AI response into a structured ticket object.
 */

/** Fields required in a valid AI-generated ticket */
const REQUIRED_FIELDS = [
  'title',
  'summary',
  'description',
  'priority',
  'severity',
  'stepsToReproduce',
  'expectedResult',
  'actualResult',
  'acceptanceCriteria',
  'testCases',
  'labels',
];

const VALID_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const VALID_SEVERITIES = ['Blocker', 'Critical', 'Major', 'Minor', 'Trivial'];

/**
 * Builds the full OpenAI chat messages array for ticket generation.
 *
 * @param {string} rawInput   – the raw bug/feature description from the user
 * @param {string} [environment] – e.g. "Production", "Staging"
 * @param {string} [browser]     – e.g. "Chrome 124", "Safari"
 * @param {string} [device]      – e.g. "Desktop", "iPhone 15"
 * @returns {Array<{ role: string, content: string }>}
 */
function buildTicketPrompt(rawInput, environment, browser, device) {
  const contextLines = [];
  if (environment) contextLines.push(`Environment: ${environment}`);
  if (browser) contextLines.push(`Browser: ${browser}`);
  if (device) contextLines.push(`Device/Platform: ${device}`);

  const contextBlock =
    contextLines.length > 0
      ? `\nAdditional context provided by the reporter:\n${contextLines.join('\n')}\n`
      : '';

  const systemPrompt = `You are a senior QA engineer and Jira administrator with 10+ years of experience writing detailed, actionable bug reports and feature tickets. Your task is to transform raw user-reported issues into perfectly structured Jira tickets.

CORE RESPONSIBILITIES:
1. Analyse the raw input carefully — infer the root cause, affected area, and scope.
2. Determine severity based on user impact:
   - Blocker: System/app completely unusable, data loss risk, security vulnerability, crashes production.
   - Critical: Major feature broken, no workaround exists, significant user impact.
   - Major: Important feature degraded, workaround exists but is inconvenient.
   - Minor: UI glitches, cosmetic issues, minor functional impairment.
   - Trivial: Typos, minor UI inconsistencies with no functional impact.
3. Determine priority based on business urgency:
   - Critical: Must fix immediately, blocking release or causing revenue loss.
   - High: Fix in current sprint, significant user/business impact.
   - Medium: Fix in next sprint, moderate impact.
   - Low: Fix when possible, minimal impact.
4. Write clear, numbered reproduction steps — each step must be a discrete, actionable action.
5. Generate realistic test cases that cover happy path, edge cases, and negative scenarios.
6. Write acceptance criteria in Given/When/Then format.
7. Infer labels, module, and environment intelligently from context clues in the raw input.
8. Use professional, clear technical language throughout.

OUTPUT RULES — READ CAREFULLY:
- You MUST respond with ONLY a single valid JSON object.
- Do NOT wrap the JSON in markdown code fences (no \`\`\`json or \`\`\`).
- Do NOT include any explanatory text, preamble, or postamble outside the JSON.
- All string values must be non-empty. Arrays must contain at least one item.
- The JSON must be parseable by JSON.parse() without any preprocessing.`;

  const userPrompt = `Analyse the following raw bug report and generate a complete, professional Jira ticket as a JSON object.
${contextBlock}
RAW INPUT:
"""
${rawInput.trim()}
"""

Return ONLY the following JSON structure (no markdown, no extra text):

{
  "title": "concise, descriptive bug title (max 80 chars, present-tense verb + noun)",
  "summary": "single sentence summarising the issue and its impact",
  "description": "detailed markdown description with ## headings for Overview, Impact, and Notes sections — include any relevant technical details inferred from the input",
  "priority": "one of: Critical | High | Medium | Low",
  "severity": "one of: Blocker | Critical | Major | Minor | Trivial",
  "stepsToReproduce": [
    "Step 1: [precise, numbered action]",
    "Step 2: [next action]"
  ],
  "expectedResult": "clear description of what should happen under normal circumstances",
  "actualResult": "clear description of what actually happens (the bug behaviour)",
  "acceptanceCriteria": [
    "Given [context] When [action] Then [expected outcome]",
    "Given [context] When [another action] Then [expected outcome]"
  ],
  "testCases": [
    {
      "title": "Verify [happy path scenario]",
      "steps": ["Navigate to...", "Perform..."],
      "expected": "System should..."
    },
    {
      "title": "Verify [negative/edge case scenario]",
      "steps": ["Navigate to...", "Perform..."],
      "expected": "System should..."
    }
  ],
  "labels": ["bug", "relevant-team-or-area", "another-label"],
  "module": "inferred module, feature area, or team responsible (e.g. Authentication, Payment, Dashboard, Checkout)",
  "environment": "${environment || 'inferred from context or set to Unknown'}"
}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

/**
 * Safely parse the AI response string into a JS object.
 * Handles cases where the model wraps the JSON in markdown code fences.
 *
 * @param {string} content – raw string from OpenAI response
 * @returns {object}
 * @throws {Error} if content cannot be parsed as JSON
 */
function parseAiResponse(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('AI response content is empty or not a string');
  }

  let cleaned = content.trim();

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  // Sometimes models prepend a phrase before the JSON — find the first '{' char
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (jsonErr) {
    throw new Error(`Failed to parse AI response as JSON: ${jsonErr.message}. Content preview: ${cleaned.slice(0, 200)}`);
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
    throw new Error('AI response parsed but is not a JSON object');
  }

  return parsed;
}

/**
 * Validate a parsed AI response object against the expected ticket schema.
 *
 * @param {object} parsed – result of parseAiResponse()
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateAiResponse(parsed) {
  const errors = [];

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, errors: ['Response is not an object'] };
  }

  // Check required fields are present and non-empty
  for (const field of REQUIRED_FIELDS) {
    if (parsed[field] === undefined || parsed[field] === null) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof parsed[field] === 'string' && parsed[field].trim() === '') {
      errors.push(`Field "${field}" must not be an empty string`);
    } else if (Array.isArray(parsed[field]) && parsed[field].length === 0) {
      errors.push(`Field "${field}" must not be an empty array`);
    }
  }

  // Validate enum fields
  if (parsed.priority && !VALID_PRIORITIES.includes(parsed.priority)) {
    errors.push(`Invalid priority "${parsed.priority}". Must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  if (parsed.severity && !VALID_SEVERITIES.includes(parsed.severity)) {
    errors.push(`Invalid severity "${parsed.severity}". Must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }

  // Validate stepsToReproduce is an array of strings
  if (Array.isArray(parsed.stepsToReproduce)) {
    parsed.stepsToReproduce.forEach((step, i) => {
      if (typeof step !== 'string' || step.trim() === '') {
        errors.push(`stepsToReproduce[${i}] must be a non-empty string`);
      }
    });
  }

  // Validate acceptanceCriteria is an array of strings
  if (Array.isArray(parsed.acceptanceCriteria)) {
    parsed.acceptanceCriteria.forEach((ac, i) => {
      if (typeof ac !== 'string' || ac.trim() === '') {
        errors.push(`acceptanceCriteria[${i}] must be a non-empty string`);
      }
    });
  }

  // Validate testCases structure
  if (Array.isArray(parsed.testCases)) {
    parsed.testCases.forEach((tc, i) => {
      if (typeof tc !== 'object' || tc === null) {
        errors.push(`testCases[${i}] must be an object`);
        return;
      }
      if (!tc.title || typeof tc.title !== 'string') {
        errors.push(`testCases[${i}].title must be a non-empty string`);
      }
      if (!Array.isArray(tc.steps) || tc.steps.length === 0) {
        errors.push(`testCases[${i}].steps must be a non-empty array`);
      }
      if (!tc.expected || typeof tc.expected !== 'string') {
        errors.push(`testCases[${i}].expected must be a non-empty string`);
      }
    });
  }

  // Validate labels is an array of strings
  if (Array.isArray(parsed.labels)) {
    parsed.labels.forEach((label, i) => {
      if (typeof label !== 'string' || label.trim() === '') {
        errors.push(`labels[${i}] must be a non-empty string`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitise and normalise a parsed AI response to ensure downstream safety.
 * Trims strings, coerces types where safe, removes unexpected top-level keys.
 *
 * @param {object} parsed
 * @returns {object}
 */
function sanitizeAiResponse(parsed) {
  return {
    title: String(parsed.title || '').trim().slice(0, 200),
    summary: String(parsed.summary || '').trim(),
    description: String(parsed.description || '').trim(),
    priority: VALID_PRIORITIES.includes(parsed.priority) ? parsed.priority : 'Medium',
    severity: VALID_SEVERITIES.includes(parsed.severity) ? parsed.severity : 'Major',
    stepsToReproduce: Array.isArray(parsed.stepsToReproduce)
      ? parsed.stepsToReproduce.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
      : [],
    expectedResult: String(parsed.expectedResult || '').trim(),
    actualResult: String(parsed.actualResult || '').trim(),
    acceptanceCriteria: Array.isArray(parsed.acceptanceCriteria)
      ? parsed.acceptanceCriteria.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
      : [],
    testCases: Array.isArray(parsed.testCases)
      ? parsed.testCases
          .filter((tc) => tc && typeof tc === 'object')
          .map((tc) => ({
            title: String(tc.title || '').trim(),
            steps: Array.isArray(tc.steps)
              ? tc.steps.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
              : [],
            expected: String(tc.expected || '').trim(),
          }))
      : [],
    labels: Array.isArray(parsed.labels)
      ? parsed.labels.filter((l) => typeof l === 'string' && l.trim()).map((l) => l.trim().toLowerCase())
      : [],
    module: String(parsed.module || '').trim() || 'General',
    environment: String(parsed.environment || '').trim() || 'Unknown',
  };
}

module.exports = {
  buildTicketPrompt,
  parseAiResponse,
  validateAiResponse,
  sanitizeAiResponse,
  VALID_PRIORITIES,
  VALID_SEVERITIES,
  REQUIRED_FIELDS,
};
