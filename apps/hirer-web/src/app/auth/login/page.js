'use client';
import React, { useState, useRef, useEffect } from 'react';
import * as API from '../../../services/api';

export default function LoginPage() {
  const [step,      setStep]     = useState('phone');
  const [phone,     setPhone]    = useState('');
  const [otp,       setOtp]      = useState(['','','','','','']);
  const [isNew,     setIsNew]    = useState(false);
  const [fullName,  setFullName] = useState('');
  const [sending,   setSending]  = useState(false);
  const [loading,   setLoading]  = useState(false);
  const [error,     setError]    = useState('');
  const [countdown, setCountdown]= useState(0);
  const timerRef = useRef(null);
  const otpRefs  = useRef([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('ks_token')) {
      window.location.href = '/dashboard';
    }
    return () => clearInterval(timerRef.current);
  }, []);

  const startTimer = () => {
    setCountdown(30);
    timerRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(timerRef.current); return 0; } return c - 1; });
    }, 1000);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone)) { setError('Enter a valid 10-digit Indian mobile number'); return; }
    setError(''); setSending(true);
    try {
      const { data } = await API.sendOTP(phone, 'hirer');
      setIsNew(data.data.isNewUser);
      setStep('otp');
      startTimer();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Try again.');
    } finally { setSending(false); }
  };

  const handleOTPChange = (val, idx) => {
    const clean = val.replace(/\D/g, '').slice(-1);
    const next  = [...otp]; next[idx] = clean; setOtp(next);
    if (clean && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!clean && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  const handleVerify = async (e) => {
    e?.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setError('Enter all 6 digits'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await API.verifyOTP(phone, code, 'hirer', fullName || undefined);
      API.storeTokens(data.data.token, data.data.refreshToken);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setSending(true);
    try { await API.sendOTP(phone, 'hirer'); startTimer(); setOtp(['','','','','','']); }
    catch { setError('Failed to resend OTP'); }
    finally { setSending(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'var(--primary)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 28, marginBottom: 16,
          }}>🔨</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)' }}>KaamSetu</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
            Hire verified blue-collar workers — no middlemen
          </p>
        </div>

        <div className="card">
          {step === 'phone' ? (
            <form onSubmit={handleSend}>
              <h2 style={{ marginBottom: 6 }}>Sign in</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
                Enter your mobile number to continue
              </p>

              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{
                    display: 'flex', alignItems: 'center', padding: '0 12px',
                    border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)',
                    fontSize: 15, color: 'var(--text-secondary)', background: 'var(--surface-alt)',
                  }}>+91</span>
                  <input
                    className={`form-input ${error ? 'error' : ''}`}
                    type="tel" inputMode="numeric" maxLength={10}
                    placeholder="9XXXXXXXXX" value={phone}
                    onChange={e => { setPhone(e.target.value.replace(/\D/g,'')); setError(''); }}
                    autoFocus
                  />
                </div>
                {error && <p className="form-error">{error}</p>}
              </div>

              <button type="submit" className="btn btn-primary w-full btn-lg"
                disabled={phone.length < 10 || sending}
                style={{ marginTop: 8 }}>
                {sending ? 'Sending OTP...' : 'Send OTP →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify}>
              <button type="button" onClick={() => setStep('phone')}
                style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14, marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Change number
              </button>

              <h2 style={{ marginBottom: 6 }}>Enter OTP</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
                Sent to +91 {phone}
              </p>

              {isNew && (
                <div className="form-group">
                  <label className="form-label">Your Name / Business Name</label>
                  <input className="form-input" placeholder="Ravi Constructions" value={fullName}
                    onChange={e => setFullName(e.target.value)} autoFocus />
                </div>
              )}

              {/* OTP boxes */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 24, justifyContent: 'center' }}>
                {otp.map((d, i) => (
                  <input key={i}
                    ref={el => otpRefs.current[i] = el}
                    type="tel" inputMode="numeric" maxLength={1}
                    value={d}
                    onChange={e => handleOTPChange(e.target.value, i)}
                    onKeyDown={e => e.key === 'Backspace' && !d && i > 0 && otpRefs.current[i-1]?.focus()}
                    style={{
                      width: 50, height: 58, textAlign: 'center',
                      fontSize: 22, fontWeight: 700,
                      border: `1.5px solid ${d ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text)', background: 'var(--surface)',
                    }}
                  />
                ))}
              </div>

              {error && <p className="form-error" style={{ textAlign: 'center', marginBottom: 16 }}>{error}</p>}

              <button type="submit" className="btn btn-primary w-full btn-lg"
                disabled={otp.join('').length < 6 || loading || (isNew && !fullName.trim())}>
                {loading ? 'Verifying...' : 'Verify & Continue →'}
              </button>

              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button type="button" onClick={handleResend}
                  disabled={countdown > 0 || sending}
                  style={{ fontSize: 14, fontWeight: 500, background: 'none', border: 'none', cursor: countdown > 0 ? 'default' : 'pointer',
                    color: countdown > 0 ? 'var(--text-tertiary)' : 'var(--primary)' }}>
                  {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 24 }}>
          By continuing you agree to KaamSetu's Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
