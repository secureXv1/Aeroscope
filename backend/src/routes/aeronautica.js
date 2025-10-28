// backend/src/routes/aeronautica.js
import { Router } from 'express';
import { pool } from '../db.js';

import multer from 'multer';
import fs from 'fs';

// 👇 usa el helper; NO declares normalize/pick aquí
import { loadRowsFromFile, pick } from '../lib/table-loader.js';

const router = Router();

/* ========= CRUD ========= */
// GET paginado y búsqueda
router.get('/', async (req, res) => {
  const { page = 1, pageSize = 12, q = '' } = req.query;
  const offset = (Number(page) - 1) * Number(pageSize);
  const like = `%${q}%`;
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM aeronautica
     WHERE matricula LIKE ? OR entidad LIKE ? OR marca LIKE ? OR modelo LIKE ? OR serie LIKE ?`,
    [like, like, like, like, like]
  );
  const [rows] = await pool.query(
    `SELECT * FROM aeronautica
     WHERE matricula LIKE ? OR entidad LIKE ? OR marca LIKE ? OR modelo LIKE ? OR serie LIKE ?
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [like, like, like, like, like, Number(pageSize), offset]
  );
  res.json({ total, page: Number(page), pageSize: Number(pageSize), items: rows });
});

router.put('/:id', async (req, res) => {
  const {
    matricula, entidad, marca, modelo, peso_kg, tipo_uas, pais_fabricacion, serie
  } = req.body;

  await pool.query(
    `UPDATE aeronautica SET
     matricula=?, entidad=?, marca=?, modelo=?, peso_kg=?, tipo_uas=?, pais_fabricacion=?, serie=?
     WHERE id=?`,
    [matricula, entidad, marca, modelo, peso_kg || null, tipo_uas, pais_fabricacion, serie, req.params.id]
  );

  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await pool.query(`DELETE FROM aeronautica WHERE id=?`, [req.params.id]);
  res.json({ ok: true });
});

/* ========= Carga CSV/XLSX ========= */
const upload = multer({ dest: 'src/uploads/' });

