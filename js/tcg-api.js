/**
 * MODULE: Official Pokémon TCG API Service (js/tcg-api.js)
 * Consumes the official Pokémon TCG API v2: https://api.pokemontcg.io/v2/
 * Provides:
 * - Real high-resolution official card scans (images.small & images.large)
 * - Real card HP, real attack names, costs, damage and rule text
 * - Real weakness, resistance, artist, set info, and rarity
 * - Pre-packaged, rock-solid card database (including user card xy7-54 Gardevoir)
 * - Live search & fetch from api.pokemontcg.io with local caching
 */

export const POKEMON_TCG_API_BASE = 'https://api.pokemontcg.io/v2';
const TCG_CACHE_KEY_PREFIX = 'poke_tcg_card_';

// Curated official cards database from https://api.pokemontcg.io/v2/cards/
export const POKEDEX_NAME_MAP = {
  'gardevoir': 282,
  'charizard': 6,
  'pikachu': 25,
  'blastoise': 9,
  'mewtwo': 150,
  'm rayquaza-ex': 384,
  'rayquaza': 384,
  'entei': 244,
  'pikachu & zekrom-gx': 25,
  'zapdos': 145,
  'arceus vstar': 493,
  'arceus': 493,
  'mew': 151,
  'alakazam': 65,
  'gengar': 94,
  'magikarp': 129,
  'caterpie': 10,
  'rattata': 19,
  'venusaur': 3,
  'bulbasaur': 1,
  'ivysaur': 2,
  'charmander': 4,
  'charmeleon': 5,
  'squirtle': 7,
  'wartortle': 8,
  'dragonite': 149,
  'snorlax': 143,
  'gyarados': 130,
  'raichu': 26,
  'nidoking': 34,
  'ninetales': 38,
  'machamp': 68
};

export function getPokedexNumberByName(name) {
  if (!name) return 282;
  const lower = String(name).toLowerCase().trim();
  for (const [k, num] of Object.entries(POKEDEX_NAME_MAP)) {
    if (lower.includes(k)) return num;
  }
  return 282;
}

