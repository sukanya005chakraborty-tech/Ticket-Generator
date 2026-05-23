'use strict';

const OpenAI = require('openai');
const config = require('../config/env');
const logger = require('../config/logger');
const {
  buildTicketPrompt,
  parseAiResponse,
  validateAiResponse,
  sanitizeAiResponse,
} = require('../prompts/ticketPrompt');

/** Singleton AI client — initialised lazily (OpenAI or Groq) */
let _aiClient = null;

/**
 * Returns the active AI client based on AI_PROVIDER env var.
 * Groq uses the same OpenAI SDK with a different baseURL (fully compatible).
 * @returns {OpenAI}
 */
function getAIClient() {
  if (!_aiClient) {
    const provider = config.aiProvider || 'openai';

    if (provider === 'groq') {
      if (!config.groq.apiKey) throw new Error('GROQ_API_KEY is not configured. Get a free key at console.groq.com');
      _aiClient = new OpenAI({
        apiKey:  config.groq.apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
        timeout: 60_000,
        maxRetries: 0,
      });
      logger.info('[aiService] Using Groq as AI provider');
    } else {
      if (!config.openai.apiKey) throw new Error('OPENAI_API_KEY is not configured');
      _aiClient = new OpenAI({
        apiKey:  config.openai.apiKey,
        timeout: 60_000,
        maxRetries: 0,
      });
      logger.info('[aiService] Using OpenAI as AI provider');
    }
  }
  return _aiClient;
}

/** Resolve the active model name based on provider. */
function getActiveModel() {
  return config.aiProvider === 'groq' ? config.groq.model : config.openai.model;
}

/**
 * Approximate token cost in USD.
 * Pricing (as of gpt-4o, gpt-4-turbo, gpt-3.5-turbo) — kept simple.
 *
 * @param {{ promptTokens: number, completionTokens: number }} tokensUsed
 * @param {string} model
 * @returns {number}  estimated USD cost (rounded to 6 decimal places)
 */
