// src/routes/aeroscope_agrupado.js
import { Router } from 'express';
import { pool } from '../db.js';
import { stringify } from 'csv-stringify/sync';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

const router = Router();

// KPIs agrupados (globales o filtrados por fecha)
router.get('/kpi', async (req, res) => {
  const { start, end } = req.query;
  let where = '1';
  const params = [];
  if (start) { where += ' AND time_start >= ?'; params.push(start + ' 00:00:00'); }
  if (end)   { where += ' AND time_start <= ?'; params.push(end + ' 23:59:59'); }
  const [rows] = await pool.query(`
    SELECT
      COUNT(*) AS total,
      SUM(tipo = 'ffpp') AS ffpp,
      SUM(tipo = 'aeronautica') AS aeronautica,
      SUM(tipo = 'hostil') AS hostil
    FROM aeroscope_agrupado
    WHERE ${where}
  `, params);
  res.json(rows[0]);
});

// Mismos filtros que aeroscope/map para alimentar gráficas comparativas
router.get('/map', async (req, res) => {
  const { start, end, drone_id, aeroscope_id } = req.query;
  let where = '1';
  const params = [];
  if (start) { where += ' AND time_start >= ?'; params.push(start + ' 00:00:00'); }
  if (end)   { where += ' AND time_start <= ?'; params.push(end + ' 23:59:59'); }
  if (drone_id) { where += ' AND drone_id = ?'; params.push(drone_id); }
  if (aeroscope_id) { where += ' AND aeroscope_id = ?'; params.push(aeroscope_id); }
  const [rows] = await pool.query(`SELECT * FROM aeroscope_agrupado WHERE ${where}`, params);
  res.json(rows);
});

