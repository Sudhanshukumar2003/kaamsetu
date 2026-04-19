import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    skills: user?.skills?.join(', ') || '',
    resumeUrl: user?.resumeUrl || '',
    companyName: user?.companyName || '',
    companyWebsite: user?.companyWebsite || '',
    companyDescription: user?.companyDescription || '',
  });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handlePwChange = (e) => setPwForm({ ...pwForm, [e.target.name]: e.target.value });

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        skills: form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
      };
      const { data } = await api.put('/users/profile', payload);
      updateUser(data.user);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword.length < 6) return toast.error('New password must be at least 6 characters');
    setPwSaving(true);
    try {
      await api.put('/users/password', pwForm);
      toast.success('Password changed!');
      setPwForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Manage your account information</p>
      </div>

      <div className="profile-grid">
        {/* Profile Card */}
        <div className="profile-sidebar">
          <div className="profile-avatar-card">
            <div className="profile-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
            <h3>{user?.name}</h3>
            <p>{user?.email}</p>
            <span className="badge">{user?.role}</span>
          </div>
        </div>

        <div className="profile-main">
          {/* Profile Form */}
          <form className="form-card" onSubmit={handleProfileSave}>
            <h2>Personal Information</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" name="name" value={form.name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 9999999999" />
              </div>
            </div>
            <div className="form-group">
              <label>Bio</label>
              <textarea name="bio" rows="3" value={form.bio} onChange={handleChange} placeholder="Tell employers about yourself..." maxLength={500} />
              <small>{form.bio.length}/500</small>
            </div>

            {user?.role === 'user' && (
              <>
                <div className="form-group">
                  <label>Skills (comma-separated)</label>
                  <input type="text" name="skills" value={form.skills} onChange={handleChange} placeholder="React, Python, SQL..." />
                </div>
                <div className="form-group">
                  <label>Resume URL</label>
                  <input type="url" name="resumeUrl" value={form.resumeUrl} onChange={handleChange} placeholder="https://..." />
                </div>
              </>
            )}

            {user?.role === 'employer' && (
              <>
                <h3>Company Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Company Name</label>
                    <input type="text" name="companyName" value={form.companyName} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Company Website</label>
                    <input type="url" name="companyWebsite" value={form.companyWebsite} onChange={handleChange} placeholder="https://..." />
                  </div>
                </div>
                <div className="form-group">
                  <label>Company Description</label>
                  <textarea name="companyDescription" rows="3" value={form.companyDescription} onChange={handleChange} maxLength={1000} />
                </div>
              </>
            )}

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>

          {/* Password Form */}
          <form className="form-card" onSubmit={handlePasswordChange}>
            <h2>Change Password</h2>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" name="currentPassword" value={pwForm.currentPassword} onChange={handlePwChange} required />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" name="newPassword" value={pwForm.newPassword} onChange={handlePwChange} placeholder="Min 6 characters" required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={pwSaving}>
              {pwSaving ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
