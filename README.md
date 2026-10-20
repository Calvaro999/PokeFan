# PokéDex Minimal — PokeAPI v2

Una aplicación web moderna, rápida y minimalista que lista y detalla **todos los Pokémon** (1,351 Pokémon) utilizando **únicamente la API oficial de PokeAPI** (`https://pokeapi.co/api/v2/`).

---

## ✨ Características Principales

- **100% PokeAPI Oficial:** Todos los datos (nombres, IDs, tipos, estadísticas, descripciones en español, sprites animados oficiales de Showdown y sonidos/cries) provienen exclusivamente de PokeAPI.
- **Navegación Principal Simplificada:**
  - Dos botones principales de entrada: **📖 POKÉDEX** y **🃏 ZONA TCG**.
- **ZONA TCG (Cartas Oficiales con Pokémon TCG API v2):**
  - **100% Cartas Oficiales Reales (`https://api.pokemontcg.io/v2/`):** Sustitución integral de cartas sintéticas por escaneos oficiales en alta resolución (scans oficiales de Pokémon Company / Cloudflare CDN).
  - **Carta Estrella xy7-54 Gardevoir (Ancient Origins - Rare Holo):**
    - 130 PS, Habilidad *Bright Heal* (cura 20 PS al equipo) y ataque *Telekinesis* (50 PS).
    - Equipada por defecto como Líder en el podio de combate y disponible en el álbum.
  - **1. SOBRES CINEMÁTICOS TCG:**
    - 4 colecciones de sobres con carátulas foil temáticas.
    - Apertura cinemática: tirón de solapa superior con chispas, expulsión física de cartas y despliegue en abanico 3D con reverso holográfico PokéDex.
    - Revelado táctil con escaneos reales oficiales y fanfarria especial para cartas Holo y Ultra Raras.
  - **2. CREADOR DE MAZO & ÁLBUM OFICIAL (3 Ranuras + Inspector 3D HD):**
    - Mazo titular de 3 ranuras (1 Líder + 2 Apoyos) con cálculo de PS y resumen de ataques oficiales.
    - **Modal Inspector 3D Deluxe (🔍):** Visualización del escaneo HD de gran formato (`images.large`), física de inclinación 3D según el cursor, efecto de brillo tornasolado/arcoíris, descripción completa de habilidades y ataques, debilidad, resistencia, coste de retirada, artista oficial (ej. TOKIYA) y cotizaciones de mercado en tiempo real de TCGPlayer.
    - Filtros por tipo (*Hada, Fuego, Agua, Eléctrico, etc.*) y por rareza Holo.
  - **3. JUGAR BATALLA (Estadio Pokémon con Estadísticas y Ataques TCG):**
    - Combate contra rivales adaptativos utilizando las cartas oficiales seleccionadas en tu mazo.
    - Los PS de combate coinciden con los PS reales de la carta (ej. 130 PS para Gardevoir) y los ataques disponibles corresponden a sus movimientos oficiales (*Telekinesis*, *Fire Spin*, etc.).
    - Sprites animados Showdown en perspectiva de estadio y recompensas en PokéCoins por victoria.
- **Arquitectura Modular (ES Modules):**
  - `js/tcg-api.js`: Cliente oficial de Pokémon TCG API v2 (`https://api.pokemontcg.io/v2/cards/`), base de datos preempaquetada para arranque instantáneo (incluyendo `xy7-54`, `base1-4`, `basep-1`, etc.), caché en `localStorage` y buscador online.
  - `js/api.js`: Servicio de PokeAPI para los 1,351 Pokémon, sprites animados Showdown y cries oficiales.
  - `js/collection.js`: Gestor de monedas PokéCoins, álbum de cartas oficiales TCG, mazo titular e inventario de caramelos.
  - `js/deckbuilder.js`: Podio interactivo de mazo de 3 cartas, álbum filtrable y modal inspector 3D en alta definición.
  - `js/card3d.js`: Física de giro 3D holográfico, reflejo dinámico con prisma especular y seguimiento del puntero del ratón.
  - `js/games/packs.js`: Apertura cinemática 3D de sobres oficiales TCG con rasgado y revelación.
  - `js/games/battle.js`: Motor de combate en estadio adaptado al mazo oficial de cartas TCG.
  - `js/audio.js`: Sintetizador Web Audio (monedas, rasgado, choques, fanfarria) y gritos de PokeAPI.
  - `js/main.js`: Enrutador principal entre Pokédex y ZONA TCG.
