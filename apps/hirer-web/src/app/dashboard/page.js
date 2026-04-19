'use client';
import React, { useEffect, useState } from 'react';
import * as API from '../../services/api';

const fmt = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;

const statusLabel = { open: 'Open', accepted: 'Accepted', in_progress: 'In Progress', completed: 'Completed', disputed: 'Disputed', cancelled: 'Cancelled' };

function GigRow({ gig, onView }) {
  const statusClass = `badge status-${gig.status}`;
  const date = new Date(gig.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{gig.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{gig.trade_name} · {gig.city}</div>
      </td>
      <td style={{ padding: '14px 16px' }}>
        <span className={statusClass}>{statusLabel[gig.status] || gig.status}</span>
      </td>
      <td style={{ padding: '14px 16px', fontSize: 14 }}>{date}</td>
      <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>
        {gig.agreed_amount ? fmt(gig.agreed_amount) : `${fmt(gig.budget_min)}–${fmt(gig.budget_max)}`}
      </td>
      <td style={{ padding: '14px 16px' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onView(gig.id)}>View</button>
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const [gigs,    setGigs]    = useState([]);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('ks_token')) {
      window.location.href = '/auth/login';
      return;
    }
    load();
  }, [tab]);

  const load = async () => {
    setLoading(true);
    try {
      const [gigsRes, profileRes] = await Promise.all([
        API.getMyGigs(tab),
        API.getHirerProfile(),
      ]);
      setGigs(gigsRes.data.data);
      const p = profileRes.data.data;
      setStats({
        totalGigs:  p.total_gigs_posted || 0,
        rating:     p.avg_rating ? p.avg_rating.toFixed(1) : '–',
        active:     gigsRes.data.data.filter(g => ['accepted','in_progress'].includes(g.status)).length,
      });
    } catch (e) {
      if (e.response?.status === 401) window.location.href = '/auth/login';
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { key: null,          label: 'All Gigs' },
    { key: 'open',        label: 'Open' },
    { key: 'accepted',    label: 'Accepted' },
    { key: 'in_progress', label: 'Active' },
    { key: 'completed',   label: 'Completed' },
  ];

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Top nav */}
      <nav style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>🔨 KaamSetu</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/gigs/new" className="btn btn-primary btn-sm">+ Post a Gig</a>
          <button className="btn btn-sm" onClick={() => { API.clearTokens(); window.location.href = '/auth/login'; }}
            style={{ color: 'var(--text-secondary)' }}>Logout</button>
        </div>
      </nav>

      <div className="container" style={{ padding: '32px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Manage your gigs and workers</p>
        </div>

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            {[
              { icon: '📋', label: 'Total Gigs Posted', value: stats.totalGigs },
              { icon: '⚡', label: 'Active Gigs',       value: stats.active },
              { icon: '⭐', label: 'Your Rating',        value: stats.rating },
            ].map(s => (
              <div key={s.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 32 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary)' }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Gig table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px', gap: 4 }}>
            {TABS.map(t => (
              <button key={String(t.key)} onClick={() => setTab(t.key)}
                style={{
                  padding: '14px 16px', fontSize: 13, fontWeight: 600,
                  border: 'none', background: 'none', cursor: 'pointer',
                  borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                  color: tab === t.key ? 'var(--primary)' : 'var(--text-secondary)',
                }}>
                {t.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <a href="/gigs/new" className="btn btn-primary btn-sm" style={{ alignSelf: 'center', marginRight: 4 }}>
              + Post Gig
            </a>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
          ) : gigs.length === 0 ? (
            <div style={{ padding: 64, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <h3>No gigs yet</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '8px 0 24px' }}>
                Post your first gig to find verified workers near you.
              </p>
              <a href="/gigs/new" className="btn btn-primary">Post a Gig</a>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-alt)' }}>
                  {['Gig', 'Status', 'Date', 'Budget', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gigs.map(g => (
                  <GigRow key={g.id} gig={g} onView={id => window.location.href = `/gigs/${id}`} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
