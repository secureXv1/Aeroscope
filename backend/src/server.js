import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import aeroscopeRoutes from './routes/aeroscope.js';
import ffppRoutes from './routes/ffpp.js';
import aeronauticaRoutes from './routes/aeronautica.js';

import { Router } from 'express';
import { exec } from 'child_process';
import fs from 'fs';

import aeroscopeAgrupadoRoutes from './routes/aeroscope_agrupado.js';
import dashboardExportRoutes from './routes/dashboard_export.js'


const router = Router();

router.get('/export-db', async (req, res) => {
  const dbName = process.env.DB_NAME || 'novedades'; // Cambia a tu db real
  const dbUser = process.env.DB_USER || 'root';
  const dbPass = process.env.DB_PASS || '';
  const filename = `backup_${dbName}_${Date.now()}.sql`;

  // 🛑 Usa rutas seguras
  const dumpCmd = `mysqldump -u${dbUser} -p${dbPass ? dbPass : ''} ${dbName}`;

  exec(dumpCmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
    if (error) {
      console.error('Error en mysqldump:', error, stderr);
      return res.status(500).json({ error: 'No se pudo exportar la base de datos.' });
    }

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(stdout);
  });
});

export default router;

process.env.TZ = process.env.TZ || 'America/Bogota';

const app = express();

app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://192.168.1.95:5173', 
  ],
  credentials: false
}));
app.use(express.json());

// Rutas API
app.use('/api/aeroscope', aeroscopeRoutes);
app.use('/api/ffpp', ffppRoutes);
app.use('/api/aeronautica', aeronauticaRoutes);
app.use('/api/export', router);
app.use('/api/aeroscope_agrupado', aeroscopeAgrupadoRoutes);
app.use('/api/dashboard', dashboardExportRoutes)

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`API escuchando en http://0.0.0.0:${port}`);
});
