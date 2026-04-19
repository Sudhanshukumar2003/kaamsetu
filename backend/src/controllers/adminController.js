const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const { sanitizeString } = require('../utils/sanitize');

// @desc  Get platform statistics
// @route GET /api/admin/stats
// @access Private (admin)
const getStats = async (req, res, next) => {
  try {
    const [totalUsers, totalEmployers, totalJobs, totalApplications] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'employer' }),
      Job.countDocuments(),
      Application.countDocuments(),
    ]);

    res.json({
      success: true,
      stats: { totalUsers, totalEmployers, totalJobs, totalApplications },
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Get all users
// @route GET /api/admin/users
// @access Private (admin)
const getAllUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const allowedRoles = ['user', 'employer', 'admin'];
    const safeRole = role && allowedRoles.includes(sanitizeString(role)) ? sanitizeString(role) : null;
    const query = safeRole ? { role: safeRole } : {};
    const skip = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(query);
    const users = await User.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    res.json({ success: true, total, users });
  } catch (error) {
    next(error);
  }
};

// @desc  Update user (activate/deactivate, change role)
// @route PUT /api/admin/users/:id
// @access Private (admin)
const updateUser = async (req, res, next) => {
  try {
    const { isActive, role } = req.body;
    const allowedRoles = ['user', 'employer', 'admin'];
    const safeRole = role && allowedRoles.includes(role) ? role : null;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { ...(isActive !== undefined && { isActive: Boolean(isActive) }), ...(safeRole && { role: safeRole }) },
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// @desc  Delete user
// @route DELETE /api/admin/users/:id
// @access Private (admin)
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    await User.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc  Get all jobs (admin view)
// @route GET /api/admin/jobs
// @access Private (admin)
const getAllJobs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const total = await Job.countDocuments();
    const jobs = await Job.find()
      .populate('employer', 'name email companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    res.json({ success: true, total, jobs });
  } catch (error) {
    next(error);
  }
};

// @desc  Toggle job active status
// @route PUT /api/admin/jobs/:id
// @access Private (admin)
const updateJobAdmin = async (req, res, next) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    res.json({ success: true, job });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStats, getAllUsers, updateUser, deleteUser, getAllJobs, updateJobAdmin };