function calculateTokenCost(tokensUsed, model) {
  const { promptTokens = 0, completionTokens = 0 } = tokensUsed;

  // Pricing per 1 000 tokens (input / output) — approximate
  const pricing = {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
  };

  // Attempt exact match, then prefix match
  let rates = pricing[model];
  if (!rates) {
    const key = Object.keys(pricing).find((k) => model.startsWith(k));
    rates = key ? pricing[key] : { input: 0.005, output: 0.015 }; // fallback to gpt-4o
  }

  const cost =
    (promptTokens / 1000) * rates.input +
    (completionTokens / 1000) * rates.output;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Determine whether the given model supports the `json_object` response format.
 * @param {string} model
 * @returns {boolean}
 */
function supportsJsonResponseFormat(model) {
  const supportedPrefixes = [
    // OpenAI
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-4-1106',
    'gpt-3.5-turbo-1106',
    'gpt-3.5-turbo-0125',
    // Groq — Llama 3.x and Mixtral support json_object mode
    'llama-3',
    'mixtral',
    'gemma2',
  ];
  return supportedPrefixes.some((prefix) => model.startsWith(prefix));
}

/**
 * Sleep for a given number of milliseconds (used for retry backoff).
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call the OpenAI Chat Completions API with a single attempt.
 * Throws on API error or invalid response shape.
 *
 * @param {Array}  messages
 * @param {string} model
 * @returns {Promise<{ content: string, usage: object }>}
 */
async function callOpenAI(messages, model) {
  const client = getAIClient();

  const requestParams = {
    model,
    messages,
    temperature: 0.3,        // Low temperature for consistent structured output
    max_tokens: 2048,
    presence_penalty: 0,
    frequency_penalty: 0,
  };

  // Use JSON mode if the model supports it
  if (supportsJsonResponseFormat(model)) {
    requestParams.response_format = { type: 'json_object' };
  }

  const response = await client.chat.completions.create(requestParams);

  if (!response.choices || response.choices.length === 0) {
    throw new Error('OpenAI returned an empty choices array');
  }

  const choice = response.choices[0];

  if (choice.finish_reason === 'length') {
    throw new Error('OpenAI response was truncated (finish_reason: length). Consider increasing max_tokens.');
  }

  if (!choice.message || !choice.message.content) {
    throw new Error('OpenAI returned a choice with no message content');
  }

  return {
    content: choice.message.content,
    usage: response.usage || {},
    finishReason: choice.finish_reason,
  };
}

/**
 * Generate structured ticket content from a raw bug description using OpenAI.
 *
 * @param {string} rawInput
 * @param {string} [environment]
 * @param {string} [browser]
 * @param {string} [device]
 * @returns {Promise<{
 *   ticket: object,
 *   tokensUsed: { promptTokens: number, completionTokens: number, totalTokens: number },
 *   estimatedCost: number,
 *   duration: number,
 *   model: string,
 * }>}
 */
async function generateTicketContent(rawInput, environment, browser, device) {
  if (!rawInput || rawInput.trim().length < 10) {
    throw new Error('Raw input is too short to generate a meaningful ticket (minimum 10 characters)');
  }

  const model = getActiveModel();
  const messages = buildTicketPrompt(rawInput, environment, browser, device);

  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1000;

  let lastError = null;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`[aiService] Calling OpenAI (attempt ${attempt}/${MAX_RETRIES})`, {
        model,
        rawInputLength: rawInput.length,
      });

      const { content, usage } = await callOpenAI(messages, model);

      const parsed = parseAiResponse(content);
      const { valid, errors } = validateAiResponse(parsed);

      if (!valid) {
        logger.warn('[aiService] AI response failed validation', { errors, attempt });
        // On the last attempt, throw rather than retry
        if (attempt === MAX_RETRIES) {
          throw new Error(`AI response validation failed after ${MAX_RETRIES} attempts: ${errors.join('; ')}`);
        }
        lastError = new Error(`Validation failed: ${errors.join('; ')}`);
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
        continue;
      }

      const sanitized = sanitizeAiResponse(parsed);
      const duration = Date.now() - startTime;

      const tokensUsed = {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      };

      const estimatedCost = calculateTokenCost(tokensUsed, model);

      logger.info('[aiService] Ticket generated successfully', {
        duration,
        tokensUsed,
        estimatedCost,
        model,
        attempt,
      });

      return {
        ticket: sanitized,
        tokensUsed,
        estimatedCost,
        duration,
        model,
      };
    } catch (err) {
      lastError = err;

      // Classify OpenAI API errors
      const status = err.status || err.statusCode;

      // Rate limit — wait longer
      if (status === 429) {
        const retryAfter = parseInt(err.headers?.['retry-after'] || '5', 10);
        const waitMs = Math.max(retryAfter * 1000, BASE_DELAY_MS * Math.pow(2, attempt));
        logger.warn(`[aiService] Rate limited. Waiting ${waitMs}ms before retry.`, { attempt });

        if (attempt < MAX_RETRIES) {
          await sleep(waitMs);
          continue;
        }
      }

      // Server-side OpenAI errors — retry with backoff
      if (status >= 500 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
        if (attempt < MAX_RETRIES) {
          const waitMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          logger.warn(`[aiService] OpenAI server error. Retrying in ${waitMs}ms.`, {
            attempt,
            status,
            message: err.message,
          });
          await sleep(waitMs);
          continue;
        }
      }

      // Non-retryable errors (4xx except 429, parse errors, validation errors) — break immediately
      logger.error('[aiService] Non-retryable error during AI generation', {
        attempt,
        error: err.message,
        status,
      });
      break;
    }
  }

  // All retries exhausted or non-retryable error
  const duration = Date.now() - startTime;
  logger.error('[aiService] Failed to generate ticket after all attempts', {
    duration,
    error: lastError?.message,
  });

  throw lastError || new Error('Unknown error during AI ticket generation');
}

module.exports = {
  generateTicketContent,
  calculateTokenCost,
  supportsJsonResponseFormat,
};
