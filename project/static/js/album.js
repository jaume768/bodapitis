(function () {
  const gallery = document.getElementById('album-gallery');
  
  async function loadGallery() {
    try {
      const response = await fetch('/api/media/gallery/');
      if (!response.ok) {
        throw new Error('Error al cargar la galería');
      }
      
      const data = await response.json();
      
      // Combinar imágenes y videos
      const allMedia = [...(data.images || []), ...(data.videos || [])];
      
      if (allMedia.length > 0) {
        gallery.innerHTML = '';
        
        allMedia.forEach(media => {
          if (media.media_type === 'video') {
            // Crear elemento de video
            const videoWrapper = document.createElement('div');
            videoWrapper.className = 'album-img album-video-wrapper';
            videoWrapper.dataset.url = media.file_url;
            videoWrapper.dataset.type = 'video';
            
            const video = document.createElement('video');
            video.src = media.file_url;
            video.className = 'album-video';
            video.muted = true;
            video.playsInline = true;
            
            const playIcon = document.createElement('div');
            playIcon.className = 'video-play-icon';
            playIcon.innerHTML = '▶';
            
            videoWrapper.appendChild(video);
            videoWrapper.appendChild(playIcon);
            gallery.appendChild(videoWrapper);
          } else {
            // Crear elemento de imagen
            const img = document.createElement('img');
            img.src = media.file_url;
            img.alt = 'foto boda';
            img.className = 'album-img';
            img.dataset.url = media.file_url;
            img.dataset.type = 'image';
            gallery.appendChild(img);
          }
        });
        
        // Añadir event listeners para abrir el viewer
        document.querySelectorAll('.album-img').forEach(element => {
          element.addEventListener('click', (e) => {
            // No abrir el visor si estamos en modo selección O acabamos de salir
            if (document.body.classList.contains('selecting') || 
                window.justExitedSelectionMode) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            openMediaViewer(element);
          });
        });
      } else {
        gallery.innerHTML = '<p style="text-align:center; padding:20px; width:100%; font-size:20px;">No hay fotos ni videos aún. ¡Sé el primero en subir!</p>';
      }
    } catch (error) {
      console.error('Error cargando galería:', error);
      gallery.innerHTML = '<p style="text-align:center; padding:20px; width:100%; color:red;">Error al cargar las fotos. Intenta recargar la página.</p>';
    }
  }
  
  // Visor de medios (lightbox)
  function openMediaViewer(element) {
    const url = element.dataset.url;
    const type = element.dataset.type;
    
    // Crear modal viewer
    const viewer = document.createElement('div');
    viewer.className = 'media-viewer';
    viewer.innerHTML = `
      <div class="media-viewer__backdrop"></div>
      <div class="media-viewer__content">
        <button class="media-viewer__close">✕</button>
        ${type === 'video' 
          ? `<video src="${url}" controls autoplay class="media-viewer__media"></video>`
          : `<img src="${url}" class="media-viewer__media" alt="Vista completa">`
        }
      </div>
    `;
    
    document.body.appendChild(viewer);
    document.body.style.overflow = 'hidden';
    
    // Cerrar al hacer clic en el fondo o en la X
    viewer.querySelector('.media-viewer__backdrop').addEventListener('click', () => closeMediaViewer(viewer));
    viewer.querySelector('.media-viewer__close').addEventListener('click', () => closeMediaViewer(viewer));
  }
  
  function closeMediaViewer(viewer) {
    document.body.style.overflow = '';
    viewer.remove();
  }
  
  loadGallery();
})();
