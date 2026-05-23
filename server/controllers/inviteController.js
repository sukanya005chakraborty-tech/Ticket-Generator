'use strict';

const inviteService  = require('../services/inviteService');
const authService    = require('../services/authService');
const asyncWrapper   = require('../utils/asyncWrapper');
const { successResponse } = require('../utils/responseHelper');

// ---------------------------------------------------------------------------
// Project-side invite management (protected, project admin only)
// ---------------------------------------------------------------------------

/**
 * POST /api/projects/:id/invites
 * Body: { email, role? }
 */
const sendInvite = asyncWrapper(async (req, res) => {
  const userId   = req.user.id || req.user._id;
  const userRole = req.user.role;
  const { id: projectId } = req.params;
  const { email, role }   = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'email is required' });
  }

  const invite = await inviteService.sendInvite(projectId, userId, userRole, email, role);

  return res.status(201).json(
    successResponse('Invite sent successfully', { invite })
  );
});

/**
 * GET /api/projects/:id/invites
 */
const listInvites = asyncWrapper(async (req, res) => {
  const userId   = req.user.id || req.user._id;
  const userRole = req.user.role;
  const { id: projectId } = req.params;

  const invites = await inviteService.listProjectInvites(projectId, userId, userRole);

  return res.json(
    successResponse('Invites retrieved successfully', { invites })
  );
});

/**
 * DELETE /api/projects/:id/invites/:inviteId
 */
const revokeInvite = asyncWrapper(async (req, res) => {
  const userId   = req.user.id || req.user._id;
  const userRole = req.user.role;
  const { inviteId } = req.params;

  await inviteService.revokeInvite(inviteId, userId, userRole);

  return res.json(
    successResponse('Invite revoked successfully')
  );
});

// ---------------------------------------------------------------------------
// Public invite endpoints (unauthenticated)
// ---------------------------------------------------------------------------

/**
 * GET /api/auth/invite?token=xxx
 * Returns project + inviter info so the frontend can show a preview.
 */
const getInvite = asyncWrapper(async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ success: false, message: 'token is required' });
  }

  const invite = await inviteService.getInviteByToken(token);

  return res.json(
    successResponse('Invite retrieved successfully', { invite })
  );
});

/**
 * POST /api/auth/accept-invite
 * Body: { token, name?, password? }
 *   - Existing user: token only needed
 *   - New user: token + name + password required
 */
const acceptInvite = asyncWrapper(async (req, res) => {
  const { token, name, password } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'token is required' });
  }

  const { user, project, isNewUser } = await inviteService.acceptInvite(token, { name, password });

  // If new user was created, issue tokens so they're logged in immediately
  let tokens = null;
  if (isNewUser) {
    tokens = await authService.issueTokens(user);
  }

  return res.status(200).json(
    successResponse('Invite accepted successfully', { project, isNewUser, tokens })
  );
});

module.exports = { sendInvite, listInvites, revokeInvite, getInvite, acceptInvite };
