import React, { useState, useEffect } from 'react';
import './CertificateForm.css';
import { salutations } from '../data/certificateData';
import { checkDownloadWindowStatus, isParticipantDownloadEnabled } from '../utils/certificateSettings';
import { fetchOrganizationsList } from '../utils/dbTracker';

const CertificateForm = ({
  salutation,
  setSalutation,
  participantName,
  setParticipantName,
  instituteName,
  setInstituteName,
  selectedZone,
  setSelectedZone,
  formStep = 'edit',
  setFormStep,
  onDownloadPDF,
  onPrint,
  isGenerating,
  isLocked = false,
  downloadTime = null,
  registeredName = ''
}) => {
  const [atariZones, setAtariZones] = useState([]);
  const [settingsVersion, setSettingsVersion] = useState(0);

  useEffect(() => {
    fetchOrganizationsList().then(orgs => {
      const validOrgs = Array.isArray(orgs) ? orgs : [];
      const kvkCategories = Array.from(new Set(
        validOrgs
          .filter(o => o && o.category && typeof o.category === 'string' && o.category.startsWith('KVK'))
          .map(o => o.category)
      ));
      if (kvkCategories.length > 0) {
        setAtariZones(kvkCategories.map((cat, idx) => ({ id: idx + 1, name: cat, shortName: cat })));
      } else {
        const defaults = [
          "KVK, ATARI Zone I, Ludhiana",
          "KVK, ATARI Zone II, Jodhpur",
          "KVK, ATARI Zone III, Kanpur",
          "KVK, ATARI Zone IV, Patna",
          "KVK, ATARI Zone V, Kolkata",
          "KVK, ATARI Zone VI, Guwahati",
          "KVK, ATARI Zone VII, Umiam",
          "KVK, ATARI Zone VIII, Pune",
          "KVK, ATARI Zone IX, Jabalpur",
          "KVK, ATARI Zone X, Hyderabad",
          "KVK, ATARI Zone XI, Bengaluru"
        ];
        setAtariZones(defaults.map((cat, idx) => ({ id: idx + 1, name: cat, shortName: cat })));
      }
    });

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

  const windowStatus = checkDownloadWindowStatus();
  const isParticipantAllowed = isParticipantDownloadEnabled(registeredName || participantName, selectedZone);
  const isDownloadActive = windowStatus.isActive && isParticipantAllowed;

  return (
    <div className="crextio-form-card">
      {/* Header */}
      <div className="form-header">
        <h2>Certificate Workspace</h2>
        <p className="form-subtitle">ICAR-CIWA Training Programme 2026</p>

        {/* Lock Banner if locked */}
        {isLocked && (
          <div className="lock-notice-banner">
            <div className="lock-banner-header">
              <span className="lock-icon">🔒</span>
              <span className="lock-title">Official Issued Certificate</span>
            </div>
            <p className="lock-desc">
              Your certificate details are finalized and locked in the ICAR database.
            </p>
            {downloadTime && (
              <small className="lock-timestamp">
                Issued on: {new Date(downloadTime).toLocaleString()}
              </small>
            )}
          </div>
        )}

        {/* Closed Download Window Banner if schedule/admin turned OFF */}
        {!windowStatus.isActive && (
          <div className="closed-notice-banner">
            <div className="lock-banner-header">
              <span className="lock-icon">⛔</span>
              <span className="lock-title">Downloads Suspended</span>
            </div>
            <p className="lock-desc">{windowStatus.reason}</p>
          </div>
        )}
      </div>

      {/* Form Body */}
      <div className="form-body">
        {isLocked ? (
          /* LOCKED VIEW USER SUMMARY */
          <div className="locked-user-summary-card">
            <div className="summary-status-header">
              <span className="gold-seal-badge">Verified ICAR Record</span>
            </div>
            <div className="summary-fields-list">
              <div className="summary-field">
                <span className="lbl">Participant:</span>
                <strong className="val">{salutation ? salutation + ' ' : ''}{participantName}</strong>
              </div>
              <div className="summary-field">
                <span className="lbl">KVK / Institute:</span>
                <span className="val">{instituteName}</span>
              </div>
            </div>
          </div>
        ) : (
          /* UNLOCKED / NEW GENERATION WORKFLOW */
          <>
            {/* Step Progress Indicator */}
            <div className="step-progress-bar">
              <div
                className={`step-item ${formStep === 'edit' ? 'active-step' : 'completed-step'}`}
                onClick={() => setFormStep('edit')}
                style={{ cursor: 'pointer' }}
              >
                <span className="step-num">1</span>
                <span className="step-lbl">Fill Details</span>
              </div>

              <div className="step-connector"></div>

              <div className={`step-item ${formStep === 'preview' ? 'active-step' : ''}`}>
                <span className="step-num">2</span>
                <span className="step-lbl">Preview & Confirm</span>
              </div>
            </div>

            {/* STEP 1: FORM INPUTS */}
            {formStep === 'edit' ? (
              <div className="step-1-form-inputs animate-fade">
                {/* Salutation + Participant Name */}
                <div className="form-group">
                  <label htmlFor="name-combobox-input">Participant Name</label>
                  <div className="name-input-row">
                    <div className="select-wrapper salutation-select-wrapper">
                      <select
                        id="salutation-select"
                        value={salutation}
                        onChange={(e) => setSalutation(e.target.value)}
                        disabled={!windowStatus.isActive}
                        title="Select Salutation"
                      >
                        <option value="">Salutation</option>
                        {salutations.map((sal, index) => (
                          <option key={index} value={sal}>
                            {sal}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="searchable-combobox-wrapper">
                      <input
                        id="name-combobox-input"
                        type="text"
                        className="combobox-input"
                        placeholder="Enter participant name..."
                        value={participantName}
                        onChange={(e) => setParticipantName(e.target.value)}
                        disabled={!windowStatus.isActive}
                      />
                    </div>
                  </div>
                </div>

                {/* Institute / KVK Name Field */}
                <div className="form-group mt-12">
                  <label htmlFor="institute-input">
                    KVK / Institute Name 🔒 <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>(Assigned by Admin)</span>
                  </label>
                  <input
                    type="text"
                    id="institute-input"
                    value={instituteName}
                    readOnly
                    disabled
                    placeholder="KVK / Institute Name"
                    style={{ background: '#f8fafc', cursor: 'not-allowed', opacity: 0.85 }}
                    title="KVK / Institute Name is registered by Admin and cannot be updated"
                  />
                </div>
              </div>
            ) : (
              /* STEP 2: PREVIEW SUMMARY & CONFIRMATION */
              <div className="step-2-preview-summary animate-fade">
                <div className="preview-confirmation-card">
                  <h4>👁️ Certificate Preview Summary</h4>
                  <p className="card-sub-text">Please review your details before generating your final certificate:</p>

                  <div className="summary-fields-list mt-8">
                    <div className="summary-field">
                      <span className="lbl">Name:</span>
                      <strong className="val">{salutation ? salutation + ' ' : ''}{participantName}</strong>
                    </div>
                    <div className="summary-field">
                      <span className="lbl">KVK / Institute:</span>
                      <span className="val">{instituteName}</span>
                    </div>
                  </div>

                  <p className="lock-warning-text mt-8">
                    ⚠️ <strong>Note:</strong> Downloading your certificate will lock these details in the ICAR database.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="form-actions">
        {isLocked ? (
          /* LOCKED VIEW ACTIONS */
          <>
            <button
              className="btn-crextio-gold width-100"
              onClick={onDownloadPDF}
              disabled={isGenerating || !isDownloadActive}
            >
              {isGenerating ? (
                <>
                  <span className="spinner dark-spinner"></span>
                  Generating High-Res PDF...
                </>
              ) : !isDownloadActive ? (
                <>
                  <span>⛔ Downloads Suspended by Admin</span>
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>Download Official PDF Copy</span>
                </>
              )}
            </button>

            <button
              className="btn-crextio-outline width-100"
              onClick={onPrint}
              disabled={!isDownloadActive}
            >
              {!isDownloadActive ? (
                '⛔ Printing Suspended by Admin'
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                  <span>Print Copy</span>
                </>
              )}
            </button>
          </>
        ) : (
          /* NEW CERTIFICATE STEP-BY-STEP ACTIONS */
          <>
            {formStep === 'edit' ? (
              <button
                className="btn-crextio-gold width-100"
                onClick={() => setFormStep('preview')}
                disabled={!participantName || !instituteName || !isDownloadActive}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>Preview Certificate Canvas →</span>
              </button>
            ) : (
              <>
                <button
                  className="btn-crextio-gold width-100"
                  onClick={onDownloadPDF}
                  disabled={isGenerating || !isDownloadActive}
                >
                  {isGenerating ? (
                    <>
                      <span className="spinner dark-spinner"></span>
                      Generating & Locking PDF...
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      <span>Confirm & Download Official PDF</span>
                    </>
                  )}
                </button>

                <button
                  className="btn-crextio-outline width-100"
                  onClick={() => setFormStep('edit')}
                >
                  ← Edit Input Details
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="form-footer">
        <p className="footer-title">ICAR-Central Institute for Women in Agriculture</p>
        <p className="footer-sub">Bhubaneswar, Odisha</p>
      </div>
    </div>
  );
};

export default CertificateForm;
