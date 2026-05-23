'use strict';

const mongoose = require('mongoose');
const Project = require('../models/Project');

/**
 * Create a new project and add the creator as first admin member.
 * @param {object} data - { name, description, key, createdBy }
 * @returns {Promise<object>}
 */
async function create(data) {
  const project = new Project({
    ...data,
    members: [{ userId: data.createdBy, role: 'admin', joinedAt: new Date() }],
  });
  const saved = await project.save();
  return saved.toObject({ virtuals: true });
}

/**
 * Find a project by id. Returns null if not found or soft-deleted.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function findById(id) {
  try {
    const project = await Project.findOne({ _id: id, isDeleted: { $ne: true } })
      .populate('createdBy', 'name email avatar')
      .populate('members.userId', 'name email avatar role')
      .lean({ virtuals: true });
    return project || null;
  } catch (err) {
    if (err.name === 'CastError') return null;
    throw err;
  }
}

/**
 * Find all projects where userId is a member.
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function findByMember(userId) {
  const oid = new mongoose.Types.ObjectId(userId);
  return Project.find({
    $or: [{ 'members.userId': oid }, { 'members.userId': userId.toString() }],
    isDeleted: { $ne: true },
  })
    .populate('createdBy', 'name email avatar')
    .sort({ createdAt: -1 })
    .lean({ virtuals: true });
}

/**
 * Update project fields. Only updates top-level fields (name, description, isActive).
 * @param {string} id
 * @param {object} data
 * @returns {Promise<object|null>}
 */
async function update(id, data) {
  try {
    const updated = await Project.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: data },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name email avatar')
      .populate('members.userId', 'name email avatar role')
      .lean({ virtuals: true });
    return updated || null;
  } catch (err) {
    if (err.name === 'CastError') return null;
    throw err;
  }
}

/**
 * Soft-delete a project.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function softDelete(id) {
  try {
    const result = await Project.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date(), isActive: false } }
    );
    return result !== null;
  } catch (err) {
    if (err.name === 'CastError') return false;
    throw err;
  }
}

/**
 * Add a member to a project. No-op if already a member.
 * @param {string} projectId
 * @param {string} userId
 * @param {'admin'|'member'} role
 * @returns {Promise<object|null>}
 */
async function addMember(projectId, userId, role = 'member') {
  const updated = await Project.findOneAndUpdate(
    {
      _id: projectId,
      isDeleted: { $ne: true },
      'members.userId': { $ne: new mongoose.Types.ObjectId(userId) },
    },
    {
      $push: { members: { userId: new mongoose.Types.ObjectId(userId), role, joinedAt: new Date() } },
    },
    { new: true, runValidators: true }
  )
    .populate('members.userId', 'name email avatar role')
    .lean({ virtuals: true });
  return updated || null;
}

/**
 * Remove a member from a project.
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function removeMember(projectId, userId) {
  const updated = await Project.findOneAndUpdate(
    { _id: projectId, isDeleted: { $ne: true } },
    { $pull: { members: { userId: new mongoose.Types.ObjectId(userId) } } },
    { new: true }
  )
    .populate('members.userId', 'name email avatar role')
    .lean({ virtuals: true });
  return updated || null;
}

/**
 * Update a member's role within a project.
 * @param {string} projectId
 * @param {string} userId
 * @param {'admin'|'member'} role
 * @returns {Promise<object|null>}
 */
async function updateMemberRole(projectId, userId, role) {
  const updated = await Project.findOneAndUpdate(
    { _id: projectId, isDeleted: { $ne: true }, 'members.userId': new mongoose.Types.ObjectId(userId) },
    { $set: { 'members.$.role': role } },
    { new: true }
  )
    .populate('members.userId', 'name email avatar role')
    .lean({ virtuals: true });
  return updated || null;
}

/**
 * Check if a user is a member of a project.
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<{ isMember: boolean, role: string|null }>}
 */
async function getMembership(projectId, userId) {
  try {
    const project = await Project.findOne(
      { _id: projectId, isDeleted: { $ne: true } },
      { members: 1 }
    ).lean();
    if (!project) return { isMember: false, role: null };
    const member = project.members.find((m) => m.userId.toString() === userId.toString());
    return member
      ? { isMember: true, role: member.role }
      : { isMember: false, role: null };
  } catch (err) {
    if (err.name === 'CastError') return { isMember: false, role: null };
    throw err;
  }
}

module.exports = {
  create,
  findById,
  findByMember,
  update,
  softDelete,
  addMember,
  removeMember,
  updateMemberRole,
  getMembership,
};
