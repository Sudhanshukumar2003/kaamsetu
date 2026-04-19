const Job = require('../models/Job');
const Application = require('../models/Application');

// Escape special regex characters to prevent regex injection
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc  Get all active jobs (with filters)
// @route GET /api/jobs
// @access Public
const getJobs = async (req, res, next) => {
  try {
    const { search, location, jobType, category, experience, page = 1, limit = 10 } = req.query;

    const query = { isActive: true };
    const allowedJobTypes = ['full-time', 'part-time', 'contract', 'internship', 'remote'];
    const allowedExperience = ['fresher', '1-2 years', '2-5 years', '5+ years'];

    if (search) {
      query.$text = { $search: search };
    }
    if (location) query.location = new RegExp(escapeRegex(location), 'i');
    if (jobType && allowedJobTypes.includes(jobType)) query.jobType = jobType;
    if (category) query.category = new RegExp(escapeRegex(category), 'i');
    if (experience && allowedExperience.includes(experience)) query.experience = experience;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .populate('employer', 'name companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      jobs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Get single job
// @route GET /api/jobs/:id
// @access Public
const getJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).populate('employer', 'name companyName companyWebsite companyDescription');
    if (!job || !job.isActive) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    job.views += 1;
    await job.save();

    res.json({ success: true, job });
  } catch (error) {
    next(error);
  }
};

// @desc  Create job
// @route POST /api/jobs
// @access Private (employer, admin)
const createJob = async (req, res, next) => {
  try {
    const {
      title, description, location, jobType, category, experience,
      companyName, skills, requirements, benefits, salaryMin, salaryMax,
      salaryCurrency, openings, deadline,
    } = req.body;
    const jobData = {
      title, description, location, jobType, category, experience,
      companyName: companyName || req.user.companyName,
      skills, requirements, benefits,
      salaryMin: salaryMin !== undefined ? Number(salaryMin) : undefined,
      salaryMax: salaryMax !== undefined ? Number(salaryMax) : undefined,
      salaryCurrency, openings: openings ? Number(openings) : 1, deadline,
      employer: req.user._id,
    };
    const job = await Job.create(jobData);
    res.status(201).json({ success: true, job });
  } catch (error) {
    next(error);
  }
};

// @desc  Update job
// @route PUT /api/jobs/:id
// @access Private (employer who owns the job, admin)
const updateJob = async (req, res, next) => {
  try {
    let job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Check ownership unless admin
    if (req.user.role !== 'admin' && job.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this job' });
    }

    const {
      title, description, location, jobType, category, experience,
      companyName, skills, requirements, benefits, salaryMin, salaryMax,
      salaryCurrency, openings, deadline, isActive,
    } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (location !== undefined) update.location = location;
    if (jobType !== undefined) update.jobType = jobType;
    if (category !== undefined) update.category = category;
    if (experience !== undefined) update.experience = experience;
    if (companyName !== undefined) update.companyName = companyName;
    if (skills !== undefined) update.skills = skills;
    if (requirements !== undefined) update.requirements = requirements;
    if (benefits !== undefined) update.benefits = benefits;
    if (salaryMin !== undefined) update.salaryMin = Number(salaryMin);
    if (salaryMax !== undefined) update.salaryMax = Number(salaryMax);
    if (salaryCurrency !== undefined) update.salaryCurrency = salaryCurrency;
    if (openings !== undefined) update.openings = Number(openings);
    if (deadline !== undefined) update.deadline = deadline;
    if (isActive !== undefined) update.isActive = Boolean(isActive);

    job = await Job.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    res.json({ success: true, job });
  } catch (error) {
    next(error);
  }
};

// @desc  Delete job
// @route DELETE /api/jobs/:id
// @access Private (employer who owns the job, admin)
const deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (req.user.role !== 'admin' && job.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this job' });
    }

    await Job.deleteOne({ _id: req.params.id });
    await Application.deleteMany({ job: req.params.id });

    res.json({ success: true, message: 'Job deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc  Get employer's own jobs
// @route GET /api/jobs/my
// @access Private (employer)
const getMyJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({ employer: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, jobs });
  } catch (error) {
    next(error);
  }
};

module.exports = { getJobs, getJob, createJob, updateJob, deleteJob, getMyJobs };
