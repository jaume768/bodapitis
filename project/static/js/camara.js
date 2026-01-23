(function () {
  const openLink = document.getElementById('open-camera');

  // Inputs (dos: cámara y galería)
  const inputCamera = document.getElementById('camera-input');   // tiene capture="environment"
  const inputGallery = document.getElementById('gallery-input'); // sin capture

  // Previsualización
  const previewWrap = document.getElementById('camera-preview');
  const previewGrid = document.getElementById('camera-preview-grid');
  const uploadText = document.getElementById('upload-text');

  // Modal de confirmación de subida
  const uploadModal = document.getElementById('upload-modal');
  const btnCancel = document.getElementById('btn-cancel');
  const btnConfirm = document.getElementById('btn-confirm');
  const statusEl = document.getElementById('upload-status');

  // Modal de elección (nuevo)
  const choiceModal = document.getElementById('choice-modal');
  const btnOpenGallery = document.getElementById('btn-open-gallery');

  let selectedFiles = [];
  const MAX_PREVIEW_FILES = 6;

  /* Utilidades modal genéricas */
  function openModal(el) {
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
  }
  function closeModal(el) {
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
  }

  function resetSelection() {
    selectedFiles = [];
    inputCamera.value = '';
    inputGallery.value = '';
    previewWrap.style.display = 'none';
    previewGrid.innerHTML = '';
  }

  // Al pulsar el icono "Cámara" -> mostramos el modal de elección
  openLink.addEventListener('click', function (e) {
    e.preventDefault();
    openModal(choiceModal);
  });

  // Botón del modal de elección
  btnOpenGallery.addEventListener('click', function () {
    closeModal(choiceModal);
    // Abrimos selector/galería
    inputGallery.click();
  });

  // Cerrar modal de elección si se pulsa el backdrop
  choiceModal.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal__backdrop')) {
      closeModal(choiceModal);
    }
  });

  // Manejador común al seleccionar/tomar archivos (desde cámara o galería)
  function handleFilesFromInput(files) {
    if (!files || files.length === 0) return;
    
    selectedFiles = Array.from(files);
    previewGrid.innerHTML = '';

    // Mostrar hasta MAX_PREVIEW_FILES archivos
    const filesToShow = selectedFiles.slice(0, MAX_PREVIEW_FILES);
    const remainingCount = selectedFiles.length - MAX_PREVIEW_FILES;

    filesToShow.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      const itemDiv = document.createElement('div');
      itemDiv.style.cssText = 'position:relative; width:100%; padding-bottom:100%; overflow:hidden; border-radius:8px; background:#f0f0f0;';
      
      if (file.type.startsWith('video/')) {
        itemDiv.innerHTML = `
          <video src="${url}" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover;" muted></video>
          <div style="position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.7); color:white; padding:2px 6px; border-radius:4px; font-size:10px;">📹</div>
        `;
      } else {
        itemDiv.innerHTML = `<img src="${url}" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover;" alt="Preview ${index + 1}">`;
      }
      
      previewGrid.appendChild(itemDiv);
    });

    // Si hay más archivos, mostrar +N
    if (remainingCount > 0) {
      const moreDiv = document.createElement('div');
      moreDiv.style.cssText = 'position:relative; width:100%; padding-bottom:100%; overflow:hidden; border-radius:8px; background:#e0e0e0; display:flex; align-items:center; justify-content:center;';
      moreDiv.innerHTML = `<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:24px; font-weight:bold; color:#666;">+${remainingCount}</div>`;
      previewGrid.appendChild(moreDiv);
    }

    // Actualizar texto
    if (selectedFiles.length === 1) {
      uploadText.textContent = '¿Subir este archivo?';
    } else {
      uploadText.textContent = `¿Subir estos ${selectedFiles.length} archivos?`;
    }

    previewWrap.style.display = 'block';
    openModal(uploadModal);
  }

  // Escucha de ambos inputs
  inputCamera.addEventListener('change', function () {
    handleFilesFromInput(inputCamera.files);
  });
  inputGallery.addEventListener('change', function () {
    handleFilesFromInput(inputGallery.files);
  });

  // Cancelar subida
  btnCancel.addEventListener('click', function () {
    closeModal(uploadModal);
    resetSelection();
  });

  // Función para obtener CSRF token
  function getCsrfToken() {
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
    return cookieValue || '';
  }

  // Helper para fetch con timeout
  async function fetchWithTimeout(url, options, timeoutMs = 60000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout: El archivo tardó demasiado en subir');
      }
      throw error;
    }
  }

  // Helper para delay entre subidas
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Confirmar subida
  btnConfirm.addEventListener('click', async function () {
    if (selectedFiles.length === 0) return;
    
    statusEl.style.display = 'block';
    statusEl.textContent = `Subiendo 0/${selectedFiles.length}…`;

    try {
      const UPLOAD_URL = '/api/media/';
      const csrfToken = getCsrfToken();
      let uploadedCount = 0;
      let failedCount = 0;
      const failedFiles = [];

      // Subir archivos secuencialmente con delay
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fd = new FormData();
        const safeName = file.name && file.name.trim() !== '' ? file.name : `archivo_${Date.now()}_${i}.jpg`;
        fd.append('file', file, safeName);

        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        console.log(`📤 Subiendo ${i + 1}/${selectedFiles.length}: ${safeName} (${fileSizeMB}MB, ${file.type})`);

        try {
          // Timeout mayor para archivos grandes (60s base + 1s por MB)
          const timeoutMs = 60000 + (file.size / (1024 * 1024)) * 1000;
          
          const resp = await fetchWithTimeout(UPLOAD_URL, {
            method: 'POST',
            headers: {
              'X-CSRFToken': csrfToken,
            },
            body: fd,
          }, timeoutMs);

          if (!resp.ok) {
            const errorText = await resp.text();
            const errorMsg = `HTTP ${resp.status}: ${errorText.substring(0, 200)}`;
            console.error('❌ Error en respuesta:', errorMsg);
            throw new Error(errorMsg);
          }
          
          const result = await resp.json();
          console.log('✅ Archivo subido:', result);
          
          uploadedCount++;
          statusEl.textContent = `Subiendo ${uploadedCount}/${selectedFiles.length}…`;
          
          // Delay entre subidas para no saturar (excepto en el último)
          if (i < selectedFiles.length - 1) {
            await delay(800); // 800ms entre subidas
          }
        } catch (err) {
          console.error(`❌ Error subiendo archivo ${safeName}:`, err);
          failedFiles.push({
            name: safeName,
            size: fileSizeMB,
            error: err.message || 'Error desconocido'
          });
          failedCount++;
        }
      }

      if (failedCount === 0) {
        statusEl.textContent = `✅ ${uploadedCount} archivos subidos. Redirigiendo…`;
        setTimeout(() => {
          window.location.href = '/album/';
        }, 1000);
      } else {
        // Mostrar alerta con detalles de errores
        let errorDetails = `Subidos: ${uploadedCount}\nFallaron: ${failedCount}\n\n`;
        errorDetails += 'Archivos que fallaron:\n';
        failedFiles.forEach((f, idx) => {
          errorDetails += `\n${idx + 1}. ${f.name} (${f.size}MB)\n   Error: ${f.error}\n`;
        });
        
        alert(errorDetails);
        console.error('📋 Resumen de errores:', failedFiles);
        
        statusEl.textContent = `⚠️ ${uploadedCount} subidos, ${failedCount} fallaron. Redirigiendo…`;
        setTimeout(() => {
          window.location.href = '/album/';
        }, 3000);
      }
    } catch (err) {
      console.error('❌ Error general:', err);
      alert(`Error al subir archivos:\n\n${err.message}\n\nRevisa la consola para más detalles.`);
      statusEl.textContent = '❌ Error al subir. Inténtalo de nuevo.';
    }
  });

  // Cerrar modal de confirmación al pulsar fuera del cuadro
  uploadModal.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal__backdrop')) {
      closeModal(uploadModal);
      resetSelection();
    }
  });
})();
