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

  const inserted = [];
  const errors = [];

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const rows = await loadRowsFromFile(filePath, req.file.originalname);

    for (const row of rows) {
      const matricula        = pick(row, ['matricula','matrícula']);
      const entidad          = pick(row, ['entidad']);
      const marca            = pick(row, ['marca']);
      const modelo           = pick(row, ['modelo']);
      const peso             = pick(row, ['peso','pesokg','peso_kg']);
      const tipo_uas         = pick(row, ['tipouas','tipo_uas']);
      const pais_fabricacion = pick(row, ['paisdefabricacion','pais_fabricacion']);
      const serie            = pick(row, ['serie']);

      if (!matricula) { errors.push({ row, error: 'MATRICULA vacía' }); continue; }

      inserted.push([
        matricula,
        entidad || null,
        marca || null,
        modelo || null,
        peso ? Number(peso) : null,
        tipo_uas || null,
        pais_fabricacion || null,
        serie || null,
      ]);
    }

    if (inserted.length) {
      await conn.query(
        `INSERT INTO aeronautica
         (matricula, entidad, marca, modelo, peso_kg, tipo_uas, pais_fabricacion, serie)
         VALUES ?`,
        [inserted]
      );
    }

    await conn.commit();
    res.json({ ok: true, inserted: inserted.length, errors });
  } catch (e) {
    await conn.rollback();
    console.error('[AERONAUTICA upload] ', e);
    res.status(500).json({ error: 'Error procesando archivo' });
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
