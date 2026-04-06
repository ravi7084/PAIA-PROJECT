const router = require('express').Router();

const ctrl = require('../controllers/user.controller');
const { protect, restrictTo } = require('../models/middleware/auth.middleware');
const { validate, schemas } = require('../models/middleware/validate.middleware');

router.use(protect);

router.get('/profile', ctrl.getProfile);
router.patch('/profile', validate(schemas.updateProfile), ctrl.updateProfile);
router.patch('/change-password', validate(schemas.changePassword), ctrl.changePassword);
router.get('/dashboard-stats', ctrl.getDashboardStats);
router.delete('/account', ctrl.deleteAccount);
router.post('/logout-all-devices', ctrl.logoutAllDevices);

router.get('/all', restrictTo('admin'), async(req, res) => {
    const User = require('../models/user.model');
    const users = await User.find({ isActive: true }).select('-__v');
    res.json({ success: true, count: users.length, data: { users } });
});

module.exports = router;