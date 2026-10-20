/**
 * MODULE: Collection, Inventory & Economy Manager (js/collection.js)
 * Manages PokéCoins, Items/Candies, Level Progression, Card Registration, and Decks
 */

import { getPokemonRarity, getPokemonLevel, getPokeArtworkUrl, getPokeShinyArtworkUrl } from './api.js';
import { playCoinSound, playSuccessChime, playLevelUpSound } from './audio.js';
import { getCardDisplayImage } from './card3d.js';

const COINS_KEY = 'poke_tcg_coins';
const COLLECTION_KEY = 'poke_tcg_collection';
const CUSTOM_DECK_KEY = 'poke_tcg_custom_deck';
const INVENTORY_KEY = 'poke_tcg_inventory';

export const ITEM_DEFINITIONS = {
  rare_candy: {
    id: 'rare_candy',
    name: 'Caramelo Raro',
    icon: '🍬',
    desc: 'Sube instantáneamente +1 nivel al Pokémon (hasta Nv. 100).',
    effectType: 'level',
    value: 1,
    color: '#38bdf8'
  },
  exp_candy: {
    id: 'exp_candy',
    name: 'Caramelo EXP',
    icon: '🫐',
    desc: 'Otorga +100 puntos de Experiencia (EXP) al Pokémon.',
    effectType: 'exp',
    value: 100,
    color: '#a855f7'
  }
};

/* -------------------- INVENTARIO DE OBJETOS -------------------- */

export function getInventory() {
  try {
    const saved = localStorage.getItem(INVENTORY_KEY);
    if (!saved) {
      // 1 Caramelo Raro y 2 Caramelos EXP de bienvenida inicial
      const initial = { rare_candy: 1, exp_candy: 2 };
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(saved);
    return {
      rare_candy: parsed.rare_candy ?? 1,
      exp_candy: parsed.exp_candy ?? 2
    };
  } catch (e) {
    return { rare_candy: 1, exp_candy: 2 };
  }
}

export function addInventoryItem(itemId, amount = 1) {
  const inv = getInventory();
  inv[itemId] = Math.max(0, (inv[itemId] || 0) + amount);
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(inv));
  syncCoinsUI();
  window.dispatchEvent(new CustomEvent('inventoryUpdated', { detail: { inventory: inv, itemId, amount } }));
  return inv;
}

export function consumeInventoryItem(itemId, amount = 1) {
  const inv = getInventory();
  if ((inv[itemId] || 0) < amount) return false;
  inv[itemId] -= amount;
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(inv));
  syncCoinsUI();
  window.dispatchEvent(new CustomEvent('inventoryUpdated', { detail: { inventory: inv, itemId, amount: -amount } }));
  return true;
}

/* -------------------- MONEDAS (POKÉCOINS) -------------------- */

export function getCoins() {
  const saved = localStorage.getItem(COINS_KEY);
  if (saved === null) {
    localStorage.setItem(COINS_KEY, '250');
    return 250;
  }
  const parsed = parseInt(saved, 10);
  return isNaN(parsed) ? 250 : parsed;
}

export function addCoins(amount) {
  const current = getCoins();
  const next = Math.max(0, current + amount);
  localStorage.setItem(COINS_KEY, String(next));
  syncCoinsUI();
  playCoinSound();
  window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { coins: next, delta: amount } }));
  return next;
}

export function spendCoins(amount) {
  const current = getCoins();
  if (current < amount) return false;
  const next = current - amount;
  localStorage.setItem(COINS_KEY, String(next));
  syncCoinsUI();
  window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { coins: next, delta: -amount } }));
  return true;
}

export function syncCoinsUI() {
  const coins = getCoins();
  const els = document.querySelectorAll('.wallet-coins, #walletCoinsDisplay, #coinsAmount');
  els.forEach(el => {
    el.textContent = coins;
  });

  const inv = getInventory();
  const candyEls = document.querySelectorAll('.wallet-candy-badge');
  candyEls.forEach(el => {
    el.innerHTML = `<span>🍬 ${inv.rare_candy || 0}</span> <span>🫐 ${inv.exp_candy || 0}</span>`;
  });

  const albumBadge = document.getElementById('albumCountBadge');
  if (albumBadge) {
    const col = getCollection();
    albumBadge.textContent = Object.keys(col).length;
  }
}

