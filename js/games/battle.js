/**
 * MODULE: Pokémon Battle Stadium (js/games/battle.js)
 * Fullscreen Atmospheric Pokémon Stadium Battle Experience:
 * - Panoramic, photorealistic stadium background with floodlights & cheering crowd
 * - Official Showdown animated GIF sprites (back view for player, front view for rival)
 * - Deluxe elemental attack cards with custom gradients, type badges, potency and multiplier pills
 * - 4 tactile modern command cards ([LUCHAR], [CAMBIAR], [ESCUDO], [HUIR])
 * - Persistent in-place DOM updates (rock-solid, zero flickering, no stuck turns)
 * - 100% official PokeAPI compliant
 */

import { 
  fetchPokemonDetail,
  fetchAdaptiveBotDeck,
  getTypeEffectiveness, 
  TYPE_TRANSLATIONS, 
  getPokemonRarity, 
  getPokemonLevel,
  WEAK_STARTER_IDS
} from '../api.js';
import { PREPACKAGED_TCG_CARDS, normalizeTcgCard, getPokedexNumberByName } from '../tcg-api.js';
import { 
  playPokemonCry, 
  playCardClashSound, 
  playCardFlipSound, 
  playVictoryFanfare, 
  playSuccessChime,
  playCoinSound,
  playLevelUpSound
} from '../audio.js';
import { 
  getUserDeck, 
  getCollection,
  addCoins, 
  syncCoinsUI, 
  ensureStarterDeckInitialized,
  ITEM_DEFINITIONS,
  addInventoryItem,
  getInventory,
  useItemOnCard,
  addExpToCard,
  getExpForNextLevel
} from '../collection.js';

const TYPE_ICONS = {
  fire: '🔥',
  water: '💧',
  grass: '🌿',
  electric: '⚡',
  ice: '❄️',
  fighting: '🥊',
  poison: '🧪',
  ground: '🏜️',
  flying: '🦅',
  psychic: '🔮',
  bug: '🐛',
  rock: '🪨',
  ghost: '👻',
  dragon: '🐉',
  dark: '🌑',
  steel: '⚙️',
  fairy: '✨',
  normal: '💥'
};

const ELEMENTAL_MOVES = {
  fire: { name: 'Llamarada', cat: 'Especial ✨' },
  water: { name: 'Hidrobomba', cat: 'Especial ✨' },
  grass: { name: 'Rayo Solar', cat: 'Especial ✨' },
  electric: { name: 'Impactrueno', cat: 'Especial ✨' },
  ice: { name: 'Rayo Hielo', cat: 'Especial ✨' },
  fighting: { name: 'A Bocajarro', cat: 'Físico 💥' },
  poison: { name: 'Bomba Lodo', cat: 'Especial ✨' },
  ground: { name: 'Terremoto', cat: 'Físico 💥' },
  flying: { name: 'Pájaro Osado', cat: 'Físico 💥' },
  psychic: { name: 'Psíquico', cat: 'Especial ✨' },
  bug: { name: 'Tijera X', cat: 'Físico 💥' },
  rock: { name: 'Avalancha', cat: 'Físico 💥' },
  ghost: { name: 'Bola Sombra', cat: 'Especial ✨' },
  dragon: { name: 'Pulso Dragón', cat: 'Especial ✨' },
  dark: { name: 'Pulso Umbrío', cat: 'Especial ✨' },
  steel: { name: 'Foco Resplandor', cat: 'Especial ✨' },
  fairy: { name: 'Fuerza Lunar', cat: 'Especial ✨' },
  normal: { name: 'Hiperrayo', cat: 'Especial ✨' }
};

export const ANIME_NATURE_LANDSCAPES = [
  { id: 'forest', name: 'Bosque y Cascada', icon: '🌲', className: 'bg-nature-forest', image: 'assets/battle_bg_forest.jpg' },
  { id: 'meadow', name: 'Pradera Alpina', icon: '🏔️', className: 'bg-nature-meadow', image: 'assets/battle_bg_meadow.jpg' },
  { id: 'coast', name: 'Costa Tropical', icon: '🏖️', className: 'bg-nature-coast', image: 'assets/battle_bg_coast.jpg' },
  { id: 'autumn', name: 'Arboleda Otoñal', icon: '🍁', className: 'bg-nature-autumn', image: 'assets/battle_bg_autumn.jpg' }
];

export class PokemonBattleGame {
  constructor(containerEl) {
    this.container = containerEl;
    this.playerTeam = [];
    this.botTeam = [];
    this.playerActiveIndex = 0;
    this.botActiveIndex = 0;
    this.turn = 'player'; // 'player' | 'bot'
    this.isBusy = false;
    this.playerShield = false;
    this.botShield = false;
    this.menuMode = 'moves'; // 'moves' | 'switch'
    this.currentLandscapeIndex = Math.floor(Math.random() * ANIME_NATURE_LANDSCAPES.length);
    const initialLandscape = ANIME_NATURE_LANDSCAPES[this.currentLandscapeIndex];
    this.battleLogMessage = `¡Combate iniciado en el paisaje: ${initialLandscape.name}!`;
    this.battleLogIcon = initialLandscape.icon;
  }

  async init() {
    this.renderLoading();
    await this.startNewMatch();
  }

  renderLoading() {
    this.container.innerHTML = `
      <div class="modern-battle-loading">
        <div class="pokeball-loading-core">
          <div class="pkb-top"></div>
          <div class="pkb-band">
            <div class="pkb-btn"></div>
          </div>
          <div class="pkb-bottom"></div>
        </div>
        <h3>Preparando el Estadio Pokémon...</h3>
        <p>Cargando ambientación, sprites animados y adaptando contrincante</p>
      </div>
    `;
  }

