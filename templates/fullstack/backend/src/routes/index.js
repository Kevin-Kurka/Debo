const router = require('express').Router();
const authRoutes = require('./auth');
const userRoutes = require('./users');
const { authenticate } = require('../middleware/auth');

router.use('/auth', authRoutes);
router.use('/users', authenticate, userRoutes);

module.exports = router;