/* -------------------- PROGRESIÓN DE NIVEL Y EXPERIENCIA -------------------- */

export function getExpForNextLevel(level) {
  if (level >= 100) return Infinity;
  // Curva de progresión: Nv. 1 -> 50 EXP, Nv. 2 -> 100 EXP, Nv. 10 -> 500 EXP, máx 1000
  return Math.min(1000, level * 50);
}

export function addExpToCard(cardKey, amount) {
  const collection = getCollection();
  const card = collection[String(cardKey)];
  if (!card) return null;

  let currentLevel = card.level || 1;
  let currentExp = card.exp || 0;
  const oldLevel = currentLevel;

  if (currentLevel >= 100) {
    return { card, oldLevel, newLevel: 100, leveledUp: false, gainedExp: 0 };
  }

  currentExp += amount;
  let leveledUp = false;

  while (currentLevel < 100 && currentExp >= getExpForNextLevel(currentLevel)) {
    currentExp -= getExpForNextLevel(currentLevel);
    currentLevel++;
    leveledUp = true;
  }

  card.level = currentLevel;
  card.exp = currentLevel >= 100 ? 0 : currentExp;

  localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
  window.dispatchEvent(new CustomEvent('collectionUpdated', { detail: { collection } }));
  if (leveledUp) {
    playLevelUpSound();
    window.dispatchEvent(new CustomEvent('cardLeveledUp', { detail: { cardKey, oldLevel, newLevel: currentLevel } }));
  }
  return { card, oldLevel, newLevel: currentLevel, leveledUp, gainedExp: amount };
}

export function useItemOnCard(cardKey, itemId) {
  const itemDef = ITEM_DEFINITIONS[itemId];
  if (!itemDef) return { success: false, reason: 'Objeto desconocido' };

  const collection = getCollection();
  const card = collection[String(cardKey)];
  if (!card) return { success: false, reason: 'Carta no encontrada' };

  if ((card.level || 1) >= 100) {
    return { success: false, reason: '¡Este Pokémon ya está en el nivel máximo (Nv. 100)!' };
  }

  const consumed = consumeInventoryItem(itemId, 1);
  if (!consumed) return { success: false, reason: `No tienes más ${itemDef.name}s disponibles` };

  let result;
  if (itemDef.effectType === 'level') {
    const oldLevel = card.level || 1;
    card.level = Math.min(100, oldLevel + itemDef.value);
    card.exp = 0;
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
    playLevelUpSound();
    window.dispatchEvent(new CustomEvent('collectionUpdated', { detail: { collection } }));
    window.dispatchEvent(new CustomEvent('cardLeveledUp', { detail: { cardKey, oldLevel, newLevel: card.level } }));
    result = { success: true, oldLevel, newLevel: card.level, leveledUp: true, card, item: itemDef };
  } else {
    const expRes = addExpToCard(cardKey, itemDef.value);
    if (!expRes.leveledUp) {
      playSuccessChime();
    }
    result = { success: true, ...expRes, item: itemDef };
  }

  return result;
}

import { PREPACKAGED_TCG_CARDS, normalizeTcgCard } from './tcg-api.js';

/* -------------------- COLECCIÓN DE CARTAS TCG OFICIALES -------------------- */

