import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const downloadCertificateAsPDF = async (certificateRef, participantName) => {
  if (!certificateRef || !certificateRef.current) {
    alert("Certificate element not ready.");
    return false;
  }

  const targetEl = certificateRef.current;

  try {
    // Wait for all fonts to be fully loaded into memory before canvas capture
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // Create a clean offscreen container (1020px x 720px) free from any parent zoom/scale transforms
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = '1020px';
    tempContainer.style.height = '720px';
    tempContainer.style.zIndex = '-99999';
    tempContainer.style.overflow = 'hidden';
    tempContainer.style.backgroundColor = '#ffffff';

    const clonedEl = targetEl.cloneNode(true);
    clonedEl.style.transform = 'none';
    clonedEl.style.transformOrigin = 'initial';
    clonedEl.style.margin = '0';
    clonedEl.style.width = '1020px';
    clonedEl.style.height = '720px';

    tempContainer.appendChild(clonedEl);
    document.body.appendChild(tempContainer);

    // Convert all SVG images to self-contained Base64 Data URIs so html2canvas captures them reliably
    const imgElements = clonedEl.querySelectorAll('img');
    await Promise.all(
      Array.from(imgElements).map(async (img) => {
        if (img.src && (img.src.includes('.svg') || img.src.includes('svg') || img.src.startsWith('blob:'))) {
          try {
            const response = await fetch(img.src);
            const blob = await response.blob();
            await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                img.src = reader.result;
                resolve();
              };
              reader.onerror = resolve;
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            console.warn("Could not inline SVG image for PDF canvas generation:", e);
          }
        }
      })
    );

    // Brief stabilization pause for cloned images & rendering engine
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Capture unscaled canvas at 4.5x scale (~450 DPI ultra crisp output, crystal-clear zoom)
    const canvas = await html2canvas(clonedEl, {
      scale: 4.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 0,
      width: 1020,
      height: 720,
      windowWidth: 1020,
      windowHeight: 720,
      onclone: (clonedDoc) => {
        const certs = clonedDoc.querySelectorAll('.certificate-container');
        certs.forEach((cert) => {
          cert.style.transform = 'none';
          cert.style.transformOrigin = 'initial';
          cert.style.margin = '0';
        });
      },
    });

    // Clean up temporary DOM container
    if (document.body.contains(tempContainer)) {
      document.body.removeChild(tempContainer);
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    // Create A4 Landscape PDF (297mm x 210mm)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    // Fit image to A4 Landscape bounds with high clarity rendering
    pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210, undefined, 'SLOW');

    const sanitizedName = participantName
      ? participantName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_')
      : 'Participant';

    const pdfFileName = `Certificate_${sanitizedName}.pdf`;

    // Export PDF using a Blob URL for maximum cross-browser compatibility
    try {
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = pdfFileName;
      
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isIOS) {
        // iOS Safari strictly blocks async downloads. Present a direct button.
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        overlay.style.zIndex = '999999';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';

        const title = document.createElement('h2');
        title.innerText = 'Certificate is Ready!';
        title.style.color = 'white';
        title.style.marginBottom = '20px';
        title.style.fontFamily = 'sans-serif';
        title.style.textAlign = 'center';

        const subtitle = document.createElement('p');
        subtitle.innerText = 'Safari requires you to tap to download.';
        subtitle.style.color = '#cbd5e1';
        subtitle.style.marginBottom = '30px';
        subtitle.style.fontFamily = 'sans-serif';

        downloadLink.innerText = 'Tap to Download PDF';
        downloadLink.style.padding = '16px 32px';
        downloadLink.style.backgroundColor = '#10b981';
        downloadLink.style.color = 'white';
        downloadLink.style.fontSize = '18px';
        downloadLink.style.fontWeight = 'bold';
        downloadLink.style.borderRadius = '8px';
        downloadLink.style.textDecoration = 'none';
        downloadLink.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';

        const closeBtn = document.createElement('button');
        closeBtn.innerText = 'Close';
        closeBtn.style.marginTop = '30px';
        closeBtn.style.padding = '10px 20px';
        closeBtn.style.backgroundColor = 'transparent';
        closeBtn.style.color = '#94a3b8';
        closeBtn.style.border = '1px solid #94a3b8';
        closeBtn.style.borderRadius = '6px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '16px';

        closeBtn.onclick = () => {
          if (document.body.contains(overlay)) document.body.removeChild(overlay);
        };

        downloadLink.onclick = () => {
          setTimeout(() => {
            if (document.body.contains(overlay)) document.body.removeChild(overlay);
          }, 2000);
        };

        overlay.appendChild(title);
        overlay.appendChild(subtitle);
        overlay.appendChild(downloadLink);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);

      } else {
        // Standard auto-download for Android / Chrome / Edge
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        setTimeout(() => {
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(blobUrl);
        }, 500);
      }
    } catch (e) {
      console.warn("Blob download failed, falling back to pdf.save():", e);
      pdf.save(pdfFileName);
    }

    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert("PDF Download Failure: " + (error.message || error.toString()));
    return false;
  }
};

export const printCertificate = (certificateRef) => {
  if (!certificateRef || !certificateRef.current) {
    alert("Certificate element not ready for printing.");
    return;
  }

  const printContent = certificateRef.current.outerHTML;
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    alert("Please allow popup windows in your browser to print the certificate.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <base href="${window.location.origin}/">
      <title>ICAR-CIWA Certificate</title>
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700;1,800&family=EB+Garamond:ital,wght@0,500;0,600;0,700;0,800;1,600;1,700;1,800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: white;
        }
        .certificate-container {
          transform: none !important;
          box-shadow: none !important;
        }
        @page {
          size: A4 landscape;
          margin: 0;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
      <link rel="stylesheet" href="${window.location.origin}/src/components/Certificate.css">
    </head>
    <body>
      ${printContent}
      <script>
        window.onload = () => {
          setTimeout(() => {
            window.print();
            window.close();
          }, 600);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};
