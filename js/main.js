/**
 * MODULE: Main Orchestrator (js/main.js)
 * Manages view switching between Pokédex, Booster Packs, Deck Builder,
 * and authentic Pokémon Battle Stadium.
 */

import { PokedexApp } from './pokedex.js';
import { PokemonBattleGame } from './games/battle.js';
import { PackOpeningGame } from './games/packs.js';
import { DeckBuilderView } from './deckbuilder.js';
import { syncCoinsUI } from './collection.js';
import { init3DCardEffects, getCardArtMode, setCardArtMode, updateAllCardsArtMode } from './card3d.js';

let pokedexInstance = null;
let battleGameInstance = null;
let packOpeningInstance = null;
let currentSubtab = 'battle';

function init() {
  // 1. Gather Pokédex DOM references
  const pokedexDom = {
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    favFilterBtn: document.getElementById('favFilterBtn'),
    favCountBadge: document.getElementById('favCountBadge'),
    sortSelect: document.getElementById('sortSelect'),
    viewModeSelect: document.getElementById('viewModeSelect'),
    genPillsContainer: document.getElementById('genPillsContainer'),
    typePillsContainer: document.getElementById('typePillsContainer'),
    resultsCounterText: document.getElementById('resultsCounterText'),
    activeChipsContainer: document.getElementById('activeChipsContainer'),
    pokemonGrid: document.getElementById('pokemonGrid'),
    emptyState: document.getElementById('emptyState'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    loadingTrigger: document.getElementById('loadingTrigger'),
    bottomLoader: document.getElementById('bottomLoader'),
    manualLoadMoreBtn: document.getElementById('manualLoadMoreBtn'),
    scrollTopBtn: document.getElementById('scrollTopBtn'),
    logoReload: document.getElementById('logoReload'),
    apiStatusText: document.getElementById('apiStatusText'),
    pokemonModal: document.getElementById('pokemonModal'),
    modalBody: document.getElementById('modalBody'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalPrevBtn: document.getElementById('modalPrevBtn'),
    modalNextBtn: document.getElementById('modalNextBtn'),
    toastContainer: document.getElementById('toastContainer')
  };

  // 2. Initialize Pokédex instance
  pokedexInstance = new PokedexApp(pokedexDom);
  pokedexInstance.init();

  // 3. Navigation View Switcher (Pokédex vs Batalla & Cartas)
  setupMainNavigation();
  setupSideDrawer();

  // 4. Subtab Switcher (Sobres / Crear Mazo / Batalla / Álbum)
  setupCardGameSubtabs();

  // 5. Initial wallet display
  syncCoinsUI();

  // 6. Initialize 3D Card Physics & Interactive Tilt on all cards
  init3DCardEffects();
  updateAllCardsArtMode();
  setupCardAnimationToggle();

  // 7. Check initial URL hash
  handleRouteHash();
  window.addEventListener('hashchange', handleRouteHash);
}

function setupSideDrawer() {
  const drawer = document.getElementById('pkmnSideDrawer');
  const btnToggle = document.getElementById('btnToggleSideDrawer');
  const btnReopen = document.getElementById('btnReopenSideDrawer');
  const btnHeaderToggle = document.getElementById('btnHeaderMenuToggle');

  const toggleDrawer = () => {
    if (drawer) {
      drawer.classList.toggle('is-collapsed');
      const isCollapsed = drawer.classList.contains('is-collapsed');
      localStorage.setItem('pkmn_drawer_collapsed', isCollapsed ? '1' : '0');
      document.body.classList.toggle('drawer-is-collapsed', isCollapsed);
    }
  };

  btnToggle?.addEventListener('click', toggleDrawer);
  btnReopen?.addEventListener('click', toggleDrawer);
  btnHeaderToggle?.addEventListener('click', toggleDrawer);

  // Default to collapsed so initial view is clean and unobstructed
  const isExplicitlyOpened = localStorage.getItem('pkmn_drawer_collapsed') === '0';
  if (!isExplicitlyOpened) {
    drawer?.classList.add('is-collapsed');
    document.body.classList.add('drawer-is-collapsed');
  } else {
    drawer?.classList.remove('is-collapsed');
    document.body.classList.remove('drawer-is-collapsed');
  }
}

function setupCardAnimationToggle() {
  const toggleBtn = document.getElementById('btnCardAnimModeToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = getCardArtMode();
      const next = current === 'animated' ? 'vintage' : 'animated';
      setCardArtMode(next);
    });
  }
}

function setupMainNavigation() {
  const navTabs = document.querySelectorAll('.main-nav-tab');

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.dataset.view;
      switchView(targetView);
    });
  });

  // 1. Botón POKÉDEX en el portal de inicio
  const btnPortalPokedex = document.getElementById('btnPortalPokedex');
  if (btnPortalPokedex) {
    btnPortalPokedex.addEventListener('click', () => {
      switchView('pokedex');
    });
    btnPortalPokedex.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchView('pokedex');
      }
    });
  }

  // 2. Botón ZONA TCG en el portal de inicio
  const btnPortalTcg = document.getElementById('btnPortalTcg');
  if (btnPortalTcg) {
    btnPortalTcg.addEventListener('click', () => {
      switchView('cartas');
    });
    btnPortalTcg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchView('cartas');
      }
    });
  }

  // 3. Botones para volver al menú de inicio desde las cabeceras
  const btnReturnFromPokedex = document.getElementById('btnReturnFromPokedex');
  if (btnReturnFromPokedex) {
    btnReturnFromPokedex.addEventListener('click', () => switchView('landing'));
  }

  const btnReturnFromTcg = document.getElementById('btnReturnFromTcg');
  if (btnReturnFromTcg) {
    btnReturnFromTcg.addEventListener('click', () => switchView('landing'));
  }

  // 4. Clic en el logo del header regresa al portal principal
  const brandGroupHome = document.getElementById('brandGroupHome');
  if (brandGroupHome) {
    brandGroupHome.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('landing');
    });
  }
}

