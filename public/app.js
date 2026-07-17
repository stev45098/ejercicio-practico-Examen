const apiBase = '';

const $ = (sel) => document.querySelector(sel);
const reserveForm = $('#reserveForm');
const reserveMsg = $('#reserveMsg');
const turnosList = $('#turnosList');
const emailQuery = $('#emailQuery');
const loadBtn = $('#loadBtn');
const cancelMsg = $('#cancelMsg');

function setMessage(el, kind, text) {
  el.className = `message ${kind || ''}`.trim();
  el.textContent = text;
}

reserveForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  reserveMsg.textContent = '';

  const form = new FormData(reserveForm);
  const payload = {
    nombre: form.get('nombre'),
    email: form.get('email'),
    servicio: form.get('servicio'),
    fecha: form.get('fecha'),
    horario: form.get('horario'),
  };

  try {
    const resp = await fetch(`${apiBase}/api/turnos/reservar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();
    if (!resp.ok) {
      setMessage(reserveMsg, 'error', (data.errors || ['Error']).join(' · '));
      return;
    }

    setMessage(reserveMsg, 'ok', `Turno reservado (ID: ${data.turno.id}).`);
    reserveForm.reset();
    // Autorefresco si el email coincide
    if (String(payload.email).toLowerCase() === String(emailQuery.value).toLowerCase()) {
      await loadTurnos();
    }
  } catch (err) {
    setMessage(reserveMsg, 'error', 'No se pudo conectar al servidor.');
  }
});

async function fetchTurnosForEmail(email) {
  // Como la API lista por fecha/servicio, cargamos por un rango simple.
  // En este ejercicio, pedimos mostrar los turnos del email del conjunto disponible (sin paginación).
  // Para simplificar: traemos todos los turnos filtrando en frontend por email.
  const resp = await fetch(`${apiBase}/api/turnos`);
  const data = await resp.json();
  const all = data.turnos || [];
  const mine = all.filter(t => String(t.email).toLowerCase() === String(email).toLowerCase());
  return mine;
}

async function loadTurnos() {
  cancelMsg.textContent = '';
  turnosList.innerHTML = '';

  const email = String(emailQuery.value || '').trim();
  if (!email || !email.includes('@')) {
    setMessage(cancelMsg, 'error', 'Ingresá un email válido.');
    return;
  }

  try {
    const mine = await fetchTurnosForEmail(email);

    if (!mine.length) {
      turnosList.innerHTML = '<div class="muted">No hay turnos reservados.</div>';
      return;
    }

    turnosList.innerHTML = mine
      .sort((a, b) => (a.fecha + a.horario).localeCompare(b.fecha + b.horario))
      .map(t => {
        return `
          <div class="turno">
            <div>
              <div class="strong">${escapeHtml(t.servicio)}</div>
              <div class="muted">${t.fecha} · ${t.horario}</div>
              <div class="muted">ID: ${t.id}</div>
            </div>
            <div class="actions">
              <button class="btn danger" type="button" data-id="${t.id}">Cancelar</button>
            </div>
          </div>
        `;
      }).join('');

    turnosList.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', () => cancelarTurno(btn.getAttribute('data-id')));
    });
  } catch (err) {
    setMessage(cancelMsg, 'error', 'Error al cargar turnos.');
  }
}

async function cancelarTurno(id) {
  const email = String(emailQuery.value || '').trim();
  if (!email || !email.includes('@')) {
    setMessage(cancelMsg, 'error', 'Ingresá tu email para cancelar.');
    return;
  }

  cancelMsg.textContent = '';
  try {
    const resp = await fetch(`${apiBase}/api/turnos/cancelar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(id), email })
    });
    const data = await resp.json();
    if (!resp.ok) {
      setMessage(cancelMsg, 'error', (data.errors || ['Error']).join(' · '));
      return;
    }
    setMessage(cancelMsg, 'ok', 'Turno cancelado.');
    await loadTurnos();
  } catch {
    setMessage(cancelMsg, 'error', 'No se pudo cancelar.');
  }
}

loadBtn.addEventListener('click', loadTurnos);

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
}

