import React from 'react';
import { Link } from 'react-router-dom';

const jobTypeColors = {
  'full-time': '#2563eb',
  'part-time': '#7c3aed',
  'contract': '#d97706',
  'internship': '#059669',
  'remote': '#dc2626',
};

const JobCard = ({ job }) => {
  const salaryText =
    job.salaryMin && job.salaryMax
      ? `₹${(job.salaryMin / 100000).toFixed(1)}L - ₹${(job.salaryMax / 100000).toFixed(1)}L`
      : job.salaryMin
      ? `From ₹${(job.salaryMin / 100000).toFixed(1)}L`
      : 'Salary not disclosed';

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="job-card">
      <div className="job-card-header">
        <div className="company-avatar">{job.companyName.charAt(0).toUpperCase()}</div>
        <div className="job-meta">
          <h3 className="job-title">
            <Link to={`/jobs/${job._id}`}>{job.title}</Link>
          </h3>
          <p className="company-name">{job.companyName}</p>
        </div>
        <span
          className="badge job-type-badge"
          style={{ backgroundColor: jobTypeColors[job.jobType] || '#6b7280', color: '#fff' }}
        >
          {job.jobType}
        </span>
      </div>

      <div className="job-card-body">
        <div className="job-details">
          <span>📍 {job.location}</span>
          <span>💰 {salaryText}</span>
          <span>🎓 {job.experience}</span>
        </div>
        {job.skills && job.skills.length > 0 && (
          <div className="job-skills">
            {job.skills.slice(0, 4).map((skill, i) => (
              <span key={i} className="skill-tag">{skill}</span>
            ))}
            {job.skills.length > 4 && <span className="skill-tag">+{job.skills.length - 4}</span>}
          </div>
        )}
      </div>

      <div className="job-card-footer">
        <span className="posted-time">{timeAgo(job.createdAt)}</span>
        <Link to={`/jobs/${job._id}`} className="btn btn-sm btn-primary">View & Apply</Link>
      </div>
    </div>
  );
};

export default JobCard;