router.post('/upload-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo no enviado' });
  const filePath = req.file.path;

  const insertedRows = [];
  const errors = [];

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    // 1) Leer CSV “;”
    let csvText = fs.readFileSync(filePath, 'utf8');
    // quita BOM si viene
    if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);

    const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
    if (!lines.length) throw new Error('CSV vacío');

    // 2) Normalizador de headers: minúsculas, sin acentos/espacios/puntuación
    const norm = (s = '') =>
      String(s)
        .trim()
        .toLowerCase()
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')     // quita acentos
        .replace(/[°º]/g, 'o')
        .replace(/[().,]/g, '')
        .replace(/\s*\/\s*/g, '_')                           // uas/equip -> uas_equip
        .replace(/\s+/g, ' ')
        .replace(/\s/g, '_');

    const headersRaw = lines[0].split(';').map(h => h.trim());
    const headers = headersRaw.map(norm);

    const rows = lines.slice(1).map(line => {
      const cols = line.split(';');
      const obj = {};
      headers.forEach((h, i) => (obj[h] = (cols[i] ?? '').trim()));
      return obj;
    });

    // 3) Helpers
    const toNumber = (s) => {
      if (s == null || s === '') return null;
      const n = Number(String(s).replace(',', '.').replace(/[^\d.\-]/g, ''));
      return Number.isNaN(n) ? null : n;
    };
    const pick = (o, keys) => {
      for (const k of keys) {
        const v = o[k];
        if (v != null && String(v).trim() !== '') return String(v).trim();
      }
      return null;
    };

    // 4) Mapeo flexible de columnas esperadas
    // (adapta a tus títulos reales; ya vienen normalizados)
    for (const row of rows) {
      const numero            = pick(row, ['numero', 'nro', 'num']);
      const registroAsociado  = pick(row, [
        'n_registro_uas_equip_asociado',
        'n_registro',
        'registro_uas_equip_asociado',
        'n_registro_uas',
        'n_registro_equip_asociado'
      ]);
      const propietario       = pick(row, ['propietario', 'entidad']);
      const marca             = pick(row, ['marca']);
      const modelo            = pick(row, ['modelo']);
      const peso_g            = toNumber(pick(row, ['peso_g', 'peso', 'peso_kg', 'peso_g_', 'peso_g__']));
      const tipo_uas          = pick(row, ['tipo_uas_multirrotor', 'tipo_uas_multirotor', 'tipo_uas']);
      const pais              = pick(row, ['pais_de_fabricacion', 'pais_fabricacion', 'pais']);
      const serie             = pick(row, ['serie', 'n_de_serie', 'numero_de_serie']);

      // matricula = preferimos el "registro asociado", si no, el número simple
      const matricula = registroAsociado || numero || null;

      // Validación mínima: al menos una clave de identidad (serie o matricula)
      if (!serie && !matricula) {
        errors.push({ row, error: 'Sin número de registro ni serie' });
        continue;
      }

      insertedRows.push([
        matricula,               // matricula (NULL permitida)
        propietario || null,     // entidad
        marca || null,
        modelo || null,
        peso_g,                  // peso_kg
        tipo_uas || null,
        pais || null,
        serie ? String(serie) : null   // serie SIEMPRE como string
      ]);
    }

    // 5) Deduplicar EN MEMORIA por serie (dejamos la primera aparición)
    const seenSerie = new Set();
    const seenMat   = new Set();
    const deduped = [];
    let dupInFile = 0;

    for (const row of insertedRows) {
      // row: [matricula, entidad, marca, modelo, peso_kg, tipo_uas, pais_fabricacion, serie]
      const serie = (row[7] ?? '').trim();
      const serieKey = serie ? serie.toUpperCase() : null;

      // Si no hay serie, intenta deduplicar por matricula
      const mat = (row[0] ?? '').trim();
      const matKey = mat ? mat.toUpperCase() : null;

      if (serieKey) {
        if (seenSerie.has(serieKey)) { dupInFile++; continue; }
        seenSerie.add(serieKey);
        deduped.push(row);
      } else if (matKey) {
        if (seenMat.has(matKey)) { dupInFile++; continue; }
        seenMat.add(matKey);
        deduped.push(row);
      } else {
        // (no debería ocurrir por la validación de arriba)
        dupInFile++;
      }
    }

    // 6) Insertar: “dejemos solo uno” -> usamos INSERT IGNORE para respetar UNIQUE(serie)
    //    - Si ya existe en BD, se ignora la fila y no rompe.
    let affected = 0;
    if (deduped.length) {
      const [result] = await conn.query(
        `INSERT INTO aeronautica (matricula, entidad, marca, modelo, peso_kg, tipo_uas, pais_fabricacion, serie)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            matricula=COALESCE(VALUES(matricula), matricula),
            entidad=COALESCE(VALUES(entidad), entidad),
            marca=COALESCE(VALUES(marca), marca),
            modelo=COALESCE(VALUES(modelo), modelo),
            peso_kg=COALESCE(VALUES(peso_kg), peso_kg),
            tipo_uas=COALESCE(VALUES(tipo_uas), tipo_uas),
            pais_fabricacion=COALESCE(VALUES(pais_fabricacion), pais_fabricacion)
          `,
        [deduped]
      );
      affected = Number(result?.affectedRows || 0);
    }

    await conn.commit();

    // Filas omitidas = duplicadas en el archivo + ignoradas por clave única existente
    const omitidas = (deduped.length - affected) + dupInFile;

    res.json({
      ok: true,
      inserted: affected,
      omitidas,
      errors
    });
  } catch (e) {
    await conn.rollback();
    console.error('[AERONAUTICA upload]', e);
    res.status(500).json({ error: 'Error procesando CSV' });
  } finally {
    fs.unlink(filePath, () => {});
    conn.release();
  }
});


router.get('/kpi', async (req, res) => {
  // si tienes un campo de fecha, filtra por él. Si no, solo cuenta matrículas únicas
  const { start, end } = req.query
  let where = '1'
  const params = []
  // Por ejemplo, si aeronautica tiene un campo de fecha: fecha_registro
  // if (start) { where += ' AND fecha_registro >= ?'; params.push(start) }
  // if (end)   { where += ' AND fecha_registro <= ?'; params.push(end) }
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(DISTINCT matricula) AS total FROM aeronautica WHERE ${where}`, params
  )
  res.json({ total })
})

router.post('/', async (req, res) => {
  const {
    matricula, entidad, marca, modelo, peso_kg, tipo_uas, pais_fabricacion, serie
  } = req.body;

  // Valida que la serie no se repita (salvo vacío)
  if (serie) {
    const [[exists]] = await pool.query('SELECT COUNT(*) AS cnt FROM aeronautica WHERE serie = ?', [serie]);
    if (exists.cnt > 0) {
      return res.status(400).json({ error: 'Ya existe un registro con esa SERIE.' });
    }
  }

  await pool.query(
    `INSERT INTO aeronautica
     (matricula, entidad, marca, modelo, peso_kg, tipo_uas, pais_fabricacion, serie)
     VALUES (?,?,?,?,?,?,?,?)`,
    [matricula, entidad, marca, modelo, peso_kg || null, tipo_uas, pais_fabricacion, serie]
  );

  res.json({ ok: true });
});



export default router;