  async startNewMatch() {
    this.playerActiveIndex = 0;
    this.botActiveIndex = 0;
    this.turn = 'player';
    this.isBusy = false;
    this.playerShield = false;
    this.botShield = false;
    this.menuMode = 'moves';

    try {
      await ensureStarterDeckInitialized();
      const deckKeys = getUserDeck();
      const collection = getCollection();

      // Cargar las 3 cartas TCG del jugador
      const rawPlayerCards = [];
      for (const key of deckKeys) {
        const strKey = String(key);
        const card = collection[strKey] || PREPACKAGED_TCG_CARDS[strKey] || PREPACKAGED_TCG_CARDS['xy7-54'];
        rawPlayerCards.push(normalizeTcgCard(card));
      }

      this.playerTeam = rawPlayerCards.slice(0, 3).map((c, i) => this.formatBattleCard(c, `player-${i}`));

      // Rival adaptativo con cartas TCG oficiales legendarias y poderosas
      const botPool = ['base1-4', 'base1-2', 'base1-10', 'xy7-75', 'sm9-33', 'swsh9-123'].filter(id => !deckKeys.includes(id));
      const shuffled = [...botPool].sort(() => Math.random() - 0.5);
      const chosenBotIds = shuffled.slice(0, 3);
      while (chosenBotIds.length < 3) chosenBotIds.push('base1-4');

      this.botTeam = chosenBotIds.map((id, i) => {
        const botCard = normalizeTcgCard(PREPACKAGED_TCG_CARDS[id] || PREPACKAGED_TCG_CARDS['base1-4']);
        return this.formatBattleCard(botCard, `bot-${i}`);
      });

      const activePlayer = this.getPlayerActive();
      this.battleLogMessage = `¡Comienza el combate con cartas oficiales TCG! ¿Qué debería hacer ${activePlayer.name.toUpperCase()}?`;
      this.battleLogIcon = '⚔️';

      this.buildArenaDOM();
      this.updateAll();

      if (activePlayer.pokeNum) {
        setTimeout(() => playPokemonCry(activePlayer.pokeNum), 350);
      }
    } catch (err) {
      console.error('Error starting match:', err);
      this.container.innerHTML = `
        <div class="modern-battle-loading">
          <p>⚠️ No se pudo conectar con PokeAPI. Verifica tu conexión.</p>
          <button class="btn-primary" id="btnRetryCombat">Reintentar</button>
        </div>
      `;
      this.container.querySelector('#btnRetryCombat')?.addEventListener('click', () => this.init());
    }
  }

  formatBattleCard(card, teamId) {
    const pokeNum = card.nationalPokedexNumbers?.[0] || getPokedexNumberByName(card.name) || 282;
    const isShiny = Boolean(card.isShiny);
    const pType = (card.primaryType || card.types?.[0] || 'colorless').toLowerCase();
    const typeTrans = TYPE_TRANSLATIONS[pType] || { es: pType, color: '#38bdf8' };
    const typeIcon = TYPE_ICONS[pType] || '⚪';

    const maxHp = card.hp ? parseInt(card.hp, 10) : 100;
    const showdownFront = isShiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${pokeNum}.gif`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${pokeNum}.gif`;

    const showdownBack = isShiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/shiny/${pokeNum}.gif`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/${pokeNum}.gif`;

    const fallbackArtwork = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeNum}.png`;
    const artwork = card.images?.large || card.images?.small || fallbackArtwork;

    // Ataques oficiales de la carta Pokémon TCG
    const cardAttacks = Array.isArray(card.attacks) && card.attacks.length > 0 ? card.attacks : [
      { name: 'Ataque TCG', power: 30, text: 'Ataque oficial.' }
    ];

    const moves = cardAttacks.map((atk, idx) => ({
      id: `tcg_move_${idx}`,
      name: atk.name,
      category: (atk.convertedEnergyCost || 1) > 2 ? 'Especial ✨' : 'Físico 💥',
      icon: typeIcon,
      type: pType,
      typeColor: typeTrans.color,
      typeName: typeTrans.es,
      power: atk.power || parseInt(atk.damage, 10) || 40,
      description: atk.text || 'Ataque oficial Pokémon TCG.'
    }));

    if (moves.length === 1) {
      moves.push({
        id: 'tcg_slam',
        name: 'Golpe TCG',
        category: 'Físico 💥',
        icon: '⚔️',
        type: 'normal',
        typeColor: '#94a3b8',
        typeName: 'Normal',
        power: 25,
        description: 'Ataque rápido directo'
      });
    }

    moves.push({
      id: 'defend',
      name: 'Barrera Protectora',
      category: 'Estado 🛡️',
      icon: '🛡️',
      type: 'normal',
      typeColor: '#38bdf8',
      typeName: 'Defensa',
      power: 0,
      description: 'Mitiga el 50% del daño del próximo turno'
    });

    return {
      id: card.id,
      pokeNum,
      key: card.id,
      card,
      teamId,
      name: card.name,
      isShiny,
      primaryType: pType,
      typeInfo: typeTrans,
      typeIcon,
      rarity: card.rarity || 'Rare',
      level: card.level || 1,
      showdownFront,
      showdownBack,
      artwork,
      maxHp,
      currentHp: maxHp,
      atk: Math.round(maxHp * 0.8),
      def: Math.round(maxHp * 0.7),
      spAtk: Math.round(maxHp * 0.85),
      spd: 70,
      isFainted: false,
      moves
    };
  }

  getPlayerActive() {
    return this.playerTeam[this.playerActiveIndex];
  }

  getBotActive() {
    return this.botTeam[this.botActiveIndex];
  }

  /**
   * Fullscreen stadium DOM with authentic anime nature landscapes (4 variations)
   */
  buildArenaDOM() {
    const currentLandscape = ANIME_NATURE_LANDSCAPES[this.currentLandscapeIndex];

    this.container.innerHTML = `
      <div class="fullscreen-pkmn-stadium ${currentLandscape.className}" id="pkmnStadiumArena">
        <!-- Selector flotante de paisaje natural anime (4 fondos oficiales) -->
        <button type="button" class="nature-landscape-pill" id="btnToggleNatureLandscape" title="Toca para cambiar entre los 4 paisajes de naturaleza anime">
          <span id="natureLandscapeIcon">${currentLandscape.icon}</span>
          <span id="natureLandscapeName">${currentLandscape.name}</span>
          <span style="font-size: 0.72rem; opacity: 0.85;">(Cambiar)</span>
        </button>

        <div class="stadium-fog-layer"></div>

        <!-- Stable Battle Arena Field (Zero-tilt, crystal-clear anime view) -->
        <div class="battle-main-field" id="battleMainField">
          <div class="camera-impact-flash" id="cameraImpactFlash"></div>

