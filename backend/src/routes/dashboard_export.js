// src/routes/dashboard_export.js
import { Router } from 'express'
import { pool } from '../db.js'
import os from 'os'

const router = Router()

function buildDateWhere(query, col = 'time_start') {
  const { start_dt, end_dt } = query
  let where = '1'
  const params = []

  const hasTime = (s = '') => /\d{2}:\d{2}(:\d{2})?$/.test(String(s))

  if (start_dt) {
    const v = hasTime(start_dt) ? start_dt : `${start_dt} 00:00:00`
    where += ` AND ${col} >= ?`
    params.push(v)
  }
  if (end_dt) {
    const v = hasTime(end_dt) ? end_dt : `${end_dt} 23:59:59`
    where += ` AND ${col} <= ?`
    params.push(v)
  }
  return { where, params }
}

function safeNum(n) { return Number.isFinite(Number(n)) ? Number(n) : 0 }

function summarizeKPIs(rows) {
  return {
    total: rows.length,
    ffpp: rows.filter(r => r.tipo === 'ffpp').length,
    aeronautica: rows.filter(r => r.tipo === 'aeronautica').length,
    hostil: rows.filter(r => r.tipo === 'hostil').length,
  }
}

function countBy(list, key) {
  const map = {}
  for (const it of list) {
    const k = it?.[key] ?? 'Desconocido'
    map[k] = (map[k] || 0) + 1
  }
  return map
}

function uniqueDronesBy(list, key) {
  const m = {}
  for (const it of list) {
    if (!it?.drone_id) continue
    const k = it?.[key] ?? 'Desconocido'
    if (!m[k]) m[k] = new Set()
    m[k].add(it.drone_id)
  }
  const out = {}
  Object.keys(m).forEach(k => out[k] = m[k].size)
  return out
}

function htmlTableFromMap(title, map) {
  const rows = Object.keys(map).sort().map(k => `
    <tr><td>${k}</td><td style="text-align:right">${map[k]}</td></tr>
  `).join('')
  return `
    <h3>${title}</h3>
    <table class="t">
      <thead><tr><th>Clave</th><th>Cantidad</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="2" class="muted">Sin datos</td></tr>'}</tbody>
    </table>
  `
}

function htmlKPIs(title, k) {
  return `
    <div class="kpis">
      <div class="kpi"><div class="lbl">Total</div><div class="num">${k.total}</div></div>
      <div class="kpi green"><div class="lbl">FFPP</div><div class="num">${k.ffpp}</div></div>
      <div class="kpi blue"><div class="lbl">Aeronáutica</div><div class="num">${k.aeronautica}</div></div>
      <div class="kpi red"><div class="lbl">Otros</div><div class="num">${k.hostil}</div></div>
    </div>
  `
}

