/**
 * MODULE: 3D Holographic Card Physics & Animation Engine (js/card3d.js)
 * Implements:
 * - 60 FPS pointer-driven 3D card tilt & perspective parallax
 * - Dynamic holographic prismatic rainbow glare tracking
 * - Idle organic floating & breathing 3D physics
 * - Card animation mode manager (Showdown Animated GIF vs Vintage Dynamic Artwork)
 */

import { getPokeArtworkUrl, getPokeShinyArtworkUrl, getPokeAnimatedUrl, getPokeShinyAnimatedUrl } from './api.js';
import { getPokedexNumberByName } from './tcg-api.js';

const CARD_ART_MODE_KEY = 'poke_tcg_card_art_mode';

// Current card art mode: 'animated' (Showdown animated GIF) | 'vintage' (Ken Sugimori 1996 animated art)
let currentCardArtMode = localStorage.getItem(CARD_ART_MODE_KEY) || 'animated';

export function getCardArtMode() {
  return currentCardArtMode;
}

export function setCardArtMode(mode) {
  currentCardArtMode = mode;
  localStorage.setItem(CARD_ART_MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent('cardArtModeChanged', { detail: { mode } }));
  updateAllCardsArtMode();
  return currentCardArtMode;
}

/**
 * Returns the appropriate artwork URL for a card based on currentCardArtMode
 */
export function getCardDisplayImage(card) {
  if (card?.images?.large || card?.images?.small) {
    return card.images.large || card.images.small;
  }

  const isShiny = Boolean(card?.isShiny);
  let numId = parseInt(card?.pokeNum || card?.id, 10);
  if (isNaN(numId)) {
    numId = getPokedexNumberByName(card?.name || card?.id);
  }
  if (!numId || isNaN(numId)) numId = 282;

  if (currentCardArtMode === 'animated') {
    // Official Showdown battle animated GIF sprite
    return isShiny ? getPokeShinyAnimatedUrl(numId) : getPokeAnimatedUrl(numId);
  } else {
    // Official Ken Sugimori (1996) Vintage Watercolor artwork
    return isShiny ? getPokeShinyArtworkUrl(numId) : getPokeArtworkUrl(numId);
  }
}

/**
 * Updates all rendered cards in the DOM to match the current art mode
 */
export function updateAllCardsArtMode() {
  const tcgImgs = document.querySelectorAll('.pkmn-tcg-card .tcg-art-image');
  tcgImgs.forEach(img => {
    const cardEl = img.closest('.pkmn-tcg-card');
    const id = cardEl?.dataset.id || cardEl?.closest('[data-card-id]')?.dataset?.cardId;
    const isShiny = cardEl?.classList.contains('card-is-shiny-foil');
    if (img && id) {
      const newSrc = getCardDisplayImage({ id, isShiny });
      if (img.src !== newSrc) {
        img.classList.add('switching-art');
        img.src = newSrc;
        img.onload = () => img.classList.remove('switching-art');
      }
    }
  });

  const albumCards = document.querySelectorAll('.album-card');
  albumCards.forEach(cardEl => {
    const img = cardEl.querySelector('.album-card-artwork img');
    const key = cardEl.dataset.cardKey;
    if (img && key) {
      const id = parseInt(key.replace('-shiny', ''), 10);
      const isShiny = key.includes('shiny');
      const newSrc = getCardDisplayImage({ id, isShiny });
      if (img.src !== newSrc) {
        img.src = newSrc;
      }
    }
  });

  const revealCards = document.querySelectorAll('.card-face.card-front');
  revealCards.forEach(cardEl => {
    const img = cardEl.querySelector('.reveal-artwork-frame img');
    const slot = cardEl.closest('.reveal-card-slot');
    const id = slot?.dataset?.pokemonId;
    const isShiny = cardEl.classList.contains('is-shiny-card');
    if (img && id) {
      img.src = getCardDisplayImage({ id: parseInt(id, 10), isShiny });
    }
  });

  // Sync animation toggle button UI if it exists
  const btn = document.getElementById('btnCardAnimModeToggle');
  const label = document.getElementById('cardAnimModeLabel');
  if (btn && label) {
    if (currentCardArtMode === 'animated') {
      btn.classList.add('mode-gif');
      label.innerHTML = 'Cartas: <strong>Showdown Animadas 🎬</strong>';
    } else {
      btn.classList.remove('mode-gif');
      label.innerHTML = 'Cartas: <strong>Vintage 1996 🎨</strong>';
    }
  }
}

