'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { list, markRead, markAllRead, remove, clearAll } = require('../controllers/notificationController');

const router = express.Router();

router.use(authenticate);

router.get('/',                    list);
router.patch('/read-all',          markAllRead);
router.patch('/:id/read',          markRead);
router.delete('/clear-all',        clearAll);
router.delete('/:id',              remove);

module.exports = router;
