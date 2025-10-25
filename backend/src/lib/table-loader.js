import fs from 'fs'
import { parse } from 'csv-parse'
import * as XLSX from 'xlsx'

/**
 * Lee filas desde .csv o .xlsx, devolviendo array de objetos (keys = encabezados).
 * - CSV: intenta delimitador "," y ";".
 * - Excel: toma la primera hoja; valores vacíos -> '' (defval).
 */
export async function loadRowsFromFile(filePath, originalName) {
  const lower = (originalName || '').toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' })
    const sheet = wb.SheetNames[0]
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '' })
    return rows
  }
  // CSV: intenta con coma y luego con punto y coma
  const tryParse = (delimiter) =>
    new Promise((resolve, reject) => {
      const out = []
      fs.createReadStream(filePath)
        .pipe(parse({
          columns: true,
          trim: true,
          skip_empty_lines: true,
          delimiter,              // ',' o ';'
          encoding: 'utf8',       // BOM ok
        }))
        .on('data', (r) => out.push(r))
        .on('end', () => resolve(out))
        .on('error', reject)
    })

  try {
    const rowsComma = await tryParse(',')
    // Si hay encabezados pero 0 filas, intenta con ';'
    if (rowsComma.length === 0) {
      const rowsSemi = await tryParse(';')
      return rowsSemi
    }
    return rowsComma
  } catch {
    // último intento con ';'
    return await tryParse(';')
  }
}

/** Normaliza nombres de encabezado: quita acentos, espacios y símbolos */
export const normalizeKey = (s = '') =>
  String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase()

/** Obtiene el valor de la fila para una lista de candidatos normalizados */
export function pick(row, candidates) {
  const index = {}
  for (const k of Object.keys(row)) index[normalizeKey(k)] = k
  for (const cand of candidates) {
    const key = index[cand]
    if (key) return row[key]
  }
  return ''
}

/** Fecha flexible: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, o ISO libre */
export function parseDateFlex(s) {
  if (!s) return null
  const v = String(s).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v)
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const [_, dd, mm, yyyy] = m
    return new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}T00:00:00Z`)
  }
  const dt = new Date(v)
  return isNaN(dt) ? null : dt
}
