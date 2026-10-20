/**
 * MODULE: Deck Builder (js/deckbuilder.js)
 * Authentic, Beautiful & Responsive Official Pokémon TCG Deck Builder:
 * - Uses real, official Pokémon TCG card scans from https://api.pokemontcg.io/v2/cards/
 * - Supports user's featured card xy7-54 Gardevoir Rare Holo
 * - Interactive 3D tilt & dynamic holographic prismatic foil reflection
 * - Fullscreen 3D Card Inspector Modal with high-res scans, attacks, market price & rules
 * - Active 3-card Deck rack with Leader/Support roles, quick swap and promote to leader
 * - Responsive card binder collection with real-time search & rarity/type filters
 */

import { 
  getCollection, 
  getUserDeck, 
  setUserDeck, 
  swapCardInDeck,
  ensureStarterDeckInitialized,
  getCoins,
  spendCoins,
  registerCards,
  syncCoinsUI,
  getInventory,
  useItemOnCard,
  getExpForNextLevel,
  ITEM_DEFINITIONS
} from './collection.js';
import { playCardFlipSound, playSuccessChime, playCoinSound, playCardSplashSound } from './audio.js';
import { PREPACKAGED_TCG_CARDS, fetchTcgCardById, pullCardsFromTcgPack, searchTcgCardsOnline, normalizeTcgCard, getPokedexNumberByName } from './tcg-api.js';

const TYPE_ICONS = {
  fairy: '✨',
  fire: '🔥',
  water: '💧',
  grass: '🌿',
  lightning: '⚡',
  psychic: '🔮',
  fighting: '🥊',
  darkness: '🌑',
  metal: '⚙️',
  dragon: '🐉',
  colorless: '⚪'
};

const ENERGY_COLORS = {
  fairy: '#f472b6',
  fire: '#ef4444',
  water: '#38bdf8',
  grass: '#22c55e',
  lightning: '#eab308',
  psychic: '#c084fc',
  fighting: '#f97316',
  darkness: '#475569',
  metal: '#94a3b8',
  dragon: '#6366f1',
  colorless: '#cbd5e1'
};

export class DeckBuilderView {
  constructor(containerEl) {
    this.container = containerEl;
    this.selectedSlot = 0; // 0 (Líder), 1 (Titular 2), 2 (Titular 3)
    this.searchQuery = '';
    this.selectedRarityFilter = 'all'; // 'all' | 'holo' | 'fairy' | 'fire' | 'water' | 'lightning' | 'psychic'
    this.inspectingCard = null;
  }

  async init() {
    this.renderLoading();
    try {
      await ensureStarterDeckInitialized();
    } catch (err) {
      console.warn('Advertencia al sincronizar cartas del mazo:', err);
    }
    this.render();
  }

  renderLoading() {
    this.container.innerHTML = `
      <div class="deckbuilder-loading-state">
        <div class="pokeball-loading-core">
          <div class="pkb-top"></div>
          <div class="pkb-band"><div class="pkb-btn"></div></div>
          <div class="pkb-bottom"></div>
        </div>
        <h3>Cargando tu Mazo Pokémon TCG...</h3>
        <p>Sincronizando cartas oficiales de api.pokemontcg.io</p>
      </div>
    `;
  }