          <!-- 1. OPPONENT ZONE (Top Stage) -->
          <div class="stadium-stage-top">
            <!-- Opponent HUD (Crystal Clear Anime Glass Card) -->
            <div class="anime-battle-hud bot-battle-hud" id="botHud">
              <div class="hud-accent-bar" id="botAccentBar"></div>
              
              <div class="hud-header-line">
                <div class="hud-pkmn-identity">
                  <span class="hud-pokedex-no" id="botPokedexNo">#000</span>
                  <h3 class="hud-pkmn-title" id="botNameText">RIVAL</h3>
                  <span class="hud-shiny-star" id="botShinyStar" style="display:none;">✨</span>
                </div>
                <div class="hud-tag-pills">
                  <span class="hud-level-badge" id="botLevelText">Nv. 50</span>
                  <span class="hud-type-badge" id="botTypePill">TIPO</span>
                </div>
              </div>

              <!-- Health Bar Section with High Visibility -->
              <div class="hud-hp-section">
                <div class="hud-hp-meta">
                  <span class="hud-hp-label-badge">PS</span>
                  <span class="hud-hp-numeric-text" id="botHpNumeric">-- / -- PS</span>
                </div>
                <div class="hud-hp-track">
                  <div class="hud-hp-fill hp-fill" id="botHpFill" style="width: 100%;"></div>
                </div>
              </div>

              <!-- Footer with Team status and active tag -->
              <div class="hud-footer-line">
                <div class="hud-team-balls" id="botBallsRow">
                  <span class="hud-ball active">●</span>
                  <span class="hud-ball active">●</span>
                  <span class="hud-ball active">●</span>
                </div>
                <span class="hud-role-pill bot-role-pill" id="botStatusTag">RIVAL ACTIVO</span>
              </div>
            </div>

            <!-- Opponent Podium & Showdown Animated Sprite (Top-Right) -->
            <div class="battle-podium-spot opponent-spot">
              <div class="stadium-podium bot-podium">
                <div class="podium-laser-ring"></div>
              </div>
              <div class="actor-sprite-wrapper bot-actor-wrapper" id="botActorWrap">
                <div class="energy-shield-dome" id="botShieldDome" style="display:none;"></div>
                <img 
                  id="botSpriteImg" 
                  class="deluxe-combat-sprite bot-combat-sprite" 
                  src="" 
                  alt="Opponent Pokémon" 
                />
                <div class="damage-float-popup" id="botDamagePopup"></div>
              </div>
            </div>
          </div>

          <!-- 2. PLAYER ZONE (Bottom Stage) -->
          <div class="stadium-stage-bottom">
            <!-- Player Podium & Showdown Animated Sprite (Back View Bottom-Left) -->
            <div class="battle-podium-spot player-spot">
              <div class="stadium-podium player-podium">
                <div class="podium-laser-ring"></div>
              </div>
              <div class="actor-sprite-wrapper player-actor-wrapper" id="playerActorWrap">
                <div class="energy-shield-dome" id="playerShieldDome" style="display:none;"></div>
                <img 
                  id="playerSpriteImg" 
                  class="deluxe-combat-sprite player-combat-sprite" 
                  src="" 
                  alt="Player Pokémon" 
                />
                <div class="damage-float-popup" id="playerDamagePopup"></div>
              </div>
            </div>

            <!-- Player HUD (Crystal Clear Anime Glass Card) -->
            <div class="anime-battle-hud player-battle-hud" id="playerHud">
              <div class="hud-accent-bar" id="playerAccentBar"></div>

              <div class="hud-header-line">
                <div class="hud-pkmn-identity">
                  <span class="hud-pokedex-no" id="playerPokedexNo">#000</span>
                  <h3 class="hud-pkmn-title" id="playerNameText">MI POKÉMON</h3>
                  <span class="hud-shiny-star" id="playerShinyStar" style="display:none;">✨</span>
                </div>
                <div class="hud-tag-pills">
                  <span class="hud-level-badge" id="playerLevelText">Nv. 50</span>
                  <span class="hud-type-badge" id="playerTypePill">TIPO</span>
                </div>
              </div>

              <!-- Health Bar Section with High Visibility -->
              <div class="hud-hp-section">
                <div class="hud-hp-meta">
                  <span class="hud-hp-label-badge">PS</span>
                  <span class="hud-hp-numeric-text" id="playerHpNumeric"><strong>--</strong> / -- PS</span>
                </div>
                <div class="hud-hp-track">
                  <div class="hud-hp-fill hp-fill" id="playerHpFill" style="width: 100%;"></div>
                </div>
              </div>

              <!-- Footer with Team status and active tag -->
              <div class="hud-footer-line">
                <div class="hud-team-balls" id="playerBallsRow">
                  <span class="hud-ball active">●</span>
                  <span class="hud-ball active">●</span>
                  <span class="hud-ball active">●</span>
                </div>
                <span class="hud-role-pill player-role-pill" id="playerStatusTag">TU TURNO</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. DELUXE FLOATING COMMAND CONSOLE (Bottom Edge) -->
        <div class="deluxe-command-console" id="deluxeCommandConsole">
          <!-- Live Battle Event Log Banner -->
          <div class="console-event-ticker" id="consoleEventTicker">
            <span class="ticker-icon" id="consoleEventIcon">⚔️</span>
            <span class="ticker-text" id="consoleEventText">${this.battleLogMessage}</span>
          </div>

