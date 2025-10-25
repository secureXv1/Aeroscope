// backend/src/routes/ffpp.js
import { Router } from 'express';
import { pool } from '../db.js';

// 👇 SOLO estos imports; NO declares normalize/pick aquí
import multer from 'multer';
import fs from 'fs';
import { loadRowsFromFile, pick, parseDateFlex } from '../lib/table-loader.js';

const router = Router();

/* ========= Listado CRUD ========= */
router.get('/', async (req, res) => {
  const { page = 1, pageSize = 12, q = '' } = req.query;
  const offset = (Number(page) - 1) * Number(pageSize);
  const like = `%${q}%`;

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM ffpp WHERE entidad LIKE ? OR equipo LIKE ? OR serie LIKE ?`, 
    [like, like, like]
  );
  const [rows] = await pool.query(
    `SELECT * FROM ffpp WHERE entidad LIKE ? OR equipo LIKE ? OR serie LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?`, 
    [like, like, like, Number(pageSize), offset]
  );

  res.json({ total, page: Number(page), pageSize: Number(pageSize), items: rows });
});

router.post('/', async (req, res) => {
  const { entidad, equipo, matricula, serie } = req.body;

  // Valida que la serie no se repita
  if (serie) {
    const [[exists]] = await pool.query('SELECT COUNT(*) AS cnt FROM ffpp WHERE serie = ?', [serie]);
    if (exists.cnt > 0) {
      return res.status(400).json({ error: 'Ya existe un registro con esa SERIE.' });
    }
  }

  await pool.query(
    `INSERT INTO ffpp (entidad, equipo, matricula, serie)
     VALUES (?,?,?,?)`,
    [entidad, equipo, matricula, serie || null]
  );

  res.json({ ok: true });
});

router.put('/:id', async (req, res) => {
  const { entidad, equipo, matricula, serie } = req.body;
  await pool.query(
    `UPDATE ffpp SET entidad=?, equipo=?, matricula=?, serie=? WHERE id=?`,
    [entidad, equipo, matricula, serie || null, req.params.id]
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await pool.query(`DELETE FROM ffpp WHERE id=?`, [req.params.id]);
  res.json({ ok: true });
});

/* ========= Carga CSV/XLSX =========
   Encabezados aceptados (normalizados): ENTIDAD, EQUIPO, MATRICULA, SERIE, FECHA DE RECOLECCION
*/
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
      const entidad   = pick(row, ['entidad']);
      const equipo    = pick(row, ['equipo']);
      const matricula = pick(row, ['matricula','matrícula']);
      const serie     = pick(row, ['serie']);
      const fechaRaw  = pick(row, [
        'fechaderecoleccion','fecharecoleccion','fehaderecoleccion','fharecoleccion'
      ]);

      // Requiere al menos ENTIDAD
      if (!entidad) {
        errors.push({ row, error: 'Campo ENTIDAD vacío (obligatorio)' });
        continue;
      }

      inserted.push([
        entidad,
        equipo || null,
        matricula || null,
        serie || null,
        parseDateFlex(fechaRaw) ? new Date(parseDateFlex(fechaRaw)) : null,
      ]);
    }

    if (inserted.length) {
      const series = inserted.map(r => r[3]).filter(Boolean); // Columna 3 es 'serie'
      if (series.length) {
        const [existing] = await conn.query(
          `SELECT serie FROM ffpp WHERE serie IN (?)`, [series]
        );
        const existingSeries = new Set(existing.map(r => r.serie));
        // Quita del array los repetidos
        let omitidos = 0;
        for (let i = inserted.length - 1; i >= 0; i--) {
          if (existingSeries.has(inserted[i][3])) {
            errors.push({ row: inserted[i], error: 'Serie ya existente (omitido)' });
            inserted.splice(i, 1);
            omitidos++;
          }
        }
      }
    }

    await conn.commit();
    res.json({ ok: true, inserted: inserted.length, errors });
  } catch (e) {
    await conn.rollback();
    console.error('[FFPP upload]', e);
    res.status(500).json({ error: 'Error procesando archivo' });
  } finally {
    fs.unlink(filePath, () => {});
    conn.release();
  }
});

router.get('/kpi', async (req, res) => {
  const { start, end } = req.query
  let where = '1'
  const params = []
  if (start) { where += ' AND fecha_recoleccion >= ?'; params.push(start) }
  if (end)   { where += ' AND fecha_recoleccion <= ?'; params.push(end) }
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM ffpp WHERE ${where}`, params
  )
  res.json({ total })
})

export default router;
