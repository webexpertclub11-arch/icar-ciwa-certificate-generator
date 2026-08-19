import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import './Certificate.css';
import leftSideLogo from '../assets/international_womenfarmer.svg';
import icarRightLogo from '../assets/icarlogoright.gif';
import certificateHead from '../assets/certificate head.png';
import defaultDirectorSign from '../assets/director sign.png';
import { getCertificateSettings, getEffectiveTrainingDates } from '../utils/certificateSettings';
import { fetchOrganizationsList } from '../utils/dbTracker';


const Certificate = React.forwardRef(({ salutation = '', name, instituteName, atariZone, serialNumber, trainingDates, customSettings, category }, ref) => {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const settings = customSettings || getCertificateSettings();

  const validSerial = serialNumber || 'CIWA/2026/NOGRA/166';

  // Dynamic hierarchical training dates statement (Participant-wise > Zone-wise > Global default)
  const displayTrainingDates = trainingDates || getEffectiveTrainingDates(validSerial, resolvedZoneFullName || atariZone || 'ICAR', customSettings?.trainingDates);

  const activeCategory = (category || atariZone || '').trim().toUpperCase();
  const instUpper = (instituteName || '').trim().toUpperCase();

  // Safe Dynamic Resolution ONLY for the ATARI Zone fullname string
  const [resolvedZoneFullName, setResolvedZoneFullName] = useState('');

  useEffect(() => {
    fetchOrganizationsList().then(orgs => {
      if (!orgs || orgs.length === 0) return;

      const targetInst = (instituteName || '').trim().toLowerCase();
      const targetZone = (atariZone || '').trim();

      let inferredZone = null;

      if (targetInst) {
        const cleanInst = targetInst.replace(/[,.-]/g, ' ').replace(/\s+/g, ' ').trim();
        const foundKVK = orgs.find(o => {
          const sNameRaw = (o.shortName || '').trim().toLowerCase();
          const fNameRaw = (o.fullName || '').trim().toLowerCase();
          return (sNameRaw === targetInst || fNameRaw === targetInst || sNameRaw.replace(/[,.-]/g, ' ') === cleanInst);
        });

        if (foundKVK && foundKVK.category) {
          inferredZone = foundKVK.category;
        }
      }

      const zoneToSearch = targetZone || inferredZone;
      if (zoneToSearch) {
        const zoneMatch = zoneToSearch.match(/Zone\s+([IVX0-9]+)/i);
        if (zoneMatch) {
          const romanNumeral = zoneMatch[1].toUpperCase();
          const regex = new RegExp(`ZONE\\s+${romanNumeral}\\b`);
          const foundATARI = orgs.find(o =>
            regex.test((o.fullName || '').toUpperCase()) ||
            regex.test((o.shortName || '').toUpperCase())
          );

          if (foundATARI && foundATARI.fullName) {
            setResolvedZoneFullName(foundATARI.fullName);
            return;
          }
        }
      }

      setResolvedZoneFullName('');
    });
  }, [instituteName, atariZone]);

  const displayZone = resolvedZoneFullName || atariZone || 'ICAR-Agricultural Technology Application Research Institute, Zone I, Ludhiana';
  const zoneUpper = (displayZone || '').trim().toUpperCase();

  // Category Layout Format Flags
  const isKvk = activeCategory.startsWith('KVK') || activeCategory.includes('ATARI') || instUpper.includes('KVK') || zoneUpper.includes('ATARI');
  const isSauOrCau = activeCategory.includes('SAU') || activeCategory.includes('CAU');

  const isIcarInstitute = !isKvk && !isSauOrCau && (
    activeCategory.includes('ICAR INSTITUTE') ||
    activeCategory === 'ICAR' ||
    (instUpper.includes('ICAR') && !instUpper.includes('AGRICULTURAL TECHNOLOGY') && !instUpper.includes('KVK'))
  );

  const finalInstituteName = instituteName;

  // Combine Salutation, Name and Institute Name dynamically
  const activeSalutation = salutation ? `${salutation} ` : '';
  const displayName = name ? `${activeSalutation}${name}` : `${activeSalutation}Madhuri Revanwar`.trim();
  const displayInstitute = finalInstituteName ? `, ${finalInstituteName}` : '';

  // Generate Dynamic High-Resolution QR Code
  useEffect(() => {
    const verificationPayload = `ICAR-CIWA OFFICIAL CERTIFICATE
Serial No: ${validSerial}
Participant: ${displayName}
Institute: ${finalInstituteName || 'ICAR'}
Zone: ${displayZone}
Training: Strengthening Agriculture Research with Gender Perspective
Organized By: ${settings.trainingOrganizer || 'ICAR-CIWA, Bhubaneswar'} (${displayTrainingDates})
Status: VERIFIED & AUTHENTIC`;

    QRCode.toDataURL(verificationPayload, {
      width: 1000,
      margin: 2,
      color: {
        dark: '#000000', // Pure black for maximum scanner contrast & optical readability
        light: '#ffffff'
      },
      errorCorrectionLevel: 'L' // Low error correction for cleaner grid & larger scannable modules
    })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error("Error generating QR Code:", err));
  }, [validSerial, displayName, finalInstituteName, displayZone, settings, displayTrainingDates]);

  return (
    <div className="certificate-wrapper">
      <div className="certificate-container" ref={ref}>
        {/* 4-Border Dual-Color Frame (html2canvas PDF compatible) */}
        <div className="border-yellow-1">
          <div className="border-brown-1">
            <div className="border-yellow-2">
              <div className="border-brown-2">

                {/* Top Logos */}
                <div className="certificate-header">
                  <div className="logo-left-box">
                    <img src={leftSideLogo} alt="International Year of the Woman Farmer 2026" className="left-logo-img" />
                  </div>
                  <div className="logo-right-box">
                    <img src={icarRightLogo} alt="ICAR Logo" className="right-logo-img" />
                  </div>
                </div>

                {/* Title Section */}
                <div className="certificate-title-box">
                  <img
                    src={certificateHead}
                    alt="Certificate of Completion"
                    className="certificate-head-img"
                  />
                </div>

                {/* Main Content Body */}
                <div className="certificate-body-box">
                  <p className="certify-lead">
                    This is to certify that
                  </p>

                  <p className={`participant-fullname ${isIcarInstitute ? 'icar-institute-name' : ''}`}>
                    <span className={!name ? 'placeholder-text' : ''}>
                      {displayName}{displayInstitute}
                    </span>
                  </p>

                  {!isIcarInstitute ? (
                    <>
                      <p className="zone-statement">
                        under <span className={!atariZone ? 'placeholder-text' : ''}>{displayZone}</span>
                      </p>

                      <div className="training-details">
                        <p className="training-line-1">
                          has successfully completed the Training Programme on <strong className="highlight-program">‘Strengthening Agriculture Research</strong>
                        </p>
                        <p className="training-line-2">
                          <strong className="highlight-program">with Gender Perspective for Sustainable Agri-Food System’</strong> organized by
                        </p>
                        <p className="training-organizer">
                          {settings.trainingOrganizer || 'ICAR-Central Institute for Women in Agriculture, Bhubaneswar'}
                        </p>
                        <p className="training-dates">
                          {displayTrainingDates}.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="training-details icar-training-details" style={{ lineHeight: '1.5', marginTop: '-5px' }}>
                      <p className="training-line-1">
                        has successfully completed the Training Programme on <strong className="highlight-program">‘Strengthening Agriculture</strong>
                      </p>
                      <p className="training-line-2">
                        <strong className="highlight-program">with Gender Perspective for Sustainable Agri-Food System’</strong> organized by
                      </p>
                      {/* <p className="training-line-3" style={{ margin: '4px 0', fontFamily: '"EB Garamond", "Georgia", serif', color: '#003300' }}>
                        <strong className="highlight-program"></strong> organized by
                      </p> */}
                      <p className="training-organizer">
                        {settings.trainingOrganizer || 'ICAR-Central Institute for Women in Agriculture, Bhubaneswar'}
                      </p>
                      <p className="training-dates">
                        {displayTrainingDates}.
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Section */}
                <div className="certificate-footer-box">
                  <div className="serial-no-box">
                    {/* Dynamic QR Code (Only image, left aligned above serial number) */}
                    {qrCodeUrl && (
                      <img src={qrCodeUrl} alt="QR Code" className="qr-code-img" />
                    )}
                    <div className="serial-text">Serial Number: {validSerial}</div>
                  </div>
                  <div className="signature-box">
                    <img
                      src={settings.directorSignatureImage || defaultDirectorSign}
                      alt="Director Signature"
                      className="director-signature-img"
                      onError={(e) => {
                        if (e.currentTarget.src !== defaultDirectorSign) {
                          e.currentTarget.src = defaultDirectorSign;
                        }
                      }}
                    />
                    <p className="sig-name">{settings.directorName || 'Dr. Mridula Devi'}</p>
                    <p className="sig-title">{settings.directorTitle || '(Director, ICAR-CIWA)'}</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

Certificate.displayName = 'Certificate';

export default Certificate;
