const DATASET_FILES = {
  fineweb: "./data/fineweb-edu-sample.json",
  dolma: "./data/dolma-education-sample.json",
  oasst: "./data/oasst1-post-training-sample.json",
};

const STREAMS = {
  pretraining: {
    label: "Pre-training",
    shortLabel: "Pre",
    texture: "web-scale text",
    trace: "domains + tokens",
    defaultDataset: "fineweb",
    datasetKeys: ["fineweb", "dolma"],
    note:
      "Pre-training data is broad, messy, and mixed: the model learns next-token patterns from many kinds of text before it is tuned to act like an assistant.",
  },
  posttraining: {
    label: "Post-training",
    shortLabel: "Post",
    texture: "human feedback",
    trace: "roles + ratings",
    defaultDataset: "oasst",
    datasetKeys: ["oasst"],
    note:
      "Post-training data is narrower and more intentional: prompts, replies, ratings, and preferences used to shape how a base model behaves.",
  },
};

const tintPalettes = {
  fineweb: [
    ["#18f5c6", "#ffde59", "#46a7ff", "#ff4fb8"],
    ["#d6ff4f", "#ff7a3d", "#28e7ff", "#f7f4ea"],
    ["#8cffd2", "#72a7ff", "#ff8fcb", "#f3ff6d"],
  ],
  dolma: [
    ["#9aa7ff", "#ff8a3d", "#ffe66d", "#22d4ff"],
    ["#b36bff", "#ff5b6e", "#d8ff4f", "#8df0d1"],
    ["#d8b4ff", "#ffcc80", "#8ab4ff", "#ffd6e7"],
  ],
  oasst: [
    ["#ff4fd8", "#30f2ff", "#f6ff5c", "#9cff6a"],
    ["#ff6b2c", "#47f0a8", "#7b61ff", "#f9f871"],
    ["#f72585", "#4cc9f0", "#b9ff66", "#ffffff"],
  ],
};

const state = {
  datasets: {},
  trainingMode: "pretraining",
  activeDatasetKey: "fineweb",
  activeDatasetByMode: {
    pretraining: "fineweb",
    posttraining: "oasst",
  },
  indexPool: [],
  isPaused: false,
  speed: 1,
  density: 3,
  showLabels: true,
  showInterface: true,
  showDetails: false,
  spawnTimer: null,
  paletteIndex: 0,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  restoreInterfaceOnFullscreenExit: false,
};

const hud = document.querySelector(".hud");
const footerNote = document.querySelector(".footer-note");
const stream = document.querySelector("#stream");
const datasetSwitch = document.querySelector("#dataset-switch");
const datasetName = document.querySelector("#dataset-name");
const datasetSummary = document.querySelector("#dataset-summary");
const datasetLicense = document.querySelector("#dataset-license");
const datasetSize = document.querySelector("#dataset-size");
const datasetSource = document.querySelector("#dataset-source");
const datasetLabelNote = document.querySelector("#dataset-label-note");
const datasetCacheNote = document.querySelector("#dataset-cache-note");
const footerText = document.querySelector("#footer-text");
const phasePill = document.querySelector("#phase-pill");
const texturePill = document.querySelector("#texture-pill");
const samplePill = document.querySelector("#sample-pill");
const phaseLabel = document.querySelector("#phase-label");
const traceLabel = document.querySelector("#trace-label");
const speedInput = document.querySelector("#speed");
const densityInput = document.querySelector("#density");
const labelsToggle = document.querySelector("#labels-toggle");
const detailsToggleButton = document.querySelector("#details-toggle-button");
const uiToggleButton = document.querySelector("#ui-toggle-button");
const toggleButton = document.querySelector("#toggle");
const shuffleButton = document.querySelector("#shuffle");
const fullscreenButton = document.querySelector("#fullscreen-toggle");
const dockUiToggle = document.querySelector("#dock-ui-toggle");
const dockFullscreenToggle = document.querySelector("#dock-fullscreen-toggle");
const modeButtons = [...document.querySelectorAll(".mode-toggle")];
const aboutOpen = document.querySelector("#about-open");
const aboutClose = document.querySelector("#about-close");
const aboutModal = document.querySelector("#about-modal");

async function init() {
  try {
    const entries = await Promise.all(
      Object.entries(DATASET_FILES).map(async ([key, file]) => {
        const response = await fetch(file);
        if (!response.ok) {
          throw new Error(`Could not load the ${key} stream.`);
        }

        return [key, await response.json()];
      }),
    );

    state.datasets = Object.fromEntries(entries);
    setupControls();
    applyLabelsVisibility();
    setDetailsVisibility(state.showDetails);
    setInterfaceVisibility(state.showInterface);
    switchTrainingMode(state.trainingMode, { force: true });
  } catch (error) {
    datasetName.textContent = "Dataset unavailable";
    datasetSummary.textContent = error.message;
    datasetLabelNote.textContent = "The local sample file could not be loaded.";
    datasetCacheNote.textContent = "Check the JSON paths and rebuild the static bundle.";
    footerText.textContent =
      "One or more streams could not be loaded. Check the sample files and try again.";
  }
}

