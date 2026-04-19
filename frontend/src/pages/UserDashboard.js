import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const statusColors = {
  pending: '#f59e0b',
  reviewed: '#3b82f6',
  shortlisted: '#8b5cf6',
  rejected: '#ef4444',
  hired: '#10b981',
};

const UserDashboard = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const { data } = await api.get('/applications/my');
        setApplications(data.applications);
      } catch {
        toast.error('Failed to load applications');
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();
  }, []);

  const handleWithdraw = async (id) => {
    if (!window.confirm('Withdraw this application?')) return;
    try {
      await api.delete(`/applications/${id}`);
      setApplications((prev) => prev.filter((a) => a._id !== id));
      toast.success('Application withdrawn');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to withdraw');
    }
  };

  const stats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === 'pending').length,
    shortlisted: applications.filter((a) => a.status === 'shortlisted').length,
    hired: applications.filter((a) => a.status === 'hired').length,
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Welcome back, {user?.name}! 👋</h1>
          <p>Track your job applications and career progress</p>
        </div>
        <Link to="/jobs" className="btn btn-primary">Browse Jobs</Link>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-box"><h3>{stats.total}</h3><p>Total Applications</p></div>
        <div className="stat-box"><h3>{stats.pending}</h3><p>Pending Review</p></div>
        <div className="stat-box"><h3>{stats.shortlisted}</h3><p>Shortlisted</p></div>
        <div className="stat-box"><h3>{stats.hired}</h3><p>Hired</p></div>
      </div>

      <div className="section-header">
        <h2>My Applications</h2>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : applications.length === 0 ? (
        <div className="empty-state">
          <span>📋</span>
          <h3>No applications yet</h3>
          <p>Start applying to jobs to see them here</p>
          <Link to="/jobs" className="btn btn-primary">Browse Jobs</Link>
        </div>
      ) : (
        <div className="applications-list">
          {applications.map((app) => (
            <div key={app._id} className="application-card">
              <div className="application-info">
                <h3>
                  {app.job ? (
                    <Link to={`/jobs/${app.job._id}`}>{app.job.title}</Link>
                  ) : (
                    <span className="text-muted">Job no longer available</span>
                  )}
                </h3>
                <p>{app.job?.companyName} • {app.job?.location}</p>
                <p className="text-muted">Applied on {new Date(app.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="application-status">
                <span
                  className="status-badge"
                  style={{ backgroundColor: statusColors[app.status] + '22', color: statusColors[app.status], borderColor: statusColors[app.status] }}
                >
                  {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                </span>
                {app.employerNote && (
                  <p className="employer-note">💬 {app.employerNote}</p>
                )}
              </div>
              {app.status === 'pending' && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleWithdraw(app._id)}
                >
                  Withdraw
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
