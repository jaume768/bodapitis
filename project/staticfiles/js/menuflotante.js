
  (function(){
    const menu = document.querySelector('.album-menu');
    const sentinel = document.getElementById('header-sentinel');

    // Si no hay sentinel, salimos
    if(!menu || !sentinel) return;

    const io = new IntersectionObserver((entries) => {
      const e = entries[0];
      // Cuando el sentinel deja de ser visible (header ya salió), fijamos el menú
      if (!e.isIntersecting) {
        menu.classList.add('is-sticky');
      } else {
        menu.classList.remove('is-sticky');
      }
    }, {
      root: null,
      threshold: 0,
      // Empieza a fijar un pelín antes de que desaparezca del todo
      rootMargin: "-10px 0px 0px 0px"
    });

    io.observe(sentinel);

    // Opcional: ocultar el menú flotante cuando aparece el teclado móvil (iOS/Android)
    // para no tapar inputs si algún día los añades:
    window.addEventListener('resize', () => {
      if (menu.classList.contains('is-sticky')) {
        // Heurística simple: si altura de viewport baja >120px, asumimos teclado abierto
        const hide = window.innerHeight < (screen.height - 120);
        menu.style.opacity = hide ? '0' : '1';
        menu.style.pointerEvents = hide ? 'none' : 'auto';
      }
    });

    // Conectar botón de descarga con la función de selección
    const btnDescarga = document.querySelector('.boton-descarga');
    if (btnDescarga) {
      btnDescarga.style.cursor = 'pointer';
      btnDescarga.addEventListener('click', () => {
        if (typeof window.downloadSelected === 'function') {
          window.downloadSelected();
        }
      });
    }

    // Conectar botón de compartir con la función de compartir
    const btnCompartir = document.querySelector('.boton-compartir');
    if (btnCompartir) {
      btnCompartir.style.cursor = 'pointer';
      btnCompartir.addEventListener('click', () => {
        if (typeof window.shareSelected === 'function') {
          window.shareSelected();
        }
      });
    }
  })();
