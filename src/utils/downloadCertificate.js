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

    // Export PDF as Data URI to guarantee .pdf file extension in Chrome
    try {
      const dataUri = pdf.output('datauristring');
      const downloadLink = document.createElement('a');
      downloadLink.href = dataUri;
      downloadLink.download = pdfFileName;
      downloadLink.setAttribute('target', '_blank');
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (e) {
      console.warn("Data URI download notice, using pdf.save():", e);
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
