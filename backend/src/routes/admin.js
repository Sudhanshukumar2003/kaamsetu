const express = require('express');
const { getStats, getAllUsers, updateUser, deleteUser, getAllJobs, updateJobAdmin } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/stats', getStats);
router.get('/users', getAllUsers);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.get('/jobs', getAllJobs);
router.put('/jobs/:id', updateJobAdmin);

module.exports = router;
