const DATASET_FILES = {
  fineweb: "./data/fineweb-edu-sample.json",
  dolma: "./data/dolma-education-sample.json",
};

const tintPalettes = {
  fineweb: [
    ["#91f8d3", "#ffd38b", "#6db4ff", "#f7a6ca"],
    ["#f4d35e", "#ee964b", "#0d3b66", "#9cd08f"],
    ["#c3f0ca", "#7ab6ff", "#f7b7a3", "#fef3c7"],
  ],
  dolma: [
    ["#b8c1ff", "#ffb07c", "#f3d47f", "#7fd6ff"],
    ["#9da6ff", "#ff8f5b", "#dde4ff", "#8df0d1"],
    ["#d8b4ff", "#ffcc80", "#8ab4ff", "#ffd6e7"],
  ],
};

const state = {
  datasets: {},
  activeDatasetKey: "fineweb",
  indexPool: [],
  isPaused: false,
  speed: 1,
  density: 3,
  showLabels: true,
  showInterface: true,
  spawnTimer: null,
  paletteIndex: 0,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  restoreInterfaceOnFullscreenExit: false,
};

const hud = document.querySelector(".hud");
const footerNote = document.querySelector(".footer-note");
const stream = document.querySelector("#stream");
const datasetName = document.querySelector("#dataset-name");
const datasetSummary = document.querySelector("#dataset-summary");
const datasetLicense = document.querySelector("#dataset-license");
const datasetSize = document.querySelector("#dataset-size");
const datasetSource = document.querySelector("#dataset-source");
const datasetLabelNote = document.querySelector("#dataset-label-note");
const footerText = document.querySelector("#footer-text");
const speedInput = document.querySelector("#speed");
const densityInput = document.querySelector("#density");
const labelsToggle = document.querySelector("#labels-toggle");
const uiToggleButton = document.querySelector("#ui-toggle-button");
const toggleButton = document.querySelector("#toggle");
const shuffleButton = document.querySelector("#shuffle");
const fullscreenButton = document.querySelector("#fullscreen-toggle");
const dockUiToggle = document.querySelector("#dock-ui-toggle");
const dockFullscreenToggle = document.querySelector("#dock-fullscreen-toggle");
const datasetButtons = [...document.querySelectorAll(".dataset-toggle")];

async function init() {
  try {
    const entries = await Promise.all(
      Object.entries(DATASET_FILES).map(async ([key, file]) => {
        const response = await fetch(file);
        if (!response.ok) {
          throw new Error(`Could not load ${key} cached sample.`);
        }

        return [key, await response.json()];
      }),
    );

    state.datasets = Object.fromEntries(entries);
    setupControls();
    applyLabelsVisibility();
    setInterfaceVisibility(state.showInterface);
    activateDataset(state.activeDatasetKey);
  } catch (error) {
    datasetName.textContent = "Dataset unavailable";
    datasetSummary.textContent = error.message;
    footerText.textContent =
      "One or more cached dataset files could not be loaded. Check the JSON paths and try again.";
  }
}

function setupControls() {
  speedInput.addEventListener("input", () => {
    state.speed = Number(speedInput.value);
  });

  densityInput.addEventListener("input", () => {
    state.density = Number(densityInput.value);
    restartSpawnLoop();
  });

  labelsToggle.addEventListener("change", () => {
    state.showLabels = labelsToggle.checked;
    applyLabelsVisibility();

    if (state.reducedMotion) {
      renderStaticGallery();
    }
  });

  uiToggleButton.addEventListener("click", () => {
    setInterfaceVisibility(!state.showInterface);
  });

  toggleButton.addEventListener("click", () => {
    state.isPaused = !state.isPaused;
    document.body.classList.toggle("paused", state.isPaused);
    toggleButton.textContent = state.isPaused ? "Resume" : "Pause";

    if (state.isPaused) {
      clearTimeout(state.spawnTimer);
      state.spawnTimer = null;
    } else {
      scheduleSpawnLoop();
    }
  });

  shuffleButton.addEventListener("click", () => {
    const palettes = currentPalettes();
    state.paletteIndex = (state.paletteIndex + 1) % palettes.length;
  });

  fullscreenButton.addEventListener("click", () => {
    void toggleFullscreenMode();
  });

  dockUiToggle.addEventListener("click", () => {
    setInterfaceVisibility(!state.showInterface);
  });

  dockFullscreenToggle.addEventListener("click", () => {
    void toggleFullscreenMode();
  });

  datasetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextKey = button.dataset.dataset;
      if (nextKey === state.activeDatasetKey) {
        return;
      }

      state.activeDatasetKey = nextKey;
      state.paletteIndex = 0;
      activateDataset(nextKey);
    });
  });

  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("keydown", handleGlobalKeydown);
  syncFullscreenControls();
}

