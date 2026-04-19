'use client';
import React, { useEffect, useState } from 'react';
import * as API from '../../../services/api';

const fmt = p => p ? `₹${(p/100).toLocaleString('en-IN')}` : '–';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '–';

const StatusBadge = ({ status }) => (
  <span className={`badge status-${status}`} style={{ fontSize: 13 }}>
    {{ open:'Open', accepted:'Accepted', in_progress:'In Progress', completed:'Completed', disputed:'Disputed', cancelled:'Cancelled' }[status] || status}
  </span>
);

const InfoBlock = ({ label, value, highlight }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: highlight ? 700 : 500, color: highlight ? 'var(--primary)' : 'var(--text)' }}>{value}</div>
  </div>
);

const Timeline = ({ gig }) => {
  const steps = [
    { label: 'Posted',      done: true },
    { label: 'Accepted',    done: ['accepted','in_progress','completed'].includes(gig.status) },
    { label: 'In Progress', done: ['in_progress','completed'].includes(gig.status) },
    { label: 'Completed',   done: gig.status === 'completed' },
    { label: 'Paid',        done: gig.payment_status === 'escrow_released' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.label}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', margin: '0 auto',
              background: s.done ? 'var(--success)' : 'var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 13 }}>
              {s.done ? '✓' : i+1}
            </div>
            <div style={{ fontSize: 11, marginTop: 4, fontWeight: s.done ? 600 : 400,
              color: s.done ? 'var(--success)' : 'var(--text-tertiary)' }}>
              {s.label}
            </div>
          </div>
          {i < steps.length-1 && (
            <div style={{ flex: 1, height: 2, marginBottom: 18,
              background: steps[i+1].done ? 'var(--success)' : 'var(--border)' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const StarRating = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 6 }}>
    {[1,2,3,4,5].map(n => (
      <button key={n} type="button" onClick={() => onChange(n)}
        style={{ fontSize: 28, background: 'none', border: 'none', cursor: 'pointer',
          color: n <= value ? '#F59E0B' : 'var(--border)' }}>★</button>
    ))}
  </div>
);

export default function GigDetailPage({ params }) {
  const gigId = params.id;
  const [gig,          setGig]          = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [actionBusy,   setActionBusy]   = useState(false);
  const [showReview,   setShowReview]   = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText,   setReviewText]   = useState('');
  const [reviewDone,   setReviewDone]   = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('ks_token')) {
      window.location.href = '/auth/login'; return;
    }
    loadGig();
  }, []);

  const loadGig = async () => {
    try { const { data } = await API.getGigDetail(gigId); setGig(data.data); }
    catch (e) { if (e.response?.status === 401) window.location.href = '/auth/login'; }
    finally { setLoading(false); }
  };

  const handlePayment = async () => {
    if (!gig.worker_id) return alert('No worker has accepted this gig yet.');
    const confirmed = confirm(`Deposit ${fmt(gig.agreed_amount)} into secure escrow?\n\nPayment will only release to the worker after you confirm job completion.`);
    if (!confirmed) return;
    setActionBusy(true);
    try {
      await API.initiatePayment(gig.id, gig.agreed_amount);
      alert('✅ Payment held in escrow! The worker is confirmed for this job.');
      loadGig();
    } catch (err) {
      alert(err.response?.data?.message || 'Payment failed. Please try again.');
    } finally { setActionBusy(false); }
  };

  const handleConfirm = async () => {
    const confirmed = confirm(`Confirm job completion and release ${fmt(Math.round((gig.agreed_amount||0)*0.9))} to the worker?`);
    if (!confirmed) return;
    setActionBusy(true);
    try {
      await API.confirmGig(gig.id);
      alert('✅ Payment released! Please leave a review for the worker.');
      loadGig();
      setShowReview(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not confirm. Please try again.');
    } finally { setActionBusy(false); }
  };

  const handleDispute = async () => {
    const reason = prompt('Briefly describe the issue:');
    if (!reason?.trim()) return;
    setActionBusy(true);
    try {
      await API.raiseDispute(gig.id, 'Work quality or commitment issue', reason);
      alert('Dispute raised. Payment is frozen. Our team will review within 24 hours.');
      loadGig();
    } catch (err) { alert(err.response?.data?.message || 'Could not raise dispute.'); }
    finally { setActionBusy(false); }
  };

  const handleReview = async (e) => {
    e.preventDefault();
    setActionBusy(true);
    try {
      await API.submitReview(gig.id, reviewRating, reviewText);
      setReviewDone(true);
      setShowReview(false);
    } catch (err) { alert(err.response?.data?.message || 'Could not submit review.'); }
    finally { setActionBusy(false); }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)' }}>Loading gig details...</p>
    </div>
  );

  if (!gig) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)' }}>Gig not found.</p>
    </div>
  );

  const workerAssigned = !!gig.worker_id;
  const paymentPending = gig.status === 'accepted' && !gig.payment_status;
  const paymentHeld    = gig.payment_status === 'escrow_held';
  const paymentDone    = gig.payment_status === 'escrow_released';
  const canConfirm     = gig.status === 'completed' && paymentHeld;
  const canReview      = (gig.status === 'completed' || paymentDone) && !reviewDone;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>🔨 KaamSetu</a>
        <a href="/dashboard" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>← Dashboard</a>
      </nav>

      <div className="container" style={{ padding: '32px 24px', maxWidth: 820 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <StatusBadge status={gig.status} />
              {gig.is_urgent && <span className="badge" style={{ background: '#FEE2E2', color: 'var(--danger)', borderColor: '#FCA5A5' }}>⚡ Urgent</span>}
            </div>
            <h1 style={{ marginBottom: 6 }}>{gig.title}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{gig.trade_name} · {gig.city}</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Progress</h3>
          <Timeline gig={gig} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* Details */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Job Details</h3>
            <InfoBlock label="Trade" value={gig.trade_name} />
            <InfoBlock label="Skill Level" value={gig.required_skill_level} />
            <InfoBlock label="Date" value={fmtDate(gig.start_date)} />
            {gig.start_time && <InfoBlock label="Start Time" value={gig.start_time} />}
            {gig.estimated_hours && <InfoBlock label="Duration" value={`~${gig.estimated_hours} hours`} />}
            <InfoBlock label="Location" value={`${gig.address}, ${gig.city}`} />
            {gig.description && <InfoBlock label="Description" value={gig.description} />}
          </div>

          {/* Payment */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Payment</h3>
            {gig.agreed_amount ? (
              <>
                <InfoBlock label="Agreed Amount" value={fmt(gig.agreed_amount)} />
                <InfoBlock label="Platform Fee (10%)" value={fmt(Math.round(gig.agreed_amount * 0.1))} />
                <InfoBlock label="Worker Receives" value={fmt(Math.round(gig.agreed_amount * 0.9))} highlight />
                <div style={{ marginTop: 12, padding: 12, borderRadius: 'var(--radius-md)',
                  background: paymentDone ? 'var(--success-light)' : paymentHeld ? 'var(--warning-light)' : 'var(--surface-alt)',
                  border: `1px solid ${paymentDone ? '#86EFAC' : paymentHeld ? '#FCD34D' : 'var(--border)'}` }}>
                  <div style={{ fontWeight: 600, fontSize: 13,
                    color: paymentDone ? 'var(--success)' : paymentHeld ? 'var(--warning)' : 'var(--text-secondary)' }}>
                    {paymentDone ? '✅ Payment Released' : paymentHeld ? '🔒 Held in Escrow' : '⏳ Awaiting Payment'}
                  </div>
                </div>
              </>
            ) : (
              <>
                <InfoBlock label="Budget Range" value={`${fmt(gig.budget_min)} – ${fmt(gig.budget_max)}`} />
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Payment details will show once a worker accepts.</p>
              </>
            )}
          </div>
        </div>

        {/* Worker card */}
        {workerAssigned && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Assigned Worker</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: 'var(--primary)', border: '2px solid var(--primary)' }}>
                {(gig.worker_name || 'W').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{gig.worker_name || 'Worker'}</div>
                {gig.work_id && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Work ID: {gig.work_id}</div>}
                {gig.worker_rating > 0 && (
                  <div style={{ fontSize: 13, color: 'var(--warning)', fontWeight: 600 }}>
                    ★ {gig.worker_rating.toFixed(1)} · {gig.worker_total_gigs} gigs done
                  </div>
                )}
              </div>
            </div>
            {gig.checkin_at && (
              <div style={{ marginTop: 12, padding: 10, background: 'var(--success-light)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>
                📍 Checked in at {new Date(gig.checkin_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                {gig.checkin_distance_m && ` · ${gig.checkin_distance_m}m from site`}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {paymentPending && (
            <div className="card" style={{ background: 'var(--warning-light)', border: '1.5px solid #FCD34D' }}>
              <h3 style={{ marginBottom: 8, color: 'var(--warning)' }}>⚡ Action Required — Deposit Payment</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                A worker has accepted your gig. Deposit {fmt(gig.agreed_amount)} into secure escrow to confirm the booking.
                The worker gets paid only after you confirm job completion.
              </p>
              <button className="btn btn-primary btn-lg w-full" onClick={handlePayment} disabled={actionBusy}>
                {actionBusy ? 'Processing...' : `🔒 Deposit ${fmt(gig.agreed_amount)} in Escrow`}
              </button>
            </div>
          )}

          {canConfirm && (
            <div className="card" style={{ background: 'var(--success-light)', border: '1.5px solid #86EFAC' }}>
              <h3 style={{ marginBottom: 8, color: 'var(--success)' }}>✅ Job Complete — Confirm & Pay</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                The worker has marked the job as complete. Confirm to release {fmt(Math.round((gig.agreed_amount||0)*0.9))} to their UPI account.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-success btn-lg" onClick={handleConfirm} disabled={actionBusy} style={{ flex: 2 }}>
                  {actionBusy ? 'Processing...' : `✅ Confirm & Release Payment`}
                </button>
                <button className="btn btn-danger" onClick={handleDispute} disabled={actionBusy} style={{ flex: 1 }}>
                  ⚠️ Dispute
                </button>
              </div>
            </div>
          )}

          {canReview && !showReview && (
            <button className="btn btn-secondary" onClick={() => setShowReview(true)}>
              ⭐ Leave a Review for the Worker
            </button>
          )}
        </div>

        {/* Review form */}
        {showReview && !reviewDone && (
          <form onSubmit={handleReview} className="card" style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Rate the Worker</h3>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Rating *</label>
              <StarRating value={reviewRating} onChange={setReviewRating} />
            </div>
            <div className="form-group">
              <label className="form-label">Comment (optional)</label>
              <textarea className="form-input" rows={3}
                placeholder="How was the work quality, punctuality, professionalism?"
                value={reviewText} onChange={e => setReviewText(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowReview(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={actionBusy} style={{ flex: 1 }}>
                {actionBusy ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </form>
        )}

        {reviewDone && (
          <div className="card" style={{ marginTop: 24, textAlign: 'center', background: 'var(--success-light)', border: '1px solid #86EFAC' }}>
            <p style={{ fontWeight: 600, color: 'var(--success)' }}>✅ Review submitted! Thank you for helping other hirers.</p>
          </div>
        )}
      </div>
    </div>
  );
}