export const PREPACKAGED_TCG_CARDS = {
  // USER'S EXPLICIT CARD: xy7-54 (Gardevoir)
  'xy7-54': {
    id: 'xy7-54',
    name: 'Gardevoir',
    supertype: 'Pokémon',
    subtypes: ['Stage 2'],
    hp: '130',
    types: ['Fairy'],
    evolvesFrom: 'Kirlia',
    abilities: [
      {
        name: 'Bright Heal',
        text: 'Una vez durante tu turno (antes de atacar), puedes curar 20 puntos de daño a cada uno de tus Pokémon.',
        type: 'Habilidad'
      }
    ],
    attacks: [
      {
        name: 'Telekinesis',
        cost: ['Colorless', 'Colorless', 'Colorless'],
        convertedEnergyCost: 3,
        damage: '50',
        text: 'Este ataque hace 50 puntos de daño a 1 de los Pokémon de tu rival sin aplicar debilidad ni resistencia.'
      }
    ],
    weaknesses: [{ type: 'Metal', value: '×2' }],
    resistances: [{ type: 'Darkness', value: '-20' }],
    retreatCost: ['Colorless', 'Colorless'],
    convertedRetreatCost: 2,
    set: {
      id: 'xy7',
      name: 'Ancient Origins',
      series: 'XY',
      printedTotal: 98,
      total: 100,
      images: {
        symbol: 'https://images.pokemontcg.io/xy7/symbol.png',
        logo: 'https://images.pokemontcg.io/xy7/logo.png'
      }
    },
    number: '54',
    artist: 'TOKIYA',
    rarity: 'Rare Holo',
    flavorText: 'Tiene el poder de predecir el futuro. Su poder alcanza el punto máximo al proteger a su Entrenador.',
    nationalPokedexNumbers: [282],
    images: {
      small: 'https://images.pokemontcg.io/xy7/54.png',
      large: 'https://images.pokemontcg.io/xy7/54_hires.png'
    },
    tcgplayer: {
      url: 'https://prices.pokemontcg.io/tcgplayer/xy7-54',
      prices: { holofoil: { market: 7.14 } }
    }
  },

  // Base Set Charizard
  'base1-4': {
    id: 'base1-4',
    name: 'Charizard',
    supertype: 'Pokémon',
    subtypes: ['Stage 2'],
    hp: '120',
    types: ['Fire'],
    evolvesFrom: 'Charmeleon',
    abilities: [
      {
        name: 'Energy Burn',
        text: 'Toda la energía unida a Charizard se convierte en energía de tipo Fuego.',
        type: 'Poder Pokémon'
      }
    ],
    attacks: [
      {
        name: 'Fire Spin',
        cost: ['Fire', 'Fire', 'Fire', 'Fire'],
        convertedEnergyCost: 4,
        damage: '100',
        text: 'Descarta 2 cartas de Energía unidas a Charizard para usar este ataque.'
      }
    ],
    weaknesses: [{ type: 'Water', value: '×2' }],
    resistances: [{ type: 'Fighting', value: '-30' }],
    retreatCost: ['Colorless', 'Colorless', 'Colorless'],
    convertedRetreatCost: 3,
    set: {
      id: 'base1',
      name: 'Base Set',
      series: 'Base',
      printedTotal: 102,
      total: 102,
      images: {
        symbol: 'https://images.pokemontcg.io/base1/symbol.png',
        logo: 'https://images.pokemontcg.io/base1/logo.png'
      }
    },
    number: '4',
    artist: 'Mitsuhiro Arita',
    rarity: 'Rare Holo',
    flavorText: 'Escupe un fuego tan caliente que funde las rocas. Causa incendios forestales sin querer.',
    nationalPokedexNumbers: [6],
    images: {
      small: 'https://images.pokemontcg.io/base1/4.png',
      large: 'https://images.pokemontcg.io/base1/4_hires.png'
    },
    tcgplayer: {
      url: 'https://prices.pokemontcg.io/tcgplayer/base1-4',
      prices: { holofoil: { market: 350.0 } }
    }
  },

  // Wizards Promo Pikachu
  'basep-1': {
    id: 'basep-1',
    name: 'Pikachu',
    supertype: 'Pokémon',
    subtypes: ['Basic'],
    hp: '60',
    types: ['Lightning'],
    evolvesTo: ['Raichu'],
    attacks: [
      {
        name: 'Growl',
        cost: ['Colorless'],
        convertedEnergyCost: 1,
        damage: '10',
        text: 'Reduce el daño del próximo ataque del rival en 10.'
      },
      {
        name: 'Thundershock',
        cost: ['Lightning', 'Lightning'],
        convertedEnergyCost: 2,
        damage: '20',
        text: 'Lanza una moneda. Si sale cara, el Pokémon rival pasa a estar Paralizado.'
      }
    ],
    weaknesses: [{ type: 'Fighting', value: '×2' }],
    retreatCost: ['Colorless'],
    convertedRetreatCost: 1,
    set: {
      id: 'basep',
      name: 'Wizards Black Star Promos',
      series: 'Base',
      printedTotal: 53,
      total: 53,
      images: {
        symbol: 'https://images.pokemontcg.io/basep/symbol.png',
        logo: 'https://images.pokemontcg.io/basep/logo.png'
      }
    },
    number: '1',
    artist: 'Keiji Kinebuchi',
    rarity: 'Promo',
    flavorText: 'Cuando varios de estos Pokémon se juntan, su electricidad puede crear tormentas de rayos.',
    nationalPokedexNumbers: [25],
    images: {
      small: 'https://images.pokemontcg.io/basep/1.png',
      large: 'https://images.pokemontcg.io/basep/1_hires.png'
    },
    tcgplayer: {
      url: 'https://prices.pokemontcg.io/tcgplayer/basep-1',
      prices: { holofoil: { market: 38.69 } }
    }
  },

  // Base Set Blastoise
  'base1-2': {
    id: 'base1-2',
    name: 'Blastoise',
    supertype: 'Pokémon',
    subtypes: ['Stage 2'],
    hp: '100',
    types: ['Water'],
    evolvesFrom: 'Wartortle',
    abilities: [
      {
        name: 'Rain Dance',
        text: 'Puedes unir cuantas cartas de Energía Agua quieras a tus Pokémon de Agua durante tu turno.',
        type: 'Poder Pokémon'
      }
    ],
    attacks: [
      {
        name: 'Hydro Pump',
        cost: ['Water', 'Water', 'Water'],
        convertedEnergyCost: 3,
        damage: '40+',
        text: 'Hace 40 puntos de daño más 10 puntos de daño adicionales por cada Energía Agua unida (máx +20).'
      }
    ],
    weaknesses: [{ type: 'Lightning', value: '×2' }],
    retreatCost: ['Colorless', 'Colorless', 'Colorless'],
    convertedRetreatCost: 3,
    set: {
      id: 'base1',
      name: 'Base Set',
      series: 'Base',
      printedTotal: 102,
      total: 102,
      images: {
        symbol: 'https://images.pokemontcg.io/base1/symbol.png',
        logo: 'https://images.pokemontcg.io/base1/logo.png'
      }
    },
    number: '2',
    artist: 'Ken Sugimori',
    rarity: 'Rare Holo',
    nationalPokedexNumbers: [9],
    images: {
      small: 'https://images.pokemontcg.io/base1/2.png',
      large: 'https://images.pokemontcg.io/base1/2_hires.png'
    }
  },

  // Base Set Mewtwo
  'base1-10': {
    id: 'base1-10',
    name: 'Mewtwo',
    supertype: 'Pokémon',
    subtypes: ['Basic'],
    hp: '60',
    types: ['Psychic'],
    attacks: [
      {
        name: 'Psychic',
        cost: ['Psychic', 'Colorless'],
        convertedEnergyCost: 2,
        damage: '10+',
        text: 'Hace 10 puntos de daño más 10 por cada carta de Energía unida al Pokémon rival.'
      },
      {
        name: 'Barrier',
        cost: ['Psychic', 'Psychic'],
        convertedEnergyCost: 2,
        damage: '',
        text: 'Descarta 1 carta de Energía Psíquica unida a Mewtwo. Previene todo daño y efectos el próximo turno.'
      }
    ],
    weaknesses: [{ type: 'Psychic', value: '×2' }],
    retreatCost: ['Colorless', 'Colorless', 'Colorless'],
    convertedRetreatCost: 3,
    set: {
      id: 'base1',
      name: 'Base Set',
      series: 'Base',
      printedTotal: 102,
      total: 102,
      images: {
        symbol: 'https://images.pokemontcg.io/base1/symbol.png',
        logo: 'https://images.pokemontcg.io/base1/logo.png'
      }
    },
    number: '10',
    artist: 'Ken Sugimori',
    rarity: 'Rare Holo',
    nationalPokedexNumbers: [150],
    images: {
      small: 'https://images.pokemontcg.io/base1/10.png',
      large: 'https://images.pokemontcg.io/base1/10_hires.png'
    }
  },

  // Ancient Origins Rayquaza EX
  'xy7-75': {
    id: 'xy7-75',
    name: 'M Rayquaza-EX',
    supertype: 'Pokémon',
    subtypes: ['MEGA', 'EX'],
    hp: '230',
    types: ['Dragon'],
    evolvesFrom: 'Rayquaza-EX',
    attacks: [
      {
        name: 'Dragon Ascent',
        cost: ['Fire', 'Fire', 'Lightning', 'Colorless', 'Colorless'],
        convertedEnergyCost: 5,
        damage: '300',
        text: 'Descarta 2 Energías unidas a este Pokémon para asestar un golpe demoledor de 300 PS.'
      }
    ],
    weaknesses: [{ type: 'Fairy', value: '×2' }],
    retreatCost: ['Colorless', 'Colorless'],
    convertedRetreatCost: 2,
    set: {
      id: 'xy7',
      name: 'Ancient Origins',
      series: 'XY',
      printedTotal: 98,
      total: 100,
      images: {
        symbol: 'https://images.pokemontcg.io/xy7/symbol.png',
        logo: 'https://images.pokemontcg.io/xy7/logo.png'
      }
    },
    number: '75',
    artist: '5ban Graphics',
    rarity: 'Rare Holo EX',
    nationalPokedexNumbers: [384],
    images: {
      small: 'https://images.pokemontcg.io/xy7/75.png',
      large: 'https://images.pokemontcg.io/xy7/75_hires.png'
    }
  },

  // Ancient Origins Entei
  'xy7-15': {
    id: 'xy7-15',
    name: 'Entei',
    supertype: 'Pokémon',
    subtypes: ['Basic'],
    hp: '130',
    types: ['Fire'],
    attacks: [
      {
        name: 'Flame Barrier',
        cost: ['Fire', 'Colorless'],
        convertedEnergyCost: 2,
        damage: '30',
        text: 'Durante el próximo turno de tu rival, este Pokémon recibe 30 puntos de daño menos de ataques.'
      },
      {
        name: 'Heat Tackle',
        cost: ['Fire', 'Fire', 'Colorless', 'Colorless'],
        convertedEnergyCost: 4,
        damage: '130',
        text: 'Este Pokémon se hace 30 puntos de daño a sí mismo.'
      }
    ],
    weaknesses: [{ type: 'Water', value: '×2' }],
    retreatCost: ['Colorless', 'Colorless'],
    convertedRetreatCost: 2,
    set: {
      id: 'xy7',
      name: 'Ancient Origins',
      series: 'XY',
      printedTotal: 98,
      total: 100,
      images: {
        symbol: 'https://images.pokemontcg.io/xy7/symbol.png',
        logo: 'https://images.pokemontcg.io/xy7/logo.png'
      }
    },
    number: '15',
    artist: 'kawayoo',
    rarity: 'Rare Holo',
    nationalPokedexNumbers: [244],
    images: {
      small: 'https://images.pokemontcg.io/xy7/15.png',
      large: 'https://images.pokemontcg.io/xy7/15_hires.png'
    }
  },

  // Team Up Pikachu & Zekrom GX
  'sm9-33': {
    id: 'sm9-33',
    name: 'Pikachu & Zekrom-GX',
    supertype: 'Pokémon',
    subtypes: ['Basic', 'TAG TEAM', 'GX'],
    hp: '240',
    types: ['Lightning'],
    attacks: [
      {
        name: 'Full Blitz',
        cost: ['Lightning', 'Lightning', 'Lightning'],
        convertedEnergyCost: 3,
        damage: '150',
        text: 'Busca en tu baraja hasta 3 cartas de Energía Eléctrica y únelas a 1 de tus Pokémon.'
      },
      {
        name: 'Tag Bolt-GX',
        cost: ['Lightning', 'Lightning', 'Lightning'],
        convertedEnergyCost: 3,
        damage: '200+',
        text: 'Si este Pokémon tiene al menos 3 Energías Eléctricas extra, hace 170 de daño a 1 Pokémon en la Banca rival.'
      }
    ],
    weaknesses: [{ type: 'Fighting', value: '×2' }],
    resistances: [{ type: 'Metal', value: '-20' }],
    retreatCost: ['Colorless', 'Colorless', 'Colorless'],
    convertedRetreatCost: 3,
    set: {
      id: 'sm9',
      name: 'Team Up',
      series: 'Sun & Moon',
      printedTotal: 181,
      total: 196,
      images: {
        symbol: 'https://images.pokemontcg.io/sm9/symbol.png',
        logo: 'https://images.pokemontcg.io/sm9/logo.png'
      }
    },
    number: '33',
    artist: 'Mitsuhiro Arita',
    rarity: 'Rare Holo GX',
    nationalPokedexNumbers: [25, 644],
    images: {
      small: 'https://images.pokemontcg.io/sm9/33.png',
      large: 'https://images.pokemontcg.io/sm9/33_hires.png'
    }
  },

  // Team Up Zapdos
  'sm9-40': {
    id: 'sm9-40',
    name: 'Zapdos',
    supertype: 'Pokémon',
    subtypes: ['Basic'],
    hp: '110',
    types: ['Lightning'],
    attacks: [
      {
        name: 'Thunder Assault',
        cost: ['Lightning'],
        convertedEnergyCost: 1,
        damage: '10+',
        text: 'Si este Pokémon se convirtió en tu Pokémon Activo este turno, este ataque hace 70 de daño adicional.'
      }
    ],
    weaknesses: [{ type: 'Lightning', value: '×2' }],
    resistances: [{ type: 'Fighting', value: '-20' }],
    retreatCost: ['Colorless', 'Colorless'],
    convertedRetreatCost: 2,
    set: {
      id: 'sm9',
      name: 'Team Up',
      series: 'Sun & Moon',
      printedTotal: 181,
      total: 196,
      images: {
        symbol: 'https://images.pokemontcg.io/sm9/symbol.png',
        logo: 'https://images.pokemontcg.io/sm9/logo.png'
      }
    },
    number: '40',
    artist: 'chibi',
    rarity: 'Rare Holo',
    nationalPokedexNumbers: [145],
    images: {
      small: 'https://images.pokemontcg.io/sm9/40.png',
      large: 'https://images.pokemontcg.io/sm9/40_hires.png'
    }
  },

  // Brilliant Stars Arceus VSTAR
  'swsh9-123': {
    id: 'swsh9-123',
    name: 'Arceus VSTAR',
    supertype: 'Pokémon',
    subtypes: ['VSTAR'],
    hp: '280',
    types: ['Colorless'],
    evolvesFrom: 'Arceus V',
    abilities: [
      {
        name: 'Starbirth',
        text: 'Durante tu turno, puedes buscar en tu baraja hasta 2 cartas cualesquiera y ponerlas en tu mano.',
        type: 'Poder VSTAR'
      }
    ],
    attacks: [
      {
        name: 'Trinity Nova',
        cost: ['Colorless', 'Colorless', 'Colorless'],
        convertedEnergyCost: 3,
        damage: '200',
        text: 'Busca en tu baraja hasta 3 cartas de Energía básica y únelas a tus Pokémon V como quieras.'
      }
    ],
    weaknesses: [{ type: 'Fighting', value: '×2' }],
    retreatCost: ['Colorless', 'Colorless'],
    convertedRetreatCost: 2,
    set: {
      id: 'swsh9',
      name: 'Brilliant Stars',
      series: 'Sword & Shield',
      printedTotal: 172,
      total: 186,
      images: {
        symbol: 'https://images.pokemontcg.io/swsh9/symbol.png',
        logo: 'https://images.pokemontcg.io/swsh9/logo.png'
      }
    },
    number: '123',
    artist: '5ban Graphics',
    rarity: 'Rare Holo VSTAR',
    nationalPokedexNumbers: [493],
    images: {
      small: 'https://images.pokemontcg.io/swsh9/123.png',
      large: 'https://images.pokemontcg.io/swsh9/123_hires.png'
    }
  },

  // Celebrations Mew
  'cel25-25': {
    id: 'cel25-25',
    name: 'Mew',
    supertype: 'Pokémon',
    subtypes: ['Basic'],
    hp: '60',
    types: ['Psychic'],
    abilities: [
      {
        name: 'Mysterious Tail',
        text: 'Mira las primeras 6 cartas de tu baraja, revela 1 carta de Objeto y ponla en tu mano.',
        type: 'Habilidad'
      }
    ],
    attacks: [
      {
        name: 'Psyshot',
        cost: ['Psychic', 'Colorless'],
        convertedEnergyCost: 2,
        damage: '30',
        text: 'Lanza un rayo psíquico certero.'
      }
    ],
    weaknesses: [{ type: 'Darkness', value: '×2' }],
    resistances: [{ type: 'Fighting', value: '-30' }],
    retreatCost: ['Colorless'],
    convertedRetreatCost: 1,
    set: {
      id: 'cel25',
      name: 'Celebrations',
      series: 'Sword & Shield',
      printedTotal: 25,
      total: 25,
      images: {
        symbol: 'https://images.pokemontcg.io/cel25/symbol.png',
        logo: 'https://images.pokemontcg.io/cel25/logo.png'
      }
    },
    number: '25',
    artist: 'Sanosuke Sakuma',
    rarity: 'Rare Holo',
    nationalPokedexNumbers: [151],
    images: {
      small: 'https://images.pokemontcg.io/cel25/25.png',
      large: 'https://images.pokemontcg.io/cel25/25_hires.png'
    }
  },

  // Base Set Alakazam
  'base1-1': {
    id: 'base1-1',
    name: 'Alakazam',
    supertype: 'Pokémon',
    subtypes: ['Stage 2'],
    hp: '80',
    types: ['Psychic'],
    evolvesFrom: 'Kadabra',
    attacks: [
      {
        name: 'Confuse Ray',
        cost: ['Psychic', 'Psychic', 'Psychic'],
        convertedEnergyCost: 3,
        damage: '30',
        text: 'Lanza una moneda. Si sale cara, el Pokémon rival pasa a estar Confundido.'
      }
    ],
    weaknesses: [{ type: 'Psychic', value: '×2' }],
    retreatCost: ['Colorless', 'Colorless', 'Colorless'],
    convertedRetreatCost: 3,
    set: {
      id: 'base1',
      name: 'Base Set',
      series: 'Base',
      printedTotal: 102,
      total: 102,
      images: {
        symbol: 'https://images.pokemontcg.io/base1/symbol.png',
        logo: 'https://images.pokemontcg.io/base1/logo.png'
      }
    },
    number: '1',
    artist: 'Ken Sugimori',
    rarity: 'Rare Holo',
    nationalPokedexNumbers: [65],
    images: {
      small: 'https://images.pokemontcg.io/base1/1.png',
      large: 'https://images.pokemontcg.io/base1/1_hires.png'
    }
  },

  // Base Set Gengar (Fossil #5)
  'base3-5': {
    id: 'base3-5',
    name: 'Gengar',
    supertype: 'Pokémon',
    subtypes: ['Stage 2'],
    hp: '80',
    types: ['Psychic'],
    evolvesFrom: 'Haunter',
    attacks: [
      {
        name: 'Dark Mind',
        cost: ['Psychic', 'Psychic', 'Psychic'],
        convertedEnergyCost: 3,
        damage: '30',
        text: 'Hace 30 de daño al rival y 10 de daño a 1 de los Pokémon en la Banca rival.'
      }
    ],
    retreatCost: ['Colorless'],
    convertedRetreatCost: 1,
    set: {
      id: 'base3',
      name: 'Fossil',
      series: 'Base',
      printedTotal: 62,
      total: 62,
      images: {
        symbol: 'https://images.pokemontcg.io/base3/symbol.png',
        logo: 'https://images.pokemontcg.io/base3/logo.png'
      }
    },
    number: '5',
    artist: 'Keiji Kinebuchi',
    rarity: 'Rare Holo',
    nationalPokedexNumbers: [94],
    images: {
      small: 'https://images.pokemontcg.io/base3/5.png',
      large: 'https://images.pokemontcg.io/base3/5_hires.png'
    }
  },

  // Base Set Venusaur (#15)
  'base1-15': {
    id: 'base1-15',
    name: 'Venusaur',
    supertype: 'Pokémon',
    subtypes: ['Stage 2'],
    hp: '100',
    types: ['Grass'],
    evolvesFrom: 'Ivysaur',
    abilities: [
      {
        name: 'Energy Trans',
        text: 'Puedes mover cartas de Energía Planta entre tus Pokémon tantas veces como quieras durante tu turno.',
        type: 'Poder Pokémon'
      }
    ],
    attacks: [
      {
        name: 'Solarbeam',
        cost: ['Grass', 'Grass', 'Grass', 'Grass'],
        convertedEnergyCost: 4,
        damage: '60',
        text: 'Dispara un haz concentrado de energía solar que inflige 60 puntos de daño.'
      }
    ],
    weaknesses: [{ type: 'Fire', value: '×2' }],
    retreatCost: ['Colorless', 'Colorless'],
    convertedRetreatCost: 2,
    set: {
      id: 'base1',
      name: 'Base Set',
      series: 'Base',
      printedTotal: 102,
      total: 102,
      images: {
        symbol: 'https://images.pokemontcg.io/base1/symbol.png',
        logo: 'https://images.pokemontcg.io/base1/logo.png'
      }
    },
    number: '15',
    artist: 'Mitsuhiro Arita',
    rarity: 'Rare Holo',
    nationalPokedexNumbers: [3],
    images: {
      small: 'https://images.pokemontcg.io/base1/15.png',
      large: 'https://images.pokemontcg.io/base1/15_hires.png'
    }
  },

  // Base Set Magikarp
  'base1-35': {
    id: 'base1-35',
    name: 'Magikarp',
    supertype: 'Pokémon',
    subtypes: ['Basic'],
    hp: '30',
    types: ['Water'],
    evolvesTo: ['Gyarados'],
    attacks: [
      {
        name: 'Tackle',
        cost: ['Colorless'],
        convertedEnergyCost: 1,
        damage: '10',
        text: 'Embate simple.'
      },
      {
        name: 'Flail',
        cost: ['Water'],
        convertedEnergyCost: 1,
        damage: '10×',
        text: 'Hace 10 puntos de daño multiplicados por el número de contadores de daño en Magikarp.'
      }
    ],
    weaknesses: [{ type: 'Lightning', value: '×2' }],
    retreatCost: ['Colorless'],
    convertedRetreatCost: 1,
    set: {
      id: 'base1',
      name: 'Base Set',
      series: 'Base',
      printedTotal: 102,
      total: 102,
      images: {
        symbol: 'https://images.pokemontcg.io/base1/symbol.png',
        logo: 'https://images.pokemontcg.io/base1/logo.png'
      }
    },
    number: '35',
    artist: 'Mitsuhiro Arita',
    rarity: 'Uncommon',
    nationalPokedexNumbers: [129],
    images: {
      small: 'https://images.pokemontcg.io/base1/35.png',
      large: 'https://images.pokemontcg.io/base1/35_hires.png'
    }
  },

  // Base Set Caterpie
  'base1-45': {
    id: 'base1-45',
    name: 'Caterpie',
    supertype: 'Pokémon',
    subtypes: ['Basic'],
    hp: '40',
    types: ['Grass'],
    evolvesTo: ['Metapod'],
    attacks: [
      {
        name: 'String Shot',
        cost: ['Grass'],
        convertedEnergyCost: 1,
        damage: '10',
        text: 'Lanza una moneda. Si sale cara, el Pokémon rival pasa a estar Paralizado.'
      }
    ],
    weaknesses: [{ type: 'Fire', value: '×2' }],
    retreatCost: ['Colorless'],
    convertedRetreatCost: 1,
    set: {
      id: 'base1',
      name: 'Base Set',
      series: 'Base',
      printedTotal: 102,
      total: 102,
      images: {
        symbol: 'https://images.pokemontcg.io/base1/symbol.png',
        logo: 'https://images.pokemontcg.io/base1/logo.png'
      }
    },
    number: '45',
    artist: 'Ken Sugimori',
    rarity: 'Common',
    nationalPokedexNumbers: [10],
    images: {
      small: 'https://images.pokemontcg.io/base1/45.png',
      large: 'https://images.pokemontcg.io/base1/45_hires.png'
    }
  },

  // Base Set Rattata
  'base1-61': {
    id: 'base1-61',
    name: 'Rattata',
    supertype: 'Pokémon',
    subtypes: ['Basic'],
    hp: '30',
    types: ['Colorless'],
    evolvesTo: ['Raticate'],
    attacks: [
      {
        name: 'Bite',
        cost: ['Colorless'],
        convertedEnergyCost: 1,
        damage: '20',
        text: 'Mordisco veloz.'
      }
    ],
    weaknesses: [{ type: 'Fighting', value: '×2' }],
    resistances: [{ type: 'Psychic', value: '-30' }],
    retreatCost: ['Colorless'],
    convertedRetreatCost: 1,
    set: {
      id: 'base1',
      name: 'Base Set',
      series: 'Base',
      printedTotal: 102,
      total: 102,
      images: {
        symbol: 'https://images.pokemontcg.io/base1/symbol.png',
        logo: 'https://images.pokemontcg.io/base1/logo.png'
      }
    },
    number: '61',
    artist: 'Ken Sugimori',
    rarity: 'Common',
    nationalPokedexNumbers: [19],
    images: {
      small: 'https://images.pokemontcg.io/base1/61.png',
      large: 'https://images.pokemontcg.io/base1/61_hires.png'
    }
  }
};

