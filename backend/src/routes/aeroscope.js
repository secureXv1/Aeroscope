import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import { parse } from 'csv-parse';
import { pool } from '../db.js';
import { stringify } from 'csv-stringify/sync'; 
import JSZip from 'jszip'
import { create } from 'xmlbuilder2'

const router = Router();
router.get('/export-csv', async (req, res) => {
  const { start, end } = req.query;
  let where = '1';
  const params = [];
  if (start) { where += ' AND time_start >= ?'; params.push(start + ' 00:00:00'); }
  if (end)   { where += ' AND time_start <= ?'; params.push(end + ' 23:59:59'); }

  // Consulta cruzada con left join (así puedes comparar drone_id con los otros)
  const [rows] = await pool.query(
    `
    SELECT
      a.*,
      CASE
        WHEN f.serie IS NOT NULL THEN 'ffpp'
        WHEN na.serie IS NOT NULL THEN 'aeronautica'
        ELSE 'hostil'
      END AS tipo
    FROM aeroscope a
      LEFT JOIN ffpp f ON a.drone_id = f.serie
      LEFT JOIN aeronautica na ON a.drone_id = na.serie
    WHERE ${where}
    ORDER BY a.time_start DESC
    `
  , params);

  function formatDate(dt) {
    if (!dt) return '';
    const date = new Date(dt);
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  // Normaliza solo las columnas deseadas
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
  res.setHeader('Content-Disposition', 'attachment; filename="aeroscope_export.csv"');
  res.send(csv);
});

// Genera un KML desde un array de puntos
function buildKml(points) {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('kml', { xmlns: 'http://www.opengis.net/kml/2.2' })
    .ele('Document')

  points.forEach(p => {
    const name = p.flight_id || p.drone_id || 'Vuelo'
    const desc = `Tipo: ${p.tipo || ''}\nDrone: ${p.drone_id || ''}\nAeroscope: ${p.aeroscope_id || ''}\nHora inicio: ${p.time_start || ''}\nHora fin: ${p.time_end || ''}`
    doc.ele('Placemark')
      .ele('name').txt(name).up()
      .ele('description').txt(desc).up()
      .ele('Point')
      .ele('coordinates').txt(`${p.longitude},${p.latitude},0`).up().up().up()
  })

  return doc.end({ prettyPrint: true })
}

router.get('/export-kmz', async (req, res) => {
  const { start, end, drone_id, aeroscope_id } = req.query
  let where = '1'
  const params = []
  if (start) { where += ' AND time_start >= ?'; params.push(start + ' 00:00:00') }
  if (end) { where += ' AND time_start <= ?'; params.push(end + ' 23:59:59') }
  if (drone_id) { where += ' AND drone_id = ?'; params.push(drone_id) }
  if (aeroscope_id) { where += ' AND aeroscope_id = ?'; params.push(aeroscope_id) }
  where += ' AND longitude IS NOT NULL AND latitude IS NOT NULL'

  const [rows] = await pool.query(`
  SELECT a.id, a.flight_id, a.drone_id, a.aeroscope_id, a.longitude, a.latitude, a.time_start, a.time_end,
    CASE
      WHEN f.serie IS NOT NULL THEN 'ffpp'
      WHEN na.serie IS NOT NULL THEN 'aeronautica'
      ELSE 'hostil'
    END AS tipo
    FROM aeroscope a
    LEFT JOIN ffpp f ON a.drone_id = f.serie
    LEFT JOIN aeronautica na ON a.drone_id = na.serie
    WHERE ${where}
  `, params)

  // 1. Genera el XML KML
  const kml = buildKml(rows)
  // 2. Lo empaqueta como KMZ
  const zip = new JSZip()
  zip.file('doc.kml', kml)
  const kmzBuf = await zip.generateAsync({ type: 'nodebuffer' })

  res.setHeader('Content-Type', 'application/vnd.google-earth.kmz')
  res.setHeader('Content-Disposition', 'attachment; filename="aeroscope_export.kmz"')
  res.send(kmzBuf)
})

// 👇 Agrega este endpoint a tu aeroscope.js
router.get('/map', async (req, res) => {
  const { start, end, drone_id, aeroscope_id } = req.query
  let where = '1'
  const params = []
  if (start) { where += ' AND a.time_start >= ?'; params.push(start + ' 00:00:00') }
  if (end) { where += ' AND a.time_start <= ?'; params.push(end + ' 23:59:59') }
  if (drone_id) { where += ' AND a.drone_id = ?'; params.push(drone_id) }
  if (aeroscope_id) { where += ' AND a.aeroscope_id = ?'; params.push(aeroscope_id) }
  where += ' AND a.longitude IS NOT NULL AND a.latitude IS NOT NULL'

  const [rows] = await pool.query(`
    SELECT a.*, 
      CASE
        WHEN f.serie IS NOT NULL THEN 'ffpp'
        WHEN na.serie IS NOT NULL THEN 'aeronautica'
        ELSE 'hostil'
      END AS tipo
    FROM aeroscope a
      LEFT JOIN ffpp f ON a.drone_id = f.serie
      LEFT JOIN aeronautica na ON a.drone_id = na.serie
    WHERE ${where}
    ORDER BY a.time_start DESC
  `, params)
  res.json(rows)
})

router.get('/kpi-global', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT
      COUNT(*) AS total,
      SUM(tipo = 'ffpp') AS ffpp,
      SUM(tipo = 'aeronautica') AS aeronautica,
      SUM(tipo = 'hostil') AS hostil
    FROM aeroscope
  `)
  res.json(rows[0])
})


// 👇 Endpoint KPI con filtro por time_start
router.get('/kpi', async (req, res) => {
  const { start, end } = req.query;
  let where = '1';
  const params = [];
  if (start) { where += ' AND time_start >= ?'; params.push(start + ' 00:00:00'); }
  if (end)   { where += ' AND time_start <= ?'; params.push(end + ' 23:59:59'); }
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM aeroscope WHERE ${where}`, params
  );
  res.json({ total });
});

