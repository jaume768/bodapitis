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
  btnOpenCamera.addEventListener('click', async function () {
    closeModal(choiceModal);
    
    // Intentar usar getUserMedia API primero (cámara real)
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      let currentFacingMode = 'environment'; // Cámara trasera por defecto
      let stream = null;
      
      const startCamera = async (facingMode) => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facingMode }, 
          audio: false 
        });
        
        return stream;
      };
      
      try {
        // Iniciar cámara trasera
        stream = await startCamera(currentFacingMode);
        
        // Crear canvas para capturar foto
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        
        // Modal temporal para vista de cámara
        const cameraModal = document.createElement('div');
        cameraModal.className = 'modal is-open';
        cameraModal.innerHTML = `
          <div class="modal__backdrop"></div>
          <div class="modal__dialog" style="max-width:100%; height:100vh; padding:0; margin:0; border-radius:0;">
            <div style="position:relative; width:100%; height:100%;">
              <video id="camera-stream" autoplay playsinline style="width:100%; height:100%; object-fit:cover;"></video>
              <button id="capture-photo" style="position:absolute; bottom:30px; left:50%; transform:translateX(-50%); width:70px; height:70px; border-radius:50%; background:#fff; border:4px solid #000; cursor:pointer;"></button>
              <button id="flip-camera" style="position:absolute; top:20px; left:20px; width:50px; height:50px; border-radius:50%; background:rgba(0,0,0,0.5); color:#fff; border:none; font-size:24px; cursor:pointer;">🔄</button>
              <button id="close-camera" style="position:absolute; top:20px; right:20px; width:50px; height:50px; border-radius:50%; background:rgba(0,0,0,0.5); color:#fff; border:none; font-size:24px; cursor:pointer;">✕</button>
            </div>
          </div>
        `;
        
        document.body.appendChild(cameraModal);
        const videoElement = cameraModal.querySelector('#camera-stream');
        videoElement.srcObject = stream;
        
        // Alternar cámara
        cameraModal.querySelector('#flip-camera').addEventListener('click', async () => {
          try {
            currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
            stream = await startCamera(currentFacingMode);
            videoElement.srcObject = stream;
          } catch (err) {
            console.error('Error al cambiar cámara:', err);
          }
        });
        
        // Capturar foto
        cameraModal.querySelector('#capture-photo').addEventListener('click', () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d').drawImage(video, 0, 0);
          
          canvas.toBlob((blob) => {
            stream.getTracks().forEach(track => track.stop());
            cameraModal.remove();
            
            // Crear archivo desde blob
            const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
            handleFileFromInput(file);
          }, 'image/jpeg', 0.9);
        });
        
        // Cerrar cámara
        cameraModal.querySelector('#close-camera').addEventListener('click', () => {
          stream.getTracks().forEach(track => track.stop());
          cameraModal.remove();
        });
        
        return; // Salir, no usar input file
      } catch (err) {
        console.warn('getUserMedia falló, usando input file:', err);
        // Continuar con input file como fallback
      }
    }
    
    // Fallback: input file tradicional
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
