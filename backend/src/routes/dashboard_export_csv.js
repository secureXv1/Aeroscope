// src/routes/dashboard_export_csv.js
import { Router } from 'express'
import { pool } from '../db.js'
import { stringify } from 'csv-stringify/sync'

const router = Router()

function buildDateWhere (query, col = 'time_start') {
  const { start_dt, end_dt } = query
  let where = '1'
  const params = []
  const hasTime = (s = '') => /\d{2}:\d{2}(:\d{2})?$/.test(String(s || ''))

  if (start_dt) {
    const v = hasTime(start_dt) ? start_dt : `${start_dt} 00:00:00`
    where += ` AND ${col} >= ?`; params.push(v)
  }
  if (end_dt) {
    const v = hasTime(end_dt) ? end_dt : `${end_dt} 23:59:59`
    where += ` AND ${col} <= ?`; params.push(v)
  }
  return { where, params }
}

async function fetchFiltered(table, query) {
  const base = buildDateWhere(query, 'time_start')
  let where = base.where
  const params = [...base.params]

  const { drone_id, aeroscope_id } = query
  if (drone_id)     { where += ' AND LOWER(TRIM(drone_id)) = LOWER(TRIM(?))'; params.push(String(drone_id)) }
  if (aeroscope_id) { where += ' AND LOWER(TRIM(aeroscope_id)) = LOWER(TRIM(?))'; params.push(String(aeroscope_id)) }

  const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${where}`, params)
  return rows
}

const normDT = v => String(v ?? '').replace('T',' ').slice(0,19)

router.get('/export-csv', async (req, res) => {
  try {
    const q = req.query || {}

    // 1) Traer ambos datasets con los mismos filtros
    const aRows = await fetchFiltered('aeroscope', q)
    const gRows = await fetchFiltered('aeroscope_agrupado', q)

    // 2) Unificarlos en una sola tabla homogénea
    const rows = [
      ...aRows.map(r => ({
        fuente: 'aeroscope',
        flight_id: r.flight_id,
        drone_id: r.drone_id,
        drone_type: r.drone_type,
        aeroscope_id: r.aeroscope_id,
        duration_sec: r.duration_sec,
        max_alt_m: r.max_alt_m,
        longitude: r.longitude,
        latitude: r.latitude,
        time_start: normDT(r.time_start),
        time_end: normDT(r.time_end),
        tipo: r.tipo
      })),
      ...gRows.map(r => ({
        fuente: 'aeroscope_agrupado',
        flight_id: r.flight_id,
        drone_id: r.drone_id,
        drone_type: r.drone_type,
        aeroscope_id: r.aeroscope_id,
        duration_sec: r.duration_sec,
        max_alt_m: r.max_alt_m,
        longitude: r.longitude,
        latitude: r.latitude,
        time_start: normDT(r.time_start),
        time_end: normDT(r.time_end),
        tipo: r.tipo
      }))
    ]

    // 3) CSV único
    const csv = stringify(rows, { header: true, bom: true })
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="informe_dashboard.csv"')
    res.send(csv)
  } catch (err) {
    console.error('export-csv error', err)
    res.status(500).json({ error: 'No se pudo generar el CSV.' })
  }
})

export default router