router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, q = '' } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    const like = `%${q}%`;
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM aeroscope
       WHERE flight_id LIKE ? OR drone_id LIKE ? OR drone_type LIKE ?`,
      [like, like, like]
    );
    const [rows] = await pool.query(
      `SELECT * FROM aeroscope
       WHERE flight_id LIKE ? OR drone_id LIKE ? OR drone_type LIKE ?
       ORDER BY time_start DESC
       LIMIT ? OFFSET ?`,
      [like, like, like, Number(pageSize), offset]
    );
    res.json({ total, page: Number(page), pageSize: Number(pageSize), items: rows });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error listando aeroscope' });
  }
});


router.get('/distincts', async (_req, res) => {
  const [drones] = await pool.query('SELECT DISTINCT drone_id FROM aeroscope WHERE drone_id IS NOT NULL');
  const [aeroscopes] = await pool.query('SELECT DISTINCT aeroscope_id FROM aeroscope WHERE aeroscope_id IS NOT NULL');
  res.json({
    drone_ids: drones.map(d => d.drone_id),
    aeroscope_ids: aeroscopes.map(a => a.aeroscope_id),
  });
});

router.get('/:id', async (req, res) => {
  const [rows] = await pool.query(`SELECT * FROM aeroscope WHERE id=?`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
  res.json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const {
    flight_id, drone_id, drone_type, aeroscope_id,
    duration_sec, max_alt_m, longitude, latitude, time_start, time_end
  } = req.body;
  await pool.query(
    `UPDATE aeroscope SET flight_id=?, drone_id=?, drone_type=?, aeroscope_id=?,
     duration_sec=?, max_alt_m=?, longitude=?, latitude=?, time_start=?, time_end=?
     WHERE id=?`,
    [flight_id, drone_id, drone_type, aeroscope_id,
     duration_sec, max_alt_m, longitude, latitude, time_start, time_end, req.params.id]
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await pool.query(`DELETE FROM aeroscope WHERE id=?`, [req.params.id]);
  res.json({ ok: true });
});

const upload = multer({ dest: 'src/uploads/' });

router.post('/upload-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo no enviado' });
  const filePath = req.file.path;
  const inserted = [], errors = [];

  const toDate = (s) => {
    if (!s) return null;
    const d = new Date(s);
    if (!isNaN(d)) return d;
    // Intentar formato DD/MM/YYYY HH:MM:SS
    const m = String(s).match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
    if (m) {
      const [, dd, mm, yyyy, hh='00', mi='00', ss='00'] = m;
      return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`);
    }
    return null;
  };
  const toNumber = (s) => (s === '' || s == null ? null : Number(s));

  // Trae arrays de series (drone_id) válidas de ffpp y aeronautica
  const [ffppRows] = await pool.query('SELECT serie FROM ffpp');
  const ffppSeries = ffppRows.map(r => String(r.serie));
  const [aeroRows] = await pool.query('SELECT serie FROM aeronautica');
  const aeroSeries = aeroRows.map(r => String(r.serie));

  // Rango geográfico Colombia
  const MIN_LAT = -4.0, MAX_LAT = 11.0, MIN_LON = -78.0, MAX_LON = -66.0;

  const trx = await pool.getConnection();
  await trx.beginTransaction();

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(parse({ columns: true, trim: true }))
        .on('data', (row) => {
          const get = (...names) => {
            for (const n of names) {
              const key = Object.keys(row).find(k => k.trim().toLowerCase() === n.trim().toLowerCase());
              if (key) return row[key];
            }
            return '';
          };
          // Obtén los campos relevantes
          const drone_id = get('Drone ID');
          const latitude = toNumber(get('Detection Latitude', 'Latitude'));
          const longitude = toNumber(get('Detection Longitude', 'Longitude'));

          // Validaciones de omisión
          if (!drone_id) { errors.push({ row, error: 'Drone ID vacío' }); return; }
          if (latitude < MIN_LAT || latitude > MAX_LAT) { errors.push({ row, error: 'Latitud fuera de rango' }); return; }
          if (longitude < MIN_LON || longitude > MAX_LON) { errors.push({ row, error: 'Longitud fuera de rango' }); return; }

          // Calcula el tipo
          let tipo = 'hostil';
          if (ffppSeries.includes(drone_id)) tipo = 'ffpp';
          else if (aeroSeries.includes(drone_id)) tipo = 'aeronautica';

          // Arma la fila completa
          const payload = {
            flight_id: get('Flight ID'),
            drone_id,
            drone_type: get('Drone Type'),
            aeroscope_id: get('Aeroscope ID'),
            duration_sec: toNumber(get('Duration')),
            max_alt_m: toNumber(get('Max Altitude')),
            longitude,
            latitude,
            time_start: toDate(get('Detection Time(Start)', 'Time(Start)', 'Start Time')),
            time_end: toDate(get('Detection Time(End)', 'Time(End)', 'End Time')),
            tipo,
          };

          if (!payload.flight_id) { errors.push({ row, error: 'Flight ID vacío' }); return; }

          inserted.push(payload);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // 🚨 Divide en bloques para inserts masivos
    if (inserted.length) {
      const chunkSize = 500;
      for (let i = 0; i < inserted.length; i += chunkSize) {
        const chunk = inserted.slice(i, i + chunkSize);
        const values = chunk.map(r => [
          r.flight_id, r.drone_id, r.drone_type, r.aeroscope_id,
          r.duration_sec, r.max_alt_m, r.longitude, r.latitude,
          r.time_start ? new Date(r.time_start) : null,
          r.time_end ? new Date(r.time_end) : null,
          r.tipo
        ]);
        await trx.query(
          `INSERT INTO aeroscope
            (flight_id, drone_id, drone_type, aeroscope_id, duration_sec, max_alt_m, longitude, latitude, time_start, time_end, tipo)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            drone_id=VALUES(drone_id),
            drone_type=VALUES(drone_type),
            aeroscope_id=VALUES(aeroscope_id),
            duration_sec=VALUES(duration_sec),
            max_alt_m=VALUES(max_alt_m),
            longitude=VALUES(longitude),
            latitude=VALUES(latitude),
            time_start=VALUES(time_start),
            time_end=VALUES(time_end),
            tipo=VALUES(tipo)
          `,
          [values]
        );
      }
    }

    await trx.commit();
    fs.unlink(filePath, () => {});

    // 🚨 Haz el UPDATE tipo fuera de la transacción para evitar locks masivos
    if (inserted.length) {
      await pool.query(
        `UPDATE aeroscope a
        LEFT JOIN ffpp f ON a.drone_id = f.serie
        LEFT JOIN aeronautica na ON a.drone_id = na.serie
        SET a.tipo = 
          CASE 
            WHEN f.serie IS NOT NULL THEN 'ffpp'
            WHEN na.serie IS NOT NULL THEN 'aeronautica'
            ELSE 'hostil'
          END
        WHERE a.drone_id IS NOT NULL`
      );
    }

    res.json({ ok: true, inserted: inserted.length, omitidas: errors.length, errors });
  } catch (e) {
    await trx.rollback();
    fs.unlink(filePath, () => {});
    console.error(e);
    res.status(500).json({ error: 'Error procesando CSV' });
  } finally {
    trx.release();
  }
});


export default router;