function renderHTML({ filtros, kAero, kAg, cntAero, cntTipo, uniqAero, uniqTipo }) {
  const css = `
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#0f172a; }
    h1 { margin:0 0 6px; font-size:20px; }
    h2 { margin:18px 0 8px; font-size:16px; }
    h3 { margin:14px 0 6px; font-size:14px; }
    .meta { font-size:12px; color:#475569; margin-bottom:14px }
    .muted { color:#94a3b8; text-align:center }
    .wrap { padding:20px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap:14px; }
    .kpis { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:10px; margin:8px 0 14px; }
    .kpi { border:1px solid #e2e8f0; border-radius:10px; padding:10px; }
    .kpi .lbl { font-size:11px; color:#64748b; }
    .kpi .num { font-size:18px; font-weight:600; }
    .kpi.green .num { color:#16a34a }
    .kpi.blue .num  { color:#2563eb }
    .kpi.red .num   { color:#dc2626 }
    .t { width:100%; border-collapse: collapse; font-size:12px; }
    .t th, .t td { border:1px solid #e2e8f0; padding:6px 8px; }
    .twocol { display:grid; grid-template-columns: 1fr 1fr; gap:20px; }
    .card { border:1px solid #e2e8f0; border-radius:12px; padding:14px; }
  `
  const filtroStr = [
    filtros.start_dt ? `Inicio: <b>${filtros.start_dt}</b>` : null,
    filtros.end_dt ? `Fin: <b>${filtros.end_dt}</b>` : null,
    filtros.aeroscope_id ? `Aeroscope ID: <b>${filtros.aeroscope_id}</b>` : null,
    filtros.drone_id ? `Drone ID: <b>${filtros.drone_id}</b>` : null,
  ].filter(Boolean).join(' &nbsp; | &nbsp; ') || 'Sin filtros (todo el universo)'

  return `
  <!doctype html>
  <html>
  <head><meta charset="utf-8"><title>Informe Aeroscope</title>
  <style>${css}</style></head>
  <body>
    <div class="wrap">
      <h1>Informe de Dashboard — Aeroscope</h1>
      <div class="meta">${filtroStr}</div>

      <div class="card">
        <h2>KPIs (Aeroscope — filtrado)</h2>
        ${htmlKPIs('Aeroscope', kAero)}
        <h2>KPIs (Agrupado — filtrado)</h2>
        ${htmlKPIs('Agrupado', kAg)}
      </div>

      <div class="twocol" style="margin-top:16px">
        <div class="card">
          ${htmlTableFromMap('Detecciones vs Aeroscope', cntAero)}
          ${htmlTableFromMap('Drones únicos vs Aeroscope', uniqAero)}
        </div>
        <div class="card">
          ${htmlTableFromMap('Detecciones vs Tipo', cntTipo)}
          ${htmlTableFromMap('Drones únicos vs Tipo', uniqTipo)}
        </div>
      </div>

      <div class="meta" style="margin-top:16px">Generado por API • ${new Date().toLocaleString()}</div>
    </div>
  </body>
  </html>
  `
}

async function fetchFiltered(conn, table, query) {
  const base = buildDateWhere(query, 'time_start')
  let where = base.where
  const params = [...base.params]
  const { drone_id, aeroscope_id } = query

  if (drone_id)     { where += ' AND LOWER(TRIM(drone_id)) = LOWER(TRIM(?))'; params.push(String(drone_id)) }
  if (aeroscope_id) { where += ' AND LOWER(TRIM(aeroscope_id)) = LOWER(TRIM(?))'; params.push(String(aeroscope_id)) }

  const [rows] = await conn.query(`SELECT * FROM ${table} WHERE ${where}`, params)
  return rows
}

// POST/GET indistinto; manda PDF si hay Puppeteer, HTML si no.
router.post('/export-report', async (req, res) => {
  try {
    const q = { ...(req.query || {}), ...(req.body || {}) }

    const conn = pool // (pool ya maneja conexiones)

    const aeroRows = await fetchFiltered(conn, 'aeroscope', q)
    const agRows   = await fetchFiltered(conn, 'aeroscope_agrupado', q)

    const kAero = summarizeKPIs(aeroRows)
    const kAg   = summarizeKPIs(agRows)

    const cntAero = countBy(aeroRows, 'aeroscope_id')
    const cntTipo = countBy(aeroRows, 'drone_type')
    const uniqAero= uniqueDronesBy(aeroRows, 'aeroscope_id')
    const uniqTipo= uniqueDronesBy(aeroRows, 'drone_type')

    const html = renderHTML({
      filtros: {
        start_dt: q.start_dt || '',
        end_dt: q.end_dt || '',
        aeroscope_id: q.aeroscope_id || '',
        drone_id: q.drone_id || '',
      },
      kAero, kAg, cntAero, cntTipo, uniqAero, uniqTipo
    })

    // Intentar PDF con puppeteer si está disponible
    let puppeteer = null
    try { puppeteer = await import('puppeteer') } catch (_) {}

    if (puppeteer) {
      const browser = await puppeteer.launch({
        headless: 'new',
        args: os.platform() === 'linux'
          ? ['--no-sandbox', '--disable-setuid-sandbox']
          : []
      })
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' }
      })
      await browser.close()

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="informe_aeroscope.pdf"')
      return res.send(pdf)
    }

    // Fallback: enviar HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="informe_aeroscope.html"')
    res.send(html)

  } catch (err) {
    console.error('export-report error', err)
    res.status(500).json({ error: 'No se pudo generar el informe.' })
  }
})

export default router
