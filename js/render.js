// Render principal: despacha la pantalla activa y el aviso de WhatsApp.

/* ---------- Render principal ---------- */

function render() {
  const app = document.getElementById('app');
  if (loading) {
    app.innerHTML = '<div class="loading-screen">Cargando…</div>';
    return;
  }

  let body = '';
  if (view.screen === 'calendar') {
    body = `
      <div class="header">
        <div class="header-inner">
          <div class="eyebrow">Volea Beach Forever 🏝️</div>
          <div class="title-row">
            <h1 class="title">Calendario</h1>
          </div>
        </div>
      </div>
      ${renderCalendar()}
      ${renderTorneosSection()}
    `;
  } else if (view.screen === 'list') {
    body = renderListView();
  } else if (view.screen === 'torneo') {
    body = renderTorneoView();
  }

  app.innerHTML = body + renderNewListModal() + renderNewRedModal() + renderNewTorneoModal() + renderEditarTorneoModal() + renderNotifyModal();
}

function renderNotifyModal() {
  if (!notifyMessage) return '';
  return `
    <div class="modal-overlay" onclick="if(event.target===this) closeNotify()">
      <div class="modal-box">
        <h3 class="modal-title">📣 Avisar al grupo</h3>
        <p style="font-size:14px; line-height:1.5; margin:0 0 18px; background:var(--sand); padding:12px 14px; border-radius:10px;">${esc(notifyMessage)}</p>
        <div class="modal-actions">
          <button class="modal-btn cancel" onclick="closeNotify()">No avisar</button>
          <button class="modal-btn confirm" onclick="copyAndOpenWhatsapp()">Copiar y abrir WhatsApp</button>
        </div>
      </div>
    </div>
  `;
}

