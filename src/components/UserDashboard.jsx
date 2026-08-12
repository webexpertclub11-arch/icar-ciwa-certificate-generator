import React, { useState, useEffect } from 'react';
import './UserDashboard.css';
import icarLogo from '../assets/icarlogoright.gif';
import { getAnnouncements } from '../utils/trainingAnnouncements';
import { checkDownloadWindowStatus, isParticipantDownloadEnabled } from '../utils/certificateSettings';

const USER_SESSION_KEY = 'icar_user_session_token';
const TEN_MINUTES_MS = 10 * 60 * 1000;

const UserDashboard = ({
  registeredName,
  salutation,
  assignedSerialNumber,
  contactInfo,
  isLocked,
  downloadTime,
  onGoToCertificateWorkspace,
  onGoToSupport,
  onLogout,
  isAdminRestricted,
  preEval,
  setPreEval,
  postEval,
  setPostEval
}) => {
  const [announcements, setAnnouncements] = useState([]);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(600);
  const [evalModalMessage, setEvalModalMessage] = useState(null);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      setAnnouncements(await getAnnouncements());
    };
    fetchAnnouncements();

    const handleSettingsUpdate = () => {
      setSettingsVersion(v => v + 1);
    };
    window.addEventListener('icar_settings_updated', handleSettingsUpdate);
    window.addEventListener('storage', handleSettingsUpdate);
    return () => {
      window.removeEventListener('icar_settings_updated', handleSettingsUpdate);
      window.removeEventListener('storage', handleSettingsUpdate);
    };
  }, []);

  // Live 10-Minute Session Countdown Timer
  useEffect(() => {
    const updateTimer = () => {
      try {
        const rawToken = localStorage.getItem(USER_SESSION_KEY);
        if (rawToken) {
          const sessionData = JSON.parse(rawToken);
          if (sessionData && sessionData.loginTime) {
            const elapsed = Date.now() - sessionData.loginTime;
            const remaining = Math.max(0, Math.floor((TEN_MINUTES_MS - elapsed) / 1000));
            setRemainingSeconds(remaining);

            if (remaining <= 0 && onLogout) {
              onLogout();
            }
            return;
          }
        }
      } catch (e) {
        console.warn("Session timer error:", e);
      }
      setRemainingSeconds(600);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [onLogout]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const windowStatus = checkDownloadWindowStatus();
  const isDownloadAllowed = !isAdminRestricted && isParticipantDownloadEnabled(assignedSerialNumber);

  // Prevent duplicate "Dr. Dr." prefix if registered name already starts with Dr.
  const cleanRegistered = (registeredName || '').trim();
  const hasDrInName = cleanRegistered.toLowerCase().startsWith('dr.') || cleanRegistered.toLowerCase().startsWith('dr ');
  const effectiveSalutation = (salutation === 'Dr.' && hasDrInName) ? '' : salutation;
  const fullName = cleanRegistered ? `${effectiveSalutation ? effectiveSalutation + ' ' : ''}${cleanRegistered}` : 'Participant';

  return (
    <div className="user-dashboard-container">
      {/* Top Executive Sticky Header */}
      <header className="user-header-pill">
        <div className="header-brand-box">
          <div className="brand-logo-circle">
            <img src={icarLogo} alt="ICAR Seal" className="brand-logo-img" />
          </div>
          <div className="brand-text-col">
            <span className="brand-title-text">ICAR-CIWA Portal</span>
            <span className="brand-subtitle-text">National Training 2026</span>
          </div>
        </div>

        {/* Navigation Tabs Pill Bar */}
        <nav className="header-nav-pills">
          <button className="nav-pill-btn active">
            📊 Dashboard
          </button>
          {!isDownloadAllowed ? (
            <button className="nav-pill-btn" onClick={onGoToSupport}>
              ⚠️ Contact Support
            </button>
          ) : (
            <button className="nav-pill-btn" onClick={onGoToCertificateWorkspace}>
              📜 My Certificate
            </button>
          )}
        </nav>

        {/* User Info & Action Group */}
        <div className="user-profile-badge-group">
          <div className="user-pill-info">
            <span className="user-name-text">👤 {fullName}</span>
          </div>
          <div className="nav-pill-timer" title="Live 10-minute session countdown timer">
            <span>⏱️</span>
            <span className="timer-countdown-val">{formatTimer(remainingSeconds)}</span>
          </div>
          <button className="icon-pill-btn btn-exit-pill" onClick={onLogout} title="Logout">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="user-main-content">

        {/* Welcome Hero Greeting Row */}
        <div className="title-section-row">
          <div>
            <h1 className="hero-greeting-title">Welcome, {fullName}! 👋</h1>
            <p className="subtitle-text">Manage your training profile, view updates, and generate official certificates.</p>
          </div>
        </div>

        {/* Hero Card Banner */}
        <div className="user-hero-card">
          <div className="hero-text-content">
            <span className="hero-tag-badge">🏛️ ICAR-Central Institute for Women in Agriculture</span>
            <h2 className="hero-heading-main">National Training Programme 2026</h2>
            <p className="hero-desc-text">
              Capacity building and gender perspective in agricultural research. Access your verified certificate and official training resources.
            </p>

            {!isDownloadAllowed && (
              <div className="restriction-alert-box">
                <span>⛔ Certificate generation/download for your profile is currently restricted by the Administrator.</span>
              </div>
            )}

            <div className="hero-action-row">
              <div className={`lock-status-chip ${!isDownloadAllowed ? 'status-suspended' : isLocked ? 'status-locked' : 'status-active'}`}>
                <span className="chip-dot"></span>
                <span>{!isDownloadAllowed ? '🔴 Access Suspended' : isLocked ? '🔒 Certificate Issued & Locked' : '🟢 Ready for Download'}</span>
              </div>
            </div>
          </div>

          <div className="hero-badge-box">
            <img src={icarLogo} alt="ICAR Seal" className="hero-seal-img" />
          </div>
        </div>

        {/* Analytics & Metrics Cards Grid (2 Columns: Identity Verification & Download Window) */}
        <div className="user-metrics-grid">
          <div className="user-metric-card">
            <div className="card-top">
              <span className="card-label">Identity Verification</span>
              <span className="card-badge badge-blue">Verified</span>
            </div>
            <div className="card-value">OTP ✓</div>
            <div className="card-footer-text">Two-Factor Security Confirmed</div>
          </div>

          <div className="user-metric-card">
            <div className="card-top">
              <span className="card-label">Download Window</span>
              <span className={`card-badge ${windowStatus.isActive ? 'badge-emerald' : 'badge-amber'}`}>
                {windowStatus.isActive ? 'Active' : 'Closed'}
              </span>
            </div>
            <div className="card-value">{windowStatus.isActive ? 'OPEN' : 'CLOSED'}</div>
            <div className="card-footer-text">Admin Schedule Window Status</div>
          </div>
        </div>

        {/* Main Grid: Announcements + Certificate Workspace Card */}
        <div className="user-dashboard-grid">

          {/* Left Column: Live Announcements Feed */}
          <div className="user-card user-feed-card">
            <div className="card-header-flex">
              <div>
                <h3>📢 Live Training Updates & Announcements</h3>
                <p className="card-sub-title">Official circulars, schedules, and guidelines</p>
              </div>
              <span className="feed-count-badge">{announcements.length} Posts</span>
            </div>

            <div className="user-announcements-list">
              {announcements.length > 0 ? (
                announcements.map((item) => (
                  <div key={item.id} className="user-announcement-item">
                    <div className="item-top-row">
                      <span className={`status-pill-ann ${item.status === 'live' ? 'pill-live' : 'pill-done'}`}>
                        {item.status === 'live' ? '🟢 LIVE NOW' : '✓ COMPLETED'}
                      </span>
                      <small className="date-text">{new Date(item.date).toLocaleDateString()}</small>
                    </div>
                    <h4 className="ann-title">{item.title}</h4>
                    <p className="ann-desc">{item.description}</p>
                  </div>
                ))
              ) : (
                <p className="empty-msg">No live announcements posted currently.</p>
              )}
            </div>
          </div>

          {/* Right Column: Certificate Access Card */}
          <div className="user-card user-cert-cta-card">
            <div>
              <div className="card-header-flex" style={{ marginBottom: '14px' }}>
                <div>
                  <h3>📜 My Training Certificate</h3>
                  <p className="card-sub-title">Assigned Serial Number & Verification</p>
                </div>
              </div>

              <div className="cert-details-box">
                <div className="detail-item-row">
                  <span className="label">Participant Name:</span>
                  <strong className="val">{fullName}</strong>
                </div>

                <div className="detail-item-row">
                  <span className="label">Serial Number:</span>
                  <code className="val-serial">{assignedSerialNumber || 'CIWA/2026/NOGRA/...'}</code>
                </div>

                <div className="detail-item-row">
                  <span className="label">Lock Status:</span>
                  <span className={`status-pill-ann ${isLocked ? 'pill-locked' : 'pill-open'}`}>
                    {isLocked ? '🔒 Locked & Saved' : '⏳ Pending Download'}
                  </span>
                </div>

                {downloadTime && (
                  <div className="detail-item-row">
                    <span className="label">Issued Date:</span>
                    <span className="val-time">{new Date(downloadTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })} IST</span>
                  </div>
                )}
              </div>

              {!isLocked && isDownloadAllowed && (
                <div className="eval-checks-box" style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1e293b' }}>Required Evaluation Forms</p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', marginBottom: '4px', cursor: 'pointer', color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={preEval}
                      onChange={async (e) => {
                        const val = e.target.checked;
                        setPreEval(val);
                        const { updateParticipantRecord } = await import('../utils/dbTracker');
                        updateParticipantRecord(null, { serialNumber: assignedSerialNumber, preEval: val, postEval });
                      }}
                    />
                    Did you submit Pre Evaluation?
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', cursor: 'pointer', color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={postEval}
                      onChange={async (e) => {
                        const val = e.target.checked;
                        setPostEval(val);
                        const { updateParticipantRecord } = await import('../utils/dbTracker');
                        updateParticipantRecord(null, { serialNumber: assignedSerialNumber, preEval, postEval: val });
                      }}
                    />
                    Did you submit Post Evaluation?
                  </label>
                </div>
              )}
            </div>

            <div className="cta-box-bottom" style={{ marginTop: '16px' }}>
              {!isDownloadAllowed ? (
                <button className="btn-user-primary width-100" style={{ backgroundColor: '#ef4444' }} onClick={onGoToSupport}>
                  ⚠️ Contact Admin to Unlock Access
                </button>
              ) : (
                <button className="btn-user-primary width-100" onClick={(e) => {
                  if (!isLocked && (!preEval || !postEval)) {
                    if (!preEval && !postEval) {
                      setEvalModalMessage('Please submit both the Pre Evaluation and Post Evaluation forms to unlock your certificate download.');
                    } else if (!preEval) {
                      setEvalModalMessage('Please submit the Pre Evaluation form to unlock your certificate download.');
                    } else if (!postEval) {
                      setEvalModalMessage('Please submit the Post Evaluation form to unlock your certificate download.');
                    }
                    return;
                  }
                  onGoToCertificateWorkspace();
                }}>
                  {isLocked ? '📜 View / Download Official PDF' : '🎓 Generate My Certificate Now →'}
                </button>
              )}
            </div>
          </div>

        </div>

      </main>

      {/* Glassmorphism Evaluation Alert Modal */}
      {evalModalMessage && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'evalModalBg 0.3s ease-out'
        }}>
          <style>{`
            @keyframes evalModalBg { from { opacity: 0; } to { opacity: 1; } }
            @keyframes evalModalSlide { from { opacity: 0; transform: translateY(-20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
          `}</style>
          <div style={{
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15), inset 0 0 0 1px rgba(255,255,255,0.7)',
            padding: '36px', borderRadius: '24px', maxWidth: '420px', width: '90%',
            textAlign: 'center',
            position: 'relative',
            animation: 'evalModalSlide 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{
              fontSize: '54px', marginBottom: '12px', display: 'inline-block',
              filter: 'drop-shadow(0 8px 16px rgba(245, 158, 11, 0.4))',
              lineHeight: '1'
            }}>
              ⚠️
            </div>
            <h3 style={{ margin: '0 0 12px 0', color: '#1e293b', fontSize: '20px', fontWeight: '700', letterSpacing: '-0.3px' }}>Action Required</h3>
            <p style={{ margin: '0 0 28px 0', color: '#475569', fontSize: '15px', lineHeight: '1.6', fontWeight: '500' }}>
              {evalModalMessage}
            </p>
            <button
              style={{
                background: 'linear-gradient(to right, #047857, #065f46)',
                color: '#fff', border: 'none', padding: '12px 24px',
                borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '600',
                transition: 'all 0.2s ease', width: '100%',
                boxShadow: '0 4px 12px rgba(4, 120, 87, 0.2)'
              }}
              onClick={() => setEvalModalMessage(null)}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(4, 120, 87, 0.3)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(4, 120, 87, 0.2)'; }}
            >
              I Understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