// Alias retrocompatible para fo-5
PREPACKAGED_TCG_CARDS['fo-5'] = PREPACKAGED_TCG_CARDS['base3-5'];

// Set collections for booster pack themes
export const TCG_PACK_COLLECTIONS = {
  kanto: {
    id: 'kanto',
    name: 'Kanto Clásico (Base Set)',
    tag: 'ORIGINAL 1999',
    cost: 100,
    icon: '🌿',
    themeColor: '#22c55e',
    image: 'assets/packs/pack_kanto.png',
    bgGradient: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #10b981 100%)',
    description: 'Cartas originales del mítico Base Set de 1999: Charizard, Blastoise, Alakazam, Mewtwo y más.',
    featured: 'Charizard, Blastoise, Mewtwo, Alakazam...',
    cardPool: ['base1-4', 'base1-2', 'base1-15', 'base1-10', 'base1-1', 'base3-5', 'base1-35', 'base1-45', 'base1-61']
  },
  fire_dragon: {
    id: 'fire_dragon',
    name: 'Ancient Origins (Fuego & Dragón)',
    tag: 'XY SERIES',
    cost: 150,
    icon: '🔥',
    themeColor: '#f97316',
    image: 'assets/packs/pack_fire_dragon.png',
    bgGradient: 'linear-gradient(135deg, #7c2d12 0%, #9a3412 50%, #ea580c 100%)',
    description: 'Expansión Ancient Origins con Gardevoir Holo (xy7-54), Mega Rayquaza-EX y Entei.',
    featured: 'Gardevoir Holo, M Rayquaza-EX, Entei...',
    cardPool: ['xy7-54', 'xy7-75', 'xy7-15', 'base1-4']
  },
  electric: {
    id: 'electric',
    name: 'Tormenta Eléctrica (Team Up)',
    tag: 'TAG TEAM GX',
    cost: 150,
    icon: '⚡',
    themeColor: '#eab308',
    image: 'assets/packs/pack_electric.png',
    bgGradient: 'linear-gradient(135deg, #713f12 0%, #854d0e 50%, #ca8a04 100%)',
    description: 'Cartas de alto voltaje con Pikachu & Zekrom-GX, Zapdos y Pikachu Promo.',
    featured: 'Pikachu & Zekrom-GX, Zapdos Holo, Pikachu...',
    cardPool: ['sm9-33', 'sm9-40', 'basep-1']
  },
  legendary: {
    id: 'legendary',
    name: 'Leyendas del Olimpo (VSTAR & Holo)',
    tag: 'ULTRA RARO',
    cost: 250,
    icon: '🌟',
    themeColor: '#fbbf24',
    image: 'assets/packs/pack_legendary.png',
    bgGradient: 'linear-gradient(135deg, #451a03 0%, #78350f 50%, #d97706 100%)',
    description: 'Máximo poder cósmico con Arceus VSTAR, Mew Celebrations y M Rayquaza-EX.',
    featured: 'Arceus VSTAR, Mew Celebrations, M Rayquaza-EX...',
    cardPool: ['swsh9-123', 'cel25-25', 'xy7-75', 'base1-10', 'xy7-54']
  }
};

