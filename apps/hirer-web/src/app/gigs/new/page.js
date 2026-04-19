'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as API from '../../../services/api';

const SKILL_LEVELS = ['beginner','intermediate','expert','master'];

const fieldLabel = {
  beginner:    '🟢 Beginner — basic tasks, entry level',
  intermediate:'🔵 Intermediate — standard work, 2+ years',
  expert:      '🟣 Expert — complex work, 5+ years',
  master:      '🟡 Master — specialist, certified',
};

export default function PostGigPage() {
  const [trades,  setTrades]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});
  const [success, setSuccess] = useState(null);
  const [locating, setLocating] = useState(false);
  const [mapPos, setMapPos] = useState([18.52, 73.85]);

  const [form, setForm] = useState({
    tradeSlug:          '',
    title:              '',
    description:        '',
    requiredSkillLevel: 'intermediate',
    address:            '',
    city:               '',
    pincode:            '',
    lat:                '',
    lng:                '',
    startDate:          '',
    startTime:          '',
    estimatedHours:     '',
    budgetMin:          '',
    budgetMax:          '',
    isUrgent:           false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('ks_token')) {
      window.location.href = '/auth/login'; return;
    }
    API.getTrades().then(r => setTrades(r.data.data)).catch(() => {});
  }, []);

  const set = (key, val) => { setForm(f => ({ ...f, [key]: val })); setErrors(e => ({ ...e, [key]: '' })); };

  const markerIcon = useMemo(() => (
    L.icon({
      iconUrl: '/locSymb.png',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    })
  ), []);

  const updateLatLng = (lat, lng) => {
    const latFixed = Number(lat).toFixed(6);
    const lngFixed = Number(lng).toFixed(6);
    set('lat', latFixed);
    set('lng', lngFixed);
    setMapPos([Number(latFixed), Number(lngFixed)]);
  };

  const handleDetectLocation = async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert('Location is not supported in this browser.');
      return;
    }

    setLocating(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;
      updateLatLng(latitude, longitude);

      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`
        );
        if (!resp.ok) throw new Error('Reverse geocode failed');
        const data = await resp.json();
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.county || '';
        const pincode = addr.postcode || '';
        const road = addr.road || addr.neighbourhood || addr.suburb || '';
        const house = addr.house_number || '';
        const street = [house, road].filter(Boolean).join(' ').trim();

        if (street) set('address', street);
        if (city) set('city', city);
        if (pincode) set('pincode', pincode);
      } catch (err) {
        // Non-blocking if reverse geocoding fails
      }
    } catch (err) {
      alert('Unable to fetch your location. Please allow location access and try again.');
    } finally {
      setLocating(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!form.tradeSlug)         e.tradeSlug    = 'Select a trade';
    if (!form.title.trim())      e.title        = 'Title is required';
    if (form.title.length < 5)   e.title        = 'Title must be at least 5 characters';
    if (!form.address.trim())    e.address      = 'Address is required';
    if (!form.city.trim())       e.city         = 'City is required';
    if (!form.startDate)         e.startDate    = 'Start date is required';
    const min = parseInt(form.budgetMin) * 100;
    const max = parseInt(form.budgetMax) * 100;
    if (!form.budgetMin || isNaN(min) || min < 100) e.budgetMin = 'Minimum budget must be ₹100 or more';
    if (!form.budgetMax || isNaN(max) || max < min)  e.budgetMax = 'Maximum must be ≥ minimum';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        tradeSlug:          form.tradeSlug,
        title:              form.title.trim(),
        description:        form.description.trim() || undefined,
        requiredSkillLevel: form.requiredSkillLevel,
        address:            form.address.trim(),
        city:               form.city.trim(),
        lat:                parseFloat(form.lat) || 18.52,
        lng:                parseFloat(form.lng) || 73.85,
        startDate:          form.startDate,
        startTime:          form.startTime || undefined,
        estimatedHours:     parseFloat(form.estimatedHours) || undefined,
        budgetMin:          Math.round(parseFloat(form.budgetMin) * 100),
        budgetMax:          Math.round(parseFloat(form.budgetMax) * 100),
        isUrgent:           form.isUrgent,
      };
      const { data } = await API.createGig(payload);
      setSuccess(data.data.id);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to post gig';
      setErrors({ _form: msg });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      setMapPos([lat, lng]);
    }
  }, [form.lat, form.lng]);

  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        updateLatLng(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  const MapRecenter = ({ position }) => {
    const map = useMap();
    useEffect(() => {
      if (position?.length === 2) {
        map.setView(position, map.getZoom(), { animate: true });
      }
    }, [map, position]);
    return null;
  };

  if (success) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 460, width: '100%', textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
        <h2 style={{ marginBottom: 8 }}>Gig Posted!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
          Your gig is now live. Matched workers will be notified instantly via WhatsApp.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`/gigs/${success}`} className="btn btn-primary">View Gig →</a>
          <a href="/gigs/new" className="btn btn-secondary">Post Another</a>
          <a href="/dashboard" className="btn btn-secondary">Dashboard</a>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <a href="/dashboard" style={{ fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>🔨 KaamSetu</a>
        <a href="/dashboard" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>← Dashboard</a>
      </nav>

      <div className="container" style={{ padding: '40px 24px', maxWidth: 720 }}>
        <h1 style={{ marginBottom: 6 }}>Post a Gig</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
          Verified workers near you will be notified immediately.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Trade */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16 }}>What work do you need done?</h3>

            <div className="form-group">
              <label className="form-label">Trade / Skill *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {trades.map(t => (
                  <button key={t.slug} type="button"
                    onClick={() => set('tradeSlug', t.slug)}
                    style={{
                      padding: '10px 12px', borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${form.tradeSlug === t.slug ? 'var(--primary)' : 'var(--border)'}`,
                      background: form.tradeSlug === t.slug ? 'var(--primary-light)' : 'var(--surface)',
                      color: form.tradeSlug === t.slug ? 'var(--primary)' : 'var(--text)',
                      fontWeight: form.tradeSlug === t.slug ? 700 : 400,
                      fontSize: 13, cursor: 'pointer', textAlign: 'left',
                    }}>
                    {t.name_en}
                    {t.name_hi && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{t.name_hi}</span>}
                  </button>
                ))}
              </div>
              {errors.tradeSlug && <p className="form-error">{errors.tradeSlug}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Job Title *</label>
              <input className={`form-input ${errors.title ? 'error' : ''}`}
                placeholder="e.g. Fix electrical wiring in 2BHK flat"
                value={form.title} onChange={e => set('title', e.target.value)} />
              {errors.title && <p className="form-error">{errors.title}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <textarea className="form-input" rows={3}
                placeholder="Describe the scope of work, materials needed, special requirements..."
                value={form.description} onChange={e => set('description', e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Skill Level Required</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {SKILL_LEVELS.map(level => (
                  <button key={level} type="button"
                    onClick={() => set('requiredSkillLevel', level)}
                    style={{
                      padding: '10px 14px', borderRadius: 'var(--radius-md)', textAlign: 'left',
                      border: `1.5px solid ${form.requiredSkillLevel === level ? 'var(--primary)' : 'var(--border)'}`,
                      background: form.requiredSkillLevel === level ? 'var(--primary-light)' : 'var(--surface)',
                      color: form.requiredSkillLevel === level ? 'var(--primary)' : 'var(--text)',
                      fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    }}>
                    {fieldLabel[level]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Where is the work?</h3>

            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Street Address *</label>
              </div>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={locating}
                  aria-label="Detect current location"
                  style={{
                    position: 'absolute',
                    left: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-alt)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                  title="Detect current location"
                >
                  <img
                    src="/locSymb.png"
                    alt=""
                    aria-hidden="true"
                    width="16"
                    height="16"
                    style={{ display: 'block' }}
                  />
                </button>
                <input
                  className={`form-input ${errors.address ? 'error' : ''}`}
                  style={{ paddingLeft: 50 }}
                  placeholder="Building name, street, area"
                  value={form.address}
                  onChange={e => set('address', e.target.value)}
                />
              </div>
              {errors.address && <p className="form-error">{errors.address}</p>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">City *</label>
                <input className={`form-input ${errors.city ? 'error' : ''}`}
                  placeholder="Pune" value={form.city} onChange={e => set('city', e.target.value)} />
                {errors.city && <p className="form-error">{errors.city}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Pincode</label>
                <input className="form-input" placeholder="411001" maxLength={6}
                  value={form.pincode} onChange={e => set('pincode', e.target.value.replace(/\D/g,''))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Latitude (optional)</label>
                <input className="form-input" placeholder="18.5204" type="number" step="0.0001"
                  value={form.lat} onChange={e => set('lat', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Longitude (optional)</label>
                <input className="form-input" placeholder="73.8567" type="number" step="0.0001"
                  value={form.lng} onChange={e => set('lng', e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  Drag the pin to set the exact location.
                </p>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleDetectLocation} disabled={locating}>
                  {locating ? 'Detecting…' : 'Use My Location'}
                </button>
              </div>
              <div style={{ height: 260, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <MapContainer center={mapPos} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapRecenter position={mapPos} />
                  <Marker
                    position={mapPos}
                    icon={markerIcon}
                    draggable
                    eventHandlers={{
                      dragend: (e) => {
                        const { lat, lng } = e.target.getLatLng();
                        updateLatLng(lat, lng);
                      },
                    }}
                  />
                  <MapClickHandler />
                </MapContainer>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
              Coordinates help us find workers closest to you. Leave blank to use city center.
            </p>
          </div>

          {/* Schedule */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16 }}>When?</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Start Date *</label>
                <input className={`form-input ${errors.startDate ? 'error' : ''}`}
                  type="date" value={form.startDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => set('startDate', e.target.value)} />
                {errors.startDate && <p className="form-error">{errors.startDate}</p>}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Start Time</label>
                <input className="form-input" type="time" value={form.startTime}
                  onChange={e => set('startTime', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Est. Hours</label>
                <input className="form-input" type="number" min={0.5} max={24} step={0.5}
                  placeholder="4" value={form.estimatedHours}
                  onChange={e => set('estimatedHours', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Budget */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 4 }}>Budget</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              Platform fee is 10%, paid by you. Workers receive 90% of agreed amount.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Minimum (₹) *</label>
                <div style={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${errors.budgetMin ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <span style={{ padding: '0 12px', color: 'var(--text-secondary)', background: 'var(--surface-alt)', height: 46, display: 'flex', alignItems: 'center', fontWeight: 600 }}>₹</span>
                  <input style={{ flex: 1, height: 46, padding: '0 12px', border: 'none', fontSize: 15, color: 'var(--text)', background: 'var(--surface)', outline: 'none' }}
                    type="number" min={100} placeholder="500"
                    value={form.budgetMin} onChange={e => set('budgetMin', e.target.value)} />
                </div>
                {errors.budgetMin && <p className="form-error">{errors.budgetMin}</p>}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Maximum (₹) *</label>
                <div style={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${errors.budgetMax ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <span style={{ padding: '0 12px', color: 'var(--text-secondary)', background: 'var(--surface-alt)', height: 46, display: 'flex', alignItems: 'center', fontWeight: 600 }}>₹</span>
                  <input style={{ flex: 1, height: 46, padding: '0 12px', border: 'none', fontSize: 15, color: 'var(--text)', background: 'var(--surface)', outline: 'none' }}
                    type="number" min={100} placeholder="1000"
                    value={form.budgetMax} onChange={e => set('budgetMax', e.target.value)} />
                </div>
                {errors.budgetMax && <p className="form-error">{errors.budgetMax}</p>}
              </div>
            </div>

            {/* Urgent toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--surface-alt)', border: '1.5px solid var(--border)' }}>
              <input type="checkbox" id="urgent" checked={form.isUrgent}
                onChange={e => set('isUrgent', e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--danger)', cursor: 'pointer' }} />
              <label htmlFor="urgent" style={{ cursor: 'pointer' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>⚡ Mark as Urgent</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Workers see urgent gigs first. Use for same-day or emergency jobs.
                </span>
              </label>
            </div>
          </div>

          {errors._form && (
            <div style={{ background: 'var(--danger-light)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 20, color: 'var(--danger)', fontSize: 14 }}>
              {errors._form}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <a href="/dashboard" className="btn btn-secondary" style={{ flex: 1, textAlign: 'center' }}>Cancel</a>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ flex: 2 }}>
              {loading ? 'Posting...' : '🚀 Post Gig & Notify Workers'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