function setupControls() {
  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      switchTrainingMode(button.dataset.mode);
    });
  });

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

  detailsToggleButton.addEventListener("click", () => {
    setDetailsVisibility(!state.showDetails);
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
    document.body.style.setProperty("--palette-kick", String(Date.now()));
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

  aboutOpen.addEventListener("click", () => {
    openAboutModal();
  });

  aboutClose.addEventListener("click", () => {
    closeAboutModal();
  });

  aboutModal.addEventListener("click", (event) => {
    if (event.target === aboutModal) {
      closeAboutModal();
    }
  });

  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("keydown", handleGlobalKeydown);
  syncFullscreenControls();
}

function switchTrainingMode(nextMode, options = {}) {
  if (!STREAMS[nextMode]) {
    return;
  }

  if (!options.force && nextMode === state.trainingMode) {
    return;
  }

  state.trainingMode = nextMode;
  state.activeDatasetKey =
    state.activeDatasetByMode[nextMode] || STREAMS[nextMode].defaultDataset;
  state.paletteIndex = 0;

  document.body.dataset.mode = nextMode;
  syncModeButtons();
  renderDatasetButtons();
  activateDataset(state.activeDatasetKey);
}

function renderDatasetButtons() {
  const streamConfig = currentStreamConfig();
  const buttons = streamConfig.datasetKeys
    .map((key) => {
      const dataset = state.datasets[key]?.dataset;
      const label = dataset?.short_tag || key;
      const active = key === state.activeDatasetKey;

      return `
        <button
          class="dataset-toggle${active ? " is-active" : ""}"
          data-dataset="${escapeHtml(key)}"
          type="button"
          aria-pressed="${String(active)}"
        >
          ${escapeHtml(label)}
        </button>
      `;
    })
    .join("");

  datasetSwitch.innerHTML = buttons;

  datasetSwitch.querySelectorAll(".dataset-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const nextKey = button.dataset.dataset;
      if (nextKey === state.activeDatasetKey) {
        return;
      }

      state.paletteIndex = 0;
      activateDataset(nextKey);
    });
  });
}

function activateDataset(key) {
  const streamConfig = currentStreamConfig();
  const nextKey = streamConfig.datasetKeys.includes(key)
    ? key
    : streamConfig.defaultDataset;

  state.activeDatasetKey = nextKey;
  state.activeDatasetByMode[state.trainingMode] = nextKey;
  document.body.dataset.mode = state.trainingMode;
  document.body.dataset.dataset = nextKey;

  syncModeButtons();
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
  const samples = currentSamples();
  const streamConfig = currentStreamConfig();

  datasetName.textContent = dataset.name;
  datasetSummary.textContent = dataset.rationale;
  datasetLicense.textContent = dataset.license;
  datasetSize.textContent = `${samples.length} excerpts`;
  datasetSource.textContent = dataset.shortSource;
  datasetLabelNote.textContent = dataset.label_note;
  datasetCacheNote.textContent = `${dataset.short_tag || dataset.name} is represented here by ${samples.length} local excerpts from ${dataset.source_url || dataset.name}.`;
  footerText.textContent = dataset.curator_note;
  phasePill.textContent = dataset.phase || streamConfig.label;
  texturePill.textContent = dataset.texture || streamConfig.texture;
  samplePill.textContent = `${samples.length} excerpts`;
  phaseLabel.textContent = streamConfig.label;
  traceLabel.textContent = dataset.trace || streamConfig.trace;
}

