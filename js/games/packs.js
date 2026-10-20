/**
 * MODULE: Booster Pack Opening Experience (js/games/packs.js)
 * Fullscreen 3D Carousel & Realistic Pack Opening Sequence:
 * - Fullscreen 3D panoramic carousel of themed expansions (Kanto, Fire/Dragon, Electric, Legendary)
 * - Cinematic Pack Opening:
 *   1. Center 3D Focus & Spotlight
 *   2. Realistic foil strip tear with sound & particle burst
 *   3. Cards physically slide upwards out of the opened foil
 *   4. Cards fan out in a 3D arc with PokéDex holo card backs
 *   5. Tactile flip reveal with epic/legendary fanfare & shiny star celebrations
 */

import { 
  PACK_COLLECTIONS, 
  getPokemonRarity, 
  getPokemonLevel,
  getPokeArtworkUrl,
  getPokeShinyArtworkUrl 
} from '../api.js';
import { pullCardsFromTcgPack, normalizeTcgCard, getPokedexNumberByName } from '../tcg-api.js';
import { getCardDisplayImage } from '../card3d.js';
import { 
  getCoins, 
  spendCoins, 
  registerCards, 
  syncCoinsUI 
} from '../collection.js';
import { 
  playPackTearSound, 
  playCardFlipSound, 
  playPokemonCry, 
  playEpicRevealSound, 
  playLegendaryRevealSound, 
  playCardClashSound,
  playSuccessChime,
  playCoinSound
} from '../audio.js';

export class PackOpeningGame {
  constructor(containerEl) {
    this.container = containerEl;
    this.isOpening = false;
    this.pulledCards = [];
    this.revealedCards = new Set();
    this.collectionKeys = ['kanto', 'fire_dragon', 'electric', 'legendary'];
    this.currentIndex = 0;
    this.boundKeyHandler = null;
    this.isPurchaseModalOpen = false;
    this.isTransitioning = false;
  }

  init() {
    this.renderCarousel();
    this.attachGlobalKeys();
  }

  attachGlobalKeys() {
    if (this.boundKeyHandler) {
      window.removeEventListener('keydown', this.boundKeyHandler);
    }
    this.boundKeyHandler = (e) => {
      // Only handle if packs view is currently visible and not opening
      const subviewPacks = document.getElementById('subviewPacks');
      if (!subviewPacks || subviewPacks.style.display === 'none' || this.isOpening) return;

      if (e.key === 'Escape' && this.isPurchaseModalOpen) {
        this.closePurchaseMenu();
        return;
      }

      if (this.isPurchaseModalOpen) return;

      if (e.key === 'ArrowLeft') {
        this.prevPack();
      } else if (e.key === 'ArrowRight') {
        this.nextPack();
      } else if (e.key === 'Enter' || e.key === ' ') {
        this.openPurchaseMenu();
      }
    };
    window.addEventListener('keydown', this.boundKeyHandler);
  }

  prevPack() {
    if (this.isOpening || this.isPurchaseModalOpen || this.isTransitioning) return;
    const total = this.collectionKeys.length;
    const target = (this.currentIndex - 1 + total) % total;
    this.goToPack(target, 'prev');
  }

  nextPack() {
    if (this.isOpening || this.isPurchaseModalOpen || this.isTransitioning) return;
    const total = this.collectionKeys.length;
    const target = (this.currentIndex + 1) % total;
    this.goToPack(target, 'next');
  }