export function getCollection() {
  try {
    const saved = localStorage.getItem(COLLECTION_KEY);
    let col = saved ? JSON.parse(saved) : {};
    let modified = false;

    // Migración o inicialización con cartas oficiales si está vacía o contiene solo IDs numéricos antiguos
    const keys = Object.keys(col);
    const hasOfficialCards = keys.some(k => k === 'xy7-54' || PREPACKAGED_TCG_CARDS[k]);

    if (keys.length === 0 || !hasOfficialCards) {
      col = {};
      // Registrar cartas TCG oficiales predeterminadas incluyendo xy7-54 Gardevoir
      Object.values(PREPACKAGED_TCG_CARDS).forEach(card => {
        if (card.id === 'fo-5') return; // Evitar duplicar alias heredado
        col[card.id] = {
          ...normalizeTcgCard(card),
          level: 1,
          exp: 0,
          copies: 1,
          registeredAt: Date.now()
        };
      });
      modified = true;
    } else {
      // 1. Migrar fo-5 a base3-5 (Gengar Fossil) si estaba registrado
      if (col['fo-5']) {
        const copies = col['fo-5'].copies || 1;
        delete col['fo-5'];
        col['base3-5'] = {
          ...normalizeTcgCard(PREPACKAGED_TCG_CARDS['base3-5']),
          level: 1,
          exp: 0,
          copies,
          registeredAt: Date.now()
        };
        modified = true;
      }

      // 2. Limpiar cualquier clave puramente numérica heredada de versiones antiguas sin imágenes TCG
      for (const k of Object.keys(col)) {
        if (/^\d+$/.test(k)) {
          delete col[k];
          modified = true;
        }
      }

      // 3. Asegurar que todas las cartas preempaquetadas oficiales estén presentes y con datos sincronizados
      Object.entries(PREPACKAGED_TCG_CARDS).forEach(([id, official]) => {
        if (id === 'fo-5') return;
        if (!col[id]) {
          col[id] = {
            ...normalizeTcgCard(official),
            level: 1,
            exp: 0,
            copies: 1,
            registeredAt: Date.now()
          };
          modified = true;
        } else {
          // Sincronizar nombre, imágenes y Pokédex oficial para que siempre coincidan con el personaje
          if (col[id].name !== official.name || col[id].images?.small !== official.images?.small) {
            col[id].name = official.name;
            col[id].images = official.images;
            col[id].attacks = official.attacks;
            col[id].abilities = official.abilities;
            col[id].types = official.types;
            col[id].primaryType = official.primaryType;
            col[id].nationalPokedexNumbers = official.nationalPokedexNumbers;
            col[id].hp = official.hp;
            col[id].rarity = official.rarity;
            col[id].set = official.set;
            col[id].isHolo = official.isHolo;
            modified = true;
          }
        }
      });
    }

    if (modified) {
      localStorage.setItem(COLLECTION_KEY, JSON.stringify(col));
    }
    return col;
  } catch (e) {
    console.error('Error reading collection:', e);
    return PREPACKAGED_TCG_CARDS;
  }
}

export function registerCards(cards) {
  const collection = getCollection();
  let newlyRegisteredCount = 0;

  cards.forEach(rawCard => {
    const card = normalizeTcgCard(rawCard);
    if (!card) return;

    const cardKey = card.id;

    if (!collection[cardKey]) {
      newlyRegisteredCount++;
      collection[cardKey] = {
        ...card,
        level: card.level || 1,
        exp: 0,
        registeredAt: Date.now(),
        copies: 1
      };
    } else {
      collection[cardKey].copies = (collection[cardKey].copies || 1) + 1;
    }
  });

  localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
  syncCoinsUI();
  window.dispatchEvent(new CustomEvent('collectionUpdated', { detail: { collection, newCount: newlyRegisteredCount } }));
  return collection;
}

export function getUserDeck() {
  try {
    const saved = localStorage.getItem(CUSTOM_DECK_KEY);
    if (!saved) return ['xy7-54', 'basep-1', 'base1-4'];
    let parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length === 3) {
      // Migrar si eran IDs numéricos o fo-5
      const migrated = parsed.map(id => {
        if (id === 'fo-5') return 'base3-5';
        if (id === 10 || id === '10') return 'base1-45'; // Caterpie
        if (id === 129 || id === '129') return 'base1-35'; // Magikarp
        if (id === 19 || id === '19') return 'base1-61'; // Rattata
        return String(id);
      });
      // Asegurarse de que el usuario tenga Gardevoir xy7-54 si no tenía deck
      if (!migrated.includes('xy7-54') && migrated[0] === 'base1-45') {
        migrated[0] = 'xy7-54';
      }
      return migrated;
    }
    return ['xy7-54', 'basep-1', 'base1-4'];
  } catch (e) {
    return ['xy7-54', 'basep-1', 'base1-4'];
  }
}