          <!-- Interactive Action Area (Main / Moves / Switch) -->
          <div class="console-interactive-area" id="consoleInteractiveArea">
            <!-- Dynamically populated -->
          </div>
        </div>
      </div>
    `;

    const btnToggleNature = this.container.querySelector('#btnToggleNatureLandscape');
    if (btnToggleNature) {
      btnToggleNature.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cycleNatureLandscape();
      });
    }

    this.renderConsoleButtons();
  }

  cycleNatureLandscape() {
    const arena = this.container.querySelector('#pkmnStadiumArena');
    const iconEl = this.container.querySelector('#natureLandscapeIcon');
    const nameEl = this.container.querySelector('#natureLandscapeName');

    // Quitar clases previas
    ANIME_NATURE_LANDSCAPES.forEach(l => arena?.classList.remove(l.className));

    // Siguiente paisaje de los 4 disponibles
    this.currentLandscapeIndex = (this.currentLandscapeIndex + 1) % ANIME_NATURE_LANDSCAPES.length;
    const nextLandscape = ANIME_NATURE_LANDSCAPES[this.currentLandscapeIndex];

    if (arena) arena.classList.add(nextLandscape.className);
    if (iconEl) iconEl.textContent = nextLandscape.icon;
    if (nameEl) nameEl.textContent = nextLandscape.name;

    this.setBattleLog(`Paisaje cambiado a: ${nextLandscape.name}`, nextLandscape.icon);
  }

  updateAll() {
    this.updateHUDs();
    this.updateSprites();
    this.renderConsoleButtons();
  }

  updateHUDs() {
    const player = this.getPlayerActive();
    const bot = this.getBotActive();

    // 1. Bot HUD
    const botHud = this.container.querySelector('#botHud');
    const botName = this.container.querySelector('#botNameText');
    const botLevel = this.container.querySelector('#botLevelText');
    const botType = this.container.querySelector('#botTypePill');
    const botShiny = this.container.querySelector('#botShinyStar');
    const botFill = this.container.querySelector('#botHpFill');
    const botBalls = this.container.querySelector('#botBallsRow');
    const botNum = this.container.querySelector('#botPokedexNo');
    const botHpNumeric = this.container.querySelector('#botHpNumeric');
    const botAccent = this.container.querySelector('#botAccentBar');

    if (botNum) botNum.textContent = `#${String(bot.pokeNum || 1).padStart(3, '0')}`;
    if (botName) botName.textContent = bot.name.toUpperCase();
    if (botLevel) botLevel.textContent = `Nv. ${bot.level}`;
    if (botType) {
      botType.textContent = bot.typeInfo.es;
      botType.style.backgroundColor = bot.typeInfo.color;
    }
    if (botShiny) botShiny.style.display = bot.isShiny ? 'inline-block' : 'none';
    if (botAccent) botAccent.style.backgroundColor = bot.typeInfo.color;

    const botPct = Math.max(0, Math.round((bot.currentHp / bot.maxHp) * 100));
    if (botFill) {
      botFill.style.width = `${botPct}%`;
      botFill.className = `hud-hp-fill hp-fill ${botPct <= 20 ? 'hp-danger' : botPct <= 50 ? 'hp-warning' : 'hp-healthy'}`;
    }

    if (botHpNumeric) {
      botHpNumeric.innerHTML = `<strong>${bot.currentHp}</strong> / ${bot.maxHp} PS`;
    }

    if (botBalls) {
      botBalls.innerHTML = this.botTeam.map(p => `
        <span class="hud-ball ${p.isFainted ? 'fainted' : 'active'}" title="${p.name}">●</span>
      `).join('');
    }

    // 2. Player HUD
    const playerHud = this.container.querySelector('#playerHud');
    const playerName = this.container.querySelector('#playerNameText');
    const playerLevel = this.container.querySelector('#playerLevelText');
    const playerType = this.container.querySelector('#playerTypePill');
    const playerShiny = this.container.querySelector('#playerShinyStar');
    const playerFill = this.container.querySelector('#playerHpFill');
    const playerNumeric = this.container.querySelector('#playerHpNumeric');
    const playerBalls = this.container.querySelector('#playerBallsRow');
    const playerNum = this.container.querySelector('#playerPokedexNo');
    const playerAccent = this.container.querySelector('#playerAccentBar');

    if (playerNum) playerNum.textContent = `#${String(player.pokeNum || 1).padStart(3, '0')}`;
    if (playerName) playerName.textContent = player.name.toUpperCase();
    if (playerLevel) playerLevel.textContent = `Nv. ${player.level}`;
    if (playerType) {
      playerType.textContent = player.typeInfo.es;
      playerType.style.backgroundColor = player.typeInfo.color;
    }
    if (playerShiny) playerShiny.style.display = player.isShiny ? 'inline-block' : 'none';
    if (playerAccent) playerAccent.style.backgroundColor = player.typeInfo.color;

    const playerPct = Math.max(0, Math.round((player.currentHp / player.maxHp) * 100));
    if (playerFill) {
      playerFill.style.width = `${playerPct}%`;
      playerFill.className = `hud-hp-fill hp-fill ${playerPct <= 20 ? 'hp-danger' : playerPct <= 50 ? 'hp-warning' : 'hp-healthy'}`;
    }

    if (playerNumeric) {
      playerNumeric.innerHTML = `<strong>${player.currentHp}</strong> / ${player.maxHp} PS`;
    }

    if (playerBalls) {
      playerBalls.innerHTML = this.playerTeam.map(p => `
        <span class="hud-ball ${p.isFainted ? 'fainted' : 'active'}" title="${p.name}">●</span>
      `).join('');
    }

    // Shields
    const botShieldEl = this.container.querySelector('#botShieldDome');
    if (botShieldEl) botShieldEl.style.display = this.botShield ? 'block' : 'none';