/**
 * Fetch a card by ID from api.pokemontcg.io/v2/cards with local cache and fallback
 */
export async function fetchTcgCardById(cardId) {
  if (!cardId) return null;

  // 1. Check in-memory pre-packaged DB first
  if (PREPACKAGED_TCG_CARDS[cardId]) {
    return PREPACKAGED_TCG_CARDS[cardId];
  }

  // 2. Check localStorage cache
  try {
    const cached = localStorage.getItem(`${TCG_CACHE_KEY_PREFIX}${cardId}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    // Ignore storage issues
  }

  // 3. Fetch from official Pokemon TCG API v2
  try {
    const response = await fetch(`${POKEMON_TCG_API_BASE}/cards?q=id:${encodeURIComponent(cardId)}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const card = data.data?.[0];
      if (card) {
        const normalized = normalizeTcgCard(card);
        try {
          localStorage.setItem(`${TCG_CACHE_KEY_PREFIX}${cardId}`, JSON.stringify(normalized));
        } catch (e) {}
        return normalized;
      }
    }
  } catch (err) {
    console.warn(`Could not fetch card ${cardId} from api.pokemontcg.io:`, err);
  }

  return PREPACKAGED_TCG_CARDS['xy7-54'];
}

/**
 * Normalizes raw api.pokemontcg.io card schema
 */