  render() {
    const collection = getCollection();
    const deckKeys = getUserDeck().map(String);
    const collectionList = Object.values(collection);
    const coins = getCoins();
    const inv = getInventory();

    // 3 cartas del mazo titular
    const activeDeckCards = deckKeys.map((key, idx) => {
      let card = collection[key] || PREPACKAGED_TCG_CARDS[key] || PREPACKAGED_TCG_CARDS['xy7-54'];
      card = normalizeTcgCard(card);
      return {
        ...card,
        slotIdx: idx,
        level: card.level || 1,
        exp: card.exp || 0
      };
    });

    // Estadísticas del mazo
    const avgHp = Math.round(activeDeckCards.reduce((acc, c) => acc + (c.hp || 80), 0) / 3);
    const totalHp = activeDeckCards.reduce((acc, c) => acc + (c.hp || 80), 0);
    const totalHolos = collectionList.filter(c => c.isHolo || (c.rarity || '').toLowerCase().includes('holo')).length;

    this.container.innerHTML = `
      <div class="deckbuilder-master-container">
        <!-- 1. ENCABEZADO Y ESTADÍSTICAS DEL EQUIPO -->
        <header class="deckbuilder-top-banner">
          <div class="banner-left">
            <div class="tcg-logo-pill">
              <span class="tcg-dot"></span>
              <strong>POKÉMON TCG OFICIAL • CONSTRUCTOR DE MAZO</strong>
            </div>
            <h2 class="banner-title">Crea tu Equipo de 3 Cartas Oficiales</h2>
            <p class="banner-sub">
              Cartas oficiales obtenidas directamente de la <strong>API Pokémon TCG (api.pokemontcg.io)</strong>.
              Toca cualquier carta para verla en alta resolución con efectos holográficos en 3D.
            </p>
          </div>

          <div class="banner-right">
            <div class="deck-stat-panel">
              <div class="stat-unit">
                <span class="unit-label">PS MEDIO</span>
                <strong class="unit-val">${avgHp} PS</strong>
              </div>
              <div class="unit-sep"></div>
              <div class="stat-unit">
                <span class="unit-label">PS TOTALES</span>
                <strong class="unit-val">${totalHp} PS</strong>
              </div>
              <div class="unit-sep"></div>
              <div class="stat-unit">
                <span class="unit-label">CARTAS HOLO</span>
                <strong class="unit-val">✨ ${totalHolos}</strong>
              </div>
            </div>

            <button class="btn-primary btn-launch-battle" id="btnGoBattleFromDeck" title="Iniciar combate en el Estadio">
              <span>⚔️</span>
              <strong>¡IR AL COMBATE!</strong>
            </button>
          </div>
        </header>

        <!-- 2. PODIO DE LAS 3 RANURAS ACTIVAS (LÍDER, TITULAR 2, TITULAR 3) -->
        <section class="active-deck-pedestal-section">
          <div class="pedestal-header-row">
            <div class="pedestal-title-group">
              <h3 class="pedestal-title">
                <span>🃏 Tu Mazo Titular Activo (3 Cartas Oficiales)</span>
              </h3>
              <p class="pedestal-subtitle">
                Tu rival en el Estadio adaptará sus cartas en base al poder de estos 3 Pokémon. Haz clic en una ranura para editarla o pulsa 🔍 para inspeccionar la carta.
              </p>
            </div>
            <div class="active-slot-pill">
              Ranura en Edición: <strong>Ranura #${this.selectedSlot + 1} (${this.selectedSlot === 0 ? '👑 LÍDER' : 'APOYO'})</strong>
            </div>
          </div>

          <div class="pedestal-cards-grid">
            ${activeDeckCards.map((card, idx) => {
              const isSelected = idx === this.selectedSlot;
              const roleTitle = idx === 0 ? '👑 LÍDER DEL MAZO' : `⚔️ TITULAR #${idx + 1}`;
              const roleBadgeClass = idx === 0 ? 'role-leader' : 'role-support';

              return `
                <div 
                  class="deck-slot-podium-wrap ${isSelected ? 'is-selected-slot-podium' : ''}" 
                  data-slot="${idx}"
                  data-card-id="${card.id}"
                  draggable="true"
                  title="Ranura #${idx + 1} (${card.name}) - Arrastra para intercambiar o suelta una carta aquí"
                >
                  <div class="slot-role-ribbon ${roleBadgeClass}">
                    <span class="ribbon-title">${roleTitle}</span>
                    <span class="ribbon-status">${isSelected ? '⭐ SELECCIONADA' : 'Toca para editar'}</span>
                  </div>
                  
                  <div class="tcg-card-wrapper size-large ${isSelected ? 'aura-glow' : ''}">
                    ${this.renderTcgCardMarkup(card, false, idx)}
                  </div>

                  <!-- Indicador visual cuando se arrastra una carta sobre esta ranura -->
                  <div class="slot-drop-hint-overlay">
                    <span class="drop-hint-icon">📥</span>
                    <span class="drop-hint-text">¡Suelta para colocar aquí!</span>
                  </div>

                  <div class="slot-actions-row">
                    <button class="btn-slot-select ${isSelected ? 'btn-selected' : ''}" data-slot="${idx}">
                      ${isSelected ? '👉 Ranura en selección' : `✏️ Cambiar Ranura #${idx + 1}`}
                    </button>
                    ${idx !== 0 ? `
                      <button class="btn-promote-leader" data-slot="${idx}" title="Poner esta carta como primer combatiente líder">
                        👑 Hacer Líder
                      </button>
                    ` : ''}
                    <button class="btn-slot-inspect" data-card-id="${card.id}" title="Inspeccionar carta en 3D HD">
                      🔍 Ver en HD
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </section>

        <!-- 3. ÁLBUM DE CARTAS DISPONIBLES EN TU INVENTARIO -->
        <section class="binder-inventory-section">
          <div class="binder-toolbar">
            <div class="toolbar-title-wrap">
              <h3>📖 Tu Álbum de Cartas Oficiales (${collectionList.length})</h3>
              <p>
                Toca cualquier carta para elegir su ranura con animación, o arrástrala directamente al mazo.
              </p>
            </div>

            <div class="toolbar-filter-controls">
              <!-- Buscador en tiempo real -->
              <div class="binder-search-box">
                <span class="search-ico">🔍</span>
                <input 
                  type="text" 
                  id="binderSearchInput" 
                  placeholder="Buscar por nombre, tipo o ataque..." 
                  value="${this.searchQuery}"
                  autocomplete="off"
                />
                ${this.searchQuery ? '<button id="btnClearBinderSearch" class="btn-clear-search" title="Limpiar">&times;</button>' : ''}
              </div>

              <!-- Filtros de Tipo y Rareza -->
              <div class="filter-pills-row">
                <button class="pill-chip ${this.selectedRarityFilter === 'all' ? 'active' : ''}" data-rarity="all">
                  Todas (${collectionList.length})
                </button>
                <button class="pill-chip chip-shiny ${this.selectedRarityFilter === 'holo' ? 'active' : ''}" data-rarity="holo">
                  ✨ Holo / Ultra Raras (${totalHolos})
                </button>
                <button class="pill-chip ${this.selectedRarityFilter === 'fairy' ? 'active' : ''}" data-rarity="fairy">
                  ✨ Hada (Gardevoir)
                </button>
                <button class="pill-chip ${this.selectedRarityFilter === 'fire' ? 'active' : ''}" data-rarity="fire">
                  🔥 Fuego (Charizard)
                </button>
                <button class="pill-chip ${this.selectedRarityFilter === 'lightning' ? 'active' : ''}" data-rarity="lightning">
                  ⚡ Eléctrico (Pikachu)
                </button>
                <button class="pill-chip ${this.selectedRarityFilter === 'water' ? 'active' : ''}" data-rarity="water">
                  💧 Agua (Blastoise)
                </button>
                <button class="pill-chip ${this.selectedRarityFilter === 'psychic' ? 'active' : ''}" data-rarity="psychic">
                  🔮 Psíquico (Mewtwo)
                </button>
              </div>
            </div>
          </div>

          <!-- Cuadrícula de Cartas -->
          <div class="binder-cards-mount" id="binderCardsMount">
            ${this.renderBinderGridMarkup(collectionList, deckKeys)}
          </div>
        </section>
      </div>

      <!-- MODAL SELECTOR DE RANURA (ELEGIR POSICIÓN EN EL MAZO) -->
      <div id="slotPickerModalMount"></div>

      <!-- MODAL DE INSPECCIÓN 3D EN ALTA DEFINICIÓN -->
      <div id="cardInspectModalMount"></div>
    `;

    this.attachListeners();
  }

  /**
   * Renderiza una auténtica Carta Pokémon TCG oficial con la imagen real de api.pokemontcg.io
   */
  renderTcgCardMarkup(card, isInDeck = false, slotIdx = 0) {
    const isHolo = Boolean(card.isHolo || (card.rarity || '').toLowerCase().includes('holo') || (card.subtypes || []).includes('EX') || (card.subtypes || []).includes('GX') || (card.subtypes || []).includes('VSTAR'));
    const pType = (card.primaryType || card.types?.[0] || 'colorless').toLowerCase();
    const typeColor = ENERGY_COLORS[pType] || '#38bdf8';

    const pokeNum = card.nationalPokedexNumbers?.[0] || getPokedexNumberByName(card.name) || 282;
    const fallbackSrc = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeNum}.png`;
    const cardImgSrc = card.images?.small || card.images?.large || fallbackSrc;

    return `
      <div 
        class="pkmn-tcg-card real-tcg-card ${isHolo ? 'card-is-shiny-foil' : ''}"
        data-card-id="${card.id}"
        data-key="${card.id}"
        style="--card-energy-color: ${typeColor};"
        title="${card.name} (${card.hp || 100} PS)"
      >
        <div class="tcg-card-holographic-glare"></div>
        ${isHolo ? '<div class="tcg-holo-prismatic-sheen"></div>' : ''}

        <!-- Indicador discreto si está en el mazo activo -->
        ${isInDeck ? `
          <div class="tcg-equipped-banner">
            ✓ ${slotIdx === 0 ? '👑 LÍDER' : `RANURA #${slotIdx + 1}`}
          </div>
        ` : ''}

        <!-- Escaneo Oficial Real de la Carta (100% visible, sin recortes) -->
        <img 
          src="${cardImgSrc}" 
          alt="${card.name}" 
          class="tcg-card-full-img" 
          loading="lazy" 
          onerror="this.onerror=null; this.src='${fallbackSrc}';"
        />

        <!-- Botón de Información Estilo Pokémon Oficial -->
        <button 
          type="button" 
          class="btn-pkmn-card-info" 
          data-card-id="${card.id}" 
          title="Ver ataques e información oficial de ${card.name}"
          aria-label="Ver ataques e información oficial de ${card.name}"
        >
          <img src="assets/pokemon_info_btn.jpg" alt="Info" class="pkmn-info-btn-img" />
        </button>
      </div>
    `;
  }

