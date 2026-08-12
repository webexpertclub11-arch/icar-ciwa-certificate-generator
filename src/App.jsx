import React, { useState, useRef, useCallback, useEffect, Suspense, lazy } from 'react';
import LoginPage from './components/LoginPage';

const Certificate = lazy(() => import('./components/Certificate'));
const CertificateForm = lazy(() => import('./components/CertificateForm'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const UserDashboard = lazy(() => import('./components/UserDashboard'));
const SupportTicketPage = lazy(() => import('./components/SupportTicketPage'));
import { downloadCertificateAsPDF, printCertificate } from './utils/downloadCertificate';
import { initializeDB, recordDownloadToDB, checkCertificateLockStatus, fetchOrganizationsList, fetchSystemConfig } from './utils/dbTracker';
import { getCertificateSettings, isParticipantDownloadEnabled, checkDownloadWindowStatus, getParticipantPermissions, forceSetCertificateSettings } from './utils/certificateSettings';
import { initSecurityGuard } from './utils/securityGuard';

const USER_SESSION_KEY = 'icar_user_session_token';
const ADMIN_SESSION_KEY = 'icar_admin_session_token';
const TEN_MINUTES_MS = 10 * 60 * 1000; // 10 Minutes User Session Expiration

const saveUserSessionToken = (participantData) => {
  try {
    const tokenData = {
      role: 'user',
      loginTime: Date.now(),
      participant: participantData
    };
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(tokenData));
  } catch (e) {
    console.error("Failed to save user session token:", e);
  }
};

const saveAdminSessionToken = () => {
  try {
    const tokenData = {
      role: 'admin',
      loginTime: Date.now()
    };
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(tokenData));
  } catch (e) {
    console.error("Failed to save admin session token:", e);
  }
};

const clearUserSessionToken = () => {
  try { localStorage.removeItem(USER_SESSION_KEY); } catch (_) { }
};

const clearAdminSessionToken = () => {
  try { localStorage.removeItem(ADMIN_SESSION_KEY); } catch (_) { }
};