function setupCardGameSubtabs() {
  const subtabs = document.querySelectorAll('.cardgame-tab');

  subtabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.subtab;
      switchCardSubtab(target);
    });
  });
}

export function switchCardSubtab(subtabName) {
  currentSubtab = subtabName;
  const subtabs = document.querySelectorAll('.cardgame-tab');
  subtabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.subtab === subtabName);
  });

  const subviewPacks = document.getElementById('subviewPacks');
  const subviewDeck = document.getElementById('subviewDeck');
  const subviewBattle = document.getElementById('subviewBattle');

  if (subviewPacks) subviewPacks.style.display = subtabName === 'packs' ? 'block' : 'none';
  if (subviewDeck) subviewDeck.style.display = subtabName === 'deck' ? 'block' : 'none';
  if (subviewBattle) subviewBattle.style.display = subtabName === 'battle' ? 'block' : 'none';

  syncCoinsUI();

  if (subtabName === 'packs') {
    window.location.hash = 'sobres';
    loadPacksGame();
  } else if (subtabName === 'deck') {
    window.location.hash = 'mazo';
    loadDeckBuilder();
  } else if (subtabName === 'battle') {
    window.location.hash = 'batalla';
    loadBattleGame();
  }
}

export function switchView(viewName) {
  const navTabs = document.querySelectorAll('.main-nav-tab');
  const viewLanding = document.getElementById('viewLanding');
  const viewPokedex = document.getElementById('viewPokedex');
  const viewCardGame = document.getElementById('viewCardGame');
  const controlsSection = document.getElementById('controlsSection');
  const mainHeader = document.getElementById('mainHeader');
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  const sideDrawer = document.getElementById('pkmnSideDrawer');
  const btnReopenDrawer = document.getElementById('btnReopenSideDrawer');

  navTabs.forEach(t => t.classList.toggle('active', t.dataset.view === viewName));

  if (viewName === 'landing' || viewName === 'home' || viewName === 'inicio') {
    document.body.classList.add('is-landing-view');
    window.location.hash = 'inicio';
    if (viewLanding) viewLanding.style.display = 'flex';
    if (mainHeader) mainHeader.style.display = 'none';
    if (controlsSection) controlsSection.style.display = 'none';
    if (viewPokedex) viewPokedex.style.display = 'none';
    if (viewCardGame) viewCardGame.style.display = 'none';
    if (scrollTopBtn) scrollTopBtn.style.display = 'none';
    if (sideDrawer) sideDrawer.style.display = 'none';
    if (btnReopenDrawer) btnReopenDrawer.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (viewName === 'cartas') {
    document.body.classList.remove('is-landing-view');
    window.location.hash = 'cartas';
    if (viewLanding) viewLanding.style.display = 'none';
    if (mainHeader) mainHeader.style.display = 'block';
    if (controlsSection) controlsSection.style.display = 'none';
    if (viewPokedex) viewPokedex.style.display = 'none';
    if (viewCardGame) viewCardGame.style.display = 'block';
    if (scrollTopBtn) scrollTopBtn.style.display = 'none';
    if (sideDrawer) sideDrawer.style.display = 'flex';
    if (btnReopenDrawer) btnReopenDrawer.style.display = 'flex';
    switchCardSubtab(currentSubtab || 'battle');
  } else {
    // Default Pokedex View
    document.body.classList.remove('is-landing-view');
    window.location.hash = 'pokedex';
    if (viewLanding) viewLanding.style.display = 'none';
    if (mainHeader) mainHeader.style.display = 'block';
    if (viewCardGame) viewCardGame.style.display = 'none';
    if (controlsSection) controlsSection.style.display = 'block';
    if (viewPokedex) viewPokedex.style.display = 'block';
    if (sideDrawer) sideDrawer.style.display = 'flex';
    if (btnReopenDrawer) btnReopenDrawer.style.display = 'flex';
  }
}

function handleRouteHash() {
  const hash = window.location.hash.toLowerCase();
  if (hash === '#sobres' || hash === '#packs') {
    switchView('cartas');
    switchCardSubtab('packs');
  } else if (hash === '#mazo' || hash === '#deck' || hash === '#equipo') {
    switchView('cartas');
    switchCardSubtab('deck');
  } else if (hash === '#album' || hash === '#coleccion') {
    switchView('cartas');
    switchCardSubtab('deck');
  } else if (hash === '#cartas' || hash === '#tcg' || hash === '#juego' || hash === '#batalla' || hash === '#battle') {
    switchView('cartas');
    switchCardSubtab('battle');
  } else if (hash === '#pokedex') {
    switchView('pokedex');
  } else {
    // Entrada sin hash o con #inicio: pantalla inicial con sólo dos botones
    switchView('landing');
  }
}

function loadBattleGame() {
  const gameMount = document.getElementById('gameMountPoint');
  if (!gameMount) return;

  // Re-instantiate or restart so custom deck is applied
  battleGameInstance = new PokemonBattleGame(gameMount);
  battleGameInstance.init();
}

function loadPacksGame() {
  const packsMount = document.getElementById('packsMountPoint');
  if (!packsMount) return;

  if (!packOpeningInstance) {
    packOpeningInstance = new PackOpeningGame(packsMount);
  }
  packOpeningInstance.init();
}

async function loadDeckBuilder() {
  const deckMount = document.getElementById('deckMountPoint');
  if (!deckMount) return;

  const builder = new DeckBuilderView(deckMount);
  await builder.init();
}

// Bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
