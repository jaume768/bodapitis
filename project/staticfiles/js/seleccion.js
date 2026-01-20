// seleccion.js
(() => {
  const LONG_PRESS_MS = 350;     // tiempo para considerar “pulsación larga”
  const MOVE_TOLERANCE = 12;     // tolerancia de movimiento en px para no cancelar el long-press

  const gallery = document.querySelector('.album-gallery');
  if (!gallery) return;

  // Detectar si es PC o móvil
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Referencias al checkbox de modo selección (solo PC)
  const selectionToggle = document.getElementById('selection-mode-toggle');
  const selectionCheckbox = document.getElementById('selection-mode-checkbox');
  
  // Mostrar checkbox solo en PC
  if (!isMobile && selectionToggle) {
    selectionToggle.style.display = 'block';
  }

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
    
    // Sincronizar checkbox en PC
    if (!isMobile && selectionCheckbox) {
      selectionCheckbox.checked = true;
    }
  }

  function exitSelectionMode() {
    selectionMode = false;
    document.body.classList.remove('selecting');
    
    // Sincronizar checkbox en PC
    if (!isMobile && selectionCheckbox) {
      selectionCheckbox.checked = false;
    }
    
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
  async function downloadSelected() {
    if (selected.size === 0) return;
    
    vibrate(15);
    const items = Array.from(selected);
    
    if (isMobile) {
      // En móviles, mostrar mensaje que la descarga solo está disponible en PC
      alert('La descarga directa solo está disponible en PC.\n\nDesde móvil puedes usar el botón "Compartir" para guardar los archivos en tu dispositivo.');
      return;
    }
    
    // En PC, descarga directa con blobs
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
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error('Error descargando:', url, error);
      }
    }
    
    vibrate(15);
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

  // En PC: Checkbox para activar/desactivar modo selección
  if (!isMobile && selectionCheckbox) {
    selectionCheckbox.addEventListener('change', (ev) => {
      if (ev.target.checked) {
        ensureSelectionMode();
      } else {
        // Deseleccionar todas las imágenes
        selected.forEach(img => {
          img.classList.remove('is-selected');
          img.setAttribute('aria-pressed', 'false');
        });
        selected.clear();
        updateCount();
        exitSelectionMode();
      }
    });
  }

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

    // En PC (mouse), no usar long-press
    if (ev.pointerType === 'mouse') {
      return; // La selección se maneja con el checkbox + click normal
    }

    // En móvil (touch/pen), usar long-press
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

  // En PC: permitir click normal cuando el modo selección está activo
  // En móvil: solo permitir tap si está en modo selección
  gallery.addEventListener('click', (ev) => {
    const img = ev.target.closest('.album-img');
    if (!img) return;
    
    // Si estamos en modo selección, toggle la imagen
    if (selectionMode) {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      toggleImage(img);
      vibrate(7);
    }
  }, true); // Capture phase

  // Prevenir menú contextual nativo en imágenes
  gallery.addEventListener('contextmenu', (ev) => {
    const img = ev.target.closest('.album-img');
    if (img) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  });
})();
