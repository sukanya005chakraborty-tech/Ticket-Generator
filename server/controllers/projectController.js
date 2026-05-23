'use strict';

const projectService = require('../services/projectService');
const asyncWrapper   = require('../utils/asyncWrapper');
const { successResponse } = require('../utils/responseHelper');

// ---------------------------------------------------------------------------
// Project CRUD
// ---------------------------------------------------------------------------

/**
 * POST /api/projects
 */
const createProject = asyncWrapper(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { name, description, key } = req.body;

  const project = await projectService.createProject(userId, { name, description, key });

  return res.status(201).json(
    successResponse('Project created successfully', { project })
  );
});

/**
 * GET /api/projects
 */
const listProjects = asyncWrapper(async (req, res) => {
  const userId = req.user.id || req.user._id;

  const projects = await projectService.listProjects(userId);

  return res.json(
    successResponse('Projects retrieved successfully', { projects })
  );
});

/**
 * GET /api/projects/:id
 */
const getProject = asyncWrapper(async (req, res) => {
  const userId    = req.user.id || req.user._id;
  const { id }    = req.params;

  const project = await projectService.getProject(id, userId);

  return res.json(
    successResponse('Project retrieved successfully', { project })
  );
});

/**
 * PUT /api/projects/:id
 */
const updateProject = asyncWrapper(async (req, res) => {
  const userId   = req.user.id || req.user._id;
  const userRole = req.user.role;
  const { id }   = req.params;

  const project = await projectService.updateProject(id, userId, userRole, req.body);

  return res.json(
    successResponse('Project updated successfully', { project })
  );
});

/**
 * DELETE /api/projects/:id
 */
const deleteProject = asyncWrapper(async (req, res) => {
  const userId   = req.user.id || req.user._id;
  const userRole = req.user.role;
  const { id }   = req.params;

  await projectService.deleteProject(id, userId, userRole);

  return res.json(
    successResponse('Project deleted successfully')
  );
});

// ---------------------------------------------------------------------------
// Member management
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/members
 */
const listMembers = asyncWrapper(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { id } = req.params;

  const members = await projectService.listMembers(id, userId);

  return res.json(
    successResponse('Members retrieved successfully', { members })
  );
});

/**
 * POST /api/projects/:id/members
 * Body: { userId, role? }
 */
const addMember = asyncWrapper(async (req, res) => {
  const requestingUserId   = req.user.id || req.user._id;
  const requestingUserRole = req.user.role;
  const { id }             = req.params;
  const { userId: targetUserId, role } = req.body;

  if (!targetUserId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  const project = await projectService.addMember(id, requestingUserId, requestingUserRole, targetUserId, role);

  return res.status(201).json(
    successResponse('Member added successfully', { project })
  );
});

/**
 * DELETE /api/projects/:id/members/:userId
 */
const removeMember = asyncWrapper(async (req, res) => {
  const requestingUserId   = req.user.id || req.user._id;
  const requestingUserRole = req.user.role;
  const { id, userId: targetUserId } = req.params;

  const project = await projectService.removeMember(id, requestingUserId, requestingUserRole, targetUserId);

  return res.json(
    successResponse('Member removed successfully', { project })
  );
});

/**
 * PATCH /api/projects/:id/members/:userId
 * Body: { role }
 */
const updateMemberRole = asyncWrapper(async (req, res) => {
  const requestingUserId   = req.user.id || req.user._id;
  const requestingUserRole = req.user.role;
  const { id, userId: targetUserId } = req.params;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ success: false, message: 'role is required' });
  }

  const project = await projectService.updateMemberRole(id, requestingUserId, requestingUserRole, targetUserId, role);

  return res.json(
    successResponse('Member role updated successfully', { project })
  );
});

module.exports = {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  listMembers,
  addMember,
  removeMember,
  updateMemberRole,
};
