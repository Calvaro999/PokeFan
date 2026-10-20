/**
 * MODULE: Memory Match Card Game (js/games/memory.js)
 * 3D card flipping memory game with PokeAPI official artwork, cries, and streak bonuses
 */

import { fetchRandomPokemonDeck, TYPE_TRANSLATIONS } from '../api.js';
import { playPokemonCry, playCardFlipSound, playSuccessChime, playVictoryFanfare } from '../audio.js';

export class MemoryGame {
  constructor(containerEl) {
    this.container = containerEl;
    this.pairCount = 6;
    this.cards = [];
    this.flippedCards = [];
    this.matchedPairs = 0;
    this.moves = 0;
    this.score = 0;
    this.streak = 0;
    this.timerSeconds = 0;
    this.timerInterval = null;
    this.isLocked = false;
  }

  async init(pairCount = 6) {
    this.pairCount = pairCount;
    this.renderLoading();
    await this.startNewGame();
  }

  renderLoading() {
    this.container.innerHTML = `
      <div class="game-loading-box">
        <div class="spinner-circle"></div>
        <p>Mezclando cartas de PokeAPI...</p>
      </div>
    `;
  }

  async startNewGame() {
    this.clearInterval();
    this.matchedPairs = 0;
    this.moves = 0;
    this.score = 0;
    this.streak = 0;
    this.timerSeconds = 0;
    this.flippedCards = [];
    this.isLocked = false;

    // Fetch random unique Pokémon for pairs from PokeAPI
    const basePokemon = await fetchRandomPokemonDeck(this.pairCount);

    // Duplicate each Pokémon to create pairs
    const deck = [];
    basePokemon.forEach((pokemon, idx) => {
      deck.push({ id: `card-${idx}-a`, pokemon, pairId: pokemon.id });
      deck.push({ id: `card-${idx}-b`, pokemon, pairId: pokemon.id });
    });

    // Shuffle deck
    this.cards = deck.sort(() => Math.random() - 0.5);

    this.renderGame();
    this.startTimer();
  }

  clearInterval() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  startTimer() {
    this.clearInterval();
    this.timerInterval = setInterval(() => {
      this.timerSeconds++;
      const timerEl = this.container.querySelector('#memoryTimerDisplay');
      if (timerEl) {
        const mins = String(Math.floor(this.timerSeconds / 60)).padStart(2, '0');
        const secs = String(this.timerSeconds % 60).padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
      }
    }, 1000);
  }

