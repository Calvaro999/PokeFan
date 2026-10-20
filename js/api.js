/**
 * MODULE: PokeAPI Service (js/api.js)
 * Exclusively communicates with PokeAPI (https://pokeapi.co/api/v2/)
 * Zero third-party external data sources.
 */

export const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

export const TYPE_TRANSLATIONS = {
  normal: { es: 'Normal', color: '#94a3b8' },
  fire: { es: 'Fuego', color: '#f97316' },
  water: { es: 'Agua', color: '#0ea5e9' },
  grass: { es: 'Planta', color: '#22c55e' },
  electric: { es: 'Eléctrico', color: '#eab308' },
  ice: { es: 'Hielo', color: '#38bdf8' },
  fighting: { es: 'Lucha', color: '#ef4444' },
  poison: { es: 'Veneno', color: '#a855f7' },
  ground: { es: 'Tierra', color: '#d97706' },
  flying: { es: 'Volador', color: '#818cf8' },
  psychic: { es: 'Psíquico', color: '#ec4899' },
  bug: { es: 'Bicho', color: '#84cc16' },
  rock: { es: 'Roca', color: '#a1a1aa' },
  ghost: { es: 'Fantasma', color: '#7c3aed' },
  dragon: { es: 'Dragón', color: '#6366f1' },
  dark: { es: 'Siniestro', color: '#475569' },
  steel: { es: 'Acero', color: '#94a3b8' },
  fairy: { es: 'Hada', color: '#f472b6' },
  stellar: { es: 'Astral', color: '#2dd4bf' },
  unknown: { es: 'Desconocido', color: '#64748b' }
};

export const GENERATION_RANGES = {
  1: { name: 'Gen 1 (Kanto)', min: 1, max: 151 },
  2: { name: 'Gen 2 (Johto)', min: 152, max: 251 },
  3: { name: 'Gen 3 (Hoenn)', min: 252, max: 386 },
  4: { name: 'Gen 4 (Sinnoh)', min: 387, max: 493 },
  5: { name: 'Gen 5 (Unova)', min: 494, max: 649 },
  6: { name: 'Gen 6 (Kalos)', min: 650, max: 721 },
  7: { name: 'Gen 7 (Alola)', min: 722, max: 809 },
  8: { name: 'Gen 8 (Galar)', min: 810, max: 905 },
  9: { name: 'Gen 9 (Paldea)', min: 906, max: 1025 },
  forms: { name: 'Formas Especiales', min: 1026, max: 99999 }
};

export const STAT_NAMES_ES = {
  'hp': 'PS',
  'attack': 'Ataque',
  'defense': 'Defensa',
  'special-attack': 'At. Esp.',
  'special-defense': 'Def. Esp.',
  'speed': 'Velocidad'
};

// Official Vintage Ken Sugimori (1996) Artwork & Sprite URL Generators
export const getPokeArtworkUrl = (id) => {
  const numericId = parseInt(id, 10);
  if (!isNaN(numericId) && numericId >= 1 && numericId <= 251) {
    return `assets/vintage/${numericId}.png`;
  }
  const paddedId = String(id).padStart(3, '0');
  return `https://raw.githubusercontent.com/pokevault/artwork/master/assets/regular/${paddedId}.png`;
};

export const getPokeVintageArtworkUrl = getPokeArtworkUrl;

export const getPokeModernArtworkUrl = (id) => 
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

export const getPokeShinyArtworkUrl = (id) => {
  const paddedId = String(id).padStart(3, '0');
  return `https://raw.githubusercontent.com/pokevault/artwork/master/assets/shiny/${paddedId}.png`;
};

export const getPokeAnimatedUrl = (id) => 
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;

