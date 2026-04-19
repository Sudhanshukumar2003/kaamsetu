const Application = require('../models/Application');
const Job = require('../models/Job');

// @desc  Apply for a job
// @route POST /api/applications/:jobId
// @access Private (user)
const applyForJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job || !job.isActive) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const existing = await Application.findOne({ job: req.params.jobId, applicant: req.user._id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You have already applied for this job' });
    }

    const application = await Application.create({
      job: req.params.jobId,
      applicant: req.user._id,
      coverLetter: req.body.coverLetter,
      resumeUrl: req.body.resumeUrl || req.user.resumeUrl,
    });

    await application.populate([
      { path: 'job', select: 'title companyName location' },
      { path: 'applicant', select: 'name email' },
    ]);

    res.status(201).json({ success: true, application });
  } catch (error) {
    next(error);
  }
};

// @desc  Get current user's applications
// @route GET /api/applications/my
// @access Private (user)
const getMyApplications = async (req, res, next) => {
  try {
    const applications = await Application.find({ applicant: req.user._id })
      .populate('job', 'title companyName location jobType isActive')
      .sort({ createdAt: -1 });

    res.json({ success: true, applications });
  } catch (error) {
    next(error);
  }
};

// @desc  Get applications for a specific job (employer view)
// @route GET /api/applications/job/:jobId
// @access Private (employer, admin)
const getJobApplications = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Employer can only see applications for their own jobs
    if (req.user.role === 'employer' && job.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const applications = await Application.find({ job: req.params.jobId })
      .populate('applicant', 'name email phone bio skills resumeUrl')
      .sort({ createdAt: -1 });

    res.json({ success: true, applications });
  } catch (error) {
    next(error);
  }
};

// @desc  Update application status (employer)
// @route PUT /api/applications/:id/status
// @access Private (employer, admin)
const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, employerNote } = req.body;

    const application = await Application.findById(req.params.id).populate('job');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Employer can only update applications for their own jobs
    if (req.user.role === 'employer' && application.job.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    application.status = status || application.status;
    application.employerNote = employerNote !== undefined ? employerNote : application.employerNote;
    await application.save();

    res.json({ success: true, application });
  } catch (error) {
    next(error);
  }
};

// @desc  Withdraw application
// @route DELETE /api/applications/:id
// @access Private (user)
const withdrawApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.applicant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await Application.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Application withdrawn' });
  } catch (error) {
    next(error);
  }
};

module.exports = { applyForJob, getMyApplications, getJobApplications, updateApplicationStatus, withdrawApplication };
