import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  const getDashboardLink = () => {
    if (!user) return null;
    if (user.role === 'admin') return '/admin';
    if (user.role === 'employer') return '/employer/dashboard';
    return '/dashboard';
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" onClick={() => setMenuOpen(false)}>
          <span className="brand-logo">💼</span>
          <span className="brand-name">KaamSetu</span>
        </Link>
      </div>

      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>

      <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
        <Link to="/jobs" onClick={() => setMenuOpen(false)}>Find Jobs</Link>

        {user ? (
          <>
            <Link to={getDashboardLink()} onClick={() => setMenuOpen(false)}>Dashboard</Link>
            <div className="user-menu">
              <span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span>
              <div className="user-dropdown">
                <span className="user-name">{user.name}</span>
                <span className="user-role badge">{user.role}</span>
                <Link to="/profile" onClick={() => setMenuOpen(false)}>My Profile</Link>
                <button onClick={handleLogout}>Logout</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-outline" onClick={() => setMenuOpen(false)}>Login</Link>
            <Link to="/register" className="btn btn-primary" onClick={() => setMenuOpen(false)}>Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