function activateDataset(key) {
  document.body.dataset.dataset = key;
  syncDatasetButtons();
  hydrateMeta(currentDataset().dataset);
  resetPool();
  clearStream();

  if (state.reducedMotion) {
    renderStaticGallery();
    return;
  }

  primeStage();
  restartSpawnLoop();
}

function hydrateMeta(dataset) {
  datasetName.textContent = dataset.name;
  datasetSummary.textContent = dataset.rationale;
  datasetLicense.textContent = dataset.license;
  datasetSize.textContent = `${currentDataset().samples.length} cached excerpts`;
  datasetSource.textContent = dataset.shortSource;
  datasetLabelNote.textContent = dataset.label_note;
  footerText.textContent = dataset.curator_note;
}

function syncDatasetButtons() {
  datasetButtons.forEach((button) => {
    const isActive = button.dataset.dataset === state.activeDatasetKey;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function applyLabelsVisibility() {
  document.body.classList.toggle("labels-hidden", !state.showLabels);
}

function setInterfaceVisibility(nextVisible, options = {}) {
  state.showInterface = nextVisible;

  if (!options.keepFullscreenRestoreFlag) {
    state.restoreInterfaceOnFullscreenExit = false;
  }

  document.body.classList.toggle("ui-hidden", !nextVisible);
  hud.setAttribute("aria-hidden", String(!nextVisible));
  footerNote.setAttribute("aria-hidden", String(!nextVisible));
  hud.inert = !nextVisible;
  footerNote.inert = !nextVisible;

  if (
    !nextVisible &&
    document.activeElement instanceof HTMLElement &&
    (hud.contains(document.activeElement) || footerNote.contains(document.activeElement))
  ) {
    document.activeElement.blur();
  }

  syncInterfaceControls();
  syncFullscreenControls();
}

function syncInterfaceControls() {
  const nextLabel = state.showInterface ? "Hide Interface" : "Show Interface";
  uiToggleButton.textContent = nextLabel;
  dockUiToggle.textContent = nextLabel;
  uiToggleButton.setAttribute("aria-pressed", String(!state.showInterface));
  dockUiToggle.setAttribute("aria-pressed", String(!state.showInterface));
}

function isFullscreenSupported() {
  return document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === "function";
}

function isFullscreenActive() {
  return Boolean(document.fullscreenElement);
}

function syncFullscreenControls() {
  const supported = isFullscreenSupported();
  const active = isFullscreenActive();

  fullscreenButton.hidden = !supported;
  dockFullscreenToggle.hidden = !supported || !active;

  if (!supported) {
    return;
  }

  const nextLabel = active ? "Exit Fullscreen" : "Go Fullscreen";
  fullscreenButton.textContent = nextLabel;
  fullscreenButton.setAttribute("aria-pressed", String(active));
  dockFullscreenToggle.setAttribute("aria-pressed", String(active));
}

async function toggleFullscreenMode() {
  if (!isFullscreenSupported()) {
    return;
  }

  try {
    if (isFullscreenActive()) {
      await document.exitFullscreen();
      return;
    }

    await document.documentElement.requestFullscreen();

    if (state.showInterface) {
      state.restoreInterfaceOnFullscreenExit = true;
      setInterfaceVisibility(false, { keepFullscreenRestoreFlag: true });
    }
  } catch (error) {
    console.error("Fullscreen toggle failed.", error);
  } finally {
    syncFullscreenControls();
  }
}

function handleFullscreenChange() {
  if (!isFullscreenActive() && state.restoreInterfaceOnFullscreenExit) {
    setInterfaceVisibility(true);
  } else {
    syncFullscreenControls();
  }
}

function handleGlobalKeydown(event) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "BUTTON" ||
      target.isContentEditable)
  ) {
    return;
  }

  if (event.key.toLowerCase() === "i") {
    event.preventDefault();
    setInterfaceVisibility(!state.showInterface);
  }

  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    void toggleFullscreenMode();
  }
}

function currentDataset() {
  return state.datasets[state.activeDatasetKey];
}

