const express = require('express');
const {
  applyForJob,
  getMyApplications,
  getJobApplications,
  updateApplicationStatus,
  withdrawApplication,
} = require('../controllers/applicationController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/:jobId', protect, authorize('user'), applyForJob);
router.get('/my', protect, authorize('user'), getMyApplications);
router.get('/job/:jobId', protect, authorize('employer', 'admin'), getJobApplications);
router.put('/:id/status', protect, authorize('employer', 'admin'), updateApplicationStatus);
router.delete('/:id', protect, authorize('user'), withdrawApplication);

module.exports = router;
