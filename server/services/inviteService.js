'use strict';

const { v4: uuidv4 }    = require('uuid');
const InviteToken        = require('../models/InviteToken');
const User               = require('../models/User');
const projectRepository  = require('../repositories/projectRepository');
const emailService       = require('./emailService');
const { AppError }       = require('../middleware/errorHandler');
const config             = require('../config/env');
const logger             = require('../config/logger');

// ── Helpers ───────────────────────────────────────────────────────────────────

function expiresAt() {
  const d = new Date();
  d.setHours(d.getHours() + config.inviteExpiresHours);
  return d;
}

// ── Service methods ───────────────────────────────────────────────────────────

/**
 * Create and send an invite for a project.
 * Only project admins (or global admin) can invite.
 *
 * @param {string} projectId
 * @param {string} invitedByUserId
 * @param {string} invitedByUserRole  - global role
 * @param {string} email              - invitee email
 * @param {'admin'|'member'} role     - role to assign on accept
 * @returns {Promise<object>}         - the InviteToken document
 */
async function sendInvite(projectId, invitedByUserId, invitedByUserRole, email, role = 'member') {
  // Authorization check
  const { isMember, role: projectRole } = await projectRepository.getMembership(projectId, invitedByUserId);
  if (!isMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');
  if (projectRole !== 'admin' && invitedByUserRole !== 'admin') {
    throw new AppError('Only project admins can send invites', 403, 'UNAUTHORIZED');
  }

  // Load project for email
  const project = await projectRepository.findById(projectId);
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

  const normalizedEmail = email.toLowerCase().trim();

  // If user already exists and is already a member — reject
  const existingUser = await User.findByEmail(normalizedEmail);
  if (existingUser) {
    const { isMember: alreadyMember } = await projectRepository.getMembership(projectId, existingUser._id);
    if (alreadyMember) throw new AppError('User is already a project member', 409, 'CONFLICT');
  }

  // Revoke any pending invite for same email+project
  await InviteToken.updateMany(
    { email: normalizedEmail, projectId, status: 'pending' },
    { $set: { status: 'revoked' } }
  );

  // Create new invite token
  const token = uuidv4();
  const invite = await InviteToken.create({
    email: normalizedEmail,
    projectId,
    invitedBy: invitedByUserId,
    role,
    token,
    expiresAt: expiresAt(),
  });

  // Build accept URL
  const inviteUrl = `${config.clientUrl}/accept-invite?token=${token}`;

  // Load inviter name for email
  const inviter = await User.findById(invitedByUserId).select('name');
  const inviterName = inviter ? inviter.name : 'A team member';

  // Send email (non-blocking — don't fail invite creation on email error)
  emailService.sendProjectInvite({
    to:           normalizedEmail,
    inviterName,
    projectName:  project.name,
    inviteUrl,
    expiresHours: config.inviteExpiresHours,
  }).catch((err) => logger.error('[inviteService] Email send failed', { error: err.message }));

  logger.info('[inviteService] Invite created', { projectId, email: normalizedEmail, token: invite._id });

  return invite;
}

/**
 * Look up an invite token (for the frontend to show project name before accepting).
 * @param {string} token
 * @returns {Promise<object>}
 */
async function getInviteByToken(token) {
  const invite = await InviteToken.findOne({ token })
    .populate('projectId', 'name key description')
    .populate('invitedBy', 'name email')
    .lean();

  if (!invite) throw new AppError('Invite not found or already used', 404, 'NOT_FOUND');
  if (invite.status !== 'pending') throw new AppError(`Invite is ${invite.status}`, 410, 'INVITE_GONE');
  if (new Date(invite.expiresAt) < new Date()) {
    await InviteToken.findByIdAndUpdate(invite._id, { status: 'expired' });
    throw new AppError('Invite has expired', 410, 'INVITE_EXPIRED');
  }

  return invite;
}

/**
 * Accept an invite.
 * - If user with that email already exists → just add to project.
 * - If no account → create account first, then add to project.
 *
 * @param {string} token
 * @param {{ name?: string, password?: string }} newUserData - required only if no account exists
 * @returns {Promise<{ user: object, project: object, isNewUser: boolean }>}
 */
async function acceptInvite(token, newUserData = {}) {
  const invite = await InviteToken.findOne({ token });
  if (!invite)                throw new AppError('Invite not found', 404, 'NOT_FOUND');
  if (!invite.isUsable())     throw new AppError(`Invite is ${invite.status}`, 410, 'INVITE_GONE');

  let user = await User.findByEmail(invite.email);
  let isNewUser = false;

  if (!user) {
    // New user — name and password required
    if (!newUserData.name || !newUserData.password) {
      throw new AppError('name and password are required to create your account', 400, 'VALIDATION_ERROR');
    }
    user = await User.create({
      name:     newUserData.name,
      email:    invite.email,
      password: newUserData.password,
      role:     'user',
    });
    isNewUser = true;
  }

  // Add to project (idempotent — addMember does nothing if already a member)
  const project = await projectRepository.addMember(invite.projectId, user._id, invite.role);
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

  // Mark invite accepted
  await InviteToken.findByIdAndUpdate(invite._id, {
    status:     'accepted',
    acceptedBy: user._id,
    acceptedAt: new Date(),
  });

  logger.info('[inviteService] Invite accepted', { userId: user._id, projectId: invite.projectId });

  return { user, project, isNewUser };
}

/**
 * List all invites for a project (project admin only).
 * @param {string} projectId
 * @param {string} requestingUserId
 * @param {string} requestingUserRole
 * @returns {Promise<object[]>}
 */
async function listProjectInvites(projectId, requestingUserId, requestingUserRole) {
  const { isMember, role } = await projectRepository.getMembership(projectId, requestingUserId);
  if (!isMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');
  if (role !== 'admin' && requestingUserRole !== 'admin') {
    throw new AppError('Only project admins can view invites', 403, 'UNAUTHORIZED');
  }

  return InviteToken.find({ projectId })
    .populate('invitedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Revoke a pending invite (project admin only).
 * @param {string} inviteId
 * @param {string} requestingUserId
 * @param {string} requestingUserRole
 * @returns {Promise<void>}
 */
async function revokeInvite(inviteId, requestingUserId, requestingUserRole) {
  const invite = await InviteToken.findById(inviteId);
  if (!invite) throw new AppError('Invite not found', 404, 'NOT_FOUND');

  const { isMember, role } = await projectRepository.getMembership(invite.projectId, requestingUserId);
  if (!isMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');
  if (role !== 'admin' && requestingUserRole !== 'admin') {
    throw new AppError('Only project admins can revoke invites', 403, 'UNAUTHORIZED');
  }

  if (invite.status !== 'pending') {
    throw new AppError(`Cannot revoke an invite that is already ${invite.status}`, 400, 'VALIDATION_ERROR');
  }

  await InviteToken.findByIdAndUpdate(inviteId, { status: 'revoked' });
}

module.exports = { sendInvite, getInviteByToken, acceptInvite, listProjectInvites, revokeInvite };
