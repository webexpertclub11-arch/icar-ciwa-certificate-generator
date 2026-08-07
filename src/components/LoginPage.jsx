import React, { useState, useEffect } from 'react';
import './LoginPage.css';
import icarLogo from '../assets/icarlogoright.gif';
import ciwaLogo from '../assets/leftsidelogo.png';
import { fetchParticipantsList, fetchParticipantsFromDB } from '../utils/dbTracker';
import { verifyAdminPassword } from '../utils/adminAuth';
import { isParticipantDownloadEnabled } from '../utils/certificateSettings';
const LoginPage = ({ onLogin, onAdminExport }) => {
    // Role toggle: 'user' | 'admin'
    const [activeRole, setActiveRole] = useState('user');

    // Participant State
    const [selectedId, setSelectedId] = useState('');
    const [searchName, setSearchName] = useState('');
    const [email, setEmail] = useState('');
    const [mobile, setMobile] = useState('');
    const [wp, setWp] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [participantsList, setParticipantsList] = useState([]);

    // Admin Password State
    const [adminPassword, setAdminPassword] = useState('');
    const [adminError, setAdminError] = useState('');
    const [showAdminPassword, setShowAdminPassword] = useState(false);

    // Load participants on mount & fetch asynchronously from Database for fresh browser sessions
    useEffect(() => {
        // 1. Instant load from LocalStorage cache
        setParticipantsList(fetchParticipantsList());

        // 2. Async fetch directly from Database for immediate update on fresh browser load
        fetchParticipantsFromDB().then(list => {
            if (list && list.length > 0) {
                setParticipantsList(list);
            }
        });

        // 3. Listen for DB initialization event
        const handleDbInit = (e) => {
            if (e.detail && Array.isArray(e.detail) && e.detail.length > 0) {
                setParticipantsList(e.detail);
            } else {
                setParticipantsList(fetchParticipantsList());
            }
        };

        window.addEventListener('icar_db_initialized', handleDbInit);
        return () => window.removeEventListener('icar_db_initialized', handleDbInit);
    }, []);


    const normalizeString = (str) => (str || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

    // Filter participants for dropdown
    const filteredParticipants = (participantsList || []).filter(p => {
        if (!p || !p.name || typeof p.name !== 'string') return false;
        const normalizedSearch = normalizeString(searchName);
        if (!normalizedSearch) return true; // Show all if search is effectively empty
        return normalizeString(p.name).includes(normalizedSearch);
    });

    const handleRoleSwitch = (role) => {
        setActiveRole(role);
        setAdminError('');
        setAdminPassword('');
    };

    const handleSelectParticipant = (p) => {
        setSearchName(p ? p.name : '');
        setSelectedId(p ? p.id : '');
        setIsDropdownOpen(false);
    };

    const handleNameChange = (e) => {
        const value = e.target.value;
        setSearchName(value);
        setIsDropdownOpen(true);
        const normalizedValue = normalizeString(value);
        const participant = (participantsList || []).find(p => {
            if (!p || !p.name || typeof p.name !== 'string') return false;
            return normalizeString(p.name) === normalizedValue;
        });
        if (participant && normalizedValue !== '') {
            setSelectedId(participant.id);
        } else {
            setSelectedId('');
        }
    };

    const handleLoginSubmit = (e) => {
        e.preventDefault();
        if (!selectedId || !searchName) {
            alert("Please search and select your registered participant name.");
            return;
        }

        if (!email) {
            alert("Please enter email address.");
            return;
        }

        const cleanMobile = (mobile || '').trim();
        const cleanWp = (wp || '').trim();

        if (!cleanMobile) {
            alert("Mobile Number is mandatory.");
            return;
        }

        if (!/^\d{10}$/.test(cleanMobile)) {
            alert("Mobile Number must be an integer containing exactly 10 digits.");
            return;
        }

        if (!cleanWp) {
            alert("WhatsApp Number is mandatory.");
            return;
        }

        if (!/^\d{10}$/.test(cleanWp)) {
            alert("WhatsApp Number must be an integer containing exactly 10 digits.");
            return;
        }

        const participant = participantsList.find(p => p.id === selectedId);
        if (!participant) {
            alert("Selected participant not found.");
            return;
        }

        onLogin({
            ...participant,
            email,
            mobile,
            wp
        });
    };

    const handleAdminSubmit = async (e) => {
        e.preventDefault();
        if (!adminPassword.trim()) {
            setAdminError('Please enter admin password');
            return;
        }

        const isValid = await verifyAdminPassword(adminPassword.trim());
        if (isValid) {
            setAdminError('');
            if (onAdminExport) {
                onAdminExport();
            }
        } else {
            setAdminError('Incorrect Admin Password');
        }
    };

    return (
        <div className="login-container">
            {/* Ambient Background Glow Orbs */}
            <div className="bg-glow orb-1"></div>
            <div className="bg-glow orb-2"></div>
            <div className="bg-glow orb-3"></div>

            <div className="login-card glass-effect">
                {/* Header Section */}
                <div className="login-header">
                    <div className="brand-logos">
                        <img src={ciwaLogo} alt="CIWA Logo" className="brand-logo left" />
                        <div className="brand-divider"></div>
                        <img src={icarLogo} alt="ICAR Logo" className="brand-logo right" />
                    </div>
                    <h2>ICAR-CIWA Certificate Portal</h2>
                    <p className="login-subtitle">
                        {activeRole === 'admin'
                            ? '🛡️ Admin Dashboard — Manage certificate records, participant roster & live analytics'
                            : '🎓 Participant Portal — Select your name & verify details to download certificate'}
                    </p>

                    {/* Role Toggle — Smooth Glassmorphism Sliding Capsule */}
                    <div className="role-toggle-wrapper">
                        <div className="role-toggle-track glass-toggle-track">
                            {/* Animated sliding background */}
                            <div className={`role-toggle-slider ${activeRole === 'user' ? 'slide-user' : 'slide-admin'}`}></div>

                            <button
                                type="button"
                                className={`role-toggle-btn ${activeRole === 'user' ? 'active-role' : ''}`}
                                onClick={() => handleRoleSwitch('user')}
                                title="Click to login as Participant and download certificate"
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                                <span>Participant Login</span>
                            </button>

                            <button
                                type="button"
                                className={`role-toggle-btn ${activeRole === 'admin' ? 'active-role' : ''}`}
                                onClick={() => handleRoleSwitch('admin')}
                                title="Click to access Admin Dashboard & Analytics"
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                <span>Admin Dashboard</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Participant Mode Forms */}
                {activeRole === 'user' && (
                    <>
                        {/* Info Form */}
                        <form onSubmit={handleLoginSubmit} className="login-form animate-fade">
                            <div className="login-form-group">
                                <label>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    Registered Participant Name
                                </label>
                                <div className="custom-dropdown-container">
                                    <input
                                        type="text"
                                        placeholder="Search or select your name..."
                                        value={searchName}
                                        onChange={handleNameChange}
                                        onFocus={() => setIsDropdownOpen(true)}
                                        onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                        required
                                        className="custom-dropdown-input"
                                    />
                                    <div className="custom-dropdown-arrow">&#9662;</div>

                                    {isDropdownOpen && (
                                        <ul className="custom-dropdown-list">
                                            {filteredParticipants.length > 0 ? (
                                                filteredParticipants.map((p) => (
                                                    <li
                                                        key={p.id}
                                                        onMouseDown={(e) => { e.preventDefault(); handleSelectParticipant(p); }}
                                                        onTouchStart={(e) => { e.preventDefault(); handleSelectParticipant(p); }}
                                                        onClick={() => handleSelectParticipant(p)}
                                                    >
                                                        <span className="participant-name-text">{p.name}</span>
                                                    </li>
                                                ))
                                            ) : (
                                                <li className="custom-dropdown-empty">No matching active registered names found</li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            <div className="login-form-group">
                                <label>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="e.g. participant@icar.org.in"
                                    required
                                />
                            </div>

                            <div className="input-row-grid">
                                <div className="login-form-group">
                                    <label>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                        Mobile Number *
                                    </label>
                                    <input
                                        type="tel"
                                        value={mobile}
                                        onChange={(e) => {
                                            const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                                            setMobile(digits);
                                        }}
                                        placeholder="10-digit mobile number"
                                        maxLength={10}
                                        required
                                    />
                                </div>

                                <div className="login-form-group">
                                    <label>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                        WhatsApp Number *
                                    </label>
                                    <input
                                        type="tel"
                                        value={wp}
                                        onChange={(e) => {
                                            const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                                            setWp(digits);
                                        }}
                                        placeholder="10-digit WhatsApp number"
                                        maxLength={10}
                                        required
                                    />
                                </div>
                            </div>

                            <button type="submit" className="btn-login">
                                Proceed to Certificate Workspace
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            </button>
                        </form>

                    </>
                )}

                {/* Inline Admin Mode Form inside Claymorphism Window */}
                {activeRole === 'admin' && (
                    <form onSubmit={handleAdminSubmit} className="login-form animate-fade admin-inline-form">
                        <div className="admin-badge-banner glass-admin-banner">
                            <span className="admin-lock-badge-icon">🛡️</span>
                            <div className="admin-badge-text">
                                <strong>Admin Portal Login</strong>
                                <small>Enter administrator password to access live metrics, participant roster & certificate downloads</small>
                            </div>
                        </div>

                        <div className="login-form-group">
                            <label>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                Master Admin Password
                            </label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showAdminPassword ? "text" : "password"}
                                    placeholder="Enter administrator password..."
                                    value={adminPassword}
                                    onChange={(e) => {
                                        setAdminPassword(e.target.value);
                                        if (adminError) setAdminError('');
                                    }}
                                    required
                                    autoFocus
                                    className={adminError ? 'input-error-border' : ''}
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                                    title={showAdminPassword ? "Hide password" : "Show password"}
                                >
                                    {showAdminPassword ? '👁️' : '👁️‍🗨️'}
                                </button>
                            </div>
                        </div>

                        {adminError && (
                            <div className="otp-error-msg admin-error-msg">
                                ⚠️ {adminError}
                            </div>
                        )}

                        <button type="submit" className="btn-login btn-admin-submit">
                            Open Admin Dashboard
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default LoginPage;