export const getPokeShinyAnimatedUrl = (id) => 
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${id}.gif`;

export const getPokeSpriteForMode = (id, mode = 'default') => {
  switch (mode) {
    case 'modern':
      return getPokeModernArtworkUrl(id);
    case 'shiny':
      return getPokeShinyArtworkUrl(id);
    case 'animated':
      return getPokeAnimatedUrl(id);
    case 'shiny-animated':
      return getPokeShinyAnimatedUrl(id);
    case 'vintage':
    case 'default':
    default:
      return getPokeArtworkUrl(id);
  }
};

export const getPokeCryUrl = (id) => 
  `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`;

// In-memory caches
const cache = {
  masterList: null,
  pokemon: new Map(),
  species: new Map(),
  typeSets: new Map(),
  typesList: null
};

/**
 * Fetch all Pokémon from PokeAPI
 */
export async function loadMasterPokemonList() {
  if (cache.masterList) return cache.masterList;

  const response = await fetch(`${POKEAPI_BASE}/pokemon?limit=1351&offset=0`);
  if (!response.ok) throw new Error('PokeAPI response error');
  
  const data = await response.json();
  const list = data.results.map((p) => {
    const parts = p.url.split('/').filter(Boolean);
    const id = parseInt(parts[parts.length - 1], 10);
    return { id, name: p.name, url: p.url };
  });

  cache.masterList = list;
  return list;
}

/**
 * Fetch types directly from PokeAPI
 */
export async function loadTypesFromPokeApi() {
  if (cache.typesList) return cache.typesList;

  try {
    const response = await fetch(`${POKEAPI_BASE}/type`);
    if (!response.ok) return [];
    const data = await response.json();
    const filtered = data.results.filter(t => t.name !== 'shadow');
    cache.typesList = filtered;
    return filtered;
  } catch (err) {
    console.warn('Error al cargar tipos de PokeAPI:', err);
    return [];
  }
}

/**
 * Fetch Pokémon IDs for a specific type
 */
export async function fetchPokemonForType(typeName) {
  if (cache.typeSets.has(typeName)) {
    return cache.typeSets.get(typeName);
  }

  try {
    const response = await fetch(`${POKEAPI_BASE}/type/${typeName}`);
    if (!response.ok) return new Set();
    const data = await response.json();
    const idSet = new Set();
    data.pokemon.forEach((entry) => {
      const parts = entry.pokemon.url.split('/').filter(Boolean);
      const id = parseInt(parts[parts.length - 1], 10);
      idSet.add(id);
    });
    cache.typeSets.set(typeName, idSet);
    return idSet;
  } catch (err) {
    console.error(`Error al cargar tipo ${typeName}:`, err);
    return new Set();
  }
}

/**
 * Fetch full Pokémon detail from PokeAPI
 */
export async function fetchPokemonDetail(idOrName) {
  const key = String(idOrName).toLowerCase();
  if (cache.pokemon.has(key)) {
    return cache.pokemon.get(key);
  }

  try {
    const response = await fetch(`${POKEAPI_BASE}/pokemon/${idOrName}`);
    if (!response.ok) return null;
    const data = await response.json();

    const detail = {
      id: data.id,
      name: data.name,
      height: data.height,
      weight: data.weight,
      baseExperience: data.base_experience,
      types: data.types.map((t) => t.type.name),
      stats: data.stats.map((s) => ({
        name: s.stat.name,
        baseStat: s.base_stat
      })),
      abilities: data.abilities.map((a) => ({
        name: a.ability.name,
        isHidden: a.is_hidden
      })),
      sprites: {
        artwork: getPokeArtworkUrl(data.id),
        artworkShiny: getPokeShinyArtworkUrl(data.id),
        modernArtwork: data.sprites?.other?.['official-artwork']?.front_default || getPokeModernArtworkUrl(data.id),
        showdown: data.sprites?.other?.showdown?.front_default || null,
        default: data.sprites?.front_default || getPokeArtworkUrl(data.id)
      },
      cries: data.cries?.latest || getPokeCryUrl(data.id),
      speciesUrl: data.species?.url
    };

    cache.pokemon.set(key, detail);
    cache.pokemon.set(String(data.id), detail);
    return detail;
  } catch (err) {
    console.error(`Error al cargar Pokémon ${idOrName}:`, err);
    return null;
  }
}

/**
 * Fetch species description and evolution URL from PokeAPI
 */
export async function fetchPokemonSpecies(id) {
  if (cache.species.has(id)) {
    return cache.species.get(id);
  }

  try {
    const response = await fetch(`${POKEAPI_BASE}/pokemon-species/${id}`);
    if (!response.ok) return null;
    const data = await response.json();

    const genusObj = data.genera.find((g) => g.language.name === 'es') ||
                     data.genera.find((g) => g.language.name === 'en');
    
    const flavorObj = data.flavor_text_entries.find((f) => f.language.name === 'es') ||
                      data.flavor_text_entries.find((f) => f.language.name === 'en');
    
    const jaNameObj = data.names.find((n) => n.language.name === 'ja');

    const speciesData = {
      genus: genusObj ? genusObj.genus : 'Pokémon',
      flavorText: flavorObj ? flavorObj.flavor_text.replace(/[\f\n\r]/g, ' ') : 'Sin descripción disponible.',
      japaneseName: jaNameObj ? jaNameObj.name : '',
      evolutionChainUrl: data.evolution_chain?.url
    };

    cache.species.set(id, speciesData);
    return speciesData;
  } catch (err) {
    console.warn(`Species data not available for ${id}:`, err);
    return null;
  }
}

/**
 * Parse recursive evolution chain
 */
export async function fetchEvolutionChain(evolutionChainUrl) {
  if (!evolutionChainUrl) return [];
  try {
    const response = await fetch(evolutionChainUrl);
    if (!response.ok) return [];
    const data = await response.json();

    const stages = [];
    let current = data.chain;

    function traverse(node) {
      const parts = node.species.url.split('/').filter(Boolean);
      const speciesId = parseInt(parts[parts.length - 1], 10);
      
      let triggerText = '';
      if (node.evolution_details && node.evolution_details.length > 0) {
        const detail = node.evolution_details[0];
        if (detail.min_level) triggerText = `Nv. ${detail.min_level}`;
        else if (detail.item) triggerText = detail.item.name.replace('-', ' ');
        else if (detail.trigger?.name === 'trade') triggerText = 'Intercambio';
        else if (detail.min_happiness) triggerText = 'Amistad';
        else if (detail.known_move) triggerText = 'Movimiento';
        else if (detail.time_of_day) triggerText = `${detail.time_of_day}`;
        else triggerText = 'Evolución';
      }

      stages.push({
        id: speciesId,
        name: node.species.name,
        trigger: triggerText
      });

      if (node.evolves_to && node.evolves_to.length > 0) {
        node.evolves_to.forEach((subNode) => traverse(subNode));
      }
    }

    traverse(current);
    return stages;
  } catch (err) {
    console.warn('Error fetching evolution chain:', err);
    return [];
  }
}

/**
 * Fetch a random deck of unique Pokémon cards for minigames
 */
export async function fetchRandomPokemonDeck(count = 6, maxId = 1010) {
  const chosenIds = new Set();
  while (chosenIds.size < count) {
    const randomId = Math.floor(Math.random() * maxId) + 1;
    chosenIds.add(randomId);
  }

  const promises = Array.from(chosenIds).map(id => fetchPokemonDetail(id));
  const results = await Promise.allSettled(promises);
  return results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);
}

/**
 * Type effectiveness matrix (Damage multiplier for card battles)
 */
const TYPE_CHART = {
  fire: { grass: 2.0, ice: 2.0, bug: 2.0, steel: 2.0, water: 0.5, fire: 0.5, rock: 0.5, dragon: 0.5 },
  water: { fire: 2.0, ground: 2.0, rock: 2.0, water: 0.5, grass: 0.5, dragon: 0.5 },
  grass: { water: 2.0, ground: 2.0, rock: 2.0, fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5 },
  electric: { water: 2.0, flying: 2.0, electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0.0 },
  ice: { grass: 2.0, ground: 2.0, flying: 2.0, dragon: 2.0, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
  fighting: { normal: 2.0, ice: 2.0, rock: 2.0, dark: 2.0, steel: 2.0, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0.0 },
  poison: { grass: 2.0, fairy: 2.0, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0.0 },
  ground: { fire: 2.0, electric: 2.0, poison: 2.0, rock: 2.0, steel: 2.0, grass: 0.5, bug: 0.5, flying: 0.0 },
  flying: { grass: 2.0, fighting: 2.0, bug: 2.0, electric: 0.5, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2.0, poison: 2.0, psychic: 0.5, steel: 0.5, dark: 0.0 },
  bug: { grass: 2.0, psychic: 2.0, dark: 2.0, fire: 0.5, fighting: 0.5, poison: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2.0, ice: 2.0, flying: 2.0, bug: 2.0, fighting: 0.5, ground: 0.5, steel: 0.5 },
  ghost: { psychic: 2.0, ghost: 2.0, dark: 0.5, normal: 0.0 },
  dragon: { dragon: 2.0, steel: 0.5, fairy: 0.0 },
  dark: { psychic: 2.0, ghost: 2.0, fighting: 0.5, dark: 0.5, fairy: 0.5 },
  steel: { ice: 2.0, rock: 2.0, fairy: 2.0, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
  fairy: { fighting: 2.0, dragon: 2.0, dark: 2.0, fire: 0.5, poison: 0.5, steel: 0.5 }
};

export function getTypeEffectiveness(attackType, defenderType) {
  if (!attackType || !defenderType) return 1.0;
  const atk = attackType.toLowerCase();
  const def = defenderType.toLowerCase();
  if (TYPE_CHART[atk] && typeof TYPE_CHART[atk][def] !== 'undefined') {
    return TYPE_CHART[atk][def];
  }
  return 1.0;
}

/**
 * Known legendary & mythical IDs in PokeAPI for guaranteed authentic pulls
 */
export const LEGENDARY_POKEMON_IDS = [
  144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251,
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 491, 492, 493,
  641, 642, 643, 644, 645, 646, 647, 648, 649,
  716, 717, 718, 772, 773, 785, 786, 787, 788, 789, 790, 791, 792, 800, 801, 802,
  888, 889, 890, 891, 892, 894, 895, 896, 897, 898,
  1001, 1002, 1003, 1004, 1007, 1008, 1014, 1015, 1016, 1017, 1024, 1025
];

export const EPIC_POKEMON_IDS = [
  3, 6, 9, 38, 59, 65, 68, 94, 130, 131, 143, 149, 157, 160, 212, 229, 248,
  254, 257, 260, 282, 306, 330, 373, 376, 389, 392, 395, 445, 448, 466, 467,
  475, 477, 500, 503, 530, 609, 612, 635, 658, 681, 706, 724, 727, 730, 745,
  778, 784, 812, 815, 818, 887, 908, 911, 914, 998
];

/**
 * Calculate Pokémon card rarity based on authentic lore and stats
 */
export function getPokemonRarity(pokemon) {
  const isLegendaryId = LEGENDARY_POKEMON_IDS.includes(pokemon.id);

  // Solo los Pokémon auténticamente Legendarios o Míticos reciben la categoría Legendario
  if (isLegendaryId) {
    return {
      id: 'legendary',
      name: 'Legendario',
      badge: '🌟 LEGENDARIO',
      color: '#fbbf24',
      bgGradient: 'linear-gradient(135deg, #fbbf24, #f59e0b, #ec4899, #8b5cf6)',
      glow: 'rgba(251, 191, 36, 0.75)',
      isLegendary: true
    };
  }

  const bst = pokemon.stats?.reduce((acc, s) => acc + (s.baseStat || 0), 0) || 300;
  const isEpicId = EPIC_POKEMON_IDS.includes(pokemon.id);
  // Pseudolegendarios y formas finales poderosas reciben la categoría Épico
  if (isEpicId || bst >= 500) {
    return {
      id: 'epic',
      name: 'Épico',
      badge: '🟣 ÉPICO',
      color: '#c084fc',
      bgGradient: 'linear-gradient(135deg, #a855f7, #6366f1)',
      glow: 'rgba(192, 132, 252, 0.65)',
      isEpic: true
    };
  }

  if (bst >= 390) {
    return {
      id: 'rare',
      name: 'Raro',
      badge: '🔵 RARO',
      color: '#38bdf8',
      bgGradient: 'linear-gradient(135deg, #0284c7, #38bdf8)',
      glow: 'rgba(56, 189, 248, 0.5)',
      isRare: true
    };
  }

  return {
    id: 'common',
    name: 'Común',
    badge: '⚪ COMÚN',
    color: '#94a3b8',
    bgGradient: 'linear-gradient(135deg, #475569, #64748b)',
    glow: 'rgba(148, 163, 184, 0.3)',
    isCommon: true
  };
}

/**
 * Calculate combat level for display (default Level 1)
 */
export function getPokemonLevel(pokemon) {
  if (pokemon && typeof pokemon.level === 'number' && !isNaN(pokemon.level)) {
    return Math.max(1, Math.min(100, Math.round(pokemon.level)));
  }
  return 1;
}

/**
 * Weakest starter Pokémon for new players: Caterpie, Magikarp, Rattata
 */
export const WEAK_STARTER_IDS = [10, 129, 19];

export const WEAK_TIER_POKEMON_IDS = [
  10, 11, 13, 14, 16, 19, 41, 129, 172, 191, 824, 265, 266, 267, 268, 293
];

export const MID_TIER_POKEMON_IDS = [
  1, 2, 4, 5, 7, 8, 25, 26, 60, 61, 64, 67, 92, 93, 133, 134, 135, 136, 152, 155, 158
];

export const PACK_COLLECTIONS = {
  kanto: {
    id: 'kanto',
    name: 'Kanto Clásico',
    tag: 'GEN 1 ORIGINAL',
    cost: 100,
    icon: '🌿',
    themeColor: '#22c55e',
    image: 'assets/packs/pack_kanto.png',
    bgGradient: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #10b981 100%)',
    description: 'Los 151 Pokémon originarios de Kanto. Probabilidad estándar de cartas Raras, Épicas y Shinys.',
    featured: 'Charizard, Pikachu, Gengar, Mew...'
  },
  fire_dragon: {
    id: 'fire_dragon',
    name: 'Fuego & Dragón',
    tag: 'EXPANSIÓN ÍGNEA',
    cost: 150,
    icon: '🔥',
    themeColor: '#f97316',
    image: 'assets/packs/pack_fire_dragon.png',
    bgGradient: 'linear-gradient(135deg, #7c2d12 0%, #9a3412 50%, #ea580c 100%)',
    description: 'Especializado en Pokémon de Fuego y Dragón con alto Ataque físico y especial.',
    featured: 'Charizard, Dragonite, Arcanine, Salamence...'
  },
  electric: {
    id: 'electric',
    name: 'Tormenta Eléctrica',
    tag: 'ALTO VOLTAJE',
    cost: 150,
    icon: '⚡',
    themeColor: '#eab308',
    image: 'assets/packs/pack_electric.png',
    bgGradient: 'linear-gradient(135deg, #713f12 0%, #854d0e 50%, #ca8a04 100%)',
    description: 'Pokémon veloces de tipo Eléctrico y Volador con ataques fulgurantes y alta velocidad.',
    featured: 'Zapdos, Raichu, Jolteon, Electivire, Zekrom...'
  },
  legendary: {
    id: 'legendary',
    name: 'Leyendas del Olimpo',
    tag: 'ULTRA RARO',
    cost: 250,
    icon: '🌟',
    themeColor: '#fbbf24',
    image: 'assets/packs/pack_legendary.png',
    bgGradient: 'linear-gradient(135deg, #451a03 0%, #78350f 50%, #d97706 100%)',
    description: '¡Máxima probabilidad de conseguir Pokémon Legendarios y Míticos con estadísticas colosales!',
    featured: 'Mewtwo, Rayquaza, Lugia, Arceus, Zacian...'
  }
};

/**
 * Fetch 3 cards for a booster pack from a specific collection in PokeAPI
 * Includes a rare chance (~8%) for each card to be Shiny!
 */
export async function fetchCardsForCollection(collectionId = 'kanto') {
  const chosenIds = [];

  if (collectionId === 'fire_dragon') {
    // Pokémon comunes y poco comunes de fuego y dragón (sin legendarios en el pool general)
    const fireDragonPool = [4, 5, 37, 38, 58, 59, 126, 136, 147, 148, 155, 156, 240, 257, 323, 330, 371, 372];
    while (chosenIds.length < 2) {
      const id = fireDragonPool[Math.floor(Math.random() * fireDragonPool.length)];
      if (!chosenIds.includes(id)) chosenIds.push(id);
    }
    // Ranura 3: Solo 3.5% de probabilidad de legendario (Rayquaza o Reshiram); de lo contrario un Épico/Destacado
    if (Math.random() < 0.035) {
      chosenIds.push(Math.random() < 0.5 ? 384 : 643);
    } else {
      const fdStars = [6, 149, 157, 248, 373, 445];
      chosenIds.push(fdStars[Math.floor(Math.random() * fdStars.length)]);
    }
  } else if (collectionId === 'electric') {
    // Pokémon eléctricos regulares
    const electricPool = [25, 100, 101, 125, 135, 172, 179, 180, 181, 239, 309, 310, 403, 404];
    while (chosenIds.length < 2) {
      const id = electricPool[Math.floor(Math.random() * electricPool.length)];
      if (!chosenIds.includes(id)) chosenIds.push(id);
    }
    // Ranura 3: Solo 3.5% de probabilidad de legendario eléctrico; de lo contrario un Épico/Destacado
    if (Math.random() < 0.035) {
      const elecLegs = [145, 243, 642, 644];
      chosenIds.push(elecLegs[Math.floor(Math.random() * elecLegs.length)]);
    } else {
      const elecStars = [26, 181, 405, 466];
      chosenIds.push(elecStars[Math.floor(Math.random() * elecStars.length)]);
    }
  } else if (collectionId === 'legendary') {
    // Colección "Leyendas": Ahora los legendarios son un trofeo muy codiciado (~20% en ranura 3)
    // Ranuras 1 y 2: Pokémon Épicos y poderosos de combate
    while (chosenIds.length < 2) {
      const id = EPIC_POKEMON_IDS[Math.floor(Math.random() * EPIC_POKEMON_IDS.length)];
      if (!chosenIds.includes(id)) chosenIds.push(id);
    }
    // Ranura 3: 20% de probabilidad de Legendario auténtico (1 de cada 5 sobres); si no, un Épico estelar
    if (Math.random() < 0.20) {
      chosenIds.push(LEGENDARY_POKEMON_IDS[Math.floor(Math.random() * LEGENDARY_POKEMON_IDS.length)]);
    } else {
      chosenIds.push(EPIC_POKEMON_IDS[Math.floor(Math.random() * EPIC_POKEMON_IDS.length)]);
    }
  } else {
    // Kanto Clásico (1 to 151)
    const kantoRegular = [];
    for (let i = 1; i <= 149; i++) {
      if (i !== 144 && i !== 145 && i !== 146) kantoRegular.push(i);
    }
    while (chosenIds.length < 2) {
      const id = kantoRegular[Math.floor(Math.random() * kantoRegular.length)];
      if (!chosenIds.includes(id)) chosenIds.push(id);
    }
    // Ranura 3: Solo 2.5% de probabilidad de Legendario Kanto (Articuno, Zapdos, Moltres, Mewtwo, Mew)
    if (Math.random() < 0.025) {
      const kantoLegs = [144, 145, 146, 150, 151];
      chosenIds.push(kantoLegs[Math.floor(Math.random() * kantoLegs.length)]);
    } else {
      const kantoStars = [3, 6, 9, 25, 65, 68, 94, 130, 143, 149];
      chosenIds.push(kantoStars[Math.floor(Math.random() * kantoStars.length)]);
    }
  }

  const promises = chosenIds.map(id => fetchPokemonDetail(id));
  const results = await Promise.allSettled(promises);
  const cards = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);

  // Apply rare shiny roll (~8% chance per card)
  return cards.map(c => {
    const isShiny = Math.random() < 0.08;
    return {
      ...c,
      isShiny,
      // Artwork Ken Sugimori original vintage por defecto, o shiny variocolor
      artworkUrl: isShiny 
        ? getPokeShinyArtworkUrl(c.id)
        : getPokeArtworkUrl(c.id),
      showdownFront: isShiny
        ? (c.sprites.other?.showdown?.front_shiny || c.sprites.front_shiny || c.sprites.other?.showdown?.front_default)
        : (c.sprites.other?.showdown?.front_default || c.sprites.front_default),
      showdownBack: isShiny
        ? (c.sprites.other?.showdown?.back_shiny || c.sprites.back_shiny || c.sprites.other?.showdown?.back_default)
        : (c.sprites.other?.showdown?.back_default || c.sprites.back_default)
    };
  });
}

/**
 * Fetch 3 adaptive Bot Pokémon based on the player's deck strength
 */
export async function fetchAdaptiveBotDeck(playerDeckCards = []) {
  let avgBst = 250;
  if (playerDeckCards && playerDeckCards.length > 0) {
    const totalBst = playerDeckCards.reduce((acc, card) => {
      const bst = card.stats?.reduce((sum, s) => sum + (s.baseStat || 0), 0) || 250;
      return acc + bst;
    }, 0);
    avgBst = Math.round(totalBst / playerDeckCards.length);
  }

  const chosenIds = new Set();
  let pool = WEAK_TIER_POKEMON_IDS;

  if (avgBst <= 320) {
    // Weak tier CPU
    pool = WEAK_TIER_POKEMON_IDS;
  } else if (avgBst <= 460) {
    // Mid tier CPU
    pool = MID_TIER_POKEMON_IDS;
  } else if (avgBst <= 560) {
    // High tier CPU
    pool = EPIC_POKEMON_IDS;
  } else {
    // Legendary tier CPU
    pool = LEGENDARY_POKEMON_IDS;
  }

  while (chosenIds.size < 3) {
    const id = pool[Math.floor(Math.random() * pool.length)];
    chosenIds.add(id);
  }

  const promises = Array.from(chosenIds).map(id => fetchPokemonDetail(id));
  const results = await Promise.allSettled(promises);
  return results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);
}

/**
 * Backwards compatible fetchBoosterPackDeck
 */
export async function fetchBoosterPackDeck() {
  return fetchCardsForCollection('kanto');
}