  /**
   * Cambia de sobre con animación 3D de transición sin destruir el DOM del carrusel,
   * manteniendo la animación del fondo con símbolos Pokémon corriendo sin detenerse.
   */
  goToPack(targetIndex, direction = 'next') {
    if (this.isOpening || this.isPurchaseModalOpen || this.isTransitioning) return;
    if (targetIndex === this.currentIndex) return;

    const wrapper = this.container.querySelector('.fullscreen-packs-carousel-wrapper');
    if (!wrapper) {
      this.currentIndex = targetIndex;
      this.renderCarousel();
      return;
    }

    this.isTransitioning = true;
    this.currentIndex = targetIndex;
    playCardFlipSound();

    const currentKey = this.collectionKeys[this.currentIndex];
    const currentCol = PACK_COLLECTIONS[currentKey] || PACK_COLLECTIONS.kanto;
    const total = this.collectionKeys.length;

    // Actualizar brillo y tema sin alterar la capa de fondo animada
    wrapper.style.setProperty('--active-pack-glow', currentCol.themeColor);
    const ambientGlow = wrapper.querySelector('.carousel-ambient-glow');
    if (ambientGlow) {
      ambientGlow.style.background = `radial-gradient(circle, ${currentCol.themeColor}1a 0%, transparent 68%)`;
    }

    // Actualizar monedero
    const coinsEl = wrapper.querySelector('#packsWalletCoinsDisplay');
    if (coinsEl) coinsEl.textContent = getCoins();

    // Actualizar los 4 sobres simultáneamente en el carrusel 3D
    const packItems = wrapper.querySelectorAll('.carousel-pack-item');
    packItems.forEach(item => {
      const idx = parseInt(item.dataset.index, 10);
      const diff = (idx - this.currentIndex + total) % total;

      item.classList.remove(
        'slot-center', 'slot-right', 'slot-back', 'slot-left',
        'is-center', 'is-right', 'is-hidden', 'is-left'
      );

      item.style.removeProperty('--shadow-x');
      item.style.removeProperty('--shadow-y');

      const deluxe = item.querySelector('.booster-pack-deluxe-3d');
      if (deluxe) {
        deluxe.classList.remove('is-tilting', 'is-returning');
        deluxe.style.removeProperty('--tilt-rx');
        deluxe.style.removeProperty('--tilt-ry');
        deluxe.style.removeProperty('--light-x');
        deluxe.style.removeProperty('--light-y');
        deluxe.style.removeProperty('--sheen-opacity');
      }

      if (diff === 0) {
        item.classList.add('slot-center', 'is-center');
        item.title = 'Toca para abrir el menú de compra';
      } else if (diff === 1) {
        item.classList.add('slot-right', 'is-right');
        item.title = PACK_COLLECTIONS[this.collectionKeys[idx]]?.name || '';
      } else if (diff === 3) {
        item.classList.add('slot-left', 'is-left');
        item.title = PACK_COLLECTIONS[this.collectionKeys[idx]]?.name || '';
      } else {
        item.classList.add('slot-back', 'is-hidden');
        item.title = '';
      }
    });

    // Actualizar puntos de paginación
    const dots = wrapper.querySelectorAll('.carousel-dot-btn');
    dots.forEach(dot => {
      const idx = parseInt(dot.dataset.index, 10);
      dot.classList.toggle('active', idx === this.currentIndex);
    });

    // Fin de la animación de transición
    setTimeout(() => {
      this.isTransitioning = false;
    }, 520);
  }

