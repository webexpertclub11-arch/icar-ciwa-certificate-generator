import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function adminExcelSyncPlugin() {
  return {
    name: 'admin-excel-sync',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/save-excel', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk.toString(); });
          req.on('end', async () => {
            try {
              const fs = require('fs');
              const path = require('path');
              const XLSX = require('xlsx');

              const { records } = JSON.parse(body);
              if (Array.isArray(records)) {
                const excelData = records.map((row, rIdx) => ({
                  'S.No': rIdx + 1,
                  'Participant Name': row.participantName || '',
                  'KVK Name': row.kvkName || '',
                  'ATARI Zone': row.atariZone || '',
                  'Time of Download': row.lastTimeOfDownload || '',
                  'Download Count': row.downloadCount || 1,
                }));

                const worksheet = XLSX.utils.json_to_sheet(excelData);
                worksheet['!cols'] = [
                  { wch: 8 },
                  { wch: 32 },
                  { wch: 32 },
                  { wch: 48 },
                  { wch: 24 },
                  { wch: 18 },
                ];
                worksheet['!protect'] = {
                  password: 'ciwa123',
                  selectLockedCells: true,
                  selectUnlockedCells: true,
                };

                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Certificate Downloads');

                const adminDir = path.join(process.cwd(), 'admin data');
                if (!fs.existsSync(adminDir)) fs.mkdirSync(adminDir, { recursive: true });

                const filePath = path.join(adminDir, 'certificate_downloads.xlsx');
                XLSX.writeFile(workbook, filePath);
                console.log('Synced Excel file to admin data folder successfully!');
              }
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              console.error('Error saving Excel file:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end();
        }
      });

      server.middlewares.use('/api/download-admin-excel', (req, res) => {
        try {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.join(process.cwd(), 'admin data', 'certificate_downloads.xlsx');
          if (fs.existsSync(filePath)) {
            const fileStream = fs.createReadStream(filePath);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="certificate_downloads.xlsx"');
            fileStream.pipe(res);
          } else {
            res.statusCode = 404;
            res.end('File not found');
          }
        } catch (err) {
          res.statusCode = 500;
          res.end(err.message);
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), adminExcelSyncPlugin()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/sql': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
});
