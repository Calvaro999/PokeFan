/**
 * MODULE: Pokédex View (js/pokedex.js)
 * Manages grid rendering, filters, modal showcase, and view modes
 */

import {
  loadMasterPokemonList,
  loadTypesFromPokeApi,
  fetchPokemonDetail,
  fetchPokemonSpecies,
  fetchEvolutionChain,
  fetchPokemonForType,
  getPokeSpriteForMode,
  getPokeArtworkUrl,
  getPokeAnimatedUrl,
  getPokeShinyArtworkUrl,
  TYPE_TRANSLATIONS,
  GENERATION_RANGES,
  STAT_NAMES_ES
} from './api.js';
import { playPokemonCry } from './audio.js';

const BATCH_SIZE = 24;

export class PokedexApp {
  constructor(domElements) {
    this.dom = domElements;
    this.allPokemon = [];
    this.filteredPokemon = [];
    this.renderedCount = 0;
    this.favorites = new Set();
    this.spriteMode = localStorage.getItem('pokedex_sprite_mode') || 'default';
    this.activeFilters = {
      search: '',
      generation: 'all',
      type: 'all',
      favoritesOnly: false,
      sortBy: 'id-asc'
    };
    this.currentModalId = null;
    this.isLoadingMore = false;
  }

  async init() {
    this.loadFavoritesFromStorage();
    this.syncInitialViewMode();
    this.setupEventListeners();
    this.renderSkeletonCards(BATCH_SIZE);

    try {
      await loadTypesFromPokeApi();
      this.populateTypePills();

      this.allPokemon = await loadMasterPokemonList();
      if (this.dom.apiStatusText) {
        this.dom.apiStatusText.textContent = `PokeAPI v2 • ${this.allPokemon.length.toLocaleString()} Pokémon`;
      }

      this.setupIntersectionObserver();
      this.applyFiltersAndSort();
    } catch (err) {
      console.error('Error inicializando Pokédex:', err);
      this.showToast('Error al conectar con PokeAPI. Reintentando...', 'error');
    }
  }

  loadFavoritesFromStorage() {
    try {
      const stored = localStorage.getItem('pokedex_favorites');
      if (stored) this.favorites = new Set(JSON.parse(stored));
    } catch (e) {
      console.warn('Error accediendo a localStorage:', e);
    }
    this.updateFavBadge();
  }

  saveFavoritesToStorage() {
    try {
      localStorage.setItem('pokedex_favorites', JSON.stringify([...this.favorites]));
    } catch (e) {
      console.warn('Error guardando favoritos:', e);
    }
    this.updateFavBadge();
  }

  updateFavBadge() {
    if (this.dom.favCountBadge) {
      this.dom.favCountBadge.textContent = this.favorites.size;
    }
  }

  toggleFavorite(id) {
    if (this.favorites.has(id)) {
      this.favorites.delete(id);
      this.showToast('Eliminado de favoritos');
    } else {
      this.favorites.add(id);
      this.showToast('¡Añadido a favoritos! ⭐');
    }
    this.saveFavoritesToStorage();

    if (this.activeFilters.favoritesOnly) {
      this.applyFiltersAndSort();
    }
  }

  syncInitialViewMode() {
    if (this.dom.viewModeSelect) {
      this.dom.viewModeSelect.value = this.spriteMode;
    }
  }

  setSpriteMode(newMode) {
    if (this.spriteMode === newMode) return;
    this.spriteMode = newMode;
    localStorage.setItem('pokedex_sprite_mode', newMode);
    this.syncInitialViewMode();

    const modeLabels = {
      'default': 'Modo: Normal (Arte Oficial HD) 🎨',
      'shiny': 'Modo: ¡Todos los Pokémon Shinys! ✨',
      'animated': 'Modo: Sprites Animados Showdown 🎬',
      'shiny-animated': 'Modo: ¡Sprites Shiny Animados! ✨🎬'
    };
    this.showToast(modeLabels[newMode] || 'Modo visual actualizado');

    this.updateAllVisibleCardSprites();
  }

