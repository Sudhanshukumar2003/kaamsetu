import React, { useState, useEffect, useCallback } from 'react';
import JobCard from '../components/JobCard';
import api from '../utils/api';

const JOB_TYPES = ['full-time', 'part-time', 'contract', 'internship', 'remote'];
const EXPERIENCE_LEVELS = ['fresher', '1-2 years', '2-5 years', '5+ years'];

const JobList = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filters, setFilters] = useState({
    search: '', location: '', jobType: '', experience: '', category: '',
  });
  const [applied, setApplied] = useState(false);

  const fetchJobs = useCallback(async (currentFilters, currentPage) => {
    setLoading(true);
    try {
      const params = { page: currentPage, limit: 9, ...currentFilters };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      const { data } = await api.get('/jobs', { params });
      setJobs(data.jobs);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs(filters, page);
  }, [fetchJobs, page]); // eslint-disable-line

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied(true);
    fetchJobs(filters, 1);
  };

  const clearFilters = () => {
    const empty = { search: '', location: '', jobType: '', experience: '', category: '' };
    setFilters(empty);
    setPage(1);
    setApplied(false);
    fetchJobs(empty, 1);
  };

  return (
    <div className="job-list-page">
      <div className="page-header">
        <h1>Find Your Next Opportunity</h1>
        <p>{total.toLocaleString()} jobs available</p>
      </div>

      {/* Search & Filters */}
      <form className="search-bar" onSubmit={handleSearch}>
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            name="search"
            placeholder="Job title, keywords..."
            value={filters.search}
            onChange={handleFilterChange}
          />
        </div>
        <div className="search-input-wrap">
          <span className="search-icon">📍</span>
          <input
            type="text"
            name="location"
            placeholder="Location"
            value={filters.location}
            onChange={handleFilterChange}
          />
        </div>
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      <div className="filter-bar">
        <select name="jobType" value={filters.jobType} onChange={handleFilterChange}>
          <option value="">All Types</option>
          {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select name="experience" value={filters.experience} onChange={handleFilterChange}>
          <option value="">All Experience</option>
          {EXPERIENCE_LEVELS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input
          type="text"
          name="category"
          placeholder="Category..."
          value={filters.category}
          onChange={handleFilterChange}
        />
        {applied && (
          <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters}>
            Clear Filters
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPage(1); fetchJobs(filters, 1); }}>
          Apply Filters
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <span>🔍</span>
          <h3>No jobs found</h3>
          <p>Try adjusting your search criteria</p>
        </div>
      ) : (
        <>
          <div className="jobs-grid">
            {jobs.map((job) => <JobCard key={job._id} job={job} />)}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="btn btn-outline btn-sm">
                ← Prev
              </button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`}
                >
                  {p}
                </button>
              ))}
              <button disabled={page === pages} onClick={() => setPage(page + 1)} className="btn btn-outline btn-sm">
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default JobList;