  /**
   * Genera el HTML de la cuadrícula de cartas filtradas
   */
  renderBinderGridMarkup(collectionList, deckKeys) {
    const filteredList = collectionList.filter(card => {
      // Búsqueda
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase().trim();
        const matchesName = (card.name || '').toLowerCase().includes(q);
        const matchesType = (card.types || []).some(t => t.toLowerCase().includes(q));
        const matchesSet = (card.set?.name || '').toLowerCase().includes(q);
        const matchesAttack = (card.attacks || []).some(a => a.name.toLowerCase().includes(q));
        if (!matchesName && !matchesType && !matchesSet && !matchesAttack) return false;
      }

      // Filtro de rareza / tipo
      if (this.selectedRarityFilter === 'holo') {
        return Boolean(card.isHolo || (card.rarity || '').toLowerCase().includes('holo'));
      }
      if (this.selectedRarityFilter !== 'all') {
        return (card.types || []).some(t => t.toLowerCase() === this.selectedRarityFilter);
      }
      return true;
    });

    // Orden: En mazo primero, luego Holos
    filteredList.sort((a, b) => {
      const aInDeck = deckKeys.includes(a.id);
      const bInDeck = deckKeys.includes(b.id);
      if (aInDeck && !bInDeck) return -1;
      if (!aInDeck && bInDeck) return 1;
      if (a.isHolo && !b.isHolo) return -1;
      if (!a.isHolo && b.isHolo) return 1;
      return (b.hp || 0) - (a.hp || 0);
    });

    if (filteredList.length === 0) {
      return `
        <div class="binder-empty-state">
          <span class="empty-ico">🔍</span>
          <h4>No se encontraron cartas</h4>
          <p>Prueba con otro término de búsqueda o limpia los filtros activos.</p>
        </div>
      `;
    }

