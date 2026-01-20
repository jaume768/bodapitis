const carrusel = document.querySelector('.carrusel');
const items = Array.from(document.querySelectorAll('.carrusel .card-container'));
const next = document.getElementById('next');
const prev = document.getElementById('prev');

/* Índice activo inicial (empieza por la primera tarjeta) */
let active = 0;

/* Métricas dinámicas (ancho card + separación visual) */
let CARD_W = 0;
let STEP = 0;
let GAP = 40; // separación entre tarjetas

function measure() {
  if (!items.length) return;
  CARD_W = items[0].offsetWidth || 300;
  STEP = CARD_W + GAP;
}

/* Dibuja el carrusel en base al índice activo (+ arrastre opcional) */
function render(extraOffsetPx = 0) {
  measure();
  for (let i = 0; i < items.length; i++) {
    const dx = i - active; // desplazamiento relativo a la activa
    const baseX = dx * STEP + extraOffsetPx;

    // escalado y giro sutil según distancia
    const dist = Math.abs(dx);
    const scale = Math.max(0.82, 1 - dist * 0.08);
    const rotateY = dx === 0 ? 0 : (dx > 0 ? -2 : 2);
    const blur = Math.min(6, dist * 2);
    const opacity = dist > 3 ? 0 : 1 - dist * 0.15;

    items[i].style.zIndex = String(100 - dist);
    items[i].style.opacity = opacity;
    items[i].style.filter = `blur(${blur}px)`;
    // Importante: centramos cada card con translateX(-50%) y luego desplazamos
    items[i].style.transform = `translateX(-50%) translateX(${baseX}px) scale(${scale}) perspective(800px) rotateY(${rotateY}deg)`;
  }
}

/* Navegación */
function goNext() {
  if (active < items.length - 1) {
    active += 1;
    render(0);
  }
}
function goPrev() {
  if (active > 0) {
    active -= 1;
    render(0);
  }
}

next?.addEventListener('click', goNext);
prev?.addEventListener('click', goPrev);

/* Teclado (opcional) */
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') goNext();
  if (e.key === 'ArrowLeft') goPrev();
});

/* Swipe con Pointer Events (funciona en móvil y escritorio) */
let dragging = false;
let startX = 0;
let lastDX = 0;

const SWIPE_THRESHOLD = 60; // px para decidir cambio de tarjeta

function onPointerDown(e) {
  dragging = true;
  startX = e.clientX ?? (e.touches && e.touches[0].clientX) ?? 0;
  lastDX = 0;
  carrusel.classList.add('is-dragging');
  // capturamos el puntero si existe
  if (carrusel.setPointerCapture && e.pointerId != null) {
    carrusel.setPointerCapture(e.pointerId);
  }
}

function onPointerMove(e) {
  if (!dragging) return;
  const x = e.clientX ?? (e.touches && e.touches[0].clientX) ?? 0;
  lastDX = x - startX;
  render(lastDX); // seguimos el dedo
}

function onPointerUp(e) {
  if (!dragging) return;
  dragging = false;
  carrusel.classList.remove('is-dragging');

  // decidimos si hay cambio de tarjeta
  if (Math.abs(lastDX) > SWIPE_THRESHOLD) {
    if (lastDX < 0) goNext(); else goPrev();
  } else {
    render(0); // volvemos a posición original
  }

  if (carrusel.releasePointerCapture && e.pointerId != null) {
    carrusel.releasePointerCapture(e.pointerId);
  }
}

/* Compatibilidad táctil si el navegador no usa Pointer Events */
const supportsPointer = 'onpointerdown' in window;
if (supportsPointer) {
  carrusel.addEventListener('pointerdown', onPointerDown);
  carrusel.addEventListener('pointermove', onPointerMove);
  carrusel.addEventListener('pointerup', onPointerUp);
  carrusel.addEventListener('pointercancel', onPointerUp);
} else {
  carrusel.addEventListener('touchstart', (e) => onPointerDown(e.changedTouches ? e.changedTouches[0] : e));
  carrusel.addEventListener('touchmove', (e) => { onPointerMove(e.changedTouches ? e.changedTouches[0] : e); }, { passive: true });
  carrusel.addEventListener('touchend', (e) => onPointerUp(e.changedTouches ? e.changedTouches[0] : e));
  carrusel.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
}

/* Recalcular al redimensionar */
window.addEventListener('resize', () => render(0));

/* Primer pintado */
render(0);
