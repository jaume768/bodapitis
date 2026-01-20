// seleccion.js
(() => {
  const LONG_PRESS_MS = 350;     // tiempo para considerar “pulsación larga”
  const MOVE_TOLERANCE = 12;     // tolerancia de movimiento en px para no cancelar el long-press

  const gallery = document.querySelector('.album-gallery');
  if (!gallery) return;

  // Barra de selección (X = limpiar selección)
  const bar = document.createElement('div');
  bar.className = 'selection-bar';
  bar.innerHTML = `
    <button type="button" class="selection-bar__delete" aria-label="Limpiar selección">✕</button>
    <div class="selection-bar__count" aria-live="polite">0 seleccionadas</div>
  `;
  document.body.appendChild(bar);

  const deleteBtn = bar.querySelector('.selection-bar__delete');
  const countEl   = bar.querySelector('.selection-bar__count');

  let selectionMode = false;
  const selected = new Set(); // guarda <img> seleccionadas
  let justExitedSelectionMode = false; // Flag para prevenir clicks inmediatos después de salir

  function updateCount() {
    const n = selected.size;
    countEl.textContent = n === 1 ? '1 seleccionada' : `${n} seleccionadas`;
  }

  function ensureSelectionMode() {
    if (selectionMode) return;
    selectionMode = true;
    document.body.classList.add('selecting');
  }

  function exitSelectionMode() {
    selectionMode = false;
    document.body.classList.remove('selecting');
    
    // Marcar que acabamos de salir del modo selección (usar window para que sea accesible desde album.js)
    window.justExitedSelectionMode = true;
    
    // Resetear el flag después de un momento seguro (300ms asegura que captura el click)
    setTimeout(() => {
      window.justExitedSelectionMode = false;
    }, 300);
  }

  function maybeExitSelectionMode() {
    if (selectionMode && selected.size === 0) exitSelectionMode();
  }

  function vibrate(ms = 10) {
    try { navigator.vibrate && navigator.vibrate(ms); } catch(_) {}
  }

  function toggleImage(img) {
    if (selected.has(img)) {
      selected.delete(img);
      img.classList.remove('is-selected');
      img.setAttribute('aria-pressed', 'false');
    } else {
      selected.add(img);
      img.classList.add('is-selected');
      img.setAttribute('aria-pressed', 'true');
    }
    updateCount();
    maybeExitSelectionMode();
  }

  // Función para descargar archivos seleccionados (descarga directa con fetch/blob)
  async function downloadSelected() {
    if (selected.size === 0) return;
    
    vibrate(15);
    const items = Array.from(selected);
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const url = item.dataset.url;
      const type = item.dataset.type || 'image';
      
      if (!url) continue;
      
      try {
        // Fetch para obtener el archivo como blob
        const response = await fetch(url);
        const blob = await response.blob();
        
        // Crear URL temporal del blob
        const blobUrl = URL.createObjectURL(blob);
        
        // Obtener extensión del archivo desde la URL
        const urlPath = new URL(url).pathname;
        const extension = urlPath.substring(urlPath.lastIndexOf('.'));
        
        // Crear enlace temporal y forzar descarga
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${type}_${Date.now()}_${i}${extension}`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Liberar el blob URL después de un momento
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        
        // Delay entre descargas para no saturar el navegador
        if (i < items.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      } catch (error) {
        console.error('Error descargando:', url, error);
      }
    }
    
    vibrate(15);
  }

  // Función para compartir archivos seleccionados (Web Share API con fallback a WhatsApp)
  async function shareSelected() {
    if (selected.size === 0) return;
    
    vibrate(15);
    const items = Array.from(selected);
    
    try {
      // Verificar si Web Share API está disponible
      if (navigator.share) {
        // Obtener los archivos como blobs y crear File objects
        const files = [];
        
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const url = item.dataset.url;
          
          if (!url) continue;
          
          try {
            const response = await fetch(url);
            const blob = await response.blob();
            
            // Obtener extensión y tipo MIME
            const urlPath = new URL(url).pathname;
            const extension = urlPath.substring(urlPath.lastIndexOf('.'));
            const fileName = `media_${Date.now()}_${i}${extension}`;
            
            // Crear File object desde blob
            const file = new File([blob], fileName, { type: blob.type });
            files.push(file);
          } catch (error) {
            console.error('Error obteniendo archivo:', url, error);
          }
        }
        
        if (files.length > 0) {
          // Compartir usando Web Share API
          await navigator.share({
            files: files,
            title: 'Fotos y videos',
            text: `Compartiendo ${files.length} archivo${files.length > 1 ? 's' : ''}`
          });
          vibrate(15);
        }
      } else {
        // Fallback: abrir WhatsApp Web con las URLs
        const urls = items
          .map(item => item.dataset.url)
          .filter(url => url)
          .join('\n');
        
        if (urls) {
          const text = encodeURIComponent(`Mira estas fotos y videos:\n\n${urls}`);
          window.open(`https://wa.me/?text=${text}`, '_blank');
          vibrate(15);
        }
      }
    } catch (error) {
      // Si el usuario cancela o hay error, no hacer nada
      console.log('Compartir cancelado o error:', error);
    }
  }

  // Exponer funciones globalmente para que los botones del menú inferior puedan usarlas
  window.downloadSelected = downloadSelected;
  window.shareSelected = shareSelected;

  // ✕ ahora SOLO deselecciona (no borra, no pregunta)
  deleteBtn.addEventListener('click', () => {
    if (selected.size === 0) {
      exitSelectionMode();
      return;
    }
    selected.forEach(img => {
      img.classList.remove('is-selected');
      img.setAttribute('aria-pressed', 'false');
    });
    selected.clear();
    updateCount();
    exitSelectionMode();
    vibrate(8);
  });

  const state = new WeakMap(); // img -> {timer, startX, startY, longTriggered}

  gallery.addEventListener('pointerdown', (ev) => {
    const img = ev.target.closest('.album-img');
    if (!img) return;

    if (ev.pointerType !== 'touch' && ev.pointerType !== 'pen') return;

    img.setPointerCapture?.(ev.pointerId);

    const info = {
      timer: null,
      startX: ev.clientX,
      startY: ev.clientY,
      longTriggered: false
    };
    state.set(img, info);

    info.timer = setTimeout(() => {
      info.longTriggered = true;
      ensureSelectionMode();
      toggleImage(img);
      vibrate(15);
    }, LONG_PRESS_MS);
  });

  gallery.addEventListener('pointermove', (ev) => {
    const img = ev.target.closest('.album-img');
    if (!img) return;
    const info = state.get(img);
    if (!info || info.longTriggered) return;

    const dx = Math.abs(ev.clientX - info.startX);
    const dy = Math.abs(ev.clientY - info.startY);
    if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) {
      clearTimeout(info.timer);
      info.timer = null;
      state.delete(img);
    }
  });

  const clearTimers = (img) => {
    const info = state.get(img);
    if (!info) return;
    if (info.timer) clearTimeout(info.timer);
    state.delete(img);
  };

  gallery.addEventListener('pointerup', (ev) => {
    const img = ev.target.closest('.album-img');
    if (!img) return;

    const info = state.get(img);
    const longTriggered = info?.longTriggered === true;
    
    // Capturar el estado ANTES de hacer cambios
    const wasInSelectionMode = selectionMode;

    clearTimers(img);

    if (!longTriggered) {
      if (wasInSelectionMode) {
        // Prevenir SIEMPRE si estábamos en modo selección, incluso si salimos después
        ev.preventDefault();
        ev.stopPropagation();
        toggleImage(img);
        vibrate(7);
      }
    } else {
      // Si fue long-press, prevenir el click que vendría después
      ev.preventDefault();
      ev.stopPropagation();
    }
  });

  gallery.addEventListener('pointercancel', (ev) => {
    const img = ev.target.closest('.album-img');
    if (!img) return;
    clearTimers(img);
  });

  document.addEventListener('pointerdown', (ev) => {
    if (!selectionMode) return;
    if (ev.target.closest('.album-img') || ev.target.closest('.selection-bar')) return;
    if (selected.size === 0) exitSelectionMode();
  });

  document.querySelectorAll('.album-img').forEach(img => {
    img.setAttribute('role', 'button');
    img.setAttribute('aria-pressed', 'false');
  });

  // Interceptar clicks en fase de captura para prevenir apertura del visor
  // cuando acabamos de salir del modo selección
  gallery.addEventListener('click', (ev) => {
    if (window.justExitedSelectionMode) {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
    }
  }, true); // true = capture phase, se ejecuta ANTES que los listeners normales
})();