router.get('/export-csv', async (req, res) => {
  const { start, end, drone_id, aeroscope_id } = req.query;
  let where = '1';
  const params = [];
  if (start) { where += ' AND time_start >= ?'; params.push(start + ' 00:00:00'); }
  if (end)   { where += ' AND time_start <= ?'; params.push(end + ' 23:59:59'); }
  if (drone_id) { where += ' AND drone_id = ?'; params.push(drone_id); }
  if (aeroscope_id) { where += ' AND aeroscope_id = ?'; params.push(aeroscope_id); }
  const [rows] = await pool.query(
    `SELECT * FROM aeroscope_agrupado WHERE ${where} ORDER BY time_start DESC`,
    params
  );

  function formatDate(dt) {
    if (!dt) return '';
    const date = new Date(dt);
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  const data = rows.map(r => ({
    flight_id: r.flight_id,
    drone_id: r.drone_id,
    drone_type: r.drone_type,
    aeroscope_id: r.aeroscope_id,
    duration_sec: r.duration_sec,
    max_alt_m: r.max_alt_m,
    longitude: r.longitude,
    latitude: r.latitude,
    time_start: formatDate(r.time_start),
    time_end: formatDate(r.time_end),
    tipo: r.tipo,
  }));
  const csv = stringify(data, { header: true, bom: true });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="aeroscope_agrupado_export.csv"');
  res.send(csv);
});

router.get('/export-kmz', async (req, res) => {
  const { start, end, drone_id, aeroscope_id } = req.query;
  let where = '1';
  const params = [];
  if (start) { where += ' AND time_start >= ?'; params.push(start + ' 00:00:00'); }
  if (end)   { where += ' AND time_start <= ?'; params.push(end + ' 23:59:59'); }
  if (drone_id) { where += ' AND drone_id = ?'; params.push(drone_id); }
  if (aeroscope_id) { where += ' AND aeroscope_id = ?'; params.push(aeroscope_id); }

  const [rows] = await pool.query(
    `SELECT * FROM aeroscope_agrupado WHERE ${where} ORDER BY time_start DESC`,
    params
  );

  // Normalización de tipo (por si viene “hosti”)
  const normalizeType = (t) => {
    const v = String(t || '').toLowerCase();
    if (v.startsWith('hosti')) return 'hostil';
    if (v.startsWith('ffpp')) return 'ffpp';
    if (v.startsWith('aer')) return 'aeronautica';
    return 'hostil'; // default
  };

  // Rutas de iconos a incluir dentro del KMZ (junto al KML)
  const ICON_DIR = path.resolve(process.cwd(), 'assets', 'kmz-icons');
  const ICON_MAP = {
    ffpp: 'ffpp.png',
    hostil: 'hostil.png',
    aeronautica: 'aeronautica.png',
  };

  // Ayudas
  const xmlEscape = (s) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const toISO = (dt) => {
    if (!dt) return '';
    const d = new Date(dt);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  };

  // Construcción de estilos por tipo (usa íconos incluidos en el KMZ)
  const styleForType = (tipo) => {
    const iconFile = ICON_MAP[tipo] || ICON_MAP.hostil;
    // KML <color> usa AABBGGRR (alpha, blue, green, red)
    const COLORS = {
      ffpp:       'ffFF9900', // naranja (ejemplo para tint)
      hostil:     'ff0000FF', // rojo
      aeronautica:'ff00FF00', // verde
    };
    const color = COLORS[tipo] || COLORS.hostil;
    return `
      <Style id="style-${tipo}">
        <IconStyle>
          <scale>1.1</scale>
          <color>${color}</color>
          <Icon><href>${xmlEscape(iconFile)}</href></Icon>
        </IconStyle>
        <LabelStyle><scale>0.9</scale></LabelStyle>
      </Style>
    `;
  };

  // Document y estilos (uno por tipo)
  const uniqueTypes = new Set(rows.map(r => normalizeType(r.tipo)));
  let stylesXml = '';
  for (const t of ['ffpp','hostil','aeronautica']) {
    if (uniqueTypes.size === 0 || uniqueTypes.has(t)) {
      stylesXml += styleForType(t);
    }
  }

  // Placemarks
  const placemarksXml = rows.map(r => {
    const tipo = normalizeType(r.tipo);
    const name = xmlEscape(r.drone_id || 'N/D');   // 👈 nombre = drone_id
    const lon = Number(r.longitude);
    const lat = Number(r.latitude);
    // Opcional: TimeSpan para Google Earth
    const ts = toISO(r.time_start);
    const te = toISO(r.time_end);

    const desc = `
      <![CDATA[
        <b>Drone ID:</b> ${xmlEscape(r.drone_id)}<br/>
        <b>Tipo:</b> ${xmlEscape(r.tipo)}<br/>
        <b>Flight ID:</b> ${xmlEscape(r.flight_id)}<br/>
        <b>Aeroscope ID:</b> ${xmlEscape(r.aeroscope_id)}<br/>
        <b>Duración (s):</b> ${xmlEscape(r.duration_sec)}<br/>
        <b>Altura máx (m):</b> ${xmlEscape(r.max_alt_m)}<br/>
        <b>Inicio:</b> ${xmlEscape(r.time_start)}<br/>
        <b>Fin:</b> ${xmlEscape(r.time_end)}<br/>
      ]]>`;

    if (!isFinite(lon) || !isFinite(lat)) return '';

    return `
      <Placemark>
        <name>${name}</name>
        <styleUrl>#style-${tipo}</styleUrl>
        ${ts || te ? `<TimeSpan>${ts ? `<begin>${ts}</begin>`:''}${te ? `<end>${te}</end>`:''}</TimeSpan>` : ''}
        <description>${desc}</description>
        <Point><coordinates>${lon},${lat},0</coordinates></Point>
      </Placemark>
    `;
  }).join('\n');

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
  <kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
      <name>Aeroscope Agrupado</name>
      ${stylesXml}
      ${placemarksXml}
    </Document>
  </kml>`;

  // Crear KMZ: doc.kml + íconos
  const zip = new AdmZip();
  zip.addFile('doc.kml', Buffer.from(kml, 'utf8'));

  // Agregar íconos si existen
  for (const key of Object.keys(ICON_MAP)) {
    const file = path.join(ICON_DIR, ICON_MAP[key]);
    if (fs.existsSync(file)) {
      zip.addLocalFile(file, ''); // al root del zip
    }
  }

  const kmzBuffer = zip.toBuffer();

  res.setHeader('Content-Type', 'application/vnd.google-earth.kmz');
  res.setHeader('Content-Disposition', 'attachment; filename="aeroscope_agrupado.kmz"');
  res.send(kmzBuffer);
});

export default router;
