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

  // Función para descargar archivos seleccionados
  // IMPORTANTE: En móviles, las descargas programáticas suelen fallar por CORS y restricciones del navegador
  // La solución más confiable es abrir los archivos para que el usuario los descargue manualmente
  async function downloadSelected() {
    if (selected.size === 0) return;
    
    vibrate(15);
    const items = Array.from(selected);
    
    // Detectar si es móvil (Android o iOS)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // En móviles, abrir archivos en nueva pestaña
      // El usuario puede usar "mantener presionado > guardar imagen/video"
      if (items.length > 3) {
        const confirm = window.confirm(`Vas a abrir ${items.length} archivos en nuevas pestañas.\n\nPara guardarlos:\n1. Mantén presionado sobre cada archivo\n2. Selecciona "Guardar imagen" o "Descargar"\n\n¿Continuar?`);
        if (!confirm) return;
      }
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const url = item.dataset.url;
        
        if (!url) continue;
        
        try {
          // Abrir en nueva pestaña
          window.open(url, '_blank');
          
          // Delay entre aperturas para evitar bloqueo del navegador
          if (i < items.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 600));
          }
        } catch (error) {
          console.error('Error abriendo archivo:', url, error);
        }
      }
      
      vibrate(15);
      
      // Mostrar instrucciones
      if (items.length > 0) {
        setTimeout(() => {
          alert('Para guardar los archivos:\n\n1. Mantén presionado sobre la imagen/video\n2. Selecciona "Guardar" o "Descargar"');
        }, 1000);
      }
    } else {
      // En desktop, intentar descarga directa
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const url = item.dataset.url;
        const type = item.dataset.type || 'image';
        
        if (!url) continue;
        
        try {
          // Intentar descarga directa desde URL
          const a = document.createElement('a');
          a.href = url;
          a.download = `${type}_${Date.now()}_${i}`;
          a.target = '_blank';
          
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          // Delay entre descargas
          if (i < items.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (error) {
          console.error('Error descargando:', url, error);
          // Fallback: abrir en nueva pestaña
          window.open(url, '_blank');
        }
      }
      
      vibrate(15);
    }
  }

  // Función para compartir archivos seleccionados
  // IMPORTANTE: Compartir archivos con fetch/blob puede fallar por CORS
  // Mejor compartir URLs directas que funciona más confiable
  async function shareSelected() {
    if (selected.size === 0) return;
    
    vibrate(15);
    const items = Array.from(selected);
    const urls = items.map(item => item.dataset.url).filter(url => url);
    
    if (urls.length === 0) return;
    
    try {
      // Verificar si Web Share API está disponible Y soporta compartir texto/URLs
      if (navigator.share && navigator.canShare) {
        // Primero intentar verificar si se pueden compartir archivos
        const canShareFiles = navigator.canShare({ files: [] });
        
        if (canShareFiles && urls.length <= 3) {
          // Intentar compartir archivos solo si son pocos (para evitar timeouts)
          try {
            const files = [];
            
            for (let i = 0; i < urls.length; i++) {
              const url = urls[i];
              
              try {
                const response = await fetch(url, { mode: 'cors' });
                if (!response.ok) throw new Error('Fetch failed');
                
                const blob = await response.blob();
                const urlPath = new URL(url).pathname;
                const extension = urlPath.substring(urlPath.lastIndexOf('.'));
                const fileName = `archivo_${i + 1}${extension}`;
                const file = new File([blob], fileName, { type: blob.type });
                files.push(file);
              } catch (fetchError) {
                console.warn('Error fetching file, will share URLs instead:', fetchError);
                // Si falla el fetch, saltar a compartir URLs
                throw fetchError;
              }
            }
            
            if (files.length > 0) {
              await navigator.share({
                files: files,
                title: 'Fotos y videos de la boda',
                text: `${files.length} archivo${files.length > 1 ? 's' : ''}`
              });
              vibrate(15);
              return; // Éxito, salir
            }
          } catch (fileError) {
            console.log('No se pudieron compartir archivos, compartiendo URLs:', fileError);
            // Continuar para compartir URLs como fallback
          }
        }
        
        // Fallback 1: Compartir URLs con Web Share API
        const shareText = urls.length === 1 
          ? `Mira esta foto/video de la boda:\n\n${urls[0]}`
          : `Mira estas ${urls.length} fotos/videos de la boda:\n\n${urls.join('\n')}`;
        
        await navigator.share({
          title: 'Fotos y videos de la boda',
          text: shareText
        });
        vibrate(15);
        
      } else if (navigator.share) {
        // Web Share API disponible pero sin canShare
        const shareText = urls.length === 1 
          ? `Mira esta foto/video de la boda:\n\n${urls[0]}`
          : `Mira estas ${urls.length} fotos/videos de la boda:\n\n${urls.join('\n')}`;
        
        await navigator.share({
          title: 'Fotos y videos de la boda',
          text: shareText
        });
        vibrate(15);
        
      } else {
        // Fallback 2: No hay Web Share API - usar WhatsApp
        const text = encodeURIComponent(
          urls.length === 1
            ? `Mira esta foto/video de la boda:\n\n${urls[0]}`
            : `Mira estas ${urls.length} fotos/videos de la boda:\n\n${urls.join('\n')}`
        );
        window.open(`https://wa.me/?text=${text}`, '_blank');
        vibrate(15);
      }
    } catch (error) {
      // Si el usuario cancela o hay error
      if (error.name === 'AbortError') {
        console.log('Usuario canceló compartir');
      } else {
        console.error('Error al compartir:', error);
        // Fallback final: abrir WhatsApp
        const text = encodeURIComponent(
          `Mira estas fotos/videos de la boda:\n\n${urls.join('\n')}`
        );
        window.open(`https://wa.me/?text=${text}`, '_blank');
      }
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

  // CRÍTICO: touchstart se dispara ANTES que pointerdown, bloqueando menú contextual
  gallery.addEventListener('touchstart', (ev) => {
    const img = ev.target.closest('.album-img');
    if (!img) return;
    
    // Solo prevenir menú contextual si estamos en modo selección
    if (selectionMode) {
      ev.preventDefault();
    }
  }, { passive: false });

  gallery.addEventListener('pointerdown', (ev) => {
    const img = ev.target.closest('.album-img');
    if (!img) return;

    if (ev.pointerType !== 'touch' && ev.pointerType !== 'pen') return;

    // NO prevenir por defecto aquí - dejar que el click normal funcione
    // Solo capturar el pointer para tracking
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
        ev.stopImmediatePropagation();
        toggleImage(img);
        vibrate(7);
      }
      // Si NO estamos en modo selección, dejar que el click pase normalmente
    } else {
      // Si fue long-press, prevenir el click que vendría después
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
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
  // cuando acabamos de salir del modo selección O estamos en modo selección
  gallery.addEventListener('click', (ev) => {
    const img = ev.target.closest('.album-img');
    if (!img) return;
    
    if (selectionMode || window.justExitedSelectionMode) {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
    }
  }, true); // true = capture phase, se ejecuta ANTES que los listeners normales

  // Prevenir menú contextual nativo en imágenes
  gallery.addEventListener('contextmenu', (ev) => {
    const img = ev.target.closest('.album-img');
    if (img) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  });
})();
