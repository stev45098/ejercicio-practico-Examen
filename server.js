import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'turnos.json');

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
if (!existsSync(dataFile)) {
  const initial = { nextId: 1, turnos: [] };
  await import('fs').then(fs => fs.writeFileSync(dataFile, JSON.stringify(initial, null, 2), 'utf-8'));
}

function loadDb() {
  const raw = readFileSync(dataFile, 'utf-8');
  return JSON.parse(raw);
}

async function saveDb(db) {
  const fsModule = await import('fs');
  // La importación dinámica permite funcionar en ESM sin require()
  fsModule.writeFileSync(dataFile, JSON.stringify(db, null, 2), 'utf-8');
}



function normalizeDate(d) {
  // Espera YYYY-MM-DD, devuelve string igual
  return String(d || '').trim();
}

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// GET turnos con filtros
// query: fecha=YYYY-MM-DD, servicio=string
app.get('/api/turnos', (req, res) => {
  const db = loadDb();
  const { fecha, servicio } = req.query;

  let result = db.turnos;
  if (fecha) result = result.filter(t => t.fecha === normalizeDate(fecha));
  if (servicio) result = result.filter(t => String(t.servicio).toLowerCase() === String(servicio).toLowerCase());

  res.json({ turnos: result });
});

// POST reserva
// body: { nombre, email, servicio, fecha, horario }
app.post('/api/turnos/reservar', async (req, res) => {
  const db = loadDb();

  const { nombre, email, servicio, fecha, horario } = req.body || {};

  const errors = [];
  if (!nombre || String(nombre).trim().length < 3) errors.push('Nombre inválido');
  if (!email || !String(email).includes('@')) errors.push('Email inválido');
  if (!servicio || String(servicio).trim().length < 3) errors.push('Servicio inválido');
  const f = normalizeDate(fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) errors.push('Fecha inválida (YYYY-MM-DD)');
  const h = String(horario || '').trim();
  if (!/^\d{2}:\d{2}$/.test(h)) errors.push('Horario inválido (HH:MM)');

  if (errors.length) return res.status(400).json({ ok: false, errors });

  // Reglas: no duplicar turno (misma fecha + horario + servicio)
  const exists = db.turnos.some(t => t.fecha === f && t.horario === h && String(t.servicio).toLowerCase() === String(servicio).toLowerCase());
  if (exists) return res.status(409).json({ ok: false, errors: ['Ese turno ya fue reservado'] });

  // Regla simple: máximo 3 reservas por email
  const count = db.turnos.filter(t => String(t.email).toLowerCase() === String(email).toLowerCase()).length;
  if (count >= 3) return res.status(409).json({ ok: false, errors: ['Límite de reservas alcanzado (máx. 3)'] });

  const id = db.nextId++;
  const turno = {
    id,
    nombre: String(nombre).trim(),
    email: String(email).trim().toLowerCase(),
    servicio: String(servicio).trim(),
    fecha: f,
    horario: h,
    estado: 'reservado',
    creadoEn: new Date().toISOString()
  };

  db.turnos.push(turno);
  await saveDb(db);


  res.json({ ok: true, turno });
});

app.post('/api/turnos/cancelar', async (req, res) => {
  const db = loadDb();

  const { id, email } = req.body || {};
  const numId = Number(id);

  if (!Number.isFinite(numId)) return res.status(400).json({ ok: false, errors: ['ID inválido'] });
  if (!email || !String(email).includes('@')) return res.status(400).json({ ok: false, errors: ['Email inválido'] });

  const idx = db.turnos.findIndex(t => t.id === numId);
  if (idx === -1) return res.status(404).json({ ok: false, errors: ['Turno no encontrado'] });

  const turno = db.turnos[idx];
  if (String(turno.email).toLowerCase() !== String(email).trim().toLowerCase()) {
    return res.status(403).json({ ok: false, errors: ['No autorizado para cancelar este turno'] });
  }

  db.turnos.splice(idx, 1);
  await saveDb(db);


  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ ok: false, errors: ['Error interno'] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`INTESUD - Portal de turnos escuchando en http://localhost:${PORT}`);
});

