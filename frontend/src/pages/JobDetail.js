import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const JobDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const { data } = await api.get(`/jobs/${id}`);
        setJob(data.job);
        if (user?.role === 'user') {
          const { data: appData } = await api.get('/applications/my');
          const applied = appData.applications.some((a) => a.job?._id === id || a.job?._id?.toString() === id);
          setAlreadyApplied(applied);
        }
      } catch {
        toast.error('Job not found');
        navigate('/jobs');
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [id, user, navigate]);

  const handleApply = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setApplying(true);
    try {
      await api.post(`/applications/${id}`, { coverLetter });
      setAlreadyApplied(true);
      setShowModal(false);
      toast.success('Application submitted successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!job) return null;

  const salaryText =
    job.salaryMin && job.salaryMax
      ? `₹${(job.salaryMin / 100000).toFixed(1)}L - ₹${(job.salaryMax / 100000).toFixed(1)}L per annum`
      : 'Salary not disclosed';

  return (
    <div className="job-detail-page">
      <div className="job-detail-header">
        <div className="company-avatar large">{job.companyName.charAt(0).toUpperCase()}</div>
        <div className="job-detail-title">
          <h1>{job.title}</h1>
          <p className="company-name">{job.companyName}</p>
          {job.employer?.companyWebsite && (
            <a href={job.employer.companyWebsite} target="_blank" rel="noopener noreferrer" className="company-link">
              🌐 {job.employer.companyWebsite}
            </a>
          )}
        </div>
        <div className="apply-section">
          {user?.role === 'user' ? (
            alreadyApplied ? (
              <span className="badge badge-success">✓ Applied</span>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={() => setShowModal(true)}>
                Apply Now
              </button>
            )
          ) : !user ? (
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>
              Login to Apply
            </button>
          ) : null}
          <p className="views-count">👁 {job.views} views</p>
        </div>
      </div>

      <div className="job-detail-grid">
        <div className="job-detail-main">
          <div className="detail-section">
            <h2>Job Description</h2>
            <p className="description-text">{job.description}</p>
          </div>

          {job.requirements && (
            <div className="detail-section">
              <h2>Requirements</h2>
              <p className="description-text">{job.requirements}</p>
            </div>
          )}

          {job.benefits && (
            <div className="detail-section">
              <h2>Benefits</h2>
              <p className="description-text">{job.benefits}</p>
            </div>
          )}

          {job.skills?.length > 0 && (
            <div className="detail-section">
              <h2>Required Skills</h2>
              <div className="skills-list">
                {job.skills.map((skill, i) => (
                  <span key={i} className="skill-tag">{skill}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="job-detail-sidebar">
          <div className="sidebar-card">
            <h3>Job Overview</h3>
            <div className="overview-list">
              <div><span>📍</span><div><strong>Location</strong><p>{job.location}</p></div></div>
              <div><span>💼</span><div><strong>Job Type</strong><p>{job.jobType}</p></div></div>
              <div><span>💰</span><div><strong>Salary</strong><p>{salaryText}</p></div></div>
              <div><span>🎓</span><div><strong>Experience</strong><p>{job.experience}</p></div></div>
              <div><span>🏷️</span><div><strong>Category</strong><p>{job.category}</p></div></div>
              <div><span>👥</span><div><strong>Openings</strong><p>{job.openings}</p></div></div>
              {job.deadline && (
                <div><span>📅</span><div><strong>Deadline</strong><p>{new Date(job.deadline).toLocaleDateString()}</p></div></div>
              )}
            </div>
          </div>

          {job.employer?.companyDescription && (
            <div className="sidebar-card">
              <h3>About {job.companyName}</h3>
              <p>{job.employer.companyDescription}</p>
            </div>
          )}
        </div>
      </div>

      {/* Apply Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Apply for {job.title}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Cover Letter (Optional)</label>
                <textarea
                  rows="6"
                  placeholder="Tell the employer why you're a great fit..."
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  maxLength={2000}
                />
                <small>{coverLetter.length}/2000</small>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleApply} disabled={applying}>
                {applying ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetail;
