(function () {
  const openLink = document.getElementById('open-camera');

  // Inputs (dos: cámara y galería)
  const inputCamera = document.getElementById('camera-input');   // tiene capture="environment"
  const inputGallery = document.getElementById('gallery-input'); // sin capture

  // Previsualización
  const previewWrap = document.getElementById('camera-preview');
  const previewImg = document.getElementById('camera-preview-img');

  // Modal de confirmación de subida
  const uploadModal = document.getElementById('upload-modal');
  const btnCancel = document.getElementById('btn-cancel');
  const btnConfirm = document.getElementById('btn-confirm');
  const statusEl = document.getElementById('upload-status');

  // Modal de elección (nuevo)
  const choiceModal = document.getElementById('choice-modal');
  const btnOpenCamera = document.getElementById('btn-open-camera');
  const btnOpenGallery = document.getElementById('btn-open-gallery');

  let lastFile = null;

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
    lastFile = null;
    inputCamera.value = '';
    inputGallery.value = '';
    previewWrap.style.display = 'none';
    previewImg.removeAttribute('src');
  }

  // Al pulsar el icono "Cámara" -> mostramos el modal de elección
  openLink.addEventListener('click', function (e) {
    e.preventDefault();
    openModal(choiceModal);
  });

  // Botones del modal de elección
  btnOpenCamera.addEventListener('click', function () {
    closeModal(choiceModal);
    // Abre la cámara nativa del dispositivo
    inputCamera.click();
  });

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

  // Manejador común al seleccionar/tomar archivo (desde cámara o galería)
  function handleFileFromInput(file) {
    if (!file) return;
    lastFile = file;

    // Previsualizar (imagen o video)
    const url = URL.createObjectURL(lastFile);
    if (file.type.startsWith('video/')) {
      previewImg.innerHTML = `<video src="${url}" controls style="max-width:100%; border-radius:8px;"></video>`;
    } else {
      previewImg.innerHTML = `<img src="${url}" style="max-width:100%; border-radius:8px;" alt="Preview">`;
    }
    previewWrap.style.display = 'block';

    // Preguntar si subir
    openModal(uploadModal);
  }

  // Escucha de ambos inputs
  inputCamera.addEventListener('change', function () {
    handleFileFromInput(inputCamera.files && inputCamera.files[0]);
  });
  inputGallery.addEventListener('change', function () {
    handleFileFromInput(inputGallery.files && inputGallery.files[0]);
  });

  // Cancelar subida
  btnCancel.addEventListener('click', function () {
    closeModal(uploadModal);
    resetSelection();
  });

  // Confirmar subida
  btnConfirm.addEventListener('click', async function () {
    if (!lastFile) return;
    statusEl.style.display = 'block';
    statusEl.textContent = 'Subiendo…';

    try {
      const UPLOAD_URL = '/api/media/';

      const fd = new FormData();
      const safeName = lastFile.name && lastFile.name.trim() !== '' ? lastFile.name : 'foto.jpg';
      fd.append('file', lastFile, safeName);

      const resp = await fetch(UPLOAD_URL, {
        method: 'POST',
        body: fd,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error('Error al subir: ' + text);
      }

      statusEl.textContent = 'Subido. Redirigiendo al álbum…';
      window.location.href = '/album/';
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Fallo al subir. Inténtalo de nuevo.';
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
