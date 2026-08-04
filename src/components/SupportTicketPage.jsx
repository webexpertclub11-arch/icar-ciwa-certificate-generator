import React, { useState } from 'react';
import { submitSupportTicket } from '../utils/dbTracker';
import icarLogo from '../assets/icarlogoright.gif';
import './SupportTicketPage.css';

const SupportTicketPage = ({ assignedSerialNumber, registeredName, contactInfo, onExit, isAdminRestricted }) => {
    const [email, setEmail] = useState((contactInfo && contactInfo.email) || '');
    const [mobile, setMobile] = useState((contactInfo && contactInfo.mobile) || '');
    const [issueDescription, setIssueDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!issueDescription.trim()) {
            setError("Please describe your issue.");
            return;
        }
        setError('');
        setIsSubmitting(true);

        const success = await submitSupportTicket({
            serialNumber: assignedSerialNumber,
            registeredName,
            email,
            mobile,
            issueDescription
        });

        setIsSubmitting(false);
        if (success) {
            setSubmitted(true);
        } else {
            setError("Failed to submit issue. Please try again.");
        }
    };

    return (
        <div className="support-ticket-page">
            <header className="support-header">
                <div className="support-brand">
                    <img src={icarLogo} alt="ICAR Logo" className="support-logo" />
                    <div className="support-title">
                        <h1>Contact Support</h1>
                        <p>ICAR-CIWA Certificate Services</p>
                    </div>
                </div>
                <button className="support-back-btn" onClick={onExit}>← Exit / Logout</button>
            </header>

            <main className="support-main">
                {submitted ? (
                    <div className="support-success-card">
                        <div className="success-icon">✓</div>
                        <h2>Ticket Submitted Successfully</h2>
                        <p>Your issue has been forwarded to the administrative team. We will review it shortly.</p>
                        <button className="support-primary-btn" onClick={onExit}>Exit Portal</button>
                    </div>
                ) : (
                    <form className="support-form-card" onSubmit={handleSubmit}>
                        <div className="support-form-header">
                            <h2>Certificate Issue Report</h2>
                            {isAdminRestricted ? (
                                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', padding: '15px', marginTop: '15px', textAlign: 'left' }}>
                                    <h3 style={{ margin: '0 0 8px 0', color: '#b91c1c', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>⛔</span> Access Disabled
                                    </h3>
                                    <p style={{ margin: '0 0 5px 0', color: '#7f1d1d', fontSize: '0.95rem' }}>
                                        Your certificate download access is currently disabled. Please let us know the issue and we will assist you.
                                    </p>
                                    <p style={{ margin: 0, color: '#991b1b', fontSize: '0.9rem' }}>
                                        Please submit a support ticket below to request permission.
                                    </p>
                                </div>
                            ) : (
                                <p>Your certificate download access is currently disabled. Please let us know the issue and we will assist you.</p>
                            )}
                        </div>

                        {error && <div className="support-error-msg">{error}</div>}

                        <div className="support-form-row">
                            <div className="support-form-group">
                                <label>Participant Name</label>
                                <input type="text" value={registeredName || ''} disabled className="support-input-disabled" />
                            </div>
                            <div className="support-form-group">
                                <label>Serial Number</label>
                                <input type="text" value={assignedSerialNumber || ''} disabled className="support-input-disabled" />
                            </div>
                        </div>

                        <div className="support-form-row">
                            <div className="support-form-group">
                                <label>Contact Email (Optional)</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
                            </div>
                            <div className="support-form-group">
                                <label>Mobile Number (Optional)</label>
                                <input type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="10-digit number" />
                            </div>
                        </div>

                        <div className="support-form-group">
                            <label>Issue Description <span className="req">*</span></label>
                            <textarea
                                rows="5"
                                placeholder="Please describe why you need access to your certificate..."
                                value={issueDescription}
                                onChange={(e) => setIssueDescription(e.target.value)}
                            />
                        </div>

                        <button type="submit" className="support-primary-btn" disabled={isSubmitting}>
                            {isSubmitting ? 'Submitting...' : 'Submit Issue to Admin'}
                        </button>
                    </form>
                )}
            </main>
        </div>
    );
};

export default SupportTicketPage;
