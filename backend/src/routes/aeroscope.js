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

// ✅ asegurar carpeta y levantar límite
const uploadDir = 'src/uploads';
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (_) {}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 200 * 1024 * 1024 } // 200 MB
});


router.post('/upload-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo no enviado' });
  const filePath = req.file.path;
  const inserted = [], errors = [];

  // 🔢 normalizadores robustos
  const toNumber = (s) => {
    if (s === '' || s == null) return null;
    const norm = String(s).replace(',', '.').replace(/[^\d.\-]/g, '').trim();
    const n = Number(norm);
    return Number.isNaN(n) ? null : n;
  };
  const toDate = (s) => {
    if (!s) return null;
    // YYYY-MM-DD HH:MM:SS
    const m1 = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
    if (m1) {
      const [, y, mo, d, h, mi, se] = m1;
      return new Date(`${y}-${mo}-${d}T${h}:${mi}:${se}`);
    }
    // DD/MM/YYYY [HH:MM:SS]
    const m2 = String(s).match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
    if (m2) {
      const [, dd, mm, yyyy, hh='00', mi='00', ss='00'] = m2;
      return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`);
    }
    const d2 = new Date(s);
    return isNaN(d2) ? null : d2;
  };

  // series de referencia
  const [ffppRows] = await pool.query('SELECT serie FROM ffpp');
  const ffppSeries = ffppRows.map(r => String(r.serie));
  const [aeroRows] = await pool.query('SELECT serie FROM aeronautica');
  const aeroSeries = aeroRows.map(r => String(r.serie));

  // rango Colombia
  const MIN_LAT = -4.0, MAX_LAT = 11.0, MIN_LON = -78.0, MAX_LON = -66.0;

  const trx = await pool.getConnection();
  await trx.beginTransaction();

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(parse({
          columns: true,
          trim: true,
          bom: true,
          skip_empty_lines: true,
          delimiter: ';'      // ⬅️ tu CSV usa ;
        }))
        .on('data', (row) => {
          const get = (...names) => {
            for (const n of names) {
              const key = Object.keys(row).find(k => k.trim().toLowerCase() === n.trim().toLowerCase());
              if (key) return row[key];
            }
            return '';
          };

          // ⬇️ lee primero en variables simples
          const flight_id     = get('Flight ID', 'FlightID', 'flight_id');
          const drone_id      = get('Drone ID', 'DroneID', 'drone_id');
          const drone_type    = get('Drone Type', 'DroneType', 'drone_type');
          const aeroscope_id  = get('Aeroscope ID', 'AeroscopeID', 'aeroscope_id');
          const duration_sec  = toNumber(get('Duration'));
          const max_alt_m     = toNumber(get('Max Altitude', 'MaxAltitude'));
          const longitude     = toNumber(get('Detection Longitude', 'Longitude', 'Lon'));
          const latitude      = toNumber(get('Detection Latitude', 'Latitude', 'Lat'));
          const time_start    = toDate(get('Detection Time(Start)', 'Time(Start)', 'Start Time'));
          const time_end      = toDate(get('Detection Time(End)', 'Time(End)', 'End Time'));

          // ⬇️ validaciones (sin usar 'payload' todavía)
          if (!flight_id) { errors.push({ row, error: 'Flight ID vacío' }); return; }
          if (!drone_id)  { errors.push({ row, error: 'Drone ID vacío'  }); return; }

          if (latitude == null || longitude == null) {
            errors.push({ row, error: 'Coordenadas faltantes' }); return;
          }
          if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
            errors.push({ row, error: 'Coordenadas inválidas' }); return;
          }
          if (latitude < MIN_LAT || latitude > MAX_LAT) {
            errors.push({ row, error: 'Latitud fuera de rango' }); return;
          }
          if (longitude < MIN_LON || longitude > MAX_LON) {
            errors.push({ row, error: 'Longitud fuera de rango' }); return;
          }

          // ⬇️ calcula tipo
          let tipo = 'hostil';
          if (ffppSeries.includes(drone_id)) tipo = 'ffpp';
          else if (aeroSeries.includes(drone_id)) tipo = 'aeronautica';

          // ⬇️ ahora sí arma payload
          const payload = {
            flight_id,
            drone_id,
            drone_type,
            aeroscope_id,
            duration_sec,
            max_alt_m,
            longitude,
            latitude,
            time_start,
            time_end,
            tipo
          };

          inserted.push(payload);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // ⛳ inserts en bloques
    if (inserted.length) {
      const chunkSize = 500;
      for (let i = 0; i < inserted.length; i += chunkSize) {
        const chunk = inserted.slice(i, i + chunkSize);
        const values = chunk.map(r => [
          r.flight_id, r.drone_id, r.drone_type, r.aeroscope_id,
          r.duration_sec, r.max_alt_m, r.longitude, r.latitude,
          r.time_start ? new Date(r.time_start) : null,
          r.time_end   ? new Date(r.time_end)   : null,
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
            tipo=VALUES(tipo)`,
          [values]
        );
      }
    }

    await trx.commit();
    fs.unlink(filePath, () => {});

    // refresca 'tipo' en masa (fuera de la trx)
    if (inserted.length) {
      await pool.query(
        `UPDATE aeroscope a
         LEFT JOIN ffpp f        ON a.drone_id = f.serie
         LEFT JOIN aeronautica na ON a.drone_id = na.serie
         SET a.tipo =
           CASE
             WHEN f.serie  IS NOT NULL THEN 'ffpp'
             WHEN na.serie IS NOT NULL THEN 'aeronautica'
             ELSE 'hostil'
           END
         WHERE a.drone_id IS NOT NULL`
      );
    }

    
    // ---- RECONSTRUIR 'aeroscope_agrupado' (compat universal) ----
    if (inserted.length) {
      // vacía la tabla final
      await pool.query('TRUNCATE TABLE aeroscope_agrupado');

      // inicializa variables de usuario
      await pool.query('SET @grp := 0, @last_drone := NULL, @last_time := NULL');

      // inserta usando una sola pasada ordenada (gaps & islands, corte > 20 min)
      await pool.query(`
        INSERT INTO aeroscope_agrupado (
          flight_id, drone_id, drone_type, aeroscope_id,
          duration_sec, max_alt_m, longitude, latitude,
          time_start, time_end, tipo
        )
        SELECT
          MIN(flight_id)          AS flight_id,
          drone_id,
          MIN(drone_type)         AS drone_type,
          MIN(aeroscope_id)       AS aeroscope_id,
          MIN(duration_sec)       AS duration_sec,
          MIN(max_alt_m)          AS max_alt_m,
          MIN(longitude)          AS longitude,
          MIN(latitude)           AS latitude,
          MIN(time_start)         AS time_start,
          MAX(time_end)           AS time_end,
          MIN(tipo)               AS tipo
        FROM (
          SELECT
            a.*,
            (@grp := IF(
              @last_drone = a.drone_id
              AND TIMESTAMPDIFF(MINUTE, @last_time, a.time_start) <= 20,
              @grp, @grp + 1
            ))                          AS group_id,
            (@last_drone := a.drone_id) AS _ld,
            (@last_time  := a.time_start) AS _lt
          FROM aeroscope a
          WHERE a.time_start IS NOT NULL
          ORDER BY a.drone_id, a.time_start
        ) t
        GROUP BY drone_id, group_id
      `);
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
