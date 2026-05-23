'use strict';

const projectRepository = require('../repositories/projectRepository');
const { AppError }      = require('./errorHandler');

/**
 * Load the project from :projectId param and attach to req.
 * Fails 404 if not found.
 */
const loadProject = async (req, res, next) => {
  const projectId = req.params.projectId || req.params.id;
  try {
    const project = await projectRepository.findById(projectId);
    if (!project) return next(new AppError('Project not found', 404, 'NOT_FOUND'));
    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Require the authenticated user to be a member of req.project.
 * Must be placed after `authenticate` and `loadProject`.
 * Attaches req.projectRole ('admin'|'member').
 */
const requireProjectMember = (req, res, next) => {
  const userId = (req.user.id || req.user._id).toString();
  const project = req.project;

  const member = project.members.find((m) => {
    const uid = m.userId && m.userId._id ? m.userId._id : m.userId;
    return uid.toString() === userId;
  });

  if (!member) {
    return next(new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED'));
  }

  req.projectRole = member.role;
  next();
};

/**
 * Require the authenticated user to be a project-level admin (or global admin).
 * Must be placed after `authenticate`, `loadProject`, and `requireProjectMember`.
 */
const requireProjectAdmin = (req, res, next) => {
  if (req.projectRole === 'admin' || req.user.role === 'admin') return next();
  return next(new AppError('Only project admins can perform this action', 403, 'UNAUTHORIZED'));
};

module.exports = { loadProject, requireProjectMember, requireProjectAdmin };
