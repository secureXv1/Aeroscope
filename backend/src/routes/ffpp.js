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
   Encabezados aceptados (normalizados): ENTIDAD, EQUIPO, MATRICULA, SERIE, (fecha se ignora)
*/
const upload = multer({ dest: 'src/uploads/' });

router.post('/upload-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo no enviado' });

  const filePath = req.file.path;
  const errors = [];

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    // 1) Cargar filas con tu helper (admite CSV/XLSX y normaliza headers)
    const rows = await loadRowsFromFile(filePath, req.file.originalname);

    // 2) Armar registros base (ignoramos fecha)
    //    - Requerimos SERIE para clave única; si falta, se omite.
    //    - Si hay varias filas con la misma serie, la ÚLTIMA del archivo gana.
    const bySerie = new Map(); // serie => { entidad, equipo, matricula, serie }

    for (const row of rows) {
      const entidad   = pick(row, ['entidad']);
      const equipo    = pick(row, ['equipo', 'modelo', 'equipo_modelo']); // por si el CSV trae “modelo”
      const matricula = pick(row, ['matricula','matrícula','registro']);
      const serie     = pick(row, ['serie','n_serie','numero_serie','num_serie']);

      if (!serie) {
        errors.push({ row, error: 'SIN SERIE (omitido)' });
        continue;
      }

      // La última del archivo sobreescribe (más “actual”)
      bySerie.set(String(serie).trim(), {
        entidad: entidad || null,
        equipo:  equipo  || null,
        matricula: matricula || null,
        serie: String(serie).trim()
      });
    }

    const records = Array.from(bySerie.values());
    let inserted = 0;
    let updated  = 0;

    if (records.length) {
      // 3) Bulk UPSERT (serie es UNIQUE)
      // - Si no existe, inserta.
      // - Si ya existe, actualiza entidad/equipo/matricula y updated_at.
      const values = records.map(r => [r.entidad, r.equipo, r.matricula, r.serie]);

      const [result] = await conn.query(
        `INSERT INTO ffpp (entidad, equipo, matricula, serie)
         VALUES ?
         ON DUPLICATE KEY UPDATE
           entidad = VALUES(entidad),
           equipo = VALUES(equipo),
           matricula = VALUES(matricula),
           updated_at = CURRENT_TIMESTAMP`,
        [values]
      );

      // MySQL: affectedRows = inserts*1 + updates*2
      const affected = Number(result?.affectedRows || 0);
      // Estimar inserts/updates
      // updates aproximados = affected - records.length (cuando hubo UPSERT)
      // pero si todas eran nuevas, affected === records.length
      if (affected <= records.length) {
        inserted = affected;
        updated  = 0;
      } else {
        updated  = affected - records.length;
        inserted = records.length - (updated / 2);
      }
    }

    await conn.commit();

    res.json({
      ok: true,
      inserted,
      updated,
      omitidas: errors.length,
      errors
    });
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