  renderGame() {
    this.container.innerHTML = `
      <div class="memory-game-wrap">
        <!-- Controls & Status Bar -->
        <div class="memory-toolbar">
          <div class="difficulty-picker">
            <span class="toolbar-label">Dificultad:</span>
            <button class="diff-btn ${this.pairCount === 6 ? 'active' : ''}" data-pairs="6">Fácil (6)</button>
            <button class="diff-btn ${this.pairCount === 8 ? 'active' : ''}" data-pairs="8">Medio (8)</button>
            <button class="diff-btn ${this.pairCount === 10 ? 'active' : ''}" data-pairs="10">Difícil (10)</button>
          </div>

          <div class="memory-stats-group">
            <div class="memory-stat-pill">
              <span>⏱️ Tiempo:</span>
              <strong id="memoryTimerDisplay">00:00</strong>
            </div>
            <div class="memory-stat-pill">
              <span>🎯 Movimientos:</span>
              <strong id="memoryMovesDisplay">${this.moves}</strong>
            </div>
            <div class="memory-stat-pill score-pill">
              <span>⭐ Puntos:</span>
              <strong id="memoryScoreDisplay">${this.score}</strong>
            </div>
            <button class="btn-secondary restart-btn" id="memoryRestartBtn" title="Reiniciar partida">
              🔄 Reiniciar
            </button>
          </div>
        </div>

        <!-- 3D Card Grid -->
        <div class="memory-grid pairs-${this.pairCount}" id="memoryGrid">
          ${this.cards.map((c, i) => this.renderMemoryCardMarkup(c, i)).join('')}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  renderMemoryCardMarkup(cardObj, index) {
    const p = cardObj.pokemon;
    const primaryType = p.types[0] || 'normal';
    const typeInfo = TYPE_TRANSLATIONS[primaryType] || { es: primaryType, color: '#38bdf8' };

    return `
      <div class="memory-card" data-index="${index}" data-pair="${cardObj.pairId}" style="--type-glow: ${typeInfo.color};">
        <div class="memory-card-inner">
          <!-- Back face (Cover / Pokéball) -->
          <div class="memory-card-back">
            <div class="memory-pokeball-art">
              <div class="mini-pokeball"></div>
            </div>
          </div>

          <!-- Front face (Revealed Pokémon) -->
          <div class="memory-card-front" style="border-color: ${typeInfo.color}66;">
            <div class="memory-card-type-dot" style="background: ${typeInfo.color};"></div>
            <img src="${p.sprites.artwork}" alt="${p.name}" class="memory-card-img" onerror="this.src='${p.sprites.default}'" />
            <div class="memory-card-name">${p.name.replace('-', ' ')}</div>
          </div>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    // Difficulty buttons
    this.container.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pairs = parseInt(btn.dataset.pairs, 10);
        this.init(pairs);
      });
    });

    // Restart button
    const restartBtn = this.container.querySelector('#memoryRestartBtn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.startNewGame());
    }

    // Card click event
    const cardEls = this.container.querySelectorAll('.memory-card');
    cardEls.forEach(cardEl => {
      cardEl.addEventListener('click', () => {
        if (this.isLocked) return;
        if (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;

        this.flipCard(cardEl);
      });
    });
  }

  flipCard(cardEl) {
    playCardFlipSound();
    cardEl.classList.add('flipped');
    this.flippedCards.push(cardEl);

    if (this.flippedCards.length === 2) {
      this.moves++;
      this.container.querySelector('#memoryMovesDisplay').textContent = this.moves;
      this.checkMatch();
    }
  }

  async checkMatch() {
    this.isLocked = true;
    const [card1, card2] = this.flippedCards;
    const pair1 = card1.dataset.pair;
    const pair2 = card2.dataset.pair;

    if (pair1 === pair2) {
      // MATCH FOUND!
      this.matchedPairs++;
      this.streak++;
      const gainedScore = 100 + (this.streak * 25);
      this.score += gainedScore;
      this.container.querySelector('#memoryScoreDisplay').textContent = this.score;

      // Visual success & Sound
      card1.classList.add('matched');
      card2.classList.add('matched');

      playSuccessChime();
      playPokemonCry(parseInt(pair1, 10));

      this.flippedCards = [];
      this.isLocked = false;

      // Check if won
      if (this.matchedPairs === this.pairCount) {
        this.clearInterval();
        await new Promise(r => setTimeout(r, 600));
        this.renderVictory();
      }
    } else {
      // MISMATCH
      this.streak = 0;
      await new Promise(r => setTimeout(r, 900));

      card1.classList.remove('flipped');
      card2.classList.remove('flipped');

      this.flippedCards = [];
      this.isLocked = false;
    }
  }

  renderVictory() {
    playVictoryFanfare();
    const mins = Math.floor(this.timerSeconds / 60);
    const secs = this.timerSeconds % 60;
    const formattedTime = `${mins}m ${secs}s`;

    this.container.innerHTML = `
      <div class="memory-victory-box">
        <div class="victory-icon">🎉</div>
        <h2>¡ENHORABUENA!</h2>
        <p class="victory-subtitle">Has encontrado todas las parejas de Pokémon</p>
        
        <div class="victory-stats-grid">
          <div class="v-stat">
            <span class="v-label">Tiempo</span>
            <strong class="v-val">${formattedTime}</strong>
          </div>
          <div class="v-stat">
            <span class="v-label">Movimientos</span>
            <strong class="v-val">${this.moves}</strong>
          </div>
          <div class="v-stat">
            <span class="v-label">Puntuación</span>
            <strong class="v-val">${this.score} pts</strong>
          </div>
        </div>

        <button class="btn-primary" id="playAgainBtn">Jugar de Nuevo 🔄</button>
      </div>
    `;

    this.container.querySelector('#playAgainBtn').addEventListener('click', () => {
      this.init(this.pairCount);
    });
  }
}
