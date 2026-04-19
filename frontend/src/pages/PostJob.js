import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const CATEGORIES = ['Technology', 'Marketing', 'Finance', 'Healthcare', 'Education', 'Design', 'Sales', 'Operations', 'HR', 'Legal', 'Other'];
const JOB_TYPES = ['full-time', 'part-time', 'contract', 'internship', 'remote'];
const EXPERIENCE = ['fresher', '1-2 years', '2-5 years', '5+ years'];

const PostJob = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    jobType: 'full-time',
    category: '',
    experience: 'fresher',
    companyName: user?.companyName || '',
    skills: '',
    requirements: '',
    benefits: '',
    salaryMin: '',
    salaryMax: '',
    openings: 1,
    deadline: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.location || !form.category) {
      return toast.error('Please fill all required fields');
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        skills: form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
        salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
        openings: Number(form.openings) || 1,
        deadline: form.deadline || undefined,
      };
      const { data } = await api.post('/jobs', payload);
      toast.success('Job posted successfully!');
      navigate(`/jobs/${data.job._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="post-job-page">
      <div className="page-header">
        <h1>Post a New Job</h1>
        <p>Reach thousands of qualified candidates</p>
      </div>

      <form className="post-job-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h2>Basic Information</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Job Title *</label>
              <input type="text" name="title" value={form.title} onChange={handleChange} placeholder="e.g. Senior Software Engineer" required />
            </div>
            <div className="form-group">
              <label>Company Name *</label>
              <input type="text" name="companyName" value={form.companyName} onChange={handleChange} placeholder="Your company" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Location *</label>
              <input type="text" name="location" value={form.location} onChange={handleChange} placeholder="e.g. Bangalore, Remote" required />
            </div>
            <div className="form-group">
              <label>Category *</label>
              <select name="category" value={form.category} onChange={handleChange} required>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Job Type *</label>
              <select name="jobType" value={form.jobType} onChange={handleChange}>
                {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Experience Required</label>
              <select name="experience" value={form.experience} onChange={handleChange}>
                {EXPERIENCE.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Job Details</h2>
          <div className="form-group">
            <label>Job Description *</label>
            <textarea name="description" rows="6" value={form.description} onChange={handleChange} placeholder="Describe the role, responsibilities..." required maxLength={5000} />
            <small>{form.description.length}/5000</small>
          </div>
          <div className="form-group">
            <label>Requirements</label>
            <textarea name="requirements" rows="4" value={form.requirements} onChange={handleChange} placeholder="List qualifications and requirements..." maxLength={3000} />
          </div>
          <div className="form-group">
            <label>Benefits</label>
            <textarea name="benefits" rows="3" value={form.benefits} onChange={handleChange} placeholder="Health insurance, flexible hours, WFH..." maxLength={2000} />
          </div>
          <div className="form-group">
            <label>Required Skills (comma-separated)</label>
            <input type="text" name="skills" value={form.skills} onChange={handleChange} placeholder="React, Node.js, MongoDB..." />
          </div>
        </div>

        <div className="form-section">
          <h2>Compensation & Details</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Min Salary (₹/year)</label>
              <input type="number" name="salaryMin" value={form.salaryMin} onChange={handleChange} placeholder="e.g. 500000" min="0" />
            </div>
            <div className="form-group">
              <label>Max Salary (₹/year)</label>
              <input type="number" name="salaryMax" value={form.salaryMax} onChange={handleChange} placeholder="e.g. 1000000" min="0" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Number of Openings</label>
              <input type="number" name="openings" value={form.openings} onChange={handleChange} min="1" />
            </div>
            <div className="form-group">
              <label>Application Deadline</label>
              <input type="date" name="deadline" value={form.deadline} onChange={handleChange} min={new Date().toISOString().split('T')[0]} />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate('/employer/dashboard')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Posting...' : 'Post Job'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PostJob;