  /**
   * 1. FULLSCREEN 3D PACK CAROUSEL
   */
  renderCarousel() {
    this.isPurchaseModalOpen = false;
    this.isTransitioning = false;

    // Si el carrusel ya existe en el DOM, solo actualizamos el sobre activo sin recrear el DOM
    // De este modo, la animación del fondo con los símbolos Pokémon NO para ni se reinicia
    const existingWrapper = this.container.querySelector('.fullscreen-packs-carousel-wrapper');
    if (existingWrapper) {
      this.goToPack(this.currentIndex, 'next');
      return;
    }

    const coins = getCoins();
    const currentKey = this.collectionKeys[this.currentIndex];
    const currentCol = PACK_COLLECTIONS[currentKey] || PACK_COLLECTIONS.kanto;
    const total = this.collectionKeys.length;

    this.container.innerHTML = `
      <div class="fullscreen-packs-carousel-wrapper" style="--active-pack-glow: ${currentCol.themeColor};">
        <!-- Ambient Radial Glow Behind Center Pack (Soft and subtle) -->
        <div class="carousel-ambient-glow" style="background: radial-gradient(circle, ${currentCol.themeColor}1a 0%, transparent 68%);"></div>

        <!-- Carousel Top Header -->
        <header class="packs-carousel-header">
          <div class="carousel-brand-tag">
            <span class="carousel-dot-live"></span>
            <strong>POKÉMON TCG LIVE • COLECCIONES DE SOBRES</strong>
          </div>
          <h1 class="carousel-main-title">🎁 Elige tu Sobre de Cartas</h1>
          <p class="carousel-sub-title">Navega por las diferentes expansiones y abre sobres para conseguir cartas raras, legendarias y shinys</p>

          <div class="carousel-wallet-badge">
            <span class="wallet-coin-icon">🪙</span>
            <strong class="wallet-coins" id="packsWalletCoinsDisplay">${coins}</strong>
            <span class="wallet-label">PokéCoins</span>
          </div>
        </header>

        <!-- 3D CAROUSEL PANORAMIC STAGE -->
        <div class="carousel-panoramic-stage">
          <!-- Left Arrow -->
          <button class="carousel-nav-arrow arrow-left" id="btnCarouselPrev" title="Sobre anterior (Flecha Izquierda)" aria-label="Anterior sobre">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m15 18-6-6 6-6"/></svg>
          </button>

          <!-- 3D Packs Track -->
          <div class="carousel-3d-track" id="carouselTrack">
            ${this.collectionKeys.map((key, idx) => {
              const col = PACK_COLLECTIONS[key];
              const diff = (idx - this.currentIndex + total) % total;
              let slotClass = 'slot-back is-hidden';
              if (diff === 0) slotClass = 'slot-center is-center';
              else if (diff === 1) slotClass = 'slot-right is-right';
              else if (diff === 3) slotClass = 'slot-left is-left';

              return `
                <div 
                  class="carousel-pack-item ${slotClass}" 
                  data-index="${idx}"
                  style="--item-accent: ${col.themeColor};"
                  title="${diff === 0 ? 'Toca para abrir el menú de compra' : col.name}"
                >
                  <div class="booster-pack-deluxe-3d" style="--mask-url: url('${col.image}');">
                    <img src="${col.image}" alt="Sobre ${col.name}" class="pack-art-img" />
                    <!-- Relieve cilíndrico tridimensional (elimina el aspecto plano y da volumen curvo al sobre) -->
                    <div class="pack-3d-cylinder-depth"></div>
                    <!-- Reflejo especular holográfico dinámico (limitado 100% al interior del sobre) -->
                    <div class="pack-3d-foil-sheen"></div>
                  </div>
                  <!-- Sombra en el suelo 3D del escenario -->
                  <div class="carousel-pack-floor-shadow"></div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Right Arrow -->
          <button class="carousel-nav-arrow arrow-right" id="btnCarouselNext" title="Sobre siguiente (Flecha Derecha)" aria-label="Siguiente sobre">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        <!-- Puntos de paginación -->
        <div class="carousel-pagination-dots">
          ${this.collectionKeys.map((key, idx) => `
            <button 
              class="carousel-dot-btn ${idx === this.currentIndex ? 'active' : ''}" 
              data-index="${idx}"
              title="${PACK_COLLECTIONS[key].name}"
            ></button>
          `).join('')}
        </div>

        <!-- Contenedor dinámico del Menú de Compra (se abre al hacer clic) -->
        <div id="purchaseModalContainer"></div>
      </div>
    `;

    this.attachCarouselListeners();
  }

  attachCarouselListeners() {
    const btnPrev = this.container.querySelector('#btnCarouselPrev');
    const btnNext = this.container.querySelector('#btnCarouselNext');

    btnPrev?.addEventListener('click', () => {
      btnPrev.classList.add('arrow-clicked');
      setTimeout(() => btnPrev.classList.remove('arrow-clicked'), 140);
      this.prevPack();
    });

    btnNext?.addEventListener('click', () => {
      btnNext.classList.add('arrow-clicked');
      setTimeout(() => btnNext.classList.remove('arrow-clicked'), 140);
      this.nextPack();
    });

    // Clic y efecto frontal interactivo en los sobres
    const packItems = this.container.querySelectorAll('.carousel-pack-item');
    packItems.forEach(item => {
      const deluxeBody = item.querySelector('.booster-pack-deluxe-3d');

      // 1. Elevación frontal elegante y brillo suave al pasar el ratón (sin inclinar en 3D)
      item.addEventListener('mouseenter', () => {
        if (this.isOpening || this.isPurchaseModalOpen || this.isTransitioning) return;
        if (deluxeBody) {
          deluxeBody.classList.remove('is-returning');
          deluxeBody.classList.add('is-front-hover');
          deluxeBody.style.setProperty('--sheen-opacity', '0.55');
        }
      });

      item.addEventListener('mousemove', (e) => {
        if (this.isOpening || this.isPurchaseModalOpen || this.isTransitioning || item.classList.contains('pack-is-shaking')) return;
        const rect = item.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width;
        const normY = (e.clientY - rect.top) / rect.height;

        const lightX = (normX * 100).toFixed(1);
        const lightY = (normY * 100).toFixed(1);

        if (deluxeBody) {
          deluxeBody.style.setProperty('--light-x', `${lightX}%`);
          deluxeBody.style.setProperty('--light-y', `${lightY}%`);
          deluxeBody.style.setProperty('--sheen-opacity', '0.55');
        }
      });

      // Animación suave de descenso al retirar el ratón
      item.addEventListener('mouseleave', () => {
        if (deluxeBody) {
          deluxeBody.classList.remove('is-front-hover');
          deluxeBody.classList.add('is-returning');
          deluxeBody.style.setProperty('--sheen-opacity', '0.12');
          deluxeBody.style.setProperty('--light-x', '50%');
          deluxeBody.style.setProperty('--light-y', '40%');

          setTimeout(() => {
            deluxeBody.classList.remove('is-returning');
          }, 440);
        }
      });

      // 2. Sacudida intensa al hacerle click + Abrir menú de compra si es el sobre activo
      item.addEventListener('click', () => {
        if (this.isOpening || this.isTransitioning) return;
        const idx = parseInt(item.dataset.index, 10);

        // Disparar animación de sacudida
        item.classList.remove('pack-is-shaking');
        void item.offsetWidth; // reiniciar reflow
        item.classList.add('pack-is-shaking');
        playCardClashSound();

        setTimeout(() => {
          item.classList.remove('pack-is-shaking');
        }, 550);

        // Si es un sobre lateral, se centra con animación fluida
        if (!isNaN(idx) && idx !== this.currentIndex) {
          const total = this.collectionKeys.length;
          const isNext = idx === (this.currentIndex + 1) % total;
          setTimeout(() => {
            this.goToPack(idx, isNext ? 'next' : 'prev');
          }, 120);
        } else if (idx === this.currentIndex) {
          // Si es el sobre central activo, abre el menú de compra con el sobre solo
          if (!this.isPurchaseModalOpen) {
            setTimeout(() => {
              this.openPurchaseMenu();
            }, 120);
          }
        }
      });
    });

    // Clic en los puntos de paginación
    const dots = this.container.querySelectorAll('.carousel-dot-btn');
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        if (this.isPurchaseModalOpen || this.isTransitioning) return;
        const idx = parseInt(dot.dataset.index, 10);
        if (!isNaN(idx) && idx !== this.currentIndex) {
          const isNext = idx > this.currentIndex;
          this.goToPack(idx, isNext ? 'next' : 'prev');
        }
      });
    });
  }

  /**
   * Abre el menú para comprar el sobre, dejando el sobre solo en pantalla
   * Con animación de entrada y salida
   */
  openPurchaseMenu() {
    if (this.isOpening || this.isPurchaseModalOpen) return;
    this.isPurchaseModalOpen = true;

    const wrapper = this.container.querySelector('.fullscreen-packs-carousel-wrapper');
    if (wrapper) wrapper.classList.add('purchase-mode-active');

    const modalContainer = this.container.querySelector('#purchaseModalContainer');
    if (!modalContainer) return;

    const currentKey = this.collectionKeys[this.currentIndex];
    const currentCol = PACK_COLLECTIONS[currentKey] || PACK_COLLECTIONS.kanto;
    const coins = getCoins();
    const canAfford = coins >= currentCol.cost;

    playCardFlipSound();

    modalContainer.innerHTML = `
      <div class="pack-purchase-modal-card" id="packPurchaseModal" style="--modal-accent: ${currentCol.themeColor};">
        <button class="purchase-modal-close-btn" id="btnClosePurchaseModal" title="Cerrar y volver al carrusel" aria-label="Cerrar">✕</button>

        <div class="purchase-header-badge">
          <span class="badge-dot" style="background: ${currentCol.themeColor};"></span>
          <strong>${currentCol.tag}</strong>
        </div>

        <div class="purchase-title-row">
          <span class="purchase-icon-hero">${currentCol.icon}</span>
          <div>
            <h2 class="purchase-pack-name">${currentCol.name}</h2>
            <span class="purchase-price-tag">🪙 ${currentCol.cost} PokéCoins</span>
          </div>
        </div>

        <p class="purchase-desc-text">${currentCol.description}</p>
        
        <div class="purchase-featured-box">
          <span class="feat-lbl">✨ Pokémon Destacados:</span>
          <strong class="feat-val">${currentCol.featured}</strong>
        </div>

        <div class="purchase-wallet-status">
          <span>Tu saldo actual:</span>
          <strong class="${canAfford ? 'funds-ok' : 'funds-low'}">🪙 ${coins} PokéCoins</strong>
        </div>

        <div class="purchase-modal-actions">
          <button 
            class="btn-primary btn-confirm-purchase ${canAfford ? 'pulse-cta' : 'disabled-cta'}" 
            id="btnConfirmPurchase"
            ${canAfford ? '' : 'disabled'}
          >
            <span>⚡</span>
            <strong>COMPRAR Y ABRIR SOBRE (${currentCol.cost} 🪙)</strong>
          </button>
          ${!canAfford ? `
            <div class="insufficient-funds-msg">
              ⚠️ Te faltan ${currentCol.cost - coins} monedas. ¡Gana combates en el Estadio para conseguirlas!
            </div>
          ` : ''}
          <button class="btn-secondary btn-cancel-purchase" id="btnCancelPurchase">
            ✕ Volver a la selección
          </button>
        </div>
      </div>
    `;

    modalContainer.querySelector('#btnClosePurchaseModal')?.addEventListener('click', () => {
      this.closePurchaseMenu();
    });

    modalContainer.querySelector('#btnCancelPurchase')?.addEventListener('click', () => {
      this.closePurchaseMenu();
    });

    modalContainer.querySelector('#btnConfirmPurchase')?.addEventListener('click', () => {
      if (coins < currentCol.cost) return;
      this.closePurchaseMenu(true);
      const centerPack = this.container.querySelector('.carousel-pack-item.is-center');
      if (centerPack) {
        centerPack.classList.add('pack-is-shaking');
        playCardClashSound();
      }
      setTimeout(() => {
        this.executeRealisticPackOpening();
      }, 400);
    });
  }

  /**
   * Cierra el menú de compra con animación de salida suave y restaura el carrusel
   */
  closePurchaseMenu(immediate = false) {
    if (!this.isPurchaseModalOpen) return;
    const modal = this.container.querySelector('#packPurchaseModal');
    const wrapper = this.container.querySelector('.fullscreen-packs-carousel-wrapper');

    playCardFlipSound();

    if (immediate || !modal) {
      if (modal) modal.remove();
      if (wrapper) wrapper.classList.remove('purchase-mode-active');
      this.isPurchaseModalOpen = false;
      return;
    }

    modal.classList.add('is-closing');
    setTimeout(() => {
      modal.remove();
      if (wrapper) wrapper.classList.remove('purchase-mode-active');
      this.isPurchaseModalOpen = false;
    }, 260);
  }

  /**
   * 2. SECUENCIA CINEMÁTICA DETALLADA DE CÓMO SE ABRE EL SOBRE
   */
  async executeRealisticPackOpening() {
    if (this.isOpening) return;
    const currentKey = this.collectionKeys[this.currentIndex];
    const currentCol = PACK_COLLECTIONS[currentKey] || PACK_COLLECTIONS.kanto;
    const coins = getCoins();

    if (coins < currentCol.cost) return;

    // Descontar monedas
    const spent = spendCoins(currentCol.cost);
    if (!spent) return;

    this.isOpening = true;
    this.revealedCards.clear();
    syncCoinsUI();

    // 1. Mostrar escenario cinemático de apertura
    this.renderCinematicOpeningStage(currentCol);

    // 2. Obtener 3 cartas oficiales de la colección TCG
    let rawCards = [];
    try {
      rawCards = await pullCardsFromTcgPack(currentCol.id);
    } catch (err) {
      console.warn('Error fetching TCG pack:', err);
      rawCards = await pullCardsFromTcgPack('kanto');
    }

    if (!rawCards || rawCards.length < 3) {
      rawCards = await pullCardsFromTcgPack('kanto');
    }

    this.pulledCards = rawCards.slice(0, 3).map(c => normalizeTcgCard(c));

    // Registrar cartas oficiales en el álbum
    registerCards(this.pulledCards);

    // Pausa de suspense con el sobre temblando/sacudiéndose
    const packBody = this.container.querySelector('#cinematicPackBody');
    if (packBody) {
      packBody.classList.add('pack-is-shaking');
      playCardClashSound();
    }
    await this.pause(800);
    if (packBody) packBody.classList.remove('pack-is-shaking');

    // 3. FASE DE RASGADO: La solapa superior se rasga con chispas y sonido
    const tearStrip = this.container.querySelector('#tearTopFoil');
    const sparksBox = this.container.querySelector('#tearSparksBurst');

    if (tearStrip && packBody) {
      tearStrip.classList.add('strip-is-tearing');
      if (sparksBox) sparksBox.classList.add('sparks-active');
      playPackTearSound();
    }

    await this.pause(650);

    // 4. FASE DE EXTRACCIÓN: Las cartas salen hacia arriba del sobre
    const cardsStack = this.container.querySelector('#slidingCardsStack');
    if (cardsStack) {
      cardsStack.classList.add('cards-slide-out-active');
      playCardClashSound();
    }

    // El envoltorio cae hacia abajo
    if (packBody) {
      packBody.classList.add('pack-empty-fade-away');
    }

    await this.pause(850);

    // 5. FASE DE DESPLIEGUE EN ABANICO
    this.renderRevealingStage();
  }

  /**
   * Renderiza el contenedor cinemático donde el sobre se rasga y se abre
   */
  renderCinematicOpeningStage(col) {
    this.container.innerHTML = `
      <div class="cinematic-pack-stage-wrapper" style="--col-glow: ${col.themeColor};">
        <div class="cinematic-spotlight-beam"></div>

        <div class="cinematic-instruction-header" id="cinematicHeaderMsg">
          <span class="live-pulse-dot"></span>
          <strong>ABRIENDO SOBRE: ${col.name.toUpperCase()}</strong>
          <small>Rasgando envoltura holográfica y extrayendo cartas...</small>
        </div>

        <!-- 3D Booster Pack with Detachable Foil Top -->
        <div class="cinematic-pack-container" id="cinematicPackContainer">
          <div class="cinematic-pack-body" id="cinematicPackBody">
            <!-- Top Peelable Foil Cap -->
            <div class="pack-top-foil-cap" id="tearTopFoil">
              <div class="foil-tear-guide-line">
                <span class="tear-scissors">✂️</span>
                <span class="tear-label">TIRAR PARA ABRIR</span>
              </div>
            </div>

            <!-- Erupción de chispas en la rasgadura -->
            <div class="tear-sparks-burst" id="tearSparksBurst">
              <span class="spark s1">⚡</span>
              <span class="spark s2">✨</span>
              <span class="spark s3">💥</span>
              <span class="spark s4">⚡</span>
            </div>

            <!-- Main Body Wrapper -->
            <div class="pack-main-wrapper">
              <img src="${col.image}" alt="Sobre ${col.name}" class="cinematic-cover-img" />
            </div>
          </div>

          <!-- Cartas que salen físicamente del sobre hacia arriba -->
          <div class="sliding-cards-stack" id="slidingCardsStack">
            <div class="sliding-card card-depth-1">
              <div class="cardback-foil-pattern">
                <span class="cardback-gem">🔮</span>
                <strong>POKÉDEX</strong>
              </div>
            </div>
            <div class="sliding-card card-depth-2">
              <div class="cardback-foil-pattern">
                <span class="cardback-gem">⚡</span>
                <strong>POKÉDEX</strong>
              </div>
            </div>
            <div class="sliding-card card-depth-3">
              <div class="cardback-foil-pattern">
                <span class="cardback-gem">✨</span>
                <strong>POKÉDEX</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 3. FASE DE REVELADO DE CARTAS EN ABANICO
   */
  renderRevealingStage() {
    this.container.innerHTML = `
      <div class="revealing-cards-stage-fullscreen">
        <div class="stage-instructions-banner" id="stageInstructions">
          ✨ ¡Sobre abierto con éxito! Toca cada carta para descubrir a tus Pokémon ✨
        </div>

        <div class="confetti-burst-wrap" id="confettiWrap"></div>

        <!-- Abanico 3D de Cartas -->
        <div class="cards-fan-panoramic-container" id="cardsFan">
          ${this.pulledCards.map((card, idx) => `
            <div 
              class="reveal-card-slot" 
              id="cardSlot-${idx}" 
              data-index="${idx}"
              data-pokemon-id="${card.id}"
              style="--card-slot-index: ${idx};"
            >
              <div class="reveal-card-flipper" id="flipper-${idx}">
                <!-- Reverso de la Carta -->
                <div class="card-face card-back">
                  <div class="cardback-foil-pattern">
                    <div class="cardback-gem">🔮</div>
                    <span class="cardback-logo">POKÉDEX</span>
                    <small>TOCA PARA REVELAR</small>
                  </div>
                  <div class="card-back-shine"></div>
                </div>

                <!-- Anverso de la Carta Oficial TCG -->
                <div 
                  class="card-face card-front real-tcg-reveal-face ${card.isHolo ? 'is-shiny-card' : ''}" 
                  style="--rarity-accent: ${card.isHolo ? '#fbbf24' : '#38bdf8'};"
                >
                  <div class="card-shine-effect"></div>
                  ${card.isHolo ? '<div class="card-shiny-glitter"></div>' : ''}
                  
                  <div class="reveal-official-img-wrap">
                    <img 
                      src="${card.images?.small || card.images?.large || ('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/' + (card.nationalPokedexNumbers?.[0] || getPokedexNumberByName(card.name) || 282) + '.png')}" 
                      alt="${card.name}" 
                      class="reveal-official-scan-img"
                      loading="lazy"
                      onerror="this.onerror=null; this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/' + (this.closest('.reveal-card-slot')?.dataset?.pokedexNum || 282) + '.png';"
                    />
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="reveal-actions-line" id="revealActionsLine">
          <button class="btn-secondary btn-reveal-all" id="btnRevealAll">
            ⚡ Revelar Todas las Cartas
          </button>
        </div>
      </div>
    `;

    const slots = this.container.querySelectorAll('.reveal-card-slot');
    slots.forEach(slot => {
      slot.addEventListener('click', () => {
        const idx = parseInt(slot.dataset.index, 10);
        this.revealCard(idx);
      });
    });

    this.container.querySelector('#btnRevealAll')?.addEventListener('click', () => {
      this.revealAllCards();
    });
  }

  async revealCard(idx) {
    if (this.revealedCards.has(idx)) return;
    this.revealedCards.add(idx);

    const flipper = this.container.querySelector(`#flipper-${idx}`);
    const slot = this.container.querySelector(`#cardSlot-${idx}`);
    const card = this.pulledCards[idx];

    if (!flipper || !card) return;
    slot.classList.add('is-revealed-done');

    const isUltraHolo = Boolean(card.isHolo || (card.rarity || '').toLowerCase().includes('holo') || (card.rarity || '').toLowerCase().includes('vstar') || (card.rarity || '').toLowerCase().includes('ex') || (card.subtypes || []).includes('TAG TEAM'));

    if (isUltraHolo) {
      await this.triggerLegendaryAnimation(slot, flipper, card);
    } else {
      playCardFlipSound();
      flipper.classList.add('is-flipped');
      playSuccessChime();
    }

    if (this.revealedCards.size === this.pulledCards.length) {
      this.onAllCardsRevealed();
    }
  }

  async revealAllCards() {
    for (let i = 0; i < this.pulledCards.length; i++) {
      if (!this.revealedCards.has(i)) {
        await this.revealCard(i);
        await this.pause(450);
      }
    }
  }

  async triggerEpicAnimation(slot, flipper, card) {
    slot.classList.add('charging-epic');
    playCardClashSound();
    await this.pause(350);

    flipper.classList.add('is-flipped');
    playEpicRevealSound();
    const pokeNum = card.nationalPokedexNumbers?.[0] || 1;
    playPokemonCry(pokeNum);

    this.showFloatingCelebrationBanner(`🟣 ¡CARTA ULTRA RARA OBTENIDA!`, card.name, '#c084fc');
  }

  async triggerLegendaryAnimation(slot, flipper, card) {
    const overlay = document.createElement('div');
    overlay.className = 'legendary-cinematic-overlay';
    overlay.innerHTML = `
      <div class="legendary-sunburst"></div>
      <div class="legendary-banner-box">
        <div class="legendary-star-icon">🌟✨🌟</div>
        <h1 class="legendary-announcement">¡¡CARTA HOLO ULTRA RARA!!</h1>
        <h2 class="legendary-name-reveal">${card.name.toUpperCase()}</h2>
        <p>¡Una carta oficial de <strong>${card.set?.name || 'Pokémon TCG'}</strong> se ha unido a tu colección!</p>
      </div>
    `;
    document.body.appendChild(overlay);

    playLegendaryRevealSound();
    const pokeNum = card.nationalPokedexNumbers?.[0] || 1;
    playPokemonCry(pokeNum);

    slot.classList.add('charging-legendary');
    flipper.classList.add('is-flipped');
    this.launchConfetti();

    await this.pause(2400);

    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.remove();
    }, 500);
  }

  showFloatingCelebrationBanner(title, pokemonName, color) {
    const banner = document.createElement('div');
    banner.className = 'pull-celebration-toast';
    banner.style.borderColor = color;
    banner.innerHTML = `
      <strong>${title}</strong>
      <span>¡${pokemonName} registrado en tu colección!</span>
    `;
    this.container.appendChild(banner);

    setTimeout(() => {
      banner.classList.add('fade-out');
      setTimeout(() => banner.remove(), 400);
    }, 2800);
  }

  launchConfetti() {
    const confettiContainer = this.container.querySelector('#confettiWrap');
    if (!confettiContainer) return;

    for (let i = 0; i < 35; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      piece.style.backgroundColor = ['#fbbf24', '#f59e0b', '#ec4899', '#8b5cf6', '#38bdf8'][Math.floor(Math.random() * 5)];
      confettiContainer.appendChild(piece);
    }
  }

  onAllCardsRevealed() {
    this.isOpening = false;
    syncCoinsUI();

    const instructions = this.container.querySelector('#stageInstructions');
    if (instructions) {
      instructions.innerHTML = `🎉 ¡Todas las cartas registradas en tu colección!`;
    }

    const actionLine = this.container.querySelector('#revealActionsLine');
    if (actionLine) {
      const coins = getCoins();
      const currentKey = this.collectionKeys[this.currentIndex];
      const currentCol = PACK_COLLECTIONS[currentKey] || PACK_COLLECTIONS.kanto;

      actionLine.innerHTML = `
        <button class="btn-primary" id="btnOpenAnotherPack" ${coins >= currentCol.cost ? '' : 'disabled'}>
          🎁 Abrir Otro Sobre (${currentCol.cost} 🪙)
        </button>
        <button class="btn-secondary" id="btnGoDeckFromPacks">
          🃏 Ir a Crear Mazo
        </button>
        <button class="btn-secondary" id="btnGoBattleFromPacks">
          ⚔️ Ir a la Batalla
        </button>
      `;

      actionLine.querySelector('#btnOpenAnotherPack')?.addEventListener('click', () => {
        this.renderCarousel();
      });

      actionLine.querySelector('#btnGoDeckFromPacks')?.addEventListener('click', () => {
        document.getElementById('btnSubtabDeck')?.click();
      });

      actionLine.querySelector('#btnGoBattleFromPacks')?.addEventListener('click', () => {
        document.getElementById('btnSubtabBattle')?.click();
      });
    }
  }

  pause(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}