- **Selector de Vista Minimalista (en la barra superior):**
  - 🎨 **Clásico 1996 (Ken Sugimori):** Ilustraciones originales vintage de acuarela de Ken Sugimori en alta resolución (Generación 1 y 2 clásicas).
  - 🖼️ **Render Moderno (3D):** Arte digital 3D oficial moderno.
  - ✨ **Todos Shinys:** Muestra automáticamente todas las tarjetas en versión Variocolor (Shiny).
  - 🎬 **Animados:** Sprites animados oficiales de Showdown para todos los Pokémon.
  - ✨🎬 **Shiny Animado:** Sprites animados en versión Variocolor.
- **Animación Suave en cada Pokémon (Hover):**
  - Al pasar el cursor por cualquier tarjeta, el Pokémon flota y se eleva suavemente con un resplandor ambiental tintado con el color característico de su tipo principal, manteniendo una respuesta rápida y sin vibraciones.
- **Diseño Minimalista & Glassmorphism:** Fondo oscuro elegante con iluminación ambiental difusa, desenfoque de cristal (backdrop-filter) y paleta de colores curada para cada tipo de Pokémon.
- **Rendimiento a 60 FPS:** 
  - Micro-animaciones en tarjetas al pasar el cursor.
  - Efectos visuales de carga (esqueleto animado / shimmer).
  - Barras de estadísticas animadas con cálculo de Total de Estadísticas Base (BST).
  - Ondas de audio animadas sincronizadas con el sonido del grito oficial.
- **Búsqueda Instantánea:** Búsqueda en tiempo real por nombre o número de Pokédex (`/` o `Ctrl+K` para enfocar).
- **Filtros por Generación:** Desde Generación 1 (Kanto) hasta Generación 9 (Paldea) y Formas Especiales / Megas / Variantes (1026+).
- **Filtros por Tipo:** Botones interactivos con colores e indicadores luminosos para los 18 tipos de Pokémon.
- **Modal Interactivo:**
  - Selector de vistas: Arte oficial en HD, forma Variocolor (Shiny ✨) y sprite animado Showdown 🎬.
  - Reproductor del grito oficial (PokeAPI Cries) con visualizador.
  - Línea evolutiva interactiva con navegación directa entre etapas.
  - Navegación entre Pokémon anterior y siguiente (teclas `←` y `→`, `Esc` para cerrar).
- **Sistema de Favoritos:** Guarda tus Pokémon preferidos localmente en el navegador (`localStorage`) con botón de filtro rápido.
- **Scroll Infinito Fluido:** Carga progresiva por lotes con `IntersectionObserver` para un rendimiento óptimo.

---

## 🚀 Cómo Ejecutar

El servidor ya está activo en `http://localhost:3000/`.

Si deseas iniciar el servidor manualmente en el futuro:
```bash
node server.js
```
O simplemente abre el archivo [index.html](file:///c:/Users/alvrm/OneDrive/Desktop/Recursos%20Clase/Matias/Pokemon/index.html) directamente en tu navegador habitual (Google Chrome, Microsoft Edge, etc.).

---

## ⌨️ Atajos de Teclado
- `/`: Activar la barra de búsqueda rápidamente.
- `Esc`: Cerrar el modal de detalles.
- `←` / `→`: Navegar al Pokémon anterior o siguiente en el modal.
- `Enter` / `Espacio`: Abrir los detalles del Pokémon seleccionado.
