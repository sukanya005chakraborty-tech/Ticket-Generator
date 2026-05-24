'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { getActivityLogs } = require('../controllers/adminController');

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, authorize(['admin']));

// GET /api/admin/activity-logs
router.get('/activity-logs', getActivityLogs);

module.exports = router;