export function setUserDeck(deckIds) {
  if (Array.isArray(deckIds) && deckIds.length === 3) {
    localStorage.setItem(CUSTOM_DECK_KEY, JSON.stringify(deckIds.map(String)));
    playSuccessChime();
    syncCoinsUI();
    window.dispatchEvent(new CustomEvent('deckUpdated', { detail: { deckIds } }));
    return true;
  }
  return false;
}

export function swapCardInDeck(slotIndex, newCardKey) {
  const currentDeck = getUserDeck().map(String);
  const targetKey = String(newCardKey);
  const existingIdx = currentDeck.indexOf(targetKey);

  if (existingIdx !== -1 && existingIdx !== slotIndex) {
    const temp = currentDeck[slotIndex];
    currentDeck[slotIndex] = targetKey;
    currentDeck[existingIdx] = temp;
  } else {
    currentDeck[slotIndex] = targetKey;
  }

  setUserDeck(currentDeck);
  return currentDeck;
}

/**
 * Initializes starter deck with Gardevoir (xy7-54), Pikachu (basep-1) and Charizard (base1-4)
 */
export async function ensureStarterDeckInitialized() {
  const collection = getCollection();
  const defaultStarters = ['xy7-54', 'basep-1', 'base1-4'];

  const missing = defaultStarters.filter(id => !collection[id]);
  if (missing.length > 0) {
    const cardsToAdd = missing.map(id => PREPACKAGED_TCG_CARDS[id]).filter(Boolean);
    registerCards(cardsToAdd);
  }

  if (!localStorage.getItem(CUSTOM_DECK_KEY)) {
    localStorage.setItem(CUSTOM_DECK_KEY, JSON.stringify(defaultStarters));
  }
  return getUserDeck();
}

/**
 * Render Collection Album (Álbum de Cartas Registradas con Nivel y Entrenamiento)
 */