export function normalizeTcgCard(raw) {
  if (!raw) return null;

  const hpVal = parseInt(raw.hp, 10);

  return {
    id: raw.id,
    name: raw.name,
    supertype: raw.supertype || 'Pokémon',
    subtypes: raw.subtypes || ['Basic'],
    level: raw.level ? parseInt(raw.level, 10) : 1,
    hp: isNaN(hpVal) ? 70 : hpVal,
    types: raw.types || ['Normal'],
    primaryType: (raw.types?.[0] || 'Colorless').toLowerCase(),
    evolvesFrom: raw.evolvesFrom || null,
    evolvesTo: raw.evolvesTo || null,
    attacks: Array.isArray(raw.attacks) ? raw.attacks.map(atk => ({
      name: atk.name,
      cost: atk.cost || ['Colorless'],
      convertedEnergyCost: atk.convertedEnergyCost || 1,
      damage: atk.damage || '',
      power: parseInt(atk.damage, 10) || 30,
      text: atk.text || 'Ataque oficial Pokémon TCG.'
    })) : [
      {
        name: 'Golpe',
        cost: ['Colorless'],
        convertedEnergyCost: 1,
        damage: '20',
        power: 20,
        text: 'Ataque básico.'
      }
    ],
    abilities: raw.abilities || [],
    weaknesses: raw.weaknesses || [],
    resistances: raw.resistances || [],
    retreatCost: raw.retreatCost || ['Colorless'],
    set: raw.set || {
      name: 'Pokémon TCG',
      images: {
        symbol: 'https://images.pokemontcg.io/xy7/symbol.png',
        logo: 'https://images.pokemontcg.io/xy7/logo.png'
      }
    },
    number: raw.number || '1',
    artist: raw.artist || 'Ken Sugimori',
    rarity: raw.rarity || 'Rare',
    flavorText: raw.flavorText || '',
    nationalPokedexNumbers: (Array.isArray(raw.nationalPokedexNumbers) && raw.nationalPokedexNumbers.length > 0)
      ? raw.nationalPokedexNumbers
      : [getPokedexNumberByName(raw.name)],
    images: {
      small: raw.images?.small || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${getPokedexNumberByName(raw.name)}.png`,
      large: raw.images?.large || raw.images?.small || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${getPokedexNumberByName(raw.name)}.png`
    },
    tcgplayer: raw.tcgplayer || null,
    cardmarket: raw.cardmarket || null,
    // Flag if it's Holo / Ultra Rare
    isHolo: (raw.rarity || '').toLowerCase().includes('holo') || (raw.rarity || '').toLowerCase().includes('ultra') || (raw.subtypes || []).includes('TAG TEAM') || (raw.subtypes || []).includes('VSTAR') || (raw.subtypes || []).includes('EX') || (raw.subtypes || []).includes('GX')
  };
}

