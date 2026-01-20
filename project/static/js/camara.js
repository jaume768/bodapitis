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
    
    // Usar getUserMedia - LA MEJOR API para acceso a cámara en web
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        await openNativeCamera();
      } catch (err) {
        console.error('Error al abrir cámara:', err);
        alert('No se pudo acceder a la cámara. Por favor verifica los permisos.');
      }
    } else {
      // Fallback para navegadores muy antiguos
      inputCamera.click();
    }
  });
  
  // Función para abrir cámara nativa con getUserMedia
  async function openNativeCamera() {
    let currentFacingMode = 'environment'; // Trasera por defecto
    let stream = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    let mode = 'photo'; // 'photo' o 'video'
    
    // Función para iniciar stream
    const startStream = async (facingMode) => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: mode === 'video' // Audio solo para video
      });
      
      return stream;
    };
    
    // Iniciar cámara
    stream = await startStream(currentFacingMode);
    
    // Crear modal de cámara
    const cameraModal = document.createElement('div');
    cameraModal.className = 'modal is-open';
    cameraModal.style.zIndex = '9999';
    cameraModal.innerHTML = `
      <div class="modal__backdrop" style="background: #000;"></div>
      <div class="modal__dialog" style="max-width:100%; height:100vh; padding:0; margin:0; border-radius:0; background:#000;">
        <div style="position:relative; width:100%; height:100%; display:flex; flex-direction:column;">
          <!-- Video preview -->
          <video id="camera-stream" autoplay playsinline muted style="flex:1; width:100%; object-fit:cover; background:#000;"></video>
          
          <!-- Controles superiores -->
          <div style="position:absolute; top:0; left:0; right:0; padding:20px; display:flex; justify-content:space-between; align-items:center; background:linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);">
            <button id="close-camera" style="width:45px; height:45px; border-radius:50%; background:rgba(255,255,255,0.3); color:#fff; border:none; font-size:24px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
            <button id="flip-camera" style="width:45px; height:45px; border-radius:50%; background:rgba(255,255,255,0.3); color:#fff; border:none; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center;">🔄</button>
          </div>
          
          <!-- Controles inferiores -->
          <div style="position:absolute; bottom:0; left:0; right:0; padding:30px 20px; background:linear-gradient(to top, rgba(0,0,0,0.7), transparent);">
            <!-- Selector modo foto/video -->
            <div style="display:flex; justify-content:center; gap:20px; margin-bottom:20px;">
              <button id="mode-photo" style="padding:8px 20px; border-radius:20px; background:#fff; color:#000; border:none; font-weight:bold; cursor:pointer;">FOTO</button>
              <button id="mode-video" style="padding:8px 20px; border-radius:20px; background:rgba(255,255,255,0.3); color:#fff; border:none; cursor:pointer;">VIDEO</button>
            </div>
            
            <!-- Botón captura/grabación -->
            <div style="display:flex; justify-content:center;">
              <button id="capture-btn" style="width:70px; height:70px; border-radius:50%; background:#fff; border:4px solid rgba(255,255,255,0.5); cursor:pointer; position:relative;">
                <div id="recording-indicator" style="display:none; width:24px; height:24px; background:red; border-radius:4px; margin:auto;"></div>
              </button>
            </div>
            
            <!-- Indicador de grabación -->
            <div id="recording-time" style="display:none; text-align:center; color:#fff; margin-top:10px; font-size:18px; font-weight:bold;">
              <span style="display:inline-block; width:12px; height:12px; background:red; border-radius:50%; margin-right:8px; animation:pulse 1s infinite;"></span>
              <span id="time-display">0:00</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(cameraModal);
    
    const videoElement = cameraModal.querySelector('#camera-stream');
    const captureBtn = cameraModal.querySelector('#capture-btn');
    const recordingIndicator = cameraModal.querySelector('#recording-indicator');
    const recordingTime = cameraModal.querySelector('#recording-time');
    const timeDisplay = cameraModal.querySelector('#time-display');
    const modePhotoBtn = cameraModal.querySelector('#mode-photo');
    const modeVideoBtn = cameraModal.querySelector('#mode-video');
    
    videoElement.srcObject = stream;
    
    // Animación pulse para el indicador
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
    
    // Cambiar modo foto/video
    modePhotoBtn.addEventListener('click', async () => {
      if (isRecording) return;
      mode = 'photo';
      modePhotoBtn.style.background = '#fff';
      modePhotoBtn.style.color = '#000';
      modeVideoBtn.style.background = 'rgba(255,255,255,0.3)';
      modeVideoBtn.style.color = '#fff';
      captureBtn.style.borderRadius = '50%';
      recordingIndicator.style.display = 'none';
      
      // Reiniciar stream sin audio
      stream = await startStream(currentFacingMode);
      videoElement.srcObject = stream;
    });
    
    modeVideoBtn.addEventListener('click', async () => {
      if (isRecording) return;
      mode = 'video';
      modeVideoBtn.style.background = '#fff';
      modeVideoBtn.style.color = '#000';
      modePhotoBtn.style.background = 'rgba(255,255,255,0.3)';
      modePhotoBtn.style.color = '#fff';
      captureBtn.style.borderRadius = '8px';
      
      // Reiniciar stream con audio
      stream = await startStream(currentFacingMode);
      videoElement.srcObject = stream;
    });
    
    // Alternar cámara
    cameraModal.querySelector('#flip-camera').addEventListener('click', async () => {
      if (isRecording) return;
      try {
        currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
        stream = await startStream(currentFacingMode);
        videoElement.srcObject = stream;
      } catch (err) {
        console.error('Error al cambiar cámara:', err);
      }
    });
    
    // Capturar foto o iniciar/detener grabación
    let recordingStartTime = 0;
    let timerInterval = null;
    
    captureBtn.addEventListener('click', async () => {
      if (mode === 'photo') {
        // CAPTURAR FOTO
        const canvas = document.createElement('canvas');
        const video = videoElement;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          stream.getTracks().forEach(track => track.stop());
          cameraModal.remove();
          style.remove();
          
          const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
          handleFileFromInput(file);
        }, 'image/jpeg', 0.92);
        
      } else {
        // GRABAR VIDEO
        if (!isRecording) {
          // INICIAR grabación
          recordedChunks = [];
          mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9'
          });
          
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              recordedChunks.push(e.data);
            }
          };
          
          mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            stream.getTracks().forEach(track => track.stop());
            cameraModal.remove();
            style.remove();
            
            const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
            handleFileFromInput(file);
          };
          
          mediaRecorder.start();
          isRecording = true;
          recordingIndicator.style.display = 'block';
          recordingTime.style.display = 'block';
          captureBtn.style.background = 'red';
          
          // Timer
          recordingStartTime = Date.now();
          timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            timeDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
          }, 1000);
          
        } else {
          // DETENER grabación
          if (timerInterval) clearInterval(timerInterval);
          mediaRecorder.stop();
          isRecording = false;
        }
      }
    });
    
    // Cerrar cámara
    cameraModal.querySelector('#close-camera').addEventListener('click', () => {
      if (timerInterval) clearInterval(timerInterval);
      if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
      }
      stream.getTracks().forEach(track => track.stop());
      cameraModal.remove();
      style.remove();
    });
  }

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
