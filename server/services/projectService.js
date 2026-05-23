'use strict';

const projectRepository = require('../repositories/projectRepository');
const User              = require('../models/User');
const { AppError }      = require('../middleware/errorHandler');
const logger            = require('../config/logger');

/**
 * Project Service – business logic for project and member management.
 */

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/**
 * Create a new project. Creator is automatically added as project admin.
 * @param {string} createdBy - userId of creator
 * @param {{ name, description, key }} data
 * @returns {Promise<object>}
 */
async function createProject(createdBy, data) {
  const project = await projectRepository.create({ ...data, createdBy });
  logger.info(`Project created: ${project._id} by user ${createdBy}`);
  return project;
}

/**
 * Get a single project. Validates the requesting user is a member.
 * @param {string} projectId
 * @param {string} requestingUserId
 * @returns {Promise<object>}
 */
async function getProject(projectId, requestingUserId) {
  const project = await projectRepository.findById(projectId);
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

  const isMember = project.members.some(
    (m) => m.userId && m.userId._id
      ? m.userId._id.toString() === requestingUserId.toString()
      : m.userId.toString() === requestingUserId.toString()
  );

  if (!isMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');

  return project;
}

/**
 * List all projects the requesting user belongs to.
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function listProjects(userId) {
  return projectRepository.findByMember(userId);
}

/**
 * Update project name/description/isActive.
 * Only project admins (or global admin) can update.
 * @param {string} projectId
 * @param {string} requestingUserId
 * @param {string} requestingUserRole - global role ('admin'|'user')
 * @param {{ name?, description?, isActive? }} data
 * @returns {Promise<object>}
 */
async function updateProject(projectId, requestingUserId, requestingUserRole, data) {
  const { isMember, role } = await projectRepository.getMembership(projectId, requestingUserId);

  if (!isMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');
  if (role !== 'admin' && requestingUserRole !== 'admin') {
    throw new AppError('Only project admins can update project details', 403, 'UNAUTHORIZED');
  }

  const allowed = {};
  if (data.name !== undefined)        allowed.name = data.name;
  if (data.description !== undefined) allowed.description = data.description;
  if (data.isActive !== undefined)    allowed.isActive = data.isActive;

  const project = await projectRepository.update(projectId, allowed);
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

  return project;
}

/**
 * Soft-delete a project. Only project admins (or global admin) can delete.
 * @param {string} projectId
 * @param {string} requestingUserId
 * @param {string} requestingUserRole
 * @returns {Promise<void>}
 */
async function deleteProject(projectId, requestingUserId, requestingUserRole) {
  const { isMember, role } = await projectRepository.getMembership(projectId, requestingUserId);

  if (!isMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');
  if (role !== 'admin' && requestingUserRole !== 'admin') {
    throw new AppError('Only project admins can delete projects', 403, 'UNAUTHORIZED');
  }

  const deleted = await projectRepository.softDelete(projectId);
  if (!deleted) throw new AppError('Project not found', 404, 'NOT_FOUND');

  logger.info(`Project soft-deleted: ${projectId} by user ${requestingUserId}`);
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

/**
 * Add a user to a project by userId.
 * Only project admins (or global admin) can add members.
 * @param {string} projectId
 * @param {string} requestingUserId
 * @param {string} requestingUserRole
 * @param {string} targetUserId
 * @param {'admin'|'member'} memberRole
 * @returns {Promise<object>}
 */
async function addMember(projectId, requestingUserId, requestingUserRole, targetUserId, memberRole = 'member') {
  const { isMember, role } = await projectRepository.getMembership(projectId, requestingUserId);

  if (!isMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');
  if (role !== 'admin' && requestingUserRole !== 'admin') {
    throw new AppError('Only project admins can add members', 403, 'UNAUTHORIZED');
  }

  // Validate target user exists
  const targetUser = await User.findOne({ _id: targetUserId, isDeleted: { $ne: true }, isActive: true });
  if (!targetUser) throw new AppError('User not found', 404, 'NOT_FOUND');

  // Check already a member
  const existing = await projectRepository.getMembership(projectId, targetUserId);
  if (existing.isMember) throw new AppError('User is already a project member', 409, 'CONFLICT');

  const project = await projectRepository.addMember(projectId, targetUserId, memberRole);
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

  logger.info(`Member ${targetUserId} added to project ${projectId} by ${requestingUserId}`);
  return project;
}

/**
 * Remove a member from a project.
 * Project admins (or global admin) can remove anyone except the last admin.
 * Members can remove themselves (leave project).
 * @param {string} projectId
 * @param {string} requestingUserId
 * @param {string} requestingUserRole
 * @param {string} targetUserId
 * @returns {Promise<object>}
 */
async function removeMember(projectId, requestingUserId, requestingUserRole, targetUserId) {
  const { isMember: requesterIsMember, role: requesterRole } = await projectRepository.getMembership(projectId, requestingUserId);
  if (!requesterIsMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');

  const isSelf = requestingUserId.toString() === targetUserId.toString();
  const isProjectAdmin = requesterRole === 'admin';
  const isGlobalAdmin = requestingUserRole === 'admin';

  if (!isSelf && !isProjectAdmin && !isGlobalAdmin) {
    throw new AppError('Only project admins can remove members', 403, 'UNAUTHORIZED');
  }

  // Prevent removing the last admin
  const project = await projectRepository.findById(projectId);
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

  const { role: targetRole } = await projectRepository.getMembership(projectId, targetUserId);
  if (!targetRole) throw new AppError('User is not a project member', 404, 'NOT_FOUND');

  if (targetRole === 'admin') {
    const adminCount = project.members.filter((m) => m.role === 'admin').length;
    if (adminCount <= 1) {
      throw new AppError('Cannot remove the last project admin', 400, 'VALIDATION_ERROR');
    }
  }

  const updated = await projectRepository.removeMember(projectId, targetUserId);
  if (!updated) throw new AppError('Project not found', 404, 'NOT_FOUND');

  logger.info(`Member ${targetUserId} removed from project ${projectId} by ${requestingUserId}`);
  return updated;
}

/**
 * Update a member's role within a project.
 * Only project admins (or global admin) can change roles.
 * Cannot demote the last admin.
 * @param {string} projectId
 * @param {string} requestingUserId
 * @param {string} requestingUserRole
 * @param {string} targetUserId
 * @param {'admin'|'member'} newRole
 * @returns {Promise<object>}
 */
async function updateMemberRole(projectId, requestingUserId, requestingUserRole, targetUserId, newRole) {
  const { isMember, role } = await projectRepository.getMembership(projectId, requestingUserId);
  if (!isMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');
  if (role !== 'admin' && requestingUserRole !== 'admin') {
    throw new AppError('Only project admins can change member roles', 403, 'UNAUTHORIZED');
  }

  // Prevent demoting last admin
  if (newRole === 'member') {
    const project = await projectRepository.findById(projectId);
    if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');
    const adminCount = project.members.filter((m) => m.role === 'admin').length;
    const { role: targetCurrentRole } = await projectRepository.getMembership(projectId, targetUserId);
    if (targetCurrentRole === 'admin' && adminCount <= 1) {
      throw new AppError('Cannot demote the last project admin', 400, 'VALIDATION_ERROR');
    }
  }

  const updated = await projectRepository.updateMemberRole(projectId, targetUserId, newRole);
  if (!updated) throw new AppError('Project or member not found', 404, 'NOT_FOUND');

  return updated;
}

/**
 * List all members of a project (requires membership).
 * @param {string} projectId
 * @param {string} requestingUserId
 * @returns {Promise<object[]>}
 */
async function listMembers(projectId, requestingUserId) {
  const project = await projectRepository.findById(projectId);
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

  const isMember = project.members.some((m) => {
    const uid = m.userId && m.userId._id ? m.userId._id : m.userId;
    return uid.toString() === requestingUserId.toString();
  });
  if (!isMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');

  return project.members;
}

module.exports = {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
  updateMemberRole,
  listMembers,
};