    const playerShieldEl = this.container.querySelector('#playerShieldDome');
    if (playerShieldEl) playerShieldEl.style.display = this.playerShield ? 'block' : 'none';
  }

  updateSprites() {
    const player = this.getPlayerActive();
    const bot = this.getBotActive();

    // Player Sprite (Back Showdown animated GIF)
    const playerImg = this.container.querySelector('#playerSpriteImg');
    if (playerImg) {
      const targetSrc = player.showdownBack || player.artwork;
      if (playerImg.src !== targetSrc) {
        playerImg.src = targetSrc;
        playerImg.onerror = () => {
          playerImg.src = player.artwork || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${player.id}.png`;
        };
      }
      playerImg.classList.toggle('is-fainted-sprite', player.isFainted);
    }

    // Bot Sprite (Front Showdown animated GIF)
    const botImg = this.container.querySelector('#botSpriteImg');
    if (botImg) {
      const targetSrc = bot.showdownFront || bot.artwork;
      if (botImg.src !== targetSrc) {
        botImg.src = targetSrc;
        botImg.onerror = () => {
          botImg.src = bot.artwork || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${bot.id}.png`;
        };
      }
      botImg.classList.toggle('is-fainted-sprite', bot.isFainted);
    }
  }

  setBattleLog(text, icon = '💬') {
    this.battleLogMessage = text;
    this.battleLogIcon = icon;
    const txtEl = this.container.querySelector('#consoleEventText');
    const icoEl = this.container.querySelector('#consoleEventIcon');
    if (txtEl) txtEl.textContent = text;
    if (icoEl) icoEl.textContent = icon;
  }

  /**
   * Cámara de combate eliminada por petición del usuario para garantizar vista estable y legible
   */
  setCameraAngle(angle, tagLabel = '') {
    // No-op: Cámara fija y estable en todo momento
  }

  triggerImpactFlash() {
    const flash = this.container.querySelector('#cameraImpactFlash');
    if (!flash) return;
    flash.classList.add('flash-active');
    setTimeout(() => {
      flash.classList.remove('flash-active');
    }, 180);
  }

  /**
   * Renders Authentic Pokémon Battle Command Buttons & Move Grid
   */
  renderConsoleButtons() {
    const area = this.container.querySelector('#consoleInteractiveArea');
    if (!area) return;

    if (this.turn !== 'player' || this.isBusy) {
      area.innerHTML = `
        <div class="pkmn-waiting-banner">
          <span class="pkb-spin-icon">⏳</span>
          <span class="pkb-waiting-text">¡Turno del rival! El contrincante está eligiendo ataque...</span>
        </div>
      `;
      return;
    }

    const player = this.getPlayerActive();
    const bot = this.getBotActive();

    // 1. MODO CAMBIO DE POKÉMON
    if (this.menuMode === 'switch') {
      area.innerHTML = `
        <div class="pkmn-switch-stage">
          <div class="switch-stage-header">
            <span class="switch-stage-title">🔄 ELIGE A QUÉ POKÉMON CAMBIAR:</span>
            <button type="button" class="btn-pkmn-retro-back" id="btnBackToMoves">
              ← VOLVER A ATAQUES
            </button>
          </div>

          <div class="switch-pokemon-grid">
            ${this.playerTeam.map((p, idx) => {
              const isActive = idx === this.playerActiveIndex;
              return `
                <button 
                  type="button"
                  class="pkmn-switch-pill ${isActive ? 'is-active-card' : ''} ${p.isFainted ? 'is-fainted-card' : ''}" 
                  data-slot="${idx}"
                  ${isActive || p.isFainted ? 'disabled' : ''}
                >
                  <img src="${p.showdownFront || p.artwork}" alt="${p.name}" class="switch-sprite-thumb" />
                  <div class="switch-pill-info">
                    <strong class="switch-pill-name">${p.name.toUpperCase()}</strong>
                    <div class="switch-pill-hp-track">
                      <div class="switch-pill-hp-fill" style="width: ${Math.max(0, Math.round((p.currentHp / p.maxHp) * 100))}%;"></div>
                    </div>
                    <span class="switch-pill-hp-num">${p.isFainted ? '💀 DEBILITADO' : `${p.currentHp}/${p.maxHp} PS`}</span>
                  </div>
                  ${isActive ? '<span class="switch-tag-active">ACTUAL</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;

      area.querySelectorAll('.pkmn-switch-pill').forEach(b => {
        b.addEventListener('click', () => {
          const slot = parseInt(b.dataset.slot, 10);
          if (!isNaN(slot) && slot !== this.playerActiveIndex) {
            this.switchPlayerPokemon(slot);
            this.menuMode = 'moves';
          }
        });
      });

      area.querySelector('#btnBackToMoves')?.addEventListener('click', () => {
        this.menuMode = 'moves';
        this.renderConsoleButtons();
      });
      return;
    }

    // 2. MODO PRINCIPAL: ¡LOS 4 ATAQUES DIRECTAMENTE VISIBLES EN PANTALLA!
    area.innerHTML = `
      <div class="pkmn-direct-moves-wrapper">
        <div class="pkmn-moves-subbar">
          <div class="subbar-tag-wrap">
            <span class="subbar-tag">⚔️ SELECCIONA UN ATAQUE:</span>
            <span class="subbar-hint">Toca una carta para atacar</span>
          </div>
          <div class="subbar-buttons">
            <button type="button" class="btn-pkmn-subbar btn-subbar-switch" id="subbarBtnSwitch" title="Cambiar Pokémon activo">
              🔄 CAMBIAR (${this.playerTeam.filter(p => !p.isFainted).length})
            </button>
            <button type="button" class="btn-pkmn-subbar btn-subbar-shield" id="subbarBtnShield" title="Reducir daño a la mitad">
              🛡️ BARRERA
            </button>
            <button type="button" class="btn-pkmn-subbar btn-subbar-flee" id="subbarBtnRun" title="Salir de la batalla">
              🏳️ HUIR
            </button>
          </div>
        </div>

        <div class="pkmn-moves-2x2-grid anime-move-grid">
          ${player.moves.slice(0, 4).map(m => {
            let multText = '';
            let multClass = '';
            
            if (m.power > 0) {
              const mult = getTypeEffectiveness(m.type, bot.primaryType);
              if (mult >= 2.0) {
                multText = 'x2 ¡SÚPER!';
                multClass = 'eff-super';
              } else if (mult <= 0.5 && mult > 0) {
                multText = 'x0.5 Débil';
                multClass = 'eff-weak';
              } else if (mult === 0) {
                multText = 'x0 Inmune';
                multClass = 'eff-zero';
              }
            }

            return `
              <button 
                type="button"
                class="anime-move-card pkmn-attack-card move-type-${m.type}" 
                data-move-id="${m.id}"
                style="--move-type-color: ${m.typeColor};"
              >
                <div class="move-top-header">
                  <span class="move-type-pill" style="background: ${m.typeColor};">
                    ${m.icon} ${m.typeName.toUpperCase()}
                  </span>
                  <div class="move-badges-cluster">
                    <span class="move-cat-badge">${m.category}</span>
                    <span class="move-power-badge">${m.power > 0 ? `POT. ${m.power}` : 'DEFENSA'}</span>
                  </div>
                </div>

                <div class="move-body-title">
                  <strong class="move-title-text">${m.name.toUpperCase()}</strong>
                  ${multText ? `<span class="move-multiplier-pill ${multClass}">${multText}</span>` : ''}
                </div>

                <div class="move-footer-desc">
                  <span>${m.description || 'Ataque Pokémon TCG'}</span>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Eventos de los 4 botones de ataque
    area.querySelectorAll('.pkmn-attack-card, .anime-move-card').forEach(b => {
      b.addEventListener('click', () => {
        this.executePlayerMove(b.dataset.moveId);
      });
    });

    // Evento cambiar Pokémon
    area.querySelector('#subbarBtnSwitch')?.addEventListener('click', () => {
      this.menuMode = 'switch';
      this.renderConsoleButtons();
    });

    // Evento Escudo
    area.querySelector('#subbarBtnShield')?.addEventListener('click', () => {
      this.executePlayerMove('defend');
    });

    // Evento Huir
    area.querySelector('#subbarBtnRun')?.addEventListener('click', () => {
      if (confirm('¿Deseas retirarte del combate y volver a la selección de modos?')) {
        document.getElementById('tabLanding')?.click();
      }
    });
  }

  async executePlayerMove(moveId) {
    if (this.isBusy || this.turn !== 'player') return;
    this.isBusy = true;
    this.menuMode = 'moves';
    this.renderConsoleButtons();

    const player = this.getPlayerActive();
    const bot = this.getBotActive();
    const move = player.moves.find(m => m.id === moveId);

    if (!move) {
      this.isBusy = false;
      return;
    }

    if (moveId === 'defend') {
      this.playerShield = true;
      playSuccessChime();
      this.setBattleLog(`¡${player.name.toUpperCase()} desplegó Escudo Protector! Reducirá el daño a la mitad.`, '🛡️');
      this.updateHUDs();
      await this.pause(800);
      this.endPlayerTurn();
      return;
    }

    // Attacking with dynamic camera angles
    const playerWrap = this.container.querySelector('#playerActorWrap');
    const botWrap = this.container.querySelector('#botActorWrap');

    // 1. Zoom and low-angle focus on Player's attacking Pokémon
    this.setCameraAngle('player-attack', `⚔️ ${player.name.toUpperCase()} ATACA`);
    if (playerWrap) playerWrap.classList.add('action-lunge-forward');
    playCardClashSound();
    playPokemonCry(player.id);

    let damage = move.power;
    let multiplier = 1.0;

    if (move.id === 'elemental' || move.id === 'secondary') {
      multiplier = getTypeEffectiveness(move.type, bot.primaryType);
      damage = Math.round(damage * multiplier);
    }

    damage = Math.max(12, Math.round(damage - (bot.def * 0.25)));

    if (this.botShield) {
      damage = Math.round(damage * 0.5);
      this.botShield = false;
    }

    await this.pause(400);

    // 2. Camera cuts/pans hard onto Opponent taking the hit with impact flash
    if (multiplier >= 2.0) {
      this.setCameraAngle('crit-impact', '🔥 ¡GOLPE SÚPER EFICAZ!');
    } else {
      this.setCameraAngle('bot-impact', '💥 IMPACTO');
    }
    this.triggerImpactFlash();

    if (playerWrap) playerWrap.classList.remove('action-lunge-forward');
    if (botWrap) {
      botWrap.classList.add('action-hit-shake');
      this.showDamageFloat('bot', damage, multiplier);
    }

    bot.currentHp = Math.max(0, bot.currentHp - damage);
    this.updateHUDs();

    let logMsg = `¡${player.name.toUpperCase()} usó ${move.name.toUpperCase()}! (-${damage} PS)`;
    if (multiplier >= 2.0) logMsg += ' ¡Es súper eficaz!';
    else if (multiplier <= 0.5 && multiplier > 0) logMsg += ' No es muy eficaz...';
    this.setBattleLog(logMsg, '💥');

    await this.pause(750);
    if (botWrap) botWrap.classList.remove('action-hit-shake');

    if (bot.currentHp <= 0) {
      this.setCameraAngle('bot-fainted', '💀 ENEMIGO DEBILITADO');
      bot.isFainted = true;
      this.setBattleLog(`¡El ${bot.name.toUpperCase()} enemigo se ha debilitado!`, '💀');
      playPokemonCry(bot.id);
      this.updateAll();
      await this.pause(850);

      const allBotFainted = this.botTeam.every(p => p.isFainted);
      if (allBotFainted) {
        this.isBusy = false;
        this.renderGameOver(true);
        return;
      }

      const nextIndex = this.botTeam.findIndex(p => !p.isFainted);
      if (nextIndex !== -1) {
        this.botActiveIndex = nextIndex;
        const newBot = this.getBotActive();
        this.setCameraAngle('switch-sweep', `⚡ ENTRA ${newBot.name.toUpperCase()}`);
        this.setBattleLog(`¡El rival envía a ${newBot.name.toUpperCase()}!`, '⚡');
        playPokemonCry(newBot.id);
        this.updateAll();
        await this.pause(850);
      }
    }

    this.setCameraAngle('neutral');
    this.endPlayerTurn();
  }

  async switchPlayerPokemon(newIndex) {
    if (this.isBusy) return;
    this.isBusy = true;
    this.playerActiveIndex = newIndex;
    const newActive = this.getPlayerActive();

    this.setCameraAngle('switch-sweep', `🔄 ENTRA ${newActive.name.toUpperCase()}`);
    playCardFlipSound();
    playPokemonCry(newActive.id);
    this.setBattleLog(`¡Regresa! ¡Adelante, ${newActive.name.toUpperCase()}!`, '🔄');
    this.playerShield = false;

    this.updateAll();
    await this.pause(900);
    this.setCameraAngle('neutral');
    this.endPlayerTurn();
  }

  endPlayerTurn() {
    this.isBusy = false;
    this.turn = 'bot';
    this.menuMode = 'main';
    this.renderConsoleButtons();

    setTimeout(() => {
      this.executeBotTurn();
    }, 1100);
  }

  async executeBotTurn() {
    if (this.botTeam.every(p => p.isFainted) || this.playerTeam.every(p => p.isFainted)) {
      return;
    }

    this.isBusy = true;
    this.renderConsoleButtons();
    const bot = this.getBotActive();
    const player = this.getPlayerActive();

    const mult = getTypeEffectiveness(bot.primaryType, player.primaryType);
    let chosenMove = bot.moves[0];

    if (mult >= 1.5) {
      chosenMove = bot.moves[1];
    } else if (bot.currentHp < bot.maxHp * 0.35 && !this.botShield && Math.random() < 0.35) {
      chosenMove = bot.moves[3] || bot.moves[0];
    } else {
      chosenMove = Math.random() < 0.5 ? bot.moves[0] : bot.moves[1];
    }

    if (chosenMove.id === 'defend') {
      this.botShield = true;
      playSuccessChime();
      this.setBattleLog(`¡El ${bot.name.toUpperCase()} enemigo activó Escudo Protector!`, '🛡️');
      this.updateHUDs();
      await this.pause(800);
      this.endBotTurn();
      return;
    }

    const botWrap = this.container.querySelector('#botActorWrap');
    const playerWrap = this.container.querySelector('#playerActorWrap');

    // 1. High angle dramatic zoom on Bot initiating attack
    this.setCameraAngle('bot-attack', `⚡ ${bot.name.toUpperCase()} ATACA`);
    if (botWrap) botWrap.classList.add('action-lunge-down');
    playCardClashSound();
    playPokemonCry(bot.id);

    let damage = chosenMove.power;
    let multiplier = 1.0;

    if (chosenMove.id === 'elemental' || chosenMove.id === 'secondary') {
      multiplier = mult;
      damage = Math.round(damage * multiplier);
    }

    damage = Math.max(10, Math.round(damage - (player.def * 0.25)));

    if (this.playerShield) {
      damage = Math.round(damage * 0.5);
      this.playerShield = false;
    }

    await this.pause(450);

    // 2. Camera cuts hard to Player receiving hit with impact flash
    if (multiplier >= 2.0) {
      this.setCameraAngle('crit-player-impact', '⚠️ ¡IMPACTO CRÍTICO CONTRA TI!');
    } else {
      this.setCameraAngle('player-impact', '💥 DAÑO RECIBIDO');
    }
    this.triggerImpactFlash();

    if (botWrap) botWrap.classList.remove('action-lunge-down');
    if (playerWrap) {
      playerWrap.classList.add('action-hit-shake');
      this.showDamageFloat('player', damage, multiplier);
    }

    player.currentHp = Math.max(0, player.currentHp - damage);
    this.updateHUDs();

    let resultMsg = `¡El ${bot.name.toUpperCase()} enemigo usó ${chosenMove.name.toUpperCase()}! (-${damage} PS)`;
    if (multiplier >= 2.0) resultMsg += ' ¡Es súper eficaz contra ti!';
    this.setBattleLog(resultMsg, '💥');

    await this.pause(750);
    if (playerWrap) playerWrap.classList.remove('action-hit-shake');

    if (player.currentHp <= 0) {
      this.setCameraAngle('player-fainted', '💀 TU POKÉMON SE DEBILITÓ');
      player.isFainted = true;
      this.setBattleLog(`¡Tu ${player.name.toUpperCase()} se debilitó!`, '💀');
      playPokemonCry(player.id);
      this.updateAll();
      await this.pause(850);

      const allPlayerFainted = this.playerTeam.every(p => p.isFainted);
      if (allPlayerFainted) {
        this.isBusy = false;
        this.renderGameOver(false);
        return;
      }

      const nextIndex = this.playerTeam.findIndex(p => !p.isFainted);
      if (nextIndex !== -1) {
        this.playerActiveIndex = nextIndex;
        const newPlayer = this.getPlayerActive();
        this.setCameraAngle('switch-sweep', `⚡ ADELANTE ${newPlayer.name.toUpperCase()}`);
        this.setBattleLog(`¡Adelante, ${newPlayer.name.toUpperCase()}!`, '⚡');
        playPokemonCry(newPlayer.id);
        this.updateAll();
        await this.pause(850);
      }
    }

    this.setCameraAngle('neutral');
    this.endBotTurn();
  }

  endBotTurn() {
    this.isBusy = false;
    this.turn = 'player';
    this.menuMode = 'moves';
    const player = this.getPlayerActive();
    this.setBattleLog(`¿Qué debería hacer ${player.name.toUpperCase()}?`, '⚔️');
    this.renderConsoleButtons();
  }

  showDamageFloat(role, damage, multiplier) {
    const popup = this.container.querySelector(`#${role}DamagePopup`);
    if (!popup) return;

    popup.textContent = `-${damage} PS`;
    popup.className = `damage-float-popup show-damage ${multiplier >= 2.0 ? 'crit-damage' : ''}`;

    setTimeout(() => {
      popup.className = 'damage-float-popup';
    }, 850);
  }

  pause(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  renderGameOver(playerWon) {
    let rewardCoins = 0;
    const droppedItems = [];
    const expAward = playerWon ? 75 : 30;

    if (playerWon) {
      playVictoryFanfare();
      rewardCoins = 100;
      addCoins(100);

      // Drops de victoria garantizados: 1 Caramelo Raro + 1 o 2 Caramelos EXP
      addInventoryItem('rare_candy', 1);
      droppedItems.push({ ...ITEM_DEFINITIONS.rare_candy, count: 1 });

      const expCandies = Math.random() < 0.5 ? 2 : 1;
      addInventoryItem('exp_candy', expCandies);
      droppedItems.push({ ...ITEM_DEFINITIONS.exp_candy, count: expCandies });
    } else {
      rewardCoins = 25;
      addCoins(25);

      // Drop de consolación por esfuerzo: 1 Caramelo EXP
      addInventoryItem('exp_candy', 1);
      droppedItems.push({ ...ITEM_DEFINITIONS.exp_candy, count: 1 });
    }
    syncCoinsUI();

    // Otorgar experiencia de batalla a los Pokémon del equipo
    const teamExpResults = [];
    let hadLevelUp = false;

    this.playerTeam.forEach(p => {
      const cardKey = p.key || String(p.id);
      const res = addExpToCard(cardKey, expAward);
      if (res) {
        if (res.leveledUp) hadLevelUp = true;
        teamExpResults.push({
          key: cardKey,
          name: p.name,
          artwork: p.artwork,
          oldLevel: res.oldLevel,
          newLevel: res.newLevel,
          leveledUp: res.leveledUp,
          gainedExp: expAward,
          card: res.card
        });
      }
    });

    if (hadLevelUp) {
      playLevelUpSound();
    }

    const renderGameOverCard = () => {
      const inv = getInventory();
      this.container.innerHTML = `
        <div class="deluxe-gameover-backdrop">
          <div class="deluxe-gameover-card ${playerWon ? 'winner-card' : 'defeat-card'}">
            <div class="gameover-trophy-icon">${playerWon ? '🏆' : '💀'}</div>
            <h2 class="gameover-title-text">
              ${playerWon ? '¡VICTORIA EN EL ESTADIO!' : '¡DERROTA EN EL ESTADIO!'}
            </h2>
            <p class="gameover-p">
              ${playerWon 
                ? '¡Tu mazo ha triunfado! Recibes PokéCoins, experiencia para tus Pokémon y objetos de entrenamiento.' 
                : 'Tus Pokémon lucharon duro y obtuvieron experiencia de combate. ¡Súbelos de nivel con caramelos para la revancha!'}
            </p>

            <!-- 1. Botín de Recompensas y Objetos Obtenidos -->
            <div class="gameover-loot-section">
              <div class="loot-header-badge">
                <span>🎁 OBJETOS Y RECOMPENSAS GANADAS</span>
              </div>
              <div class="loot-items-grid">
                <div class="loot-item-pill loot-coins">
                  <span class="loot-icon">🪙</span>
                  <div class="loot-meta">
                    <strong class="loot-name">+${rewardCoins} PokéCoins</strong>
                    <small class="loot-sub">Monedas para sobres</small>
                  </div>
                </div>
                ${droppedItems.map(item => `
                  <div class="loot-item-pill loot-${item.id}">
                    <span class="loot-icon">${item.icon}</span>
                    <div class="loot-meta">
                      <strong class="loot-name">${item.name} ×${item.count}</strong>
                      <small class="loot-sub">${item.desc}</small>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- 2. Progreso de Experiencia y Subida de Nivel del Equipo -->
            <div class="gameover-team-progress-section">
              <div class="team-progress-header">
                <span>📈 SUBIDA DE NIVEL Y PROGRESO (+${expAward} EXP por combate)</span>
                <span class="current-inv-hint">Mochila: 🍬 ×${inv.rare_candy || 0} | 🫐 ×${inv.exp_candy || 0}</span>
              </div>
              <div class="team-progress-cards-row">
                ${teamExpResults.map(member => {
                  const cardLvl = member.card?.level || member.newLevel;
                  const expNext = getExpForNextLevel(cardLvl);
                  const expCur = member.card?.exp || 0;
                  const expPercent = Math.min(100, Math.round((expCur / expNext) * 100));

                  return `
                    <div class="member-progress-card ${member.leveledUp ? 'is-level-up' : ''}" data-key="${member.key}">
                      <div class="member-thumb-frame">
                        <img src="${member.artwork}" alt="${member.name}" />
                        ${member.leveledUp ? '<span class="level-up-sparkle-badge">🎉 ¡SUBIÓ DE NIVEL!</span>' : ''}
                      </div>
                      <div class="member-info">
                        <strong class="member-name">${member.name}</strong>
                        <div class="member-lvl-pill">
                          ${member.leveledUp 
                            ? `<span class="lvl-old">Nv. ${member.oldLevel}</span> ➜ <strong class="lvl-new">Nv. ${member.newLevel}</strong>`
                            : `<strong>Nv. ${cardLvl}</strong>`}
                        </div>
                      </div>
                      <div class="member-exp-bar">
                        <div class="exp-bar-fill" style="width: ${expPercent}%;"></div>
                      </div>
                      <div class="member-exp-meta">
                        <small>${expCur} / ${expNext} EXP</small>
                        <span class="exp-gain-txt">+${expAward} EXP</span>
                      </div>
                      
                      <!-- Botones para usar caramelos en este Pokémon -->
                      <div class="member-quick-candy-actions">
                        <button class="btn-quick-candy btn-candy-rare" data-key="${member.key}" data-item="rare_candy" title="Dar Caramelo Raro (+1 Nivel)" ${inv.rare_candy <= 0 ? 'disabled' : ''}>
                          🍬 +1 Nv
                        </button>
                        <button class="btn-quick-candy btn-candy-exp" data-key="${member.key}" data-item="exp_candy" title="Dar Caramelo EXP (+100 EXP)" ${inv.exp_candy <= 0 ? 'disabled' : ''}>
                          🫐 +100 EXP
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- 3. Botones de Navegación -->
            <div class="gameover-btns-row">
              <button class="btn-primary" id="btnPlayAgainMatch">
                ⚔️ Jugar Otra Batalla
              </button>
              <button class="btn-secondary" id="btnGoDeckMatch">
                🃏 Ver Mazo y Subir Nivel
              </button>
              <button class="btn-secondary" id="btnGoPacksMatch">
                🎁 Abrir Nuevos Sobres
              </button>
            </div>
          </div>
        </div>
      `;

      // Listeners para usar caramelos directamente aquí
      this.container.querySelectorAll('.btn-quick-candy').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const key = btn.dataset.key;
          const item = btn.dataset.item;
          const res = useItemOnCard(key, item);
          if (res.success) {
            // Actualizar la referencia del card local
            const member = teamExpResults.find(m => m.key === key);
            if (member) {
              member.oldLevel = res.oldLevel;
              member.newLevel = res.newLevel;
              member.leveledUp = true;
              member.card = res.card;
            }
            renderGameOverCard();
          }
        });
      });

      this.container.querySelector('#btnPlayAgainMatch')?.addEventListener('click', () => {
        this.init();
      });

      this.container.querySelector('#btnGoDeckMatch')?.addEventListener('click', () => {
        document.getElementById('btnSubtabDeck')?.click();
      });

      this.container.querySelector('#btnGoPacksMatch')?.addEventListener('click', () => {
        document.getElementById('btnSubtabPacks')?.click();
      });
    };

    renderGameOverCard();
  }
}

export { PokemonBattleGame as CardBattleGame };