function App() {
  const [salutation, setSalutation] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [instituteName, setInstituteName] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Navigation & Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [userActiveTab, setUserActiveTab] = useState('dashboard'); // 'dashboard' or 'certificate'
  const [formStep, setFormStep] = useState('edit'); // 'edit' or 'preview'
  const [isAdminRestricted, setIsAdminRestricted] = useState(false);
  const [preEval, setPreEval] = useState(false);
  const [postEval, setPostEval] = useState(false);

  const [assignedSerialNumber, setAssignedSerialNumber] = useState('CIWA/2026/NOGRA/166');
  const [registeredName, setRegisteredName] = useState('');
  const [participantContact, setParticipantContact] = useState({});
  const [participantTrainingDates, setParticipantTrainingDates] = useState('');
  const [participantCategory, setParticipantCategory] = useState('');

  // Lock State & Immutability
  const [isLocked, setIsLocked] = useState(false);
  const [downloadTime, setDownloadTime] = useState(null);

  // Dynamic Certificate Settings (Director Signature, Name, Title)
  const [certSettings, setCertSettings] = useState(getCertificateSettings());

  // Anti-Screenshot Canvas Blur State
  const [isSecurityBlurred, setIsSecurityBlurred] = useState(false);

  // Interactive Zoom & Fullscreen Controls
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState(null);

  const certificateRef = useRef(null);
  const previewContainerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleLogin = useCallback(async (participant, shouldSaveToken = true) => {
    if (shouldSaveToken) {
      saveUserSessionToken(participant);
    }

    const pName = participant.name;
    const sNo = participant.serialNumber || 'CIWA/2026/NOGRA/166';

    setRegisteredName(pName);
    setAssignedSerialNumber(sNo);
    setParticipantTrainingDates(participant.trainingDates || '');
    setParticipantContact({
      email: participant.email,
      mobile: participant.mobile,
      wp: participant.wp
    });

    const lockRecord = await checkCertificateLockStatus(sNo, pName);
    const orgs = await fetchOrganizationsList();
    const getFullNameAndCategory = (short) => {
      if (!short) return { fullName: '', category: '', shortName: '', officialFullName: '' };
      const cleanTarget = short.trim().toLowerCase();

      // Match exact org by shortName or fullName (do NOT match by category alone)
      const org = orgs.find(o =>
        (o.shortName || '').trim().toLowerCase() === cleanTarget ||
        (o.fullName || '').trim().toLowerCase() === cleanTarget
      ) || orgs.find(o =>
        (o.shortName && cleanTarget.includes((o.shortName).trim().toLowerCase())) ||
        (o.fullName && cleanTarget.includes((o.fullName).trim().toLowerCase()))
      );

      if (org) {
        const catUpper = (org.category || '').toUpperCase();
        const useShortName = catUpper.includes('ICAR') || catUpper.includes('SAU') || catUpper.includes('CAU');
        return {
          fullName: useShortName ? (org.shortName || org.fullName) : (org.fullName || org.shortName),
          category: org.category,
          shortName: org.shortName || org.fullName,
          officialFullName: org.fullName || org.shortName
        };
      }
      return { fullName: short, category: '', shortName: short, officialFullName: short };
    };

    if (lockRecord) {
      const orgData = getFullNameAndCategory(lockRecord.kvkName || '');
      const zoneData = getFullNameAndCategory(lockRecord.atariZone || '');
      setSalutation(lockRecord.salutation || '');
      setParticipantName(lockRecord.certificateName || pName);
      setInstituteName(lockRecord.kvkName || orgData.fullName || '');
      setParticipantCategory(orgData.category || participant.category || '');
      setSelectedZone(lockRecord.atariZone || orgData.officialFullName || zoneData.fullName || '');
      setDownloadTime(lockRecord.downloadTime);
      setPreEval(lockRecord.preEval || false);
      setPostEval(lockRecord.postEval || false);

      if (lockRecord.isLocked) {
        setIsLocked(true);
        showToast('🔒 Locked Certificate Loaded: Previous issued certificate retrieved.', 'info');
      } else {
        setIsLocked(false);
        setFormStep('edit');
        showToast(`🔓 Unlocked Certificate Loaded: You can now edit your details.`, 'success');
      }
    } else {
      const orgData = getFullNameAndCategory(participant.instituteName || '');
      const zoneData = getFullNameAndCategory(participant.atariZone || '');
      setSalutation(''); // Fix: Clear salutation for new users
      setParticipantName(pName);
      if (participant.instituteName) {
        setInstituteName(participant.instituteName || orgData.fullName || '');
        setParticipantCategory(orgData.category || participant.category || '');
      }
      const activeCat = (orgData.category || participant.category || '').toUpperCase();
      if (activeCat.includes('CAU') || activeCat.includes('SAU')) {
        setSelectedZone(participant.atariZone || orgData.officialFullName || (activeCat.includes('CAU') ? 'Central Agricultural University' : 'State Agricultural University'));
      } else if (participant.atariZone) {
        setSelectedZone(participant.atariZone || zoneData.officialFullName || zoneData.fullName);
      }
      setPreEval(participant.preEval || false);
      setPostEval(participant.postEval || false);
      setIsLocked(false);
      setDownloadTime(null);
      setFormStep('edit');
      showToast(`Welcome ${pName}! Fill details to generate your certificate.`, 'success');
    }

    setCertSettings(getCertificateSettings());

    const permissions = getParticipantPermissions();
    const isSpecificallyRestricted = (participant.isRestricted === 1 || participant.isRestricted === true) || (permissions?.disabledSerials?.[sNo] || (participant.atariZone && permissions?.disabledZones?.[participant.atariZone]));
    const isAllowed = !isSpecificallyRestricted && isParticipantDownloadEnabled(sNo, participant.atariZone);
    setUserActiveTab(isSpecificallyRestricted ? 'support' : 'dashboard');
    setIsAdminRestricted(!!isSpecificallyRestricted);

    setIsLoggedIn(true);
  }, [showToast]);

  // Initialize DB table and settings after login to prevent unnecessary SQL calls on login page
  useEffect(() => {
    if (isLoggedIn || isAdminLoggedIn) {
      initializeDB().then(() => {
        fetchSystemConfig().then(config => {
          if (config) {
            forceSetCertificateSettings(config);
            setCertSettings(getCertificateSettings());
          }
        });
      });
    }
  }, [isLoggedIn, isAdminLoggedIn]);

  // Initialize security guard and check session tokens on mount
  useEffect(() => {
    setCertSettings(getCertificateSettings());

    const cleanupSecurity = initSecurityGuard(
      (msg, triggerBlur = false) => {
        showToast(msg, 'error');
        if (triggerBlur) {
          setIsSecurityBlurred(true);
          setTimeout(() => setIsSecurityBlurred(false), 3000);
        }
      },
      (shouldBlur) => {
        setIsSecurityBlurred(shouldBlur);
      }
    );

    // 1. Check Admin Session Token (Unlimited / Persistent until explicit Exit)
    try {
      const adminTokenRaw = localStorage.getItem(ADMIN_SESSION_KEY);
      if (adminTokenRaw) {
        const adminSession = JSON.parse(adminTokenRaw);
        if (adminSession && adminSession.role === 'admin') {
          setIsAdminLoggedIn(true);
          return () => { if (cleanupSecurity) cleanupSecurity(); };
        }
      }
    } catch (e) {
      console.warn("Notice restoring admin session token:", e);
    }

    // 2. Check User Session Token (10 Minutes Expiration Limit)
    try {
      const userTokenRaw = localStorage.getItem(USER_SESSION_KEY);
      if (userTokenRaw) {
        const userSession = JSON.parse(userTokenRaw);
        if (userSession && userSession.role === 'user' && userSession.participant) {
          const elapsedTime = Date.now() - (userSession.loginTime || 0);
          if (elapsedTime < TEN_MINUTES_MS) {
            handleLogin(userSession.participant, false);
            const remainingTime = TEN_MINUTES_MS - elapsedTime;
            const timer = setTimeout(() => {
              clearUserSessionToken();
              setIsLoggedIn(false);
              showToast('⏳ Session Expired: Your 10-minute session has ended. Please log in again.', 'info');
            }, remainingTime);

            return () => {
              clearTimeout(timer);
              if (cleanupSecurity) cleanupSecurity();
            };
          } else {
            clearUserSessionToken();
          }
        }
      }
    } catch (e) {
      console.warn("Notice restoring user session token:", e);
    }

    return () => {
      if (cleanupSecurity) cleanupSecurity();
    };
  }, [handleLogin, showToast]);

  const fullNameWithSalutation = participantName
    ? `${salutation ? salutation + ' ' : ''}${participantName}`
    : '';

  const handleOpenPasswordModal = useCallback(() => {
    setIsPasswordModalOpen(true);
  }, []);

  const handleAdminAuthSuccess = useCallback(() => {
    saveAdminSessionToken();
    setIsAdminLoggedIn(true);
  }, []);

  const handleExitAdmin = useCallback(() => {
    clearAdminSessionToken();
    setIsAdminLoggedIn(false);
    setCertSettings(getCertificateSettings());
  }, []);

  const handleLogout = useCallback(() => {
    clearUserSessionToken();
    setIsLoggedIn(false);
    setRegisteredName('');
    setParticipantName('');
    setSalutation(''); // Fix: Clear previous user's salutation
    setIsLocked(false);
    setFormStep('edit');
    setIsAdminRestricted(false);
    setPreEval(false);
    setPostEval(false);
  }, []);

  // Download PDF and immediately Lock Certificate
  const handleDownloadPDF = useCallback(async () => {
    const windowStatus = checkDownloadWindowStatus();
    if (!windowStatus.isActive) {
      showToast(`⛔ Downloads Suspended: ${windowStatus.reason}`, 'error');
      return;
    }

    if (!isParticipantDownloadEnabled(assignedSerialNumber || registeredName, selectedZone)) {
      showToast('⛔ Certificate download access has been disabled for your profile by Administrator.', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const payload = {
        registeredName,
        certificateName: participantName,
        salutation,
        email: participantContact.email,
        mobile: participantContact.mobile,
        wp: participantContact.wp,
        kvkName: instituteName,
        atariZone: selectedZone,
        serialNumber: assignedSerialNumber,
        preEval,
        postEval
      };

      await recordDownloadToDB(payload);

      const pdfDownloaded = await downloadCertificateAsPDF(certificateRef, fullNameWithSalutation || participantName);

      if (pdfDownloaded) {
        setIsLocked(false);
        const nowIso = new Date().toISOString();
        setDownloadTime(nowIso);
        showToast('🎉 Certificate Downloaded & Details Saved in ICAR Database!', 'success');
      } else {
        showToast('⚠️ Certificate download encountered an issue.', 'error');
      }
    } catch (err) {
      console.error("Download error:", err);
      alert("Download Error: " + err.message + "\\nPlease check console.");
      showToast('Failed to complete certificate download.', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [fullNameWithSalutation, registeredName, participantContact, participantName, salutation, assignedSerialNumber, instituteName, selectedZone, showToast]);

  const handlePrint = useCallback(() => {
    const windowStatus = checkDownloadWindowStatus();
    if (!windowStatus.isActive) {
      showToast(`⛔ Printing Suspended: ${windowStatus.reason}`, 'error');
      return;
    }

    if (!isParticipantDownloadEnabled(assignedSerialNumber || registeredName, selectedZone)) {
      showToast('⛔ Certificate printing has been disabled for your profile by Administrator.', 'error');
      return;
    }

    printCertificate(certificateRef);
  }, [assignedSerialNumber, registeredName, selectedZone, showToast]);

  const handleInspectCertificateFromAdmin = async (logItem) => {
    setRegisteredName(logItem.registeredName || '');
    setParticipantName(logItem.certificateName || logItem.registeredName || '');
    setSalutation(logItem.salutation || '');

    const orgs = await fetchOrganizationsList();
    const getFullNameAndCategory = (short) => {
      if (!short) return { fullName: '', category: '' };
      const org = orgs.find(o =>
        (o.shortName || '').toLowerCase() === short.toLowerCase() ||
        (o.name || '').toLowerCase() === short.toLowerCase() ||
        (o.fullName || '').toLowerCase() === short.toLowerCase()
      );
      return org ? { fullName: (org.fullName || org.name), category: org.category } : { fullName: short, category: '' };
    };

    const orgData = getFullNameAndCategory(logItem.kvkName || '');
    const zoneData = getFullNameAndCategory(logItem.atariZone || '');
    setInstituteName(logItem.kvkName || orgData.fullName || '');
    setParticipantCategory(orgData.category || '');
    setSelectedZone(logItem.atariZone || zoneData.fullName || '');
    setAssignedSerialNumber(logItem.serialNumber || '');
    setIsLocked(logItem.isLocked !== undefined ? logItem.isLocked : true);
    setDownloadTime(logItem.downloadTime);
    setCertSettings(getCertificateSettings());
    setIsAdminLoggedIn(false);
    setUserActiveTab('certificate');
    setIsLoggedIn(true);
    showToast(`Loaded Certificate for ${logItem.registeredName} in Generator Workspace.`, 'info');
  };

  // Zoom Control Actions
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.15, 2.0));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.15, 0.5));
  const handleZoomReset = () => setZoomLevel(1.0);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (previewContainerRef.current?.requestFullscreen) {
        previewContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Render Admin Dashboard View
  if (isAdminLoggedIn) {
    return (
      <Suspense fallback={<div className="app-layout"><div className="toast-notification toast-info"><span>Loading Admin Dashboard...</span></div></div>}>
        <AdminDashboard
          onExitAdmin={handleExitAdmin}
          onPreviewCertificate={handleInspectCertificateFromAdmin}
        />
      </Suspense>
    );
  }

  // Render Login Screen View
  if (!isLoggedIn) {
    return (
      <LoginPage onLogin={handleLogin} onAdminExport={handleAdminAuthSuccess} />
    );
  }

  // Render User Dashboard View if active tab is 'dashboard'
  if (userActiveTab === 'dashboard') {
    return (
      <Suspense fallback={<div className="app-layout"><div className="toast-notification toast-info"><span>Loading Dashboard...</span></div></div>}>
        <UserDashboard
          registeredName={registeredName}
          salutation={salutation}
          assignedSerialNumber={assignedSerialNumber}
          contactInfo={participantContact}
          isLocked={isLocked}
          downloadTime={downloadTime}
          onGoToCertificateWorkspace={() => setUserActiveTab('certificate')}
          onGoToSupport={() => setUserActiveTab('support')}
          onLogout={handleLogout}
          isAdminRestricted={isAdminRestricted}
          preEval={preEval}
          setPreEval={setPreEval}
          postEval={postEval}
          setPostEval={setPostEval}
        />
      </Suspense>
    );
  }

  // Render Support Ticket Page
  if (userActiveTab === 'support') {
    return (
      <Suspense fallback={<div className="app-layout"><div className="toast-notification toast-info"><span>Loading Support...</span></div></div>}>
        <SupportTicketPage
          assignedSerialNumber={assignedSerialNumber}
          registeredName={registeredName}
          contactInfo={participantContact}
          onExit={handleLogout}
          isAdminRestricted={isAdminRestricted}
        />
      </Suspense>
    );
  }

  // Render Certificate Generator Workspace View
  return (
    <div className="app-layout">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          <span>{toast.message}</span>
        </div>
      )}

      <Suspense fallback={<div className="toast-notification toast-info" style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 999 }}><span>Loading Form...</span></div>}>
        <CertificateForm
          salutation={salutation}
          setSalutation={setSalutation}
          participantName={participantName}
          setParticipantName={setParticipantName}
          instituteName={instituteName}
          setInstituteName={setInstituteName}
          selectedZone={selectedZone}
          setSelectedZone={setSelectedZone}
          formStep={formStep}
          setFormStep={setFormStep}
          onDownloadPDF={handleDownloadPDF}
          onPrint={handlePrint}
          isGenerating={isGenerating}
          isLocked={isLocked}
          downloadTime={downloadTime}
          registeredName={registeredName}
          onGoToDashboard={() => setUserActiveTab('dashboard')}
        />
      </Suspense>

      <main className="preview-area" ref={previewContainerRef}>
        {/* Simple Text Breadcrumb Toolbar */}
        <div className="preview-header">
          <div className="preview-title-group">
            <div className="simple-breadcrumb-nav">
              <span className="crumb-link" onClick={() => setUserActiveTab('dashboard')}>
                Dashboard
              </span>
              <span className="crumb-arrow">&gt;</span>
              <span className="crumb-current">Workspace</span>
            </div>

            <span className="serial-badge">SN: {assignedSerialNumber}</span>
          </div>

          {/* Controls toolbar */}
          <div className="toolbar-controls">
            <button className="control-btn" onClick={handleZoomOut} title="Zoom Out (-)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>
            <button className="control-btn zoom-indicator" onClick={handleZoomReset} title="Reset Zoom (100%)">
              {Math.round(zoomLevel * 100)}%
            </button>
            <button className="control-btn" onClick={handleZoomIn} title="Zoom In (+)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>
            <div className="control-sep"></div>
            <button className="control-btn" onClick={toggleFullscreen} title="Toggle Fullscreen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
            </button>
          </div>

          <div className="preview-badge">
            <span className={`badge ${isLocked ? 'badge-locked' : (participantName && instituteName ? 'badge-ready' : 'badge-draft')}`}>
              {isLocked ? '🔒 Locked & Issued' : (participantName && instituteName ? '✓ Ready' : '◯ Draft')}
            </span>
          </div>
        </div>

        {/* Scaled Preview Canvas Wrapper with Anti-Screenshot Blur Protection */}
        <div className="preview-content">
          <div
            className="certificate-zoom-viewport"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s ease-out',
              filter: isSecurityBlurred ? 'blur(50px)' : 'none',
              opacity: isSecurityBlurred ? 0.05 : 1
            }}
          >
            <Suspense fallback={<div style={{ padding: '20px' }}>Loading Certificate Canvas...</div>}>
              <Certificate
                ref={certificateRef}
                salutation={salutation}
                name={participantName}
                instituteName={instituteName}
                atariZone={selectedZone}
                serialNumber={assignedSerialNumber}
                trainingDates={participantTrainingDates}
                customSettings={certSettings}
                category={participantCategory}
              />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
