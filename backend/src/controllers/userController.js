const User = require('../models/User');

// @desc  Get current user profile
// @route GET /api/users/profile
// @access Private
const getProfile = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// @desc  Update current user profile
// @route PUT /api/users/profile
// @access Private
const updateProfile = async (req, res, next) => {
  try {
    // Destructure only allowed fields to prevent mass assignment
    const { name, phone, bio, skills, resumeUrl, companyName, companyWebsite, companyDescription } = req.body;
    const allowedUpdate = {};
    if (name !== undefined) allowedUpdate.name = name;
    if (phone !== undefined) allowedUpdate.phone = phone;
    if (bio !== undefined) allowedUpdate.bio = bio;
    if (skills !== undefined) allowedUpdate.skills = skills;
    if (resumeUrl !== undefined) allowedUpdate.resumeUrl = resumeUrl;
    if (companyName !== undefined) allowedUpdate.companyName = companyName;
    if (companyWebsite !== undefined) allowedUpdate.companyWebsite = companyWebsite;
    if (companyDescription !== undefined) allowedUpdate.companyDescription = companyDescription;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: allowedUpdate },
      { new: true, runValidators: true }
    );

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
};

// @desc  Change password
// @route PUT /api/users/password
// @access Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new passwords are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, changePassword };
