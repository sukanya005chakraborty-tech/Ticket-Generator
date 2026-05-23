'use strict';

/**
 * @fileoverview Pagination utility functions.
 * Provides helpers to extract pagination parameters from query strings,
 * compute page metadata, and build safe MongoDB sort objects.
 */

/** The minimum allowed page number. */
const MIN_PAGE = 1;

/** The default number of documents per page. */
const DEFAULT_LIMIT = 10;

/** The maximum number of documents that can be requested per page. */
const MAX_LIMIT = 100;

// ── Param Extraction ──────────────────────────────────────────────────────────

/**
 * Extract and sanitize pagination parameters from an Express query string object.
 * Clamps `limit` to [1, MAX_LIMIT] and ensures `page` is >= 1.
 *
 * @param {Object} [query={}] - req.query object (or any plain object with page/limit).
 * @param {string|number} [query.page] - Requested page number (1-based, default: 1).
 * @param {string|number} [query.limit] - Requested documents per page (default: 10, max: 100).
 * @returns {{ page: number, limit: number, skip: number }}
 *
 * @example
 * const { page, limit, skip } = getPaginationParams(req.query);
 * const docs = await Ticket.find(filter).skip(skip).limit(limit);
 */
function getPaginationParams(query = {}) {
  const page = Math.max(MIN_PAGE, parseInt(query.page, 10) || MIN_PAGE);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT)
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

// ── Pagination Metadata ───────────────────────────────────────────────────────

/**
 * Compute pagination metadata from the total document count, current page, and page size.
 *
 * @param {number} total - Total number of matching documents in the collection.
 * @param {number} page - Current page number (1-based).
 * @param {number} limit - Number of documents per page.
 * @returns {{
 *   total: number,
 *   page: number,
 *   limit: number,
 *   totalPages: number,
 *   hasNext: boolean,
 *   hasPrev: boolean
 * }}
 *
 * @example
 * const meta = buildPaginationMeta(250, 2, 10);
 * // { total: 250, page: 2, limit: 10, totalPages: 25, hasNext: true, hasPrev: true }
 */
function buildPaginationMeta(total, page, limit) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// ── Sort Query Builder ────────────────────────────────────────────────────────

/**
 * Build a safe MongoDB sort object from query parameters.
 * Only fields explicitly listed in `allowedFields` are accepted;
 * any other value falls back to `defaultField`.
 *
 * @param {string} [sortBy='createdAt'] - Field to sort on.
 * @param {string} [sortOrder='desc'] - Direction: 'asc' or 'desc'.
 * @param {string[]} [allowedFields=['createdAt']] - Whitelist of sortable field names.
 * @param {string} [defaultField='createdAt'] - Fallback sort field if `sortBy` is not whitelisted.
 * @returns {Object} MongoDB sort object, e.g. `{ createdAt: -1 }`.
 *
 * @example
 * const sort = buildSortQuery('priority', 'asc', ['priority', 'createdAt', 'status']);
 * // { priority: 1 }
 *
 * const sortBad = buildSortQuery('__proto__', 'desc', ['createdAt']);
 * // { createdAt: -1 }  ← falls back to default
 */
function buildSortQuery(
  sortBy = 'createdAt',
  sortOrder = 'desc',
  allowedFields = ['createdAt'],
  defaultField = 'createdAt'
) {
  const safeField = allowedFields.includes(sortBy) ? sortBy : defaultField;
  const direction = sortOrder === 'asc' ? 1 : -1;

  return { [safeField]: direction };
}

// ── Combined Helper ───────────────────────────────────────────────────────────

/**
 * One-call convenience wrapper that returns pagination params AND the sort object.
 *
 * @param {Object} query - req.query
 * @param {string[]} allowedSortFields - Fields allowed for sorting.
 * @returns {{ page: number, limit: number, skip: number, sort: Object }}
 */
function getPaginationAndSort(query, allowedSortFields) {
  const { page, limit, skip } = getPaginationParams(query);
  const sort = buildSortQuery(query.sortBy, query.sortOrder, allowedSortFields);
  return { page, limit, skip, sort };
}

module.exports = {
  getPaginationParams,
  buildPaginationMeta,
  buildSortQuery,
  getPaginationAndSort,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