    return `
      <div class="binder-cards-grid">
        ${filteredList.map(card => {
          const cardKey = card.id;
          const isInDeck = deckKeys.includes(cardKey);
          const deckSlotIdx = deckKeys.indexOf(cardKey);

          return `
            <div 
              class="binder-card-cell ${isInDeck ? 'card-is-equipped' : ''}" 
              data-card-id="${cardKey}"
              draggable="true"
              title="${card.name} (${card.hp || 100} PS) - Arrastra al mazo o haz clic para elegir su ranura"
            >
              <div class="tcg-card-wrapper size-medium">
                ${this.renderTcgCardMarkup(card, isInDeck, deckSlotIdx)}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  attachListeners() {
    // 1. Selección de Ranura en el Podio Superior
    const slotPods = this.container.querySelectorAll('.deck-slot-podium-wrap');
    slotPods.forEach(pod => {
      pod.addEventListener('click', (e) => {
        if (e.target.closest('.btn-promote-leader') || e.target.closest('.btn-slot-inspect')) return;

        const slotIdx = parseInt(pod.dataset.slot, 10);
        if (!isNaN(slotIdx)) {
          this.selectedSlot = slotIdx;
          playCardFlipSound();
          this.render();
          const albumSection = this.container.querySelector('.binder-inventory-section');
          if (albumSection) {
            albumSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });

    // 2. Botón "👑 Hacer Líder" en ranuras 1 y 2 (con animación)
    const promoteBtns = this.container.querySelectorAll('.btn-promote-leader');
    promoteBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotIdx = parseInt(btn.dataset.slot, 10);
        if (!isNaN(slotIdx)) {
          const currentDeck = getUserDeck();
          const targetCard = currentDeck[slotIdx];
          this.placeCardInSlot(0, targetCard, true);
        }
      });
    });

    // 3. Clic en el botón oficial de información Pokémon
    this.container.querySelectorAll('.btn-pkmn-card-info, .btn-slot-inspect, .btn-card-inspect-direct').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const cardId = btn.dataset.cardId;
        if (cardId) this.openCardInspectModal(cardId);
      });
    });

    // 4. Clic en la carta del álbum: abre modal para elegir la ranura (no automático)
    const binderCells = this.container.querySelectorAll('.binder-card-cell');
    binderCells.forEach(cell => {
      cell.addEventListener('click', (e) => {
        if (e.target.closest('.btn-pkmn-card-info')) return;
        if (this._justFinishedDragging || this._isDraggingCardActive) return;

        const key = cell.dataset.cardId;
        const collection = getCollection();
        const card = collection[key] || PREPACKAGED_TCG_CARDS[key];
        if (card) {
          this.openSlotPickerModal(normalizeTcgCard(card));
        }
      });
    });

    // 5. Conectar eventos Drag & Drop (arrastrar cartas directamente)
    this.attachDragAndDropListeners();

    // 6. Buscador en tiempo real
    const searchInput = this.container.querySelector('#binderSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.updateBinderGridOnly();
      });
    }

    const clearBtn = this.container.querySelector('#btnClearBinderSearch');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.searchQuery = '';
        if (searchInput) searchInput.value = '';
        this.updateBinderGridOnly();
      });
    }

    // 7. Chips de Filtro por Rareza / Tipo
    const chips = this.container.querySelectorAll('.pill-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.selectedRarityFilter = chip.dataset.rarity;
        chips.forEach(c => c.classList.toggle('active', c === chip));
        this.updateBinderGridOnly();
      });
    });

    // 8. Botón "Ir al Combate"
    this.container.querySelector('#btnGoBattleFromDeck')?.addEventListener('click', () => {
      document.getElementById('btnSubtabBattle')?.click();
    });
  }

  /**
   * Abre un Modal Interactivo 3D en Ultra Alta Definición para inspeccionar la carta oficial
   */
  async openCardInspectModal(cardId) {
    playCardFlipSound();
    const collection = getCollection();
    let card = collection[cardId] || PREPACKAGED_TCG_CARDS[cardId];
    if (!card) {
      card = await fetchTcgCardById(cardId);
    }
    if (!card) return;

    card = normalizeTcgCard(card);
    const pType = (card.primaryType || 'colorless').toLowerCase();
    const typeColor = ENERGY_COLORS[pType] || '#38bdf8';
    const typeIcon = TYPE_ICONS[pType] || '⚪';

    const pokeNum = card.nationalPokedexNumbers?.[0] || getPokedexNumberByName(card.name) || 282;
    const fallbackSrc = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeNum}.png`;
    const modalImgSrc = card.images?.large || card.images?.small || fallbackSrc;

    const modalMount = this.container.querySelector('#cardInspectModalMount');
    if (!modalMount) return;

    modalMount.innerHTML = `
      <div class="tcg-inspect-modal-backdrop" id="inspectBackdrop">
        <div class="tcg-inspect-modal-dialog">
          <button class="inspect-close-btn" id="btnCloseInspectModal" title="Cerrar modal">&times;</button>
          
          <div class="inspect-grid">
            <!-- 1. CARTA 3D EN ALTA DEFINICIÓN -->
            <div class="inspect-card-column">
              <div class="inspect-card-3d-wrap">
                <div class="pkmn-tcg-card inspect-deluxe-card card-is-shiny-foil" style="--card-energy-color: ${typeColor};">
                  <div class="tcg-card-holographic-glare"></div>
                  <div class="tcg-holo-prismatic-sheen"></div>
                  <img 
                    src="${modalImgSrc}" 
                    alt="${card.name}" 
                    class="inspect-large-img" 
                    onerror="this.onerror=null; this.src='${fallbackSrc}';"
                  />
                </div>
              </div>
              <small class="inspect-tilt-hint">✨ Pasa el ratón o desliza para ver los reflejos holográficos en 3D</small>
            </div>

            <!-- 2. DETALLES OFICIALES DE LA CARTA (API TCG) -->
            <div class="inspect-details-column">
              <div class="inspect-header">
                <div class="inspect-name-row">
                  <h2 class="inspect-card-title">${card.name}</h2>
                  <span class="inspect-hp-pill">${card.hp} PS</span>
                </div>
                <div class="inspect-meta-tags">
                  <span class="inspect-type-pill" style="background: ${typeColor}; color: #000;">
                    ${typeIcon} Tipo ${card.types?.join(' / ') || 'Normal'}
                  </span>
                  <span class="inspect-subtypes-pill">${card.subtypes?.join(', ') || 'Básico'}</span>
                  <span class="inspect-rarity-pill">🌟 ${card.rarity || 'Rare Holo'}</span>
                </div>
              </div>

              <!-- Habilidad si tiene -->
              ${(card.abilities || []).map(ab => `
                <div class="inspect-ability-card">
                  <div class="ability-title">
                    <span class="ability-badge">${ab.type || 'Habilidad'}</span>
                    <strong>${ab.name}</strong>
                  </div>
                  <p class="ability-text">${ab.text}</p>
                </div>
              `).join('')}

              <!-- Ataques Oficiales -->
              <div class="inspect-attacks-section">
                <h4 class="attacks-title">⚔️ Ataques Oficiales de la Carta</h4>
                <div class="attacks-list-full">
                  ${(card.attacks || []).map(atk => `
                    <div class="inspect-attack-item">
                      <div class="attack-item-top">
                        <div class="attack-cost-wrap">
                          ${(atk.cost || []).map(c => `<span class="energy-cost-dot" title="${c}">${TYPE_ICONS[c.toLowerCase()] || '⚪'}</span>`).join('')}
                          <strong class="atk-item-name">${atk.name}</strong>
                        </div>
                        <span class="atk-item-damage">${atk.damage ? `${atk.damage} PS` : 'Efecto'}</span>
                      </div>
                      ${atk.text ? `<p class="atk-item-text">${atk.text}</p>` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Datos de Combate: Debilidad, Resistencia y Retirada -->
              <div class="inspect-combat-grid">
                <div class="combat-unit">
                  <span class="combat-lbl">Debilidad</span>
                  <strong>${card.weaknesses?.length ? card.weaknesses.map(w => `${TYPE_ICONS[w.type?.toLowerCase()] || ''} ${w.type} ${w.value}`).join(', ') : 'Ninguna'}</strong>
                </div>
                <div class="combat-unit">
                  <span class="combat-lbl">Resistencia</span>
                  <strong>${card.resistances?.length ? card.resistances.map(r => `${TYPE_ICONS[r.type?.toLowerCase()] || ''} ${r.type} ${r.value}`).join(', ') : 'Ninguna'}</strong>
                </div>
                <div class="combat-unit">
                  <span class="combat-lbl">Coste Retirada</span>
                  <strong>${card.retreatCost?.length ? card.retreatCost.map(c => TYPE_ICONS[c.toLowerCase()] || '⚪').join(' ') : 'Gratis'}</strong>
                </div>
              </div>

              <!-- Datos de Expansión, Ilustrador y Mercado -->
              <div class="inspect-extra-data-grid">
                <div class="extra-data-unit">
                  <span class="extra-lbl">Expansión</span>
                  <strong>${card.set?.name || 'Ancient Origins'}</strong>
                </div>
                <div class="extra-data-unit">
                  <span class="extra-lbl">Ilustrador Oficial</span>
                  <strong>${card.artist || 'TOKIYA'}</strong>
                </div>
                <div class="extra-data-unit">
                  <span class="extra-lbl">Número de Carta</span>
                  <strong>#${card.number || '54'} / ${card.set?.total || 100}</strong>
                </div>
                <div class="extra-data-unit">
                  <span class="extra-lbl">Valor Mercado (TCGPlayer)</span>
                  <strong style="color: #4ade80;">$${card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.market || '7.14'} USD</strong>
                </div>
              </div>

              ${card.flavorText ? `
                <div class="inspect-flavor-text">
                  <em>"${card.flavorText}"</em>
                </div>
              ` : ''}

              <!-- Botones Rápidos para Equipar en el Mazo -->
              <div class="inspect-actions-row">
                <button class="btn-primary btn-inspect-equip" data-slot="0">
                  👑 Equipar como Líder
                </button>
                <button class="btn-secondary btn-inspect-equip" data-slot="1">
                  ⚔️ Ranura #2
                </button>
                <button class="btn-secondary btn-inspect-equip" data-slot="2">
                  🛡️ Ranura #3
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Listeners del modal
    const closeBtn = modalMount.querySelector('#btnCloseInspectModal');
    const backdrop = modalMount.querySelector('#inspectBackdrop');

    const closeModal = () => {
      modalMount.innerHTML = '';
    };

    closeBtn?.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    modalMount.querySelectorAll('.btn-inspect-equip').forEach(btn => {
      btn.addEventListener('click', () => {
        const slotIdx = parseInt(btn.dataset.slot, 10);
        closeModal();
        this.placeCardInSlot(slotIdx, card.id, true);
      });
    });
  }

  /**
   * Coloca una carta en la ranura indicada del mazo, ejecutando la animación de SPLASH y sonidos
   */
  placeCardInSlot(slotIdx, cardKey, withAnimation = true) {
    if (slotIdx < 0 || slotIdx > 2 || !cardKey) return;

    swapCardInDeck(slotIdx, cardKey);
    this.selectedSlot = slotIdx;

    if (withAnimation) {
      playCardSplashSound();
    } else {
      playCardFlipSound();
      playSuccessChime();
    }

    this.render();

    if (withAnimation) {
      requestAnimationFrame(() => {
        const slotEl = this.container.querySelector(`.deck-slot-podium-wrap[data-slot="${slotIdx}"]`);
        if (slotEl) {
          const subview = document.getElementById('subviewDeck');
          if (subview && typeof subview.scrollTo === 'function') {
            subview.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            slotEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }

          // 1. Resplandor / shockwave de impacto en la ranura
          slotEl.classList.remove('slot-anim-snap');
          void slotEl.offsetWidth;
          slotEl.classList.add('slot-anim-snap');

          // 2. Animación de inmersión y rebote líquido de la carta
          const cardWrap = slotEl.querySelector('.tcg-card-wrapper') || slotEl.querySelector('.pkmn-tcg-card');
          if (cardWrap) {
            cardWrap.classList.remove('card-anim-splash', 'card-anim-placed');
            void cardWrap.offsetWidth;
            cardWrap.classList.add('card-anim-splash');
          }

          // 3. Generar el efecto de partículas, ondas y gotas de Splash
          this.createCardSplashEffect(slotEl);

          setTimeout(() => {
            slotEl.classList.remove('slot-anim-snap');
            if (cardWrap) cardWrap.classList.remove('card-anim-splash', 'card-anim-placed');
          }, 1100);
        }
      });
    }
  }

  /**
   * Genera el efecto visual completo de SPLASH:
   * Ondas expansivas concéntricas (ripples), corona de salpicadura y 20 gotas despedidas en arco
   */
  createCardSplashEffect(podiumEl) {
    if (!podiumEl) return;

    const prevSplash = podiumEl.querySelector('.card-placement-splash-fx');
    if (prevSplash) prevSplash.remove();

    const splashContainer = document.createElement('div');
    splashContainer.className = 'card-placement-splash-fx';

    // 1. Resplandor acuático difuso
    const mistGlow = document.createElement('div');
    mistGlow.className = 'splash-mist-glow';
    splashContainer.appendChild(mistGlow);

    // 2. Ondas concéntricas de salpicadura (Ripples)
    for (let i = 1; i <= 3; i++) {
      const ring = document.createElement('div');
      ring.className = `splash-ripple-ring ring-${i}`;
      splashContainer.appendChild(ring);
    }

    // 3. Corona vertical de salpicadura
    const crown = document.createElement('div');
    crown.className = 'splash-crown-burst';
    splashContainer.appendChild(crown);

    // 4. 20 Gotas despedidas en abanico
    const dropletCount = 20;
    for (let i = 0; i < dropletCount; i++) {
      const drop = document.createElement('div');
      drop.className = 'splash-droplet-item';

      const angle = (Math.PI / (dropletCount + 1)) * (i + 1) + (Math.random() * 0.2 - 0.1);
      const distance = 65 + Math.random() * 85;
      const x = Math.cos(Math.PI - angle) * distance;
      const y = -Math.sin(angle) * (distance * 1.15);

      const size = 6 + Math.random() * 9;
      const duration = 0.55 + Math.random() * 0.3;
      const delay = Math.random() * 0.08;

      drop.style.setProperty('--drop-x', `${x.toFixed(1)}px`);
      drop.style.setProperty('--drop-y', `${y.toFixed(1)}px`);
      drop.style.setProperty('--drop-size', `${size.toFixed(1)}px`);
      drop.style.setProperty('--drop-duration', `${duration.toFixed(2)}s`);
      drop.style.setProperty('--drop-delay', `${delay.toFixed(3)}s`);

      splashContainer.appendChild(drop);
    }

    podiumEl.appendChild(splashContainer);

    setTimeout(() => {
      splashContainer.remove();
    }, 1200);
  }

  /**
   * Abre un modal para que el usuario ELIJA MANUALMENTE en qué posición del mazo
   * desea colocar la carta (no automático).
   */
  openSlotPickerModal(card) {
    if (!card) return;
    playCardFlipSound();

    const collection = getCollection();
    const currentDeckKeys = getUserDeck().map(String);
    const modalMount = this.container.querySelector('#slotPickerModalMount');
    if (!modalMount) return;

    const pokeNum = card.nationalPokedexNumbers?.[0] || getPokedexNumberByName(card.name) || 282;
    const fallbackSrc = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeNum}.png`;
    const cardImgSrc = card.images?.small || card.images?.large || fallbackSrc;
    const pType = (card.primaryType || card.types?.[0] || 'colorless').toLowerCase();
    const typeIcon = TYPE_ICONS[pType] || '⚪';

    // Obtener los datos de las cartas actualmente en cada ranura
    const currentDeckCards = currentDeckKeys.map((k) => {
      let c = collection[k] || PREPACKAGED_TCG_CARDS[k] || PREPACKAGED_TCG_CARDS['xy7-54'];
      return normalizeTcgCard(c);
    });

    modalMount.innerHTML = `
      <div class="slot-picker-backdrop" id="slotPickerBackdrop">
        <div class="slot-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="pickerModalTitle">
          <button class="slot-picker-close-btn" id="btnCloseSlotPicker" title="Cerrar ventana">&times;</button>

          <!-- ENCABEZADO CON LA CARTA SELECCIONADA -->
          <div class="slot-picker-header">
            <div class="slot-picker-thumb-wrap">
              <img 
                src="${cardImgSrc}" 
                alt="${card.name}" 
                class="slot-picker-thumb-img"
                onerror="this.onerror=null; this.src='${fallbackSrc}';"
              />
            </div>
            <div class="slot-picker-title-group">
              <h3 id="pickerModalTitle">
                ¿Dónde colocar a ${card.name}?
                <span class="slot-picker-card-pill">${typeIcon} ${card.hp || 100} PS</span>
              </h3>
              <p>Elige en qué posición de tu mazo de 3 cartas quieres colocarla:</p>
            </div>
          </div>

          <!-- LAS 3 OPCIONES INTERACTIVAS DE RANURA -->
          <div class="slot-picker-options">
            <!-- Ranura 1: Líder -->
            <button class="slot-picker-opt-btn opt-leader" data-slot="0">
              <div class="opt-slot-icon-box">👑</div>
              <div class="opt-details-col">
                <div class="opt-role-badge-row">
                  <span class="opt-role-label">Ranura #1 — Líder del Mazo</span>
                </div>
                <div class="opt-replace-info">
                  Reemplaza a: <strong>${currentDeckCards[0]?.name || 'Vacío'}</strong> (${currentDeckCards[0]?.hp || 80} PS)
                </div>
              </div>
              <div class="opt-action-arrow">➔</div>
            </button>

            <!-- Ranura 2: Apoyo 1 -->
            <button class="slot-picker-opt-btn" data-slot="1">
              <div class="opt-slot-icon-box">⚔️</div>
              <div class="opt-details-col">
                <div class="opt-role-badge-row">
                  <span class="opt-role-label">Ranura #2 — Titular de Apoyo</span>
                </div>
                <div class="opt-replace-info">
                  Reemplaza a: <strong>${currentDeckCards[1]?.name || 'Vacío'}</strong> (${currentDeckCards[1]?.hp || 80} PS)
                </div>
              </div>
              <div class="opt-action-arrow">➔</div>
            </button>

            <!-- Ranura 3: Apoyo 2 -->
            <button class="slot-picker-opt-btn" data-slot="2">
              <div class="opt-slot-icon-box">🛡️</div>
              <div class="opt-details-col">
                <div class="opt-role-badge-row">
                  <span class="opt-role-label">Ranura #3 — Titular de Apoyo</span>
                </div>
                <div class="opt-replace-info">
                  Reemplaza a: <strong>${currentDeckCards[2]?.name || 'Vacío'}</strong> (${currentDeckCards[2]?.hp || 80} PS)
                </div>
              </div>
              <div class="opt-action-arrow">➔</div>
            </button>
          </div>

          <!-- PIE DE VENTANA CON BOTÓN CANCELAR -->
          <div class="slot-picker-footer">
            <button class="btn-slot-picker-cancel" id="btnCancelSlotPicker">Cancelar</button>
          </div>
        </div>
      </div>
    `;

    const backdrop = modalMount.querySelector('#slotPickerBackdrop');
    const closeBtn = modalMount.querySelector('#btnCloseSlotPicker');
    const cancelBtn = modalMount.querySelector('#btnCancelSlotPicker');

    const closeModal = () => {
      modalMount.innerHTML = '';
      window.removeEventListener('keydown', handleKeyDown);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKeyDown);

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    // Clic en una de las 3 ranuras elegidas
    modalMount.querySelectorAll('.slot-picker-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosenSlot = parseInt(btn.dataset.slot, 10);
        closeModal();
        this.placeCardInSlot(chosenSlot, card.id, true);
      });
    });
  }

  /**
   * Conecta el sistema avanzado de Arrastre 3D con físicas de inclinación inercial,
   * réplica flotante con reflejos holográficos y desplazamiento automático vertical (auto-scroll)
   */
  attachDragAndDropListeners() {
    const slotPods = this.container.querySelectorAll('.deck-slot-podium-wrap');
    const binderCards = this.container.querySelectorAll('.binder-card-cell');
    const collection = getCollection();

    // Desactivar el arrastre nativo básico del navegador para usar nuestro motor 3D fluido
    [...binderCards, ...slotPods].forEach(el => {
      el.addEventListener('dragstart', (e) => e.preventDefault());
    });

    // Helper para obtener el contenedor real que tiene overflow de scroll (#subviewDeck)
    const getScrollTarget = () => {
      const subview = document.getElementById('subviewDeck');
      if (subview && (subview.scrollHeight > subview.clientHeight || subview.clientHeight > 0)) {
        return subview;
      }
      const deckMount = this.container;
      const parentScroll = deckMount?.closest('#subviewDeck') || deckMount?.parentElement;
      if (parentScroll && parentScroll.scrollHeight > parentScroll.clientHeight) {
        return parentScroll;
      }
      return document.scrollingElement || document.documentElement || document.body || window;
    };

    const initDragOnElement = (element, isPodiumSlot = false) => {
      if (element._hasDragAttached) return;
      element._hasDragAttached = true;

      element.addEventListener('pointerdown', (e) => {
        // Ignorar clic derecho o clics sobre botones interactivos internos
        if (e.button !== 0) return;
        if (e.target.closest('button, a, input, select, .btn-pkmn-card-info, .btn-slot-inspect, .btn-promote-leader')) {
          return;
        }

        const cardId = element.dataset.cardId;
        if (!cardId) return;

        const sourceSlot = isPodiumSlot ? parseInt(element.dataset.slot, 10) : null;
        const startX = e.clientX;
        const startY = e.clientY;
        let isDragging = false;

        // Extraer imagen y datos de la carta para la réplica 3D flotante
        const cardObj = collection[cardId] || PREPACKAGED_TCG_CARDS[cardId];
        const cardImg = element.querySelector('img.tcg-card-full-img') || element.querySelector('img');
        const pokeNum = cardObj?.nationalPokedexNumbers?.[0] || getPokedexNumberByName(cardObj?.name) || 282;
        const fallbackSrc = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeNum}.png`;
        const cardImgSrc = cardImg ? cardImg.src : (cardObj?.images?.small || cardObj?.images?.large || fallbackSrc);

        let follower = null;
        let topHint = null;
        let bottomHint = null;
        let animFrameId = null;

        let targetX = startX;
        let targetY = startY;
        let posX = startX;
        let posY = startY;
        let prevX = startX;
        let prevY = startY;
        let tiltX = 0;
        let tiltY = 0;
        let tiltZ = 0;
        let scrollVelocity = 0;

        // Desplaza verticalmente el contenedor activo (#subviewDeck) y el window si es necesario
        const performScroll = (deltaY) => {
          const scrollTarget = getScrollTarget();
          let hasScrolled = false;

          if (scrollTarget && scrollTarget !== window && typeof scrollTarget.scrollTop === 'number') {
            const prev = scrollTarget.scrollTop;
            scrollTarget.scrollTop += deltaY;
            if (Math.abs(scrollTarget.scrollTop - prev) > 0.5) {
              hasScrolled = true;
            }
          }

          // Si estamos navegando hacia arriba y el subview ya llegó a la cima (o si window tiene scroll),
          // nos aseguramos de que el scroll de la ventana principal también vuelva a 0
          if (deltaY < 0 && window.scrollY > 0) {
            window.scrollBy({ top: deltaY, behavior: 'auto' });
          } else if (!hasScrolled) {
            window.scrollBy({ top: deltaY, behavior: 'auto' });
          }
        };

        // Detecta qué podio de ranura está bajo el cursor en tiempo real (incluso mientras la pantalla se desplaza)
        const updateHoveredPodium = (clientX, clientY) => {
          if (follower) follower.style.visibility = 'hidden';
          const elementBelow = document.elementFromPoint(clientX, clientY);
          if (follower) follower.style.visibility = 'visible';

          const hoveredPodium = elementBelow?.closest('.deck-slot-podium-wrap');
          slotPods.forEach(pod => {
            if (pod === hoveredPodium && (!isPodiumSlot || parseInt(pod.dataset.slot, 10) !== sourceSlot)) {
              pod.classList.add('is-drag-over');
            } else {
              pod.classList.remove('is-drag-over');
            }
          });
          return hoveredPodium;
        };

        // Calcula dinámicamente la velocidad de auto-scroll en los bordes
        const updateScrollVelocity = (currentY) => {
          const target = getScrollTarget();
          const targetRect = (target && target !== window && target.getBoundingClientRect)
            ? target.getBoundingClientRect()
            : { top: 0, bottom: window.innerHeight };

          // Zona superior generosa: primeros 180px o cerca del borde superior del contenedor
          const topZone = Math.max(180, targetRect.top + 130);
          // Zona inferior generosa: últimos 150px de la pantalla
          const bottomZone = Math.min(window.innerHeight - 140, targetRect.bottom - 120);

          const canScrollUp = (target && target !== window && typeof target.scrollTop === 'number')
            ? (target.scrollTop > 2 || window.scrollY > 2)
            : (window.scrollY > 2);
          const canScrollDown = (target && target !== window && typeof target.scrollTop === 'number')
            ? (target.scrollTop < target.scrollHeight - target.clientHeight - 4)
            : (window.scrollY < (document.documentElement.scrollHeight - window.innerHeight - 4));

          if (currentY < topZone && canScrollUp) {
            const factor = Math.min(1, Math.max(0, (topZone - currentY) / 130));
            scrollVelocity = -Math.round(8 + factor * 26);
            topHint?.classList.add('is-active');
            bottomHint?.classList.remove('is-active');
          } else if (currentY > bottomZone && canScrollDown) {
            const factor = Math.min(1, Math.max(0, (currentY - bottomZone) / 130));
            scrollVelocity = Math.round(8 + factor * 26);
            bottomHint?.classList.add('is-active');
            topHint?.classList.remove('is-active');
          } else {
            scrollVelocity = 0;
            topHint?.classList.remove('is-active');
            bottomHint?.classList.remove('is-active');
          }
        };

        // Rueda del ratón durante el arrastre (permite navegar fluidamente arriba y abajo con la carta en mano)
        const onWheel = (wheelEvt) => {
          if (!isDragging) return;
          wheelEvt.preventDefault();
          performScroll(wheelEvt.deltaY);
          updateHoveredPodium(targetX, targetY);
        };

        // Teclado durante el arrastre (Flecha Arriba/Abajo, RePág/AvPág, Escape)
        const onDragKeyDown = (keyEvt) => {
          if (!isDragging) return;
          if (keyEvt.key === 'ArrowDown') {
            keyEvt.preventDefault();
            performScroll(90);
            updateHoveredPodium(targetX, targetY);
          } else if (keyEvt.key === 'ArrowUp') {
            keyEvt.preventDefault();
            performScroll(-90);
            updateHoveredPodium(targetX, targetY);
          } else if (keyEvt.key === 'PageDown' || keyEvt.key === ' ') {
            keyEvt.preventDefault();
            performScroll(320);
            updateHoveredPodium(targetX, targetY);
          } else if (keyEvt.key === 'PageUp') {
            keyEvt.preventDefault();
            performScroll(-320);
            updateHoveredPodium(targetX, targetY);
          } else if (keyEvt.key === 'Escape') {
            keyEvt.preventDefault();
            cancelCurrentDrag();
          }
        };

        const onPointerMove = (moveEvt) => {
          targetX = moveEvt.clientX;
          targetY = moveEvt.clientY;

          if (!isDragging) {
            const dist = Math.hypot(targetX - startX, targetY - startY);
            if (dist > 7) {
              isDragging = true;
              this._isDraggingCardActive = true;
              document.body.classList.add('is-dragging-card');
              element.classList.add('is-card-dragging');

              try {
                if (element.setPointerCapture && e.pointerId !== undefined) {
                  element.setPointerCapture(e.pointerId);
                }
              } catch (_) {}

              // Iluminar los pedestales receptores activos
              slotPods.forEach(pod => {
                if (!isPodiumSlot || parseInt(pod.dataset.slot, 10) !== sourceSlot) {
                  pod.classList.add('drag-active-target');
                }
              });

              // Crear la carta 3D flotante que sigue al cursor con perspectiva
              follower = document.createElement('div');
              follower.className = 'floating-drag-3d-follower';
              follower.id = 'active3dDragFollower';
              follower.innerHTML = `
                <div class="floating-drag-3d-card-inner">
                  <img src="${cardImgSrc}" class="floating-drag-3d-img" alt="Arrastrando" />
                  <div class="floating-drag-3d-sheen"></div>
                </div>
                <div class="floating-drag-3d-shadow"></div>
              `;
              document.body.appendChild(follower);

              // Indicadores visuales de auto-scroll con badge interactivo
              topHint = document.createElement('div');
              topHint.className = 'drag-scroll-hint-top';
              topHint.innerHTML = '<div class="drag-scroll-badge">⬆️ Subiendo hacia el mazo...</div>';
              document.body.appendChild(topHint);

              bottomHint = document.createElement('div');
              bottomHint.className = 'drag-scroll-hint-bottom';
              bottomHint.innerHTML = '<div class="drag-scroll-badge">⬇️ Bajando hacia el álbum...</div>';
              document.body.appendChild(bottomHint);

              window.addEventListener('wheel', onWheel, { passive: false });
              window.addEventListener('keydown', onDragKeyDown);

              posX = targetX;
              posY = targetY;
              prevX = targetX;
              prevY = targetY;

              startPhysicsLoop();
            }
          }

          if (isDragging) {
            updateHoveredPodium(moveEvt.clientX, moveEvt.clientY);
          }
        };

        const startPhysicsLoop = () => {
          const updatePhysics = () => {
            if (!isDragging) return;

            // 1. Recalcular y ejecutar auto-scroll continuo mientras el cursor está en el borde
            updateScrollVelocity(targetY);
            if (scrollVelocity !== 0) {
              performScroll(scrollVelocity);
              updateHoveredPodium(targetX, targetY);
            }

            // 2. Interpolación elástica suave hacia la posición del cursor
            posX += (targetX - posX) * 0.42;
            posY += (targetY - posY) * 0.42;

            // 3. Velocidad para cálculo de inclinación 3D
            const vx = targetX - prevX;
            const vy = targetY - prevY;
            prevX = targetX;
            prevY = targetY;

            // 4. Inclinación 3D en los 3 ejes (inercia dinámica)
            const targetTiltY = Math.max(-28, Math.min(28, vx * 1.35));
            const targetTiltX = Math.max(-22, Math.min(22, -vy * 1.1));
            const targetTiltZ = Math.max(-14, Math.min(14, vx * 0.42));

            tiltX += (targetTiltX - tiltX) * 0.22;
            tiltY += (targetTiltY - tiltY) * 0.22;
            tiltZ += (targetTiltZ - tiltZ) * 0.22;

            if (follower) {
              const fWidth = follower.offsetWidth || 165;
              const fHeight = follower.offsetHeight || 230;
              const sheenAngle = (135 + tiltY * 2.5 - tiltX * 1.8).toFixed(1);

              follower.style.setProperty('--sheen-angle', `${sheenAngle}deg`);
              follower.style.transform = `translate3d(${(posX - fWidth / 2).toFixed(1)}px, ${(posY - fHeight / 2).toFixed(1)}px, 0) rotateX(${tiltX.toFixed(1)}deg) rotateY(${tiltY.toFixed(1)}deg) rotateZ(${tiltZ.toFixed(1)}deg) scale(1.08)`;
            }

            animFrameId = requestAnimationFrame(updatePhysics);
          };
          animFrameId = requestAnimationFrame(updatePhysics);
        };

        const cleanupListeners = () => {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);
          window.removeEventListener('wheel', onWheel);
          window.removeEventListener('keydown', onDragKeyDown);

          if (animFrameId) cancelAnimationFrame(animFrameId);
        };

        const cancelCurrentDrag = () => {
          cleanupListeners();
          topHint?.remove();
          bottomHint?.remove();
          document.body.classList.remove('is-dragging-card');
          element.classList.remove('is-card-dragging');

          slotPods.forEach(pod => {
            pod.classList.remove('drag-active-target', 'is-drag-over');
          });

          if (follower) {
            follower.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
            follower.style.opacity = '0';
            follower.style.transform += ' scale(0.7)';
            setTimeout(() => follower?.remove(), 260);
          }

          isDragging = false;
          this._isDraggingCardActive = false;
        };

        const onPointerUp = (upEvt) => {
          cleanupListeners();

          try {
            if (element.releasePointerCapture && upEvt.pointerId !== undefined) {
              element.releasePointerCapture(upEvt.pointerId);
            }
          } catch (_) {}

          topHint?.remove();
          bottomHint?.remove();
          document.body.classList.remove('is-dragging-card');
          element.classList.remove('is-card-dragging');

          slotPods.forEach(pod => {
            pod.classList.remove('drag-active-target', 'is-drag-over');
          });

          if (isDragging) {
            this._justFinishedDragging = true;
            setTimeout(() => {
              this._justFinishedDragging = false;
              this._isDraggingCardActive = false;
            }, 100);

            if (follower) follower.style.visibility = 'hidden';
            const elementBelow = document.elementFromPoint(upEvt.clientX, upEvt.clientY);
            if (follower) follower.style.visibility = 'visible';

            const droppedPodium = elementBelow?.closest('.deck-slot-podium-wrap');

            if (droppedPodium) {
              const targetSlotIdx = parseInt(droppedPodium.dataset.slot, 10);

              if (follower) {
                follower.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';
                follower.style.opacity = '0.35';
                follower.style.transform += ' scale(0.85)';
                setTimeout(() => follower?.remove(), 200);
              }

              if (isPodiumSlot && sourceSlot !== null && !isNaN(sourceSlot)) {
                if (sourceSlot !== targetSlotIdx) {
                  const currentDeck = getUserDeck().map(String);
                  const temp = currentDeck[targetSlotIdx];
                  currentDeck[targetSlotIdx] = currentDeck[sourceSlot];
                  currentDeck[sourceSlot] = temp;
                  setUserDeck(currentDeck);
                  this.placeCardInSlot(targetSlotIdx, currentDeck[targetSlotIdx], true);
                }
              } else if (cardId && !isNaN(targetSlotIdx)) {
                this.placeCardInSlot(targetSlotIdx, cardId, true);
              }
            } else {
              if (follower) {
                follower.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
                follower.style.opacity = '0';
                follower.style.transform += ' scale(0.7)';
                setTimeout(() => follower?.remove(), 260);
              }
            }
          }
        };

        window.addEventListener('pointermove', onPointerMove, { passive: true });
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
      });
    };

    // Registrar en las cartas del álbum
    binderCards.forEach(cell => initDragOnElement(cell, false));

    // Registrar en las 3 ranuras del podio (para intercambiar de sitio)
    slotPods.forEach(pod => initDragOnElement(pod, true));
  }

  /**
   * Actualiza únicamente la cuadrícula del inventario sin redibujar todo el DOM
   */
  updateBinderGridOnly() {
    const mount = this.container.querySelector('#binderCardsMount');
    if (!mount) return;

    const collection = getCollection();
    const deckKeys = getUserDeck().map(String);
    const collectionList = Object.values(collection);

    mount.innerHTML = this.renderBinderGridMarkup(collectionList, deckKeys);

    // Re-vincular eventos del botón oficial de información Pokémon
    mount.querySelectorAll('.btn-pkmn-card-info').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const cardId = btn.dataset.cardId;
        if (cardId) this.openCardInspectModal(cardId);
      });
    });

    // Clic en la carta para abrir el selector de ranura (no automático)
    mount.querySelectorAll('.binder-card-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        if (e.target.closest('.btn-pkmn-card-info')) return;
        if (this._justFinishedDragging || this._isDraggingCardActive) return;
        const key = cell.dataset.cardId;
        const card = collection[key] || PREPACKAGED_TCG_CARDS[key];
        if (card) {
          this.openSlotPickerModal(normalizeTcgCard(card));
        }
      });
    });

    // Re-vincular el sistema de Arrastre 3D para las cartas filtradas
    this.attachDragAndDropListeners();
  }
}