  updateAllVisibleCardSprites() {
    const cards = this.dom.pokemonGrid.querySelectorAll('.pokemon-card');
    cards.forEach((card) => {
      const id = parseInt(card.dataset.id, 10);
      const img = card.querySelector('.pokemon-card-img');
      if (!img || !id) return;

      img.classList.add('switching');
      img.src = getPokeSpriteForMode(id, this.spriteMode);
      this.setupCardImageFallback(img, id, this.spriteMode);

      img.onload = () => {
        img.classList.remove('switching');
      };
    });
  }

  setupCardImageFallback(img, id, mode) {
    img.onerror = () => {
      img.onerror = null;
      if (mode === 'shiny-animated') {
        img.src = getPokeAnimatedUrl(id);
        img.onerror = () => {
          img.src = getPokeShinyArtworkUrl(id);
          img.onerror = () => {
            img.src = getPokeArtworkUrl(id);
          };
        };
      } else if (mode === 'animated') {
        img.src = getPokeArtworkUrl(id);
      } else if (mode === 'shiny') {
        img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`;
        img.onerror = () => {
          img.src = getPokeArtworkUrl(id);
        };
      } else {
        img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
        img.onerror = () => {
          img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
        };
      }
    };
  }

  async populateTypePills() {
    const types = await loadTypesFromPokeApi();
    const fragment = document.createDocumentFragment();

    types.forEach((typeObj) => {
      const info = TYPE_TRANSLATIONS[typeObj.name] || { es: typeObj.name, color: '#94a3b8' };
      const btn = document.createElement('button');
      btn.className = 'type-pill-btn';
      btn.dataset.type = typeObj.name;
      btn.style.setProperty('--type-color', info.color);
      btn.innerHTML = `<span class="type-dot"></span> ${info.es}`;
      
      btn.addEventListener('click', () => {
        this.setActiveTypeFilter(typeObj.name);
      });

      fragment.appendChild(btn);
    });

    this.dom.typePillsContainer.appendChild(fragment);
  }

  async applyFiltersAndSort() {
    let list = [...this.allPokemon];

    // Generation
    const gen = this.activeFilters.generation;
    if (gen !== 'all') {
      const range = GENERATION_RANGES[gen];
      if (range) list = list.filter(p => p.id >= range.min && p.id <= range.max);
    }

    // Favorites
    if (this.activeFilters.favoritesOnly) {
      list = list.filter(p => this.favorites.has(p.id));
    }

    // Search
    const query = this.activeFilters.search.trim().toLowerCase();
    if (query) {
      const cleanNum = query.replace(/^#+/, '');
      const isNum = !isNaN(cleanNum) && cleanNum !== '';
      list = list.filter(p => {
        if (isNum && p.id === parseInt(cleanNum, 10)) return true;
        return p.name.toLowerCase().includes(query) || String(p.id).includes(cleanNum);
      });
    }

    // Type Filter
    const type = this.activeFilters.type;
    if (type !== 'all') {
      const typeSet = await fetchPokemonForType(type);
      list = list.filter(p => typeSet.has(p.id));
    }

    // Sorting
    const sort = this.activeFilters.sortBy;
    if (sort === 'id-asc') list.sort((a, b) => a.id - b.id);
    else if (sort === 'id-desc') list.sort((a, b) => b.id - a.id);
    else if (sort === 'name-asc') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'name-desc') list.sort((a, b) => b.name.localeCompare(a.name));

    this.filteredPokemon = list;
    this.renderedCount = 0;

    this.updateResultsBar();
    this.dom.pokemonGrid.innerHTML = '';

    if (list.length === 0) {
      this.dom.emptyState.style.display = 'block';
      this.dom.loadingTrigger.style.display = 'none';
    } else {
      this.dom.emptyState.style.display = 'none';
      this.dom.loadingTrigger.style.display = 'flex';
      this.renderNextBatch();
    }
  }

  updateResultsBar() {
    const total = this.filteredPokemon.length;
    this.dom.resultsCounterText.innerHTML = `Mostrando <strong>${Math.min(this.renderedCount || BATCH_SIZE, total)}</strong> de <strong>${total.toLocaleString()}</strong> Pokémon`;

    this.dom.activeChipsContainer.innerHTML = '';
    
    if (this.activeFilters.search) {
      this.addFilterChip(`Búsqueda: "${this.activeFilters.search}"`, () => {
        this.dom.searchInput.value = '';
        this.activeFilters.search = '';
        this.dom.clearSearchBtn.style.display = 'none';
        this.applyFiltersAndSort();
      });
    }

    if (this.activeFilters.generation !== 'all') {
      const genObj = GENERATION_RANGES[this.activeFilters.generation];
      this.addFilterChip(`Gen: ${genObj ? genObj.name : this.activeFilters.generation}`, () => {
        this.setActiveGenFilter('all');
      });
    }

    if (this.activeFilters.type !== 'all') {
      const typeName = TYPE_TRANSLATIONS[this.activeFilters.type]?.es || this.activeFilters.type;
      this.addFilterChip(`Tipo: ${typeName}`, () => {
        this.setActiveTypeFilter('all');
      });
    }

    if (this.activeFilters.favoritesOnly) {
      this.addFilterChip(`Solo Favoritos`, () => {
        this.activeFilters.favoritesOnly = false;
        this.dom.favFilterBtn.classList.remove('active');
        this.applyFiltersAndSort();
      });
    }
  }

  addFilterChip(label, onRemove) {
    const chip = document.createElement('span');
    chip.className = 'filter-chip';
    chip.innerHTML = `${label} <span class="chip-remove" title="Quitar filtro">&times;</span>`;
    chip.querySelector('.chip-remove').addEventListener('click', onRemove);
    this.dom.activeChipsContainer.appendChild(chip);
  }

  async renderNextBatch() {
    if (this.isLoadingMore) return;
    if (this.renderedCount >= this.filteredPokemon.length) {
      this.dom.loadingTrigger.style.display = 'none';
      return;
    }

    this.isLoadingMore = true;
    this.dom.bottomLoader.style.display = 'flex';

    const startIndex = this.renderedCount;
    const nextBatch = this.filteredPokemon.slice(startIndex, startIndex + BATCH_SIZE);
    const fragment = document.createDocumentFragment();

    nextBatch.forEach((pokemon) => {
      const card = this.createPokemonCardElement(pokemon);
      fragment.appendChild(card);
    });

    this.dom.pokemonGrid.appendChild(fragment);
    this.renderedCount += nextBatch.length;

    this.updateResultsBar();
    this.loadBatchDetails(nextBatch);

    this.isLoadingMore = false;
    if (this.renderedCount >= this.filteredPokemon.length) {
      this.dom.loadingTrigger.style.display = 'none';
    }
  }

  createPokemonCardElement(pokemon) {
    const card = document.createElement('article');
    card.className = 'pokemon-card';
    card.dataset.id = pokemon.id;
    card.dataset.name = pokemon.name;
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Ver detalles de ${pokemon.name}`);

    const isFav = this.favorites.has(pokemon.id);
    const formattedId = `#${String(pokemon.id).padStart(4, '0')}`;
    const artworkUrl = getPokeSpriteForMode(pokemon.id, this.spriteMode);

    card.innerHTML = `
      <div class="card-top">
        <span class="pokemon-id">${formattedId}</span>
        <div class="card-actions">
          <button class="card-action-btn play-cry-btn" title="Escuchar sonido PokeAPI" aria-label="Reproducir grito">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M11 5L6 9H2v6h4l5 4V5z"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
          <button class="card-action-btn fav-btn ${isFav ? 'is-fav' : ''}" title="Guardar favorito" aria-label="Favorito">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="sprite-wrapper">
        <img 
          src="${artworkUrl}" 
          alt="${pokemon.name}" 
          class="pokemon-card-img" 
          loading="lazy"
        />
      </div>

      <h3 class="pokemon-name">${pokemon.name.replace('-', ' ')}</h3>
      
      <div class="types-container" id="types-${pokemon.id}">
        <span class="type-badge" style="background-color: rgba(255,255,255,0.06);">Cargando...</span>
      </div>
    `;

    const imgEl = card.querySelector('.pokemon-card-img');
    this.setupCardImageFallback(imgEl, pokemon.id, this.spriteMode);

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-btn')) return;
      this.openPokemonModal(pokemon.id);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.openPokemonModal(pokemon.id);
      }
    });

    const favBtn = card.querySelector('.fav-btn');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFavorite(pokemon.id);
      favBtn.classList.toggle('is-fav', this.favorites.has(pokemon.id));
    });

    const playCryBtn = card.querySelector('.play-cry-btn');
    playCryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playPokemonCry(pokemon.id);
    });

    return card;
  }

  async loadBatchDetails(batch) {
    const promises = batch.map(async (pokemon) => {
      const detail = await fetchPokemonDetail(pokemon.id);
      if (!detail) return;

      const typesContainer = document.getElementById(`types-${pokemon.id}`);
      const card = document.querySelector(`.pokemon-card[data-id="${pokemon.id}"]`);
      
      if (typesContainer && detail.types && detail.types.length > 0) {
        typesContainer.innerHTML = detail.types.map((type) => {
          const trans = TYPE_TRANSLATIONS[type] || { es: type, color: '#94a3b8' };
          return `<span class="type-badge" style="--badge-bg: ${trans.color};">${trans.es}</span>`;
        }).join('');

        if (card) {
          const primaryType = detail.types[0];
          const primaryColor = TYPE_TRANSLATIONS[primaryType]?.color || '#38bdf8';
          card.style.setProperty('--card-glow', `${primaryColor}33`);
          card.style.setProperty('--card-border', `${primaryColor}66`);
          card.style.setProperty('--card-shadow', `${primaryColor}40`);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  async openPokemonModal(id) {
    this.currentModalId = id;
    this.dom.pokemonModal.classList.add('open');
    this.dom.pokemonModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    this.updateModalNavButtons();

    this.dom.modalBody.innerHTML = `
      <div class="modal-loading-state">
        <div class="spinner-circle"></div>
        <p>Cargando información oficial desde PokeAPI...</p>
      </div>
    `;

    try {
      const [detail, species] = await Promise.all([
        fetchPokemonDetail(id),
        fetchPokemonSpecies(id)
      ]);

      if (!detail) {
        this.dom.modalBody.innerHTML = `<div class="modal-loading-state"><p>No se pudo obtener información del Pokémon.</p></div>`;
        return;
      }

      let evolutions = [];
      if (species && species.evolutionChainUrl) {
        evolutions = await fetchEvolutionChain(species.evolutionChainUrl);
      }

      this.renderModalContent(detail, species, evolutions);
    } catch (err) {
      console.error('Error cargando modal:', err);
      this.dom.modalBody.innerHTML = `<div class="modal-loading-state"><p>Error al cargar detalles de PokeAPI.</p></div>`;
    }
  }

  renderModalContent(detail, species, evolutions) {
    const formattedId = `#${String(detail.id).padStart(4, '0')}`;
    const isFav = this.favorites.has(detail.id);
    const primaryType = detail.types[0] || 'normal';
    const primaryColor = TYPE_TRANSLATIONS[primaryType]?.color || '#38bdf8';
    const bst = detail.stats.reduce((acc, curr) => acc + curr.baseStat, 0);
    const heightMeters = (detail.height / 10).toFixed(1);
    const weightKg = (detail.weight / 10).toFixed(1);

    this.dom.modalBody.innerHTML = `
      <div class="modal-grid" style="--modal-type-glow: ${primaryColor}33;">
        <div class="modal-hero">
          <div class="modal-badge-id">${formattedId}</div>

          <div class="modal-sprite-box">
            <img 
              id="modalSpriteImg"
              src="${detail.sprites.artwork}" 
              alt="${detail.name}" 
              class="modal-sprite-img"
              onerror="this.src='${detail.sprites.default}'"
            />
          </div>

          <div class="sprite-controls">
            <button class="sprite-toggle-btn active" data-view="artwork">Arte Clásico 🎨</button>
            <button class="sprite-toggle-btn" data-view="modern">Render 3D 🖼️</button>
            <button class="sprite-toggle-btn" data-view="shiny">Variocolor ✨</button>
            ${detail.sprites.showdown ? '<button class="sprite-toggle-btn" data-view="showdown">Animado 🎬</button>' : ''}
          </div>

          <div class="modal-cry-player" id="modalCryBtn" title="Reproducir sonido oficial de PokeAPI">
            <div class="cry-icon-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>
            <span class="cry-label">Sonido Oficial</span>
            <div class="sound-waves">
              <span class="sound-bar"></span>
              <span class="sound-bar"></span>
              <span class="sound-bar"></span>
              <span class="sound-bar"></span>
            </div>
          </div>
        </div>

        <div class="modal-details">
          <div class="modal-header-info">
            <div class="modal-title-box">
              ${species?.japaneseName ? `<span class="modal-japanese-name">${species.japaneseName}</span>` : ''}
              <h2 class="modal-name" id="modalPokemonName">${detail.name.replace('-', ' ')}</h2>
              <span class="modal-genus">${species?.genus || 'Pokémon'}</span>
            </div>
            <div class="modal-header-actions">
              <button class="modal-tcg-link-btn" id="modalGoTcgBtn" title="Ver cartas oficiales TCG de ${detail.name}">
                <span>🃏</span> Zona TCG
              </button>
              <button class="modal-fav-toggle-btn ${isFav ? 'is-fav' : ''}" id="modalFavBtn" title="Guardar en favoritos" aria-label="Favorito">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="types-container" style="justify-content: flex-start;">
            ${detail.types.map((type) => {
              const t = TYPE_TRANSLATIONS[type] || { es: type, color: '#94a3b8' };
              return `<span class="type-badge" style="--badge-bg: ${t.color}; padding: 5px 14px; font-size: 0.8rem;">${t.es}</span>`;
            }).join('')}
          </div>

          <p class="modal-flavor-text">
            "${species?.flavorText || 'Datos recogidos de la base oficial de PokeAPI.'}"
          </p>

          <div class="physical-traits-grid">
            <div class="trait-card">
              <span class="trait-label">Altura</span>
              <span class="trait-val">${heightMeters} m</span>
            </div>
            <div class="trait-card">
              <span class="trait-label">Peso</span>
              <span class="trait-val">${weightKg} kg</span>
            </div>
            <div class="trait-card">
              <span class="trait-label">Habilidades</span>
              <div class="abilities-list">
                ${detail.abilities.map((a) => `
                  <span class="ability-tag ${a.isHidden ? 'hidden' : ''}" title="${a.isHidden ? 'Habilidad Oculta' : 'Habilidad'}">
                    ${a.name.replace('-', ' ')} ${a.isHidden ? '★' : ''}
                  </span>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="stats-section-box">
            <div class="stats-header-bar">
              <span class="section-subtitle">Estadísticas Base</span>
              <span class="bst-badge">Total: ${bst}</span>
            </div>
            <div class="stat-rows">
              ${detail.stats.map((s) => {
                const label = STAT_NAMES_ES[s.name] || s.name;
                const percentage = Math.min(100, Math.round((s.baseStat / 255) * 100));
                
                let statColor = '#ef4444';
                if (s.baseStat >= 110) statColor = '#38bdf8';
                else if (s.baseStat >= 80) statColor = '#22c55e';
                else if (s.baseStat >= 50) statColor = '#eab308';

                return `
                  <div class="stat-row">
                    <span class="stat-name">${label}</span>
                    <span class="stat-value">${s.baseStat}</span>
                    <div class="stat-bar-track">
                      <div class="stat-bar-fill" style="--stat-color: ${statColor}; width: 0%;" data-target="${percentage}%"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          ${evolutions.length > 1 ? `
            <div class="evolution-section">
              <span class="section-subtitle">Línea Evolutiva</span>
              <div class="evo-chain-wrapper">
                ${evolutions.map((stage, idx) => {
                  const isCurrent = stage.id === detail.id;
                  const evoArtwork = getPokeArtworkUrl(stage.id);
                  return `
                    ${idx > 0 ? `
                      <div class="evo-arrow">
                        <span class="evo-trigger">${stage.trigger || '→'}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
                      </div>
                    ` : ''}
                    <div class="evo-stage ${isCurrent ? 'current' : ''}" data-id="${stage.id}" title="${stage.name}">
                      <img src="${evoArtwork}" alt="${stage.name}" class="evo-sprite" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${stage.id}.png'" />
                      <span class="evo-name">${stage.name}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      this.dom.modalBody.querySelectorAll('.stat-bar-fill').forEach((bar) => {
        bar.style.width = bar.dataset.target;
      });
    });

    const spriteImg = document.getElementById('modalSpriteImg');
    this.dom.modalBody.querySelectorAll('.sprite-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.dom.modalBody.querySelectorAll('.sprite-toggle-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const view = btn.dataset.view;
        if (view === 'artwork') spriteImg.src = detail.sprites.artwork;
        else if (view === 'modern') spriteImg.src = detail.sprites.modernArtwork || detail.sprites.artwork;
        else if (view === 'shiny') spriteImg.src = detail.sprites.artworkShiny;
        else if (view === 'showdown') spriteImg.src = detail.sprites.showdown;
      });
    });

    const cryBtn = document.getElementById('modalCryBtn');
    if (cryBtn) {
      cryBtn.addEventListener('click', () => {
        cryBtn.classList.add('playing');
        playPokemonCry(detail.id, () => cryBtn.classList.remove('playing'));
      });
    }

    const modalFavBtn = document.getElementById('modalFavBtn');
    modalFavBtn?.addEventListener('click', () => {
      this.toggleFavorite(detail.id);
      const nowFav = this.favorites.has(detail.id);
      modalFavBtn.classList.toggle('is-fav', nowFav);
      
      const gridCard = document.querySelector(`.pokemon-card[data-id="${detail.id}"] .fav-btn`);
      if (gridCard) gridCard.classList.toggle('is-fav', nowFav);
    });

    const modalGoTcgBtn = document.getElementById('modalGoTcgBtn');
    modalGoTcgBtn?.addEventListener('click', () => {
      this.closeModal();
      window.location.hash = '#mazo';
    });

    this.dom.modalBody.querySelectorAll('.evo-stage').forEach((evoNode) => {
      evoNode.addEventListener('click', () => {
        const targetId = parseInt(evoNode.dataset.id, 10);
        if (targetId && targetId !== detail.id) {
          this.openPokemonModal(targetId);
        }
      });
    });
  }

  closeModal() {
    this.dom.pokemonModal.classList.remove('open');
    this.dom.pokemonModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    this.currentModalId = null;
  }

  updateModalNavButtons() {
    const currentIndex = this.filteredPokemon.findIndex(p => p.id === this.currentModalId);
    this.dom.modalPrevBtn.style.display = currentIndex > 0 ? 'flex' : 'none';
    this.dom.modalNextBtn.style.display = currentIndex >= 0 && currentIndex < this.filteredPokemon.length - 1 ? 'flex' : 'none';
  }

  navigateModal(direction) {
    if (!this.currentModalId) return;
    const currentIndex = this.filteredPokemon.findIndex(p => p.id === this.currentModalId);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < this.filteredPokemon.length) {
      this.openPokemonModal(this.filteredPokemon[nextIndex].id);
    }
  }

  setupEventListeners() {
    if (this.dom.viewModeSelect) {
      this.dom.viewModeSelect.addEventListener('change', (e) => {
        this.setSpriteMode(e.target.value);
      });
    }

    let searchTimeout;
    this.dom.searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const val = e.target.value;
      this.dom.clearSearchBtn.style.display = val ? 'block' : 'none';

      searchTimeout = setTimeout(() => {
        this.activeFilters.search = val;
        this.applyFiltersAndSort();
      }, 180);
    });

    this.dom.clearSearchBtn.addEventListener('click', () => {
      this.dom.searchInput.value = '';
      this.dom.clearSearchBtn.style.display = 'none';
      this.activeFilters.search = '';
      this.applyFiltersAndSort();
      this.dom.searchInput.focus();
    });

    this.dom.favFilterBtn.addEventListener('click', () => {
      this.activeFilters.favoritesOnly = !this.activeFilters.favoritesOnly;
      this.dom.favFilterBtn.classList.toggle('active', this.activeFilters.favoritesOnly);
      this.applyFiltersAndSort();
    });

    this.dom.sortSelect.addEventListener('change', (e) => {
      this.activeFilters.sortBy = e.target.value;
      this.applyFiltersAndSort();
    });

    this.dom.genPillsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;
      this.setActiveGenFilter(btn.dataset.gen);
    });

    const allTypeBtn = this.dom.typePillsContainer.querySelector('[data-type="all"]');
    if (allTypeBtn) {
      allTypeBtn.addEventListener('click', () => this.setActiveTypeFilter('all'));
    }

    this.dom.resetFiltersBtn.addEventListener('click', () => this.resetAllFilters());

    this.dom.modalCloseBtn.addEventListener('click', () => this.closeModal());
    this.dom.modalPrevBtn.addEventListener('click', () => this.navigateModal(-1));
    this.dom.modalNextBtn.addEventListener('click', () => this.navigateModal(1));

    this.dom.pokemonModal.addEventListener('click', (e) => {
      if (e.target === this.dom.pokemonModal) this.closeModal();
    });

    this.dom.manualLoadMoreBtn.addEventListener('click', () => this.renderNextBatch());

    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        this.dom.scrollTopBtn.classList.add('visible');
      } else {
        this.dom.scrollTopBtn.classList.remove('visible');
      }
    });

    this.dom.scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    if (this.dom.logoReload) {
      this.dom.logoReload.addEventListener('click', () => this.resetAllFilters());
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== this.dom.searchInput && !this.dom.pokemonModal.classList.contains('open')) {
        e.preventDefault();
        this.dom.searchInput.focus();
      }

      if (this.dom.pokemonModal.classList.contains('open')) {
        if (e.key === 'Escape') this.closeModal();
        if (e.key === 'ArrowLeft') this.navigateModal(-1);
        if (e.key === 'ArrowRight') this.navigateModal(1);
      }
    });
  }

  setActiveGenFilter(gen) {
    this.activeFilters.generation = gen;
    this.dom.genPillsContainer.querySelectorAll('.pill-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.gen === gen);
    });
    this.applyFiltersAndSort();
  }

  setActiveTypeFilter(type) {
    this.activeFilters.type = type;
    this.dom.typePillsContainer.querySelectorAll('.type-pill-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    this.applyFiltersAndSort();
  }

  resetAllFilters() {
    this.dom.searchInput.value = '';
    this.dom.clearSearchBtn.style.display = 'none';
    this.activeFilters.search = '';
    this.activeFilters.generation = 'all';
    this.activeFilters.type = 'all';
    this.activeFilters.favoritesOnly = false;
    this.activeFilters.sortBy = 'id-asc';
    this.dom.sortSelect.value = 'id-asc';
    this.dom.favFilterBtn.classList.remove('active');

    this.dom.genPillsContainer.querySelectorAll('.pill-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.gen === 'all');
    });
    this.dom.typePillsContainer.querySelectorAll('.type-pill-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.type === 'all');
    });

    this.applyFiltersAndSort();
  }

  setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) {
      this.dom.manualLoadMoreBtn.style.display = 'inline-flex';
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !this.isLoadingMore) {
        this.renderNextBatch();
      }
    }, {
      rootMargin: '300px 0px',
      threshold: 0.1
    });

    observer.observe(this.dom.loadingTrigger);
  }

  renderSkeletonCards(count) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const skel = document.createElement('div');
      skel.className = 'skeleton-card';
      skel.innerHTML = `
        <div class="skeleton-top"><div class="skeleton-id"></div></div>
        <div class="skeleton-img"></div>
        <div class="skeleton-title"></div>
        <div class="skeleton-badges">
          <div class="skeleton-badge"></div>
          <div class="skeleton-badge"></div>
        </div>
      `;
      fragment.appendChild(skel);
    }
    this.dom.pokemonGrid.appendChild(fragment);
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }
}