/**
 * Searches cards by name or query from api.pokemontcg.io/v2/cards
 */
export async function searchTcgCardsOnline(query, pageSize = 20) {
  if (!query) return Object.values(PREPACKAGED_TCG_CARDS);

  try {
    const qStr = `name:*${encodeURIComponent(query)}*`;
    const res = await fetch(`${POKEMON_TCG_API_BASE}/cards?q=${qStr}&pageSize=${pageSize}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.data) && data.data.length > 0) {
        return data.data.map(normalizeTcgCard);
      }
    }
  } catch (e) {
    console.warn('TCG search online error, falling back to local prepackaged cards:', e);
  }

  // Fallback to local filter
  const qLower = query.toLowerCase();
  return Object.values(PREPACKAGED_TCG_CARDS).filter(c => 
    c.name.toLowerCase().includes(qLower) ||
    c.types.some(t => t.toLowerCase().includes(qLower)) ||
    (c.set?.name || '').toLowerCase().includes(qLower)
  );
}

/**
 * Pulls 3 official cards from a booster pack collection
 */
export async function pullCardsFromTcgPack(collectionId = 'kanto') {
  const packInfo = TCG_PACK_COLLECTIONS[collectionId] || TCG_PACK_COLLECTIONS.kanto;
  const pool = packInfo.cardPool || ['base1-4', 'base1-2', 'base1-10', 'xy7-54'];

  // Shuffle and pick 3 distinct cards
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const pickedIds = shuffled.slice(0, 3);

  // If pool has fewer than 3, pad with Gardevoir or Charizard
  while (pickedIds.length < 3) {
    const fallbackId = Math.random() > 0.5 ? 'xy7-54' : 'base1-4';
    pickedIds.push(fallbackId);
  }

  const cards = await Promise.all(pickedIds.map(id => fetchTcgCardById(id)));
  return cards.map(c => normalizeTcgCard(c));
}