function currentSamples() {
  return currentDataset().samples;
}

function currentPalettes() {
  return tintPalettes[state.activeDatasetKey];
}

function resetPool() {
  state.indexPool = shuffle(currentSamples().map((_, index) => index));
}

function clearStream() {
  stream.innerHTML = "";
}

function primeStage() {
  const starterCount = Math.min(Math.max(4, state.density + 1), currentSamples().length);
  for (let index = 0; index < starterCount; index += 1) {
    spawnFragment();
  }
}

function scheduleSpawnLoop() {
  if (state.reducedMotion || state.isPaused || state.spawnTimer) {
    return;
  }

  const spawn = () => {
    state.spawnTimer = null;

    if (state.isPaused) {
      return;
    }

    spawnFragment();

    const delay = Math.max(650, 2100 - state.density * 260);
    state.spawnTimer = window.setTimeout(spawn, delay);
  };

  state.spawnTimer = window.setTimeout(spawn, 950);
}

function restartSpawnLoop() {
  clearTimeout(state.spawnTimer);
  state.spawnTimer = null;

  if (!state.reducedMotion && !state.isPaused) {
    scheduleSpawnLoop();
  }
}

function spawnFragment() {
  if (!state.indexPool.length) {
    resetPool();
  }

  const nextIndex = state.indexPool.pop();
  const sample = currentSamples()[nextIndex];
  const palettes = currentPalettes();
  const palette = palettes[state.paletteIndex % palettes.length];
  const tint = palette[Math.floor(Math.random() * palette.length)];
  const fragment = document.createElement("article");
  const width = randomBetween(270, 430);
  const left = randomBetween(2, 74);
  const driftX = `${randomBetween(-14, 14)}vw`;
  const duration = `${(randomBetween(18, 34) / state.speed).toFixed(1)}s`;
  const tilt = `${randomBetween(-5, 5)}deg`;

  fragment.className = "fragment";
  fragment.style.left = `${left}vw`;
  fragment.style.width = `${Math.min(width, window.innerWidth - 28)}px`;
  fragment.style.setProperty("--drift-x", driftX);
  fragment.style.setProperty("--fragment-tint", tint);
  fragment.style.setProperty("--tilt", tilt);
  fragment.style.animationDuration = duration;
  fragment.innerHTML = buildFragmentMarkup(sample);

  fragment.addEventListener("animationend", () => {
    fragment.remove();
  });

  stream.appendChild(fragment);

  const fragments = stream.querySelectorAll(".fragment");
  if (fragments.length > 22) {
    fragments[0].remove();
  }
}

function buildFragmentMarkup(sample) {
  const chips = [
    currentDataset().dataset.short_tag,
    sample.domain,
    formatCategory(sample.category),
    sample.source_type,
  ]
    .filter(Boolean)
    .map((value) => `<span class="fragment-chip">${escapeHtml(value)}</span>`)
    .join("");

  const footerBits = [
    formatLength(sample),
    sample.dump,
    sample.year,
    sample.label_basis,
  ]
    .filter(Boolean)
    .map((value) => `<span>${escapeHtml(value)}</span>`)
    .join("");

  return `
    <div class="label-cluster">${chips}</div>
    <p class="fragment-text">${escapeHtml(sample.excerpt)}</p>
    <div class="fragment-footer">${footerBits}</div>
    <p class="fragment-source">${escapeHtml(sample.url)}</p>
  `;
}

function renderStaticGallery() {
  clearStream();

  currentSamples().forEach((sample, index) => {
    const fragment = document.createElement("article");
    const palettes = currentPalettes();
    const palette = palettes[index % palettes.length];
    const tint = palette[index % palette.length];

    fragment.className = "fragment";
    fragment.style.setProperty("--fragment-tint", tint);
    fragment.style.setProperty("--tilt", "0deg");
    fragment.innerHTML = buildFragmentMarkup(sample);
    stream.appendChild(fragment);
  });
}

function formatLength(sample) {
  if (sample.count && sample.unit) {
    return `${sample.count} ${sample.unit}`;
  }

  if (sample.token_count) {
    return `${sample.token_count} tokens`;
  }

  return "";
}

function formatCategory(category) {
  if (!category) {
    return "";
  }

  return category.replace("__label__", "").replaceAll("_", " ");
}

function shuffle(values) {
  const clone = [...values];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[next]] = [clone[next], clone[index]];
  }

  return clone;
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

init();