/**
 * Initializes continuous 3D tilt, holographic rainbow glare, and parallax physics on all cards
 */
export function init3DCardEffects(container = document) {
  const cardSelector = '.pkmn-tcg-card, .album-card, .reveal-card-slot, .pokemon-card';

  let activeCard = null;
  let rafId = null;
  let currentTiltX = 0;
  let currentTiltY = 0;
  let targetTiltX = 0;
  let targetTiltY = 0;
  let targetPointerX = 50;
  let targetPointerY = 50;

  function updateCardPhysics() {
    if (!activeCard) return;

    // Smooth lerp (linear interpolation) for weighted card physics
    currentTiltX += (targetTiltX - currentTiltX) * 0.18;
    currentTiltY += (targetTiltY - currentTiltY) * 0.18;

    activeCard.style.setProperty('--card-tilt-x', `${currentTiltX.toFixed(2)}deg`);
    activeCard.style.setProperty('--card-tilt-y', `${currentTiltY.toFixed(2)}deg`);
    activeCard.style.setProperty('--pointer-x', `${targetPointerX.toFixed(1)}%`);
    activeCard.style.setProperty('--pointer-y', `${targetPointerY.toFixed(1)}%`);

    rafId = requestAnimationFrame(updateCardPhysics);
  }

  container.addEventListener('pointermove', (e) => {
    const card = e.target.closest(cardSelector);
    if (!card) {
      if (activeCard) {
        resetCard(activeCard);
        activeCard = null;
      }
      return;
    }

    if (activeCard !== card) {
      if (activeCard) resetCard(activeCard);
      activeCard = card;
      activeCard.classList.add('card-is-tilting');
      if (!rafId) rafId = requestAnimationFrame(updateCardPhysics);
    }

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const normX = Math.max(0, Math.min(1, x / w));
    const normY = Math.max(0, Math.min(1, y / h));

    // Dynamic tilt ranges (-16deg to +16deg)
    targetTiltY = (normX - 0.5) * 26; // horizontal tilt
    targetTiltX = -(normY - 0.5) * 26; // vertical tilt
    targetPointerX = normX * 100;
    targetPointerY = normY * 100;
  }, { passive: true });

  container.addEventListener('pointerleave', (e) => {
    const card = e.target.closest(cardSelector);
    if (card) {
      resetCard(card);
      if (activeCard === card) activeCard = null;
    }
  }, true);

  container.addEventListener('pointerout', (e) => {
    const card = e.target.closest(cardSelector);
    if (card && (!e.relatedTarget || !card.contains(e.relatedTarget))) {
      resetCard(card);
      if (activeCard === card) activeCard = null;
    }
  }, { passive: true });

  function resetCard(card) {
    card.classList.remove('card-is-tilting');
    targetTiltX = 0;
    targetTiltY = 0;
    targetPointerX = 50;
    targetPointerY = 50;
    card.style.removeProperty('--card-tilt-x');
    card.style.removeProperty('--card-tilt-y');
    card.style.removeProperty('--pointer-x');
    card.style.removeProperty('--pointer-y');
  }

  // Device orientation / gyroscope support for mobile devices
  if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', (e) => {
      if (!e.gamma || !e.beta) return;
      const tiltY = Math.max(-15, Math.min(15, e.gamma * 0.5));
      const tiltX = Math.max(-15, Math.min(15, (e.beta - 45) * 0.4));
      
      const cards = document.querySelectorAll('.pkmn-tcg-card:not(.card-is-tilting)');
      cards.forEach(c => {
        c.style.setProperty('--card-tilt-x', `${tiltX.toFixed(1)}deg`);
        c.style.setProperty('--card-tilt-y', `${tiltY.toFixed(1)}deg`);
        c.style.setProperty('--pointer-x', `${(50 + tiltY * 2).toFixed(1)}%`);
        c.style.setProperty('--pointer-y', `${(50 + tiltX * 2).toFixed(1)}%`);
      });
    }, { passive: true });
  }
}
