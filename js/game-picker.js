/* Reusable, accessible board-game search and selection UI. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GamePicker = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const FALLBACK_IMAGE = "assets/images/event-placeholder.webp";

  function imageUrl(game, large) {
    if (!game) return FALLBACK_IMAGE;
    return (large ? game.IMAGE_URL : game.THUMBNAIL_URL) || game.THUMBNAIL_URL || game.IMAGE_URL || FALLBACK_IMAGE;
  }

  function range(min, max, unit) {
    const low = Number(min);
    const high = Number(max);
    if (!low && !high) return "";
    return `${low || high}${high && high !== low ? `–${high}` : ""} ${unit}`;
  }

  function compactMeta(game) {
    return [range(game && game.MIN_PLAYERS, game && game.MAX_PLAYERS, "players"), range(game && game.MIN_PLAYTIME, game && game.MAX_PLAYTIME, "min")].filter(Boolean);
  }

  function rating(game) {
    const value = Number(game && game.AVERAGE_RATING);
    return value ? `★ ${value.toFixed(1)}` : "";
  }

  function debounce(callback, wait) {
    let timer;
    function debounced() {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { callback.apply(null, args); }, wait);
    }
    debounced.cancel = function () { clearTimeout(timer); };
    return debounced;
  }

  function create(container, options) {
    const settings = Object.assign({
      label: "Search board games",
      placeholder: "Search board games...",
      minChars: 2,
      debounceMs: 300,
      allowClear: true,
      search: function (query) { return DB.searchGames(query, 12); }
    }, options || {});
    let selected = settings.selectedGame || null;
    let requestNumber = 0;

    container.innerHTML = `<div class="game-picker">
      <label for="${esc(settings.inputId || "gameSearch")}">${esc(settings.label)}</label>
      <div class="game-picker-search"><input id="${esc(settings.inputId || "gameSearch")}" type="search" autocomplete="off" placeholder="${esc(settings.placeholder)}" aria-controls="${esc(settings.inputId || "gameSearch")}Results" aria-expanded="false"><span class="game-picker-spinner" hidden aria-hidden="true"></span></div>
      <div class="game-picker-status subtle" role="status" aria-live="polite">Search for a board game</div>
      <div class="game-picker-results" id="${esc(settings.inputId || "gameSearch")}Results" role="listbox" hidden></div>
      <div class="game-picker-selected"></div>
    </div>`;

    const input = container.querySelector("input");
    const results = container.querySelector(".game-picker-results");
    const status = container.querySelector(".game-picker-status");
    const spinner = container.querySelector(".game-picker-spinner");
    const selectedWrap = container.querySelector(".game-picker-selected");

    function fallbackImage(event) {
      if (event.target.dataset.fallbackApplied) return;
      event.target.dataset.fallbackApplied = "true";
      event.target.src = FALLBACK_IMAGE;
    }

    function renderSelected() {
      if (!selected) {
        selectedWrap.innerHTML = "";
        selectedWrap.hidden = true;
        return;
      }
      const meta = compactMeta(selected);
      selectedWrap.hidden = false;
      selectedWrap.innerHTML = `<article class="selected-game-card"><img src="${esc(imageUrl(selected))}" alt="${esc(selected.GAME_NAME)} cover"><div><strong>${esc(selected.GAME_NAME)}</strong><small>${esc(meta.join(" · ") || selected.CATEGORY || "Board game")}</small>${rating(selected) ? `<small>${esc(rating(selected))}</small>` : ""}</div>${settings.allowClear ? '<button class="btn secondary small game-picker-clear" type="button" aria-label="Remove selected game">Remove</button>' : ""}</article>`;
      const image = selectedWrap.querySelector("img");
      if (image) image.addEventListener("error", fallbackImage);
      const clear = selectedWrap.querySelector(".game-picker-clear");
      if (clear) clear.addEventListener("click", function () {
        const previous = selected;
        selected = null;
        renderSelected();
        if (settings.onClear) settings.onClear(previous);
        input.focus();
      });
    }

    function closeResults() {
      results.hidden = true;
      input.setAttribute("aria-expanded", "false");
    }

    function renderResults(games) {
      if (!games.length) {
        results.innerHTML = "";
        closeResults();
        status.textContent = "No games found";
        return;
      }
      status.textContent = `${games.length} game${games.length === 1 ? "" : "s"} found`;
      results.innerHTML = games.map(function (game, index) {
        const meta = compactMeta(game);
        return `<button class="game-search-result" type="button" role="option" data-index="${index}"><img src="${esc(imageUrl(game))}" alt=""><span><strong>${esc(game.GAME_NAME)}</strong><small>${esc(meta.join(" · ") || game.CATEGORY || "Board game")}</small>${rating(game) ? `<small>${esc(rating(game))}</small>` : ""}</span></button>`;
      }).join("");
      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
      results.querySelectorAll("img").forEach(function (image) { image.addEventListener("error", fallbackImage); });
      results.querySelectorAll(".game-search-result").forEach(function (button) {
        button.addEventListener("click", function () {
          selected = games[Number(button.dataset.index)];
          input.value = "";
          closeResults();
          status.textContent = `${selected.GAME_NAME} selected`;
          renderSelected();
          if (settings.onSelect) settings.onSelect(selected);
        });
      });
    }

    async function runSearch(query) {
      const currentRequest = ++requestNumber;
      spinner.hidden = false;
      status.textContent = "Searching...";
      closeResults();
      try {
        const games = await settings.search(query);
        if (currentRequest === requestNumber) renderResults(Array.isArray(games) ? games : []);
      } catch (_) {
        if (currentRequest === requestNumber) {
          results.innerHTML = "";
          closeResults();
          status.textContent = "Unable to load games. Try again.";
        }
      } finally {
        if (currentRequest === requestNumber) spinner.hidden = true;
      }
    }

    const scheduleSearch = debounce(runSearch, settings.debounceMs);

    input.addEventListener("input", function () {
      scheduleSearch.cancel();
      requestNumber += 1;
      spinner.hidden = true;
      const query = input.value.trim();
      if (query.length < settings.minChars) {
        closeResults();
        status.textContent = query ? `Enter at least ${settings.minChars} characters` : "Search for a board game";
        return;
      }
      status.textContent = "Type to search";
      scheduleSearch(query);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeResults();
        status.textContent = selected ? `${selected.GAME_NAME} selected` : "Search for a board game";
      }
      if (event.key === "ArrowDown" && !results.hidden) {
        event.preventDefault();
        const first = results.querySelector("button");
        if (first) first.focus();
      }
    });
    results.addEventListener("keydown", function (event) {
      const buttons = Array.from(results.querySelectorAll("button"));
      const index = buttons.indexOf(document.activeElement);
      if (event.key === "ArrowDown" && buttons[index + 1]) { event.preventDefault(); buttons[index + 1].focus(); }
      if (event.key === "ArrowUp") { event.preventDefault(); (buttons[index - 1] || input).focus(); }
      if (event.key === "Escape") { event.preventDefault(); closeResults(); input.focus(); }
    });

    renderSelected();
    return {
      getSelected: function () { return selected; },
      setSelected: function (game) { selected = game || null; renderSelected(); },
      focus: function () { input.focus(); }
    };
  }

  return { create: create, imageUrl: imageUrl, compactMeta: compactMeta, rating: rating, range: range, debounce: debounce };
});
