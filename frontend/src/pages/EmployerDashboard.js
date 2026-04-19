import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const EmployerDashboard = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [applications, setApplications] = useState([]);
  const [appLoading, setAppLoading] = useState(false);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data } = await api.get('/jobs/my');
        setJobs(data.jobs);
      } catch {
        toast.error('Failed to load jobs');
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  const loadApplications = async (jobId) => {
    setSelected(jobId);
    setAppLoading(true);
    try {
      const { data } = await api.get(`/applications/job/${jobId}`);
      setApplications(data.applications);
    } catch {
      toast.error('Failed to load applications');
    } finally {
      setAppLoading(false);
    }
  };

  const handleStatusChange = async (appId, status) => {
    try {
      await api.put(`/applications/${appId}/status`, { status });
      setApplications((prev) => prev.map((a) => a._id === appId ? { ...a, status } : a));
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleToggleJob = async (jobId, isActive) => {
    try {
      await api.put(`/jobs/${jobId}`, { isActive: !isActive });
      setJobs((prev) => prev.map((j) => j._id === jobId ? { ...j, isActive: !isActive } : j));
      toast.success(`Job ${!isActive ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update job');
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Delete this job? This will also remove all applications.')) return;
    try {
      await api.delete(`/jobs/${jobId}`);
      setJobs((prev) => prev.filter((j) => j._id !== jobId));
      if (selected === jobId) { setSelected(null); setApplications([]); }
      toast.success('Job deleted');
    } catch {
      toast.error('Failed to delete job');
    }
  };

  const activeJobs = jobs.filter((j) => j.isActive).length;

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Employer Dashboard 🏢</h1>
          <p>{user?.companyName || user?.name}</p>
        </div>
        <Link to="/employer/post-job" className="btn btn-primary">+ Post New Job</Link>
      </div>

      <div className="stats-row">
        <div className="stat-box"><h3>{jobs.length}</h3><p>Total Jobs Posted</p></div>
        <div className="stat-box"><h3>{activeJobs}</h3><p>Active Listings</p></div>
        <div className="stat-box"><h3>{jobs.length - activeJobs}</h3><p>Closed Listings</p></div>
      </div>

      <div className="employer-grid">
        {/* Jobs List */}
        <div className="jobs-panel">
          <h2>Your Job Postings</h2>
          {loading ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : jobs.length === 0 ? (
            <div className="empty-state">
              <span>📋</span>
              <h3>No jobs posted yet</h3>
              <Link to="/employer/post-job" className="btn btn-primary">Post Your First Job</Link>
            </div>
          ) : (
            <div className="jobs-list-panel">
              {jobs.map((job) => (
                <div
                  key={job._id}
                  className={`job-list-item ${selected === job._id ? 'active' : ''} ${!job.isActive ? 'inactive' : ''}`}
                  onClick={() => loadApplications(job._id)}
                >
                  <div className="job-item-info">
                    <h4>{job.title}</h4>
                    <p>{job.location} • {job.jobType}</p>
                    <p className="text-muted">{new Date(job.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="job-item-actions">
                    <span className={`badge ${job.isActive ? 'badge-success' : 'badge-muted'}`}>
                      {job.isActive ? 'Active' : 'Closed'}
                    </span>
                    <div className="action-btns">
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={(e) => { e.stopPropagation(); handleToggleJob(job._id, job.isActive); }}
                      >
                        {job.isActive ? 'Close' : 'Open'}
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={(e) => { e.stopPropagation(); handleDeleteJob(job._id); }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Applications Panel */}
        <div className="applications-panel">
          <h2>{selected ? 'Applications' : 'Select a job to view applications'}</h2>
          {selected && (
            appLoading ? (
              <div className="loading-spinner"><div className="spinner"></div></div>
            ) : applications.length === 0 ? (
              <div className="empty-state">
                <span>📭</span>
                <h3>No applications yet</h3>
              </div>
            ) : (
              <div className="applications-list">
                {applications.map((app) => (
                  <div key={app._id} className="application-card employer-view">
                    <div className="applicant-info">
                      <div className="applicant-avatar">{app.applicant?.name?.charAt(0) || '?'}</div>
                      <div>
                        <h4>{app.applicant?.name}</h4>
                        <p>{app.applicant?.email}</p>
                        {app.applicant?.phone && <p>📱 {app.applicant.phone}</p>}
                        {app.applicant?.skills?.length > 0 && (
                          <div className="skills-mini">
                            {app.applicant.skills.slice(0, 3).map((s, i) => (
                              <span key={i} className="skill-tag">{s}</span>
                            ))}
                          </div>
                        )}
                        {app.coverLetter && <p className="cover-letter-preview">"{app.coverLetter.slice(0, 100)}..."</p>}
                      </div>
                    </div>
                    <div className="application-actions">
                      <select
                        value={app.status}
                        onChange={(e) => handleStatusChange(app._id, e.target.value)}
                        className="status-select"
                      >
                        <option value="pending">Pending</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="shortlisted">Shortlisted</option>
                        <option value="rejected">Rejected</option>
                        <option value="hired">Hired</option>
                      </select>
                      {app.applicant?.resumeUrl && (
                        <a href={app.applicant.resumeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">
                          View Resume
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployerDashboard;
