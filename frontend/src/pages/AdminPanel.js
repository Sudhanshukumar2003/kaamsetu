import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../utils/api';

const AdminPanel = () => {
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/admin/stats');
        setStats(data.stats);
      } catch {
        toast.error('Failed to load stats');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data.users);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/jobs');
      setJobs(data.jobs);
    } catch {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'users') loadUsers();
    else if (tab === 'jobs') loadJobs();
  }, [tab]); // eslint-disable-line

  const handleToggleUser = async (userId, isActive) => {
    try {
      const { data } = await api.put(`/admin/users/${userId}`, { isActive: !isActive });
      setUsers((prev) => prev.map((u) => u._id === userId ? data.user : u));
      toast.success(`User ${!isActive ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete this user permanently?')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      toast.success('User deleted');
    } catch {
      toast.error('Failed to delete user');
    }
  };

  const handleToggleJob = async (jobId, isActive) => {
    try {
      const { data } = await api.put(`/admin/jobs/${jobId}`, { isActive: !isActive });
      setJobs((prev) => prev.map((j) => j._id === jobId ? data.job : j));
      toast.success(`Job ${!isActive ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update job');
    }
  };

  const handleChangeRole = async (userId, role) => {
    try {
      const { data } = await api.put(`/admin/users/${userId}`, { role });
      setUsers((prev) => prev.map((u) => u._id === userId ? data.user : u));
      toast.success('Role updated');
    } catch {
      toast.error('Failed to update role');
    }
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Admin Panel ⚙️</h1>
        <p>Manage users, jobs, and platform settings</p>
      </div>

      <div className="admin-tabs">
        {['stats', 'users', 'jobs'].map((t) => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'stats' ? '📊 Overview' : t === 'users' ? '👥 Users' : '💼 Jobs'}
          </button>
        ))}
      </div>

      {loading && <div className="loading-spinner"><div className="spinner"></div></div>}

      {/* Stats Tab */}
      {tab === 'stats' && stats && !loading && (
        <div className="stats-grid admin-stats">
          <div className="stat-card">
            <h2>{stats.totalUsers}</h2>
            <p>Job Seekers</p>
          </div>
          <div className="stat-card">
            <h2>{stats.totalEmployers}</h2>
            <p>Employers</p>
          </div>
          <div className="stat-card">
            <h2>{stats.totalJobs}</h2>
            <p>Jobs Posted</p>
          </div>
          <div className="stat-card">
            <h2>{stats.totalApplications}</h2>
            <p>Applications</p>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && !loading && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => handleChangeRole(u._id, e.target.value)}
                      className="role-select"
                    >
                      <option value="user">user</option>
                      <option value="employer">employer</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className={`btn btn-sm ${u.isActive ? 'btn-outline' : 'btn-secondary'}`}
                        onClick={() => handleToggleUser(u._id, u.isActive)}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(u._id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Jobs Tab */}
      {tab === 'jobs' && !loading && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Company</th>
                <th>Location</th>
                <th>Type</th>
                <th>Status</th>
                <th>Posted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j._id}>
                  <td>{j.title}</td>
                  <td>{j.companyName}</td>
                  <td>{j.location}</td>
                  <td>{j.jobType}</td>
                  <td>
                    <span className={`badge ${j.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {j.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(j.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className={`btn btn-sm ${j.isActive ? 'btn-outline' : 'btn-secondary'}`}
                      onClick={() => handleToggleJob(j._id, j.isActive)}
                    >
                      {j.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
