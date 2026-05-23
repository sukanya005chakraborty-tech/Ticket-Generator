'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { validate }     = require('../middleware/validate');
const {
  createProjectSchema,
  updateProjectSchema,
  addMemberSchema,
  updateMemberRoleSchema,
} = require('../validators/projectValidator');
const {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  listMembers,
  addMember,
  removeMember,
  updateMemberRole,
} = require('../controllers/projectController');

const {
  sendInvite,
  listInvites,
  revokeInvite,
} = require('../controllers/inviteController');

const router = Router();

/**
 * Project Routes
 * Base path: /api/projects
 * All routes require authentication.
 */

// POST   /api/projects
router.post('/', authenticate, validate(createProjectSchema), createProject);

// GET    /api/projects
router.get('/', authenticate, listProjects);

// GET    /api/projects/:id
router.get('/:id', authenticate, getProject);

// PUT    /api/projects/:id
router.put('/:id', authenticate, validate(updateProjectSchema), updateProject);

// DELETE /api/projects/:id
router.delete('/:id', authenticate, deleteProject);

// ── Member routes ─────────────────────────────────────────────────────────────

// GET    /api/projects/:id/members
router.get('/:id/members', authenticate, listMembers);

// POST   /api/projects/:id/members
router.post('/:id/members', authenticate, validate(addMemberSchema), addMember);

// PATCH  /api/projects/:id/members/:userId  (change role)
router.patch('/:id/members/:userId', authenticate, validate(updateMemberRoleSchema), updateMemberRole);

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', authenticate, removeMember);

// ── Invite routes ─────────────────────────────────────────────────────────────

// POST   /api/projects/:id/invites
router.post('/:id/invites', authenticate, sendInvite);

// GET    /api/projects/:id/invites
router.get('/:id/invites', authenticate, listInvites);

// DELETE /api/projects/:id/invites/:inviteId
router.delete('/:id/invites/:inviteId', authenticate, revokeInvite);

module.exports = router;
