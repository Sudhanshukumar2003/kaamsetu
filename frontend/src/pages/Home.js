import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user } = useAuth();

  const features = [
    { icon: '🔍', title: 'Smart Job Search', desc: 'Filter by location, type, category and skills' },
    { icon: '🏢', title: 'Verified Employers', desc: 'Apply with confidence to trusted companies' },
    { icon: '⚡', title: 'Instant Apply', desc: 'One-click application with your saved profile' },
    { icon: '📊', title: 'Track Applications', desc: 'Monitor your application status in real time' },
  ];

  const stats = [
    { value: '10,000+', label: 'Job Listings' },
    { value: '5,000+', label: 'Companies' },
    { value: '50,000+', label: 'Job Seekers' },
    { value: '1,000+', label: 'Hires Monthly' },
  ];

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>
            Your Dream Job is <span className="highlight">One Click Away</span>
          </h1>
          <p>KaamSetu connects talented professionals with top employers across India. Start your journey today.</p>
          <div className="hero-actions">
            <Link to="/jobs" className="btn btn-primary btn-lg">Browse Jobs</Link>
            {!user && (
              <Link to="/register" className="btn btn-outline btn-lg">Post a Job</Link>
            )}
            {user?.role === 'employer' && (
              <Link to="/employer/post-job" className="btn btn-outline btn-lg">Post a Job</Link>
            )}
          </div>
        </div>
        <div className="hero-image">
          <div className="hero-illustration">
            <div className="illustration-circle c1"></div>
            <div className="illustration-circle c2"></div>
            <div className="illustration-circle c3"></div>
            <span className="illustration-icon">💼</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-section">
        <div className="stats-grid">
          {stats.map((s, i) => (
            <div key={i} className="stat-card">
              <h2>{s.value}</h2>
              <p>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <h2>Why Choose KaamSetu?</h2>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-card employer-cta">
          <h3>👔 Are you an Employer?</h3>
          <p>Post jobs and find the best talent for your team.</p>
          <Link to={user?.role === 'employer' ? '/employer/post-job' : '/register?role=employer'} className="btn btn-white">
            Start Hiring
          </Link>
        </div>
        <div className="cta-card jobseeker-cta">
          <h3>🎯 Looking for a Job?</h3>
          <p>Thousands of opportunities waiting for you.</p>
          <Link to="/jobs" className="btn btn-white">Explore Jobs</Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
