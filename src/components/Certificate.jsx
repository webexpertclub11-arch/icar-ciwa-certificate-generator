import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import './Certificate.css';
import leftSideLogo from '../assets/international_womenfarmer.svg';
import icarRightLogo from '../assets/icarlogoright.gif';
import certificateHead from '../assets/certificate head.png';
import { getCertificateSettings, getEffectiveTrainingDates } from '../utils/certificateSettings';
import { fetchOrganizationsList } from '../utils/dbTracker';

const Certificate = React.forwardRef(({ salutation = '', name, instituteName, atariZone, serialNumber, trainingDates, customSettings, category }, ref) => {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const settings = customSettings || getCertificateSettings();

  const [resolvedZone, setResolvedZone] = useState(atariZone);
  const [resolvedCategory, setResolvedCategory] = useState(category);
  const [resolvedInstituteName, setResolvedInstituteName] = useState(instituteName || '');

  useEffect(() => {
    setResolvedInstituteName(instituteName || '');
  }, [instituteName]);

  // Dynamic Zone / University Full Name & SAU/CAU Short Name Resolution from DB
  useEffect(() => {
    fetchOrganizationsList().then(orgs => {
      if (!orgs || orgs.length === 0) return;

      const targetZone = (atariZone || '').trim();
      const targetInst = (instituteName || '').trim();
      const explicitCat = (category || '').trim();

      if (!targetZone && !targetInst && !explicitCat) return;

      let foundInst = null;
      let foundZone = null;

      if (targetInst) {
        const cleanInst = targetInst.toLowerCase();
        foundInst = orgs.find(o =>
          (o.shortName || '').trim().toLowerCase() === cleanInst ||
          (o.fullName || '').trim().toLowerCase() === cleanInst
        ) || orgs.find(o =>
          (o.shortName && cleanInst.includes((o.shortName).trim().toLowerCase())) ||
          (o.fullName && cleanInst.includes((o.fullName).trim().toLowerCase()))
        );
      }

      if (targetZone) {
        const zoneMatch = targetZone.match(/Zone\s+([IVX0-9]+)/i);
        if (zoneMatch) {
          const zoneStr = `Zone ${zoneMatch[1]}`.toLowerCase();
          foundZone = orgs.find(o =>
            (o.fullName || '').toLowerCase().includes(zoneStr) ||
            (o.shortName || '').toLowerCase().includes(zoneStr)
          );
        }
      }

      const activeCat = (explicitCat || foundInst?.category || foundZone?.category || '').toUpperCase();
      const isSauOrCau = activeCat.includes('SAU') || activeCat.includes('CAU');

      if (isSauOrCau) {
        if (foundInst) {
          setResolvedInstituteName(foundInst.shortName || foundInst.fullName || targetInst);
          setResolvedZone(foundInst.fullName || (activeCat.includes('CAU') ? 'Central Agricultural University' : 'State Agricultural University'));
        } else {
          setResolvedInstituteName(targetInst);
          setResolvedZone(activeCat.includes('CAU') ? 'Central Agricultural University' : 'State Agricultural University');
        }
      } else {
        if (foundZone && foundZone.fullName) {
          setResolvedZone(foundZone.fullName);
        } else if (targetZone) {
          setResolvedZone(targetZone);
        }

        if (foundInst && (foundInst.shortName || foundInst.fullName)) {
          setResolvedInstituteName(foundInst.shortName || foundInst.fullName);
        } else if (targetInst) {
          setResolvedInstituteName(targetInst);
        }
      }

      if (explicitCat) {
        setResolvedCategory(explicitCat);
      } else if (foundInst && foundInst.category) {
        setResolvedCategory(foundInst.category);
      } else if (foundZone && foundZone.category) {
        setResolvedCategory(foundZone.category);
      }
    });
  }, [atariZone, instituteName, category]);

  const displayZone = resolvedZone || atariZone || 'ICAR-Agricultural Technology Application Research Institute, Zone I, Ludhiana';
  const validSerial = serialNumber || 'CIWA/2026/NOGRA/166';

  // Dynamic hierarchical training dates statement (Participant-wise > Zone-wise > Global default)
  const displayTrainingDates = trainingDates || getEffectiveTrainingDates(validSerial, displayZone, customSettings?.trainingDates);

  const activeCategory = (resolvedCategory || category || atariZone || '').trim().toUpperCase();
  const instUpper = (instituteName || resolvedInstituteName || '').trim().toUpperCase();
  const zoneUpper = (displayZone || '').trim().toUpperCase();

  // Category Layout Format Flags
  const isKvk = activeCategory.startsWith('KVK') || activeCategory.includes('ATARI') || instUpper.includes('KVK') || zoneUpper.includes('ATARI');
  const isSauOrCau = activeCategory.includes('SAU') || activeCategory.includes('CAU');

  // ICAR Institute is strictly true ONLY if category is ICAR Institute and NOT KVK / ATARI / SAU / CAU
  const isIcarInstitute = !isKvk && !isSauOrCau && (
    activeCategory.includes('ICAR INSTITUTE') ||
    activeCategory === 'ICAR' ||
    (instUpper.includes('ICAR') && !instUpper.includes('AGRICULTURAL TECHNOLOGY') && !instUpper.includes('KVK'))
  );

  const finalInstituteName = resolvedInstituteName || instituteName;

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
                          has successfully completed the Training Programme on <strong className="highlight-program">“Strengthening Agriculture Research</strong>
                        </p>
                        <p className="training-line-2">
                          <strong className="highlight-program">with Gender Perspective for Sustainable Agri-Food System”</strong> organized by
                        </p>
                        <p className="training-organizer">
                          {settings.trainingOrganizer || 'ICAR-Central Institute for Women in Agriculture, Bhubaneswar'}
                        </p>
                        <p className="training-dates">
                          {displayTrainingDates}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="training-details icar-training-details" style={{ lineHeight: '1.5', marginTop: '-5px' }}>
                      <p className="training-line-1">
                        has successfully completed the Training Programme on <strong className="highlight-program">“Strengthening Agriculture</strong>
                      </p>
                      <p className="training-line-2">
                        <strong className="highlight-program">Research with Gender Perspective for Sustainable Agri-Food System” for Nodal</strong>
                      </p>
                      <p className="training-line-3" style={{ margin: '4px 0', fontFamily: '"EB Garamond", "Georgia", serif', color: '#003300' }}>
                        <strong className="highlight-program">& Co-Nodal Officers- Gender Research in Agriculture (NO-GRA)</strong> organized by
                      </p>
                      <p className="training-organizer">
                        {settings.trainingOrganizer || 'ICAR-Central Institute for Women in Agriculture, Bhubaneswar'}
                      </p>
                      <p className="training-dates">
                        {displayTrainingDates}
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
                      src={settings.directorSignatureImage}
                      alt="Director Signature"
                      className="director-signature-img"
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