function syncModeButtons() {
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === state.trainingMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function syncDatasetButtons() {
  datasetSwitch.querySelectorAll(".dataset-toggle").forEach((button) => {
    const isActive = button.dataset.dataset === state.activeDatasetKey;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function applyLabelsVisibility() {
  document.body.classList.toggle("labels-visible", state.showLabels);
  document.body.classList.toggle("labels-hidden", !state.showLabels);
}

function setDetailsVisibility(nextExpanded) {
  state.showDetails = nextExpanded;
  document.body.classList.toggle("details-expanded", nextExpanded);
  document.body.classList.toggle("details-collapsed", !nextExpanded);
  detailsToggleButton.textContent = nextExpanded ? "Collapse Details" : "Expand Details";
  detailsToggleButton.setAttribute("aria-pressed", String(nextExpanded));
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
  return (
    document.fullscreenEnabled &&
    typeof document.documentElement.requestFullscreen === "function"
  );
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
  dockFullscreenToggle.textContent = nextLabel;
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

function openAboutModal() {
  if (typeof aboutModal.showModal === "function") {
    aboutModal.showModal();
  } else {
    aboutModal.setAttribute("open", "");
  }
}

function closeAboutModal() {
  if (typeof aboutModal.close === "function") {
    aboutModal.close();
  } else {
    aboutModal.removeAttribute("open");
  }
}

function currentStreamConfig() {
  return STREAMS[state.trainingMode];
}

function currentDataset() {
  return state.datasets[state.activeDatasetKey];
}

function currentSamples() {
  return currentDataset().samples;
}

function currentPalettes() {
  return tintPalettes[state.activeDatasetKey] || tintPalettes.fineweb;
}

function resetPool() {
  state.indexPool = shuffle(currentSamples().map((_, index) => index));
}

function clearStream() {
  stream.innerHTML = "";
}

function primeStage() {
  const starterCount = Math.min(Math.max(4, state.density + 2), currentSamples().length);
  for (let index = 0; index < starterCount; index += 1) {
    spawnFragment({ immediate: true });
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

    const delay = Math.max(740, 2300 - state.density * 280);
    state.spawnTimer = window.setTimeout(spawn, delay);
  };

  state.spawnTimer = window.setTimeout(spawn, 860);
}

function restartSpawnLoop() {
  clearTimeout(state.spawnTimer);
  state.spawnTimer = null;

  if (!state.reducedMotion && !state.isPaused) {
    scheduleSpawnLoop();
  }
}

function spawnFragment(options = {}) {
  if (!state.indexPool.length) {
    resetPool();
  }

  const nextIndex = state.indexPool.pop();
  const sample = currentSamples()[nextIndex];
  const palettes = currentPalettes();
  const palette = palettes[state.paletteIndex % palettes.length];
  const tint = palette[Math.floor(Math.random() * palette.length)];
  const fragment = document.createElement("article");
  const width = randomBetween(300, 470);
  const left = randomBetween(2, 72);
  const driftX = `${randomBetween(-16, 16)}vw`;
  const baseDuration = state.trainingMode === "posttraining" ? 27 : 24;
  const duration = `${(randomBetween(baseDuration, baseDuration + 18) / state.speed).toFixed(1)}s`;
  const tilt = `${randomBetween(-4, 4)}deg`;
  const delay = options.immediate ? `${randomBetween(-18, -3)}s` : "0s";

  fragment.className = "fragment";
  fragment.dataset.role = sample.role || state.trainingMode;
  fragment.style.left = `${left}vw`;
  fragment.style.width = `${Math.min(width, window.innerWidth - 28)}px`;
  fragment.style.setProperty("--drift-x", driftX);
  fragment.style.setProperty("--fragment-tint", tint);
  fragment.style.setProperty("--tilt", tilt);
  fragment.style.animationDuration = duration;
  fragment.style.animationDelay = delay;
  fragment.innerHTML = buildFragmentMarkup(sample);

  fragment.addEventListener("animationend", () => {
    fragment.remove();
  });

  stream.appendChild(fragment);

  const fragments = stream.querySelectorAll(".fragment");
  if (fragments.length > 20) {
    fragments[0].remove();
  }
}

function buildFragmentMarkup(sample) {
  const dataset = currentDataset().dataset;
  const streamConfig = currentStreamConfig();
  const chips = [
    streamConfig.shortLabel,
    dataset.short_tag,
    formatRole(sample.role),
    sample.domain,
    formatCategory(sample.category),
    sample.source_type,
    sample.lang,
  ]
    .filter(Boolean)
    .map((value) => `<span class="fragment-chip">${escapeHtml(value)}</span>`)
    .join("");

  const footerBits = [
    formatLength(sample),
    sample.year,
    formatReview(sample),
    formatQuality(sample),
  ]
    .filter(Boolean)
    .map((value) => `<span>${escapeHtml(value)}</span>`)
    .join("");

  return `
    <div class="fragment-topline">
      <div class="label-cluster">${chips}</div>
      <span class="fragment-phase">${escapeHtml(dataset.phase || streamConfig.label)}</span>
    </div>
    <p class="fragment-text">${escapeHtml(sample.excerpt)}</p>
    <div class="fragment-footer">${footerBits}</div>
    <p class="fragment-source">${escapeHtml(sourceLabel(sample))}</p>
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
    fragment.dataset.role = sample.role || state.trainingMode;
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

function formatRole(role) {
  if (!role) {
    return "";
  }

  return role === "prompter" ? "human prompt" : role;
}

function formatReview(sample) {
  if (typeof sample.review_count !== "number") {
    return "";
  }

  return `${sample.review_count} reviews`;
}

function formatQuality(sample) {
  if (typeof sample.quality_score !== "number") {
    return "";
  }

  return `score ${sample.quality_score.toFixed(2)}`;
}

function sourceLabel(sample) {
  if (sample.url) {
    return sample.url;
  }

  return currentDataset().dataset.source_url || currentDataset().dataset.name;
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
