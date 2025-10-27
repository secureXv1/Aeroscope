// src/routes/aeroscope_agrupado.js
import { Router } from 'express';
import { pool } from '../db.js';
import { stringify } from 'csv-stringify/sync';

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


export default router;