export function renderAlbumView(containerEl) {
  const collection = getCollection();
  const cardList = Object.values(collection);
  const coins = getCoins();
  const inv = getInventory();

  const totalCards = cardList.length;
  const legendaries = cardList.filter(c => c.rarity?.id === 'legendary').length;
  const epics = cardList.filter(c => c.rarity?.id === 'epic').length;
  const rares = cardList.filter(c => c.rarity?.id === 'rare').length;
  const commons = cardList.filter(c => c.rarity?.id === 'common').length;

  containerEl.innerHTML = `
    <div class="album-container">
      <!-- Album Header Summary -->
      <div class="album-header">
        <div class="album-header-left">
          <h2>📖 Tu Álbum de Cartas Coleccionadas</h2>
          <p>Todos los Pokémon comienzan a <strong>Nivel 1</strong>. Súbelos de nivel ganando batallas o usando caramelos 🍬.</p>
        </div>
        <div class="album-stats-pills">
          <div class="stat-pill total">
            <strong>${totalCards}</strong> <span>Registradas</span>
          </div>
          <div class="stat-pill leg" title="Legendarios">
            <strong>🌟 ${legendaries}</strong> <span>Legendarios</span>
          </div>
          <div class="stat-pill epic" title="Épicos">
            <strong>🟣 ${epics}</strong> <span>Épicos</span>
          </div>
          <div class="stat-pill rare" title="Raros">
            <strong>🔵 ${rares}</strong> <span>Raros</span>
          </div>
          <div class="stat-pill com" title="Comunes">
            <strong>⚪ ${commons}</strong> <span>Comunes</span>
          </div>
        </div>
      </div>

      <!-- Barra de Mochila de Objetos -->
      <div class="album-candy-bar">
        <span class="candy-bar-title">🎒 Tu Mochila de Entrenamiento:</span>
        <div class="candy-bar-items">
          <span class="candy-tag candy-rare" title="Sube 1 nivel completo">🍬 Caramelo Raro: <strong>${inv.rare_candy || 0}</strong></span>
          <span class="candy-tag candy-exp" title="Otorga +100 EXP">🫐 Caramelo EXP: <strong>${inv.exp_candy || 0}</strong></span>
        </div>
      </div>

      ${totalCards === 0 ? `
        <div class="album-empty-state">
          <div class="empty-book-icon">🎁</div>
          <h3>Aún no has abierto sobres</h3>
          <p>¡Tienes <strong>${coins} Monedas</strong> listas! Abre tu primer sobre para conseguir tus primeras cartas.</p>
          <button class="btn-primary" id="btnGoToPacks">
            Abrir Mi Primer Sobre (100 🪙)
          </button>
        </div>
      ` : `
        <div class="album-cards-grid">
          ${cardList.sort((a, b) => {
            const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
            return (rarityOrder[a.rarity?.id] ?? 4) - (rarityOrder[b.rarity?.id] ?? 4);
          }).map(card => {
            const r = card.rarity || { name: 'Común', badge: '⚪ COMÚN', color: '#94a3b8' };
            const cardLvl = card.level || 1;
            const expNext = getExpForNextLevel(cardLvl);
            const expCur = card.exp || 0;
            const expPercent = Math.min(100, Math.round((expCur / expNext) * 100));

            return `
              <div class="album-card rarity-${r.id}" style="--album-rarity-color: ${r.color};" data-card-key="${card.key || card.id}" data-id="${card.id}">
                <div class="album-card-foil-sheen"></div>
                <div class="album-card-top">
                  <span class="album-rarity-tag">${r.badge}</span>
                  <span class="album-level-tag">Nv. ${cardLvl}</span>
                </div>
                <div class="album-card-artwork">
                  <img 
                    src="${getCardDisplayImage(card)}" 
                    alt="${card.name}" 
                    loading="lazy" 
                    onerror="this.onerror=null; this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${card.id}.png';"
                  />
                </div>
                <div class="album-card-meta">
                  <strong class="album-card-name">${card.name}</strong>
                  <span class="album-card-type">${card.primaryType}</span>
                </div>
                
                <!-- Barra de EXP -->
                <div class="album-card-exp-wrap">
                  <div class="exp-bar-line">
                    <div class="exp-bar-fill" style="width: ${expPercent}%;"></div>
                  </div>
                  <small class="exp-bar-txt">${expCur} / ${expNext} EXP</small>
                </div>

                <!-- Botones de uso rápido de Caramelos -->
                <div class="album-card-candy-actions">
                  <button class="btn-feed-candy btn-feed-rare" data-key="${card.key || card.id}" data-item="rare_candy" title="Dar Caramelo Raro (+1 Nivel)" ${inv.rare_candy <= 0 ? 'disabled' : ''}>
                    🍬 +1 Nv
                  </button>
                  <button class="btn-feed-candy btn-feed-exp" data-key="${card.key || card.id}" data-item="exp_candy" title="Dar Caramelo EXP (+100 EXP)" ${inv.exp_candy <= 0 ? 'disabled' : ''}>
                    🫐 +100 EXP
                  </button>
                </div>

                <div class="album-card-footer">
                  <small>Copias: ×${card.copies || 1}</small>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;

  // Listeners para usar caramelos desde el álbum
  containerEl.querySelectorAll('.btn-feed-candy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.key;
      const item = btn.dataset.item;
      const res = useItemOnCard(key, item);
      if (res.success) {
        renderAlbumView(containerEl);
      }
    });
  });

  containerEl.querySelector('#btnGoToPacks')?.addEventListener('click', () => {
    document.getElementById('btnSubtabPacks')?.click();
  });

  if (!containerEl._hasArtModeListener) {
    containerEl._hasArtModeListener = true;
    window.addEventListener('cardArtModeChanged', () => {
      if (document.body.contains(containerEl)) {
        renderAlbumView(containerEl);
      }
    });
  }
}
