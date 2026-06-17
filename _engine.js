/* ==========================================================================
   SITG Reference Library - search engine and renderer
   Ranking: 0 exact term, 1 prefix, 2 contains, 3 definition, 4 fuzzy.
   LEXDATA (array of [term, definition, categoryCode]) is concatenated above.
   ========================================================================== */
(function () {
  "use strict";

  var CATS = {
    gov: "Governance", risk: "Risk", res: "Resilience", trans: "Transformation",
    cyber: "Cyber Security", cloud: "Cloud", id: "Identity", crypto: "Cryptography",
    pqc: "PQC", quantum: "Quantum", ai: "AI", std: "Standards", arch: "Architecture"
  };
  var CAT_ORDER = ["gov","risk","res","trans","cyber","cloud","id","crypto","pqc","quantum","ai","std","arch"];

  // ---------- Build index ----------
  var RAW = (typeof LEXDATA !== "undefined") ? LEXDATA : [];
  var ITEMS = [];
  var seen = Object.create(null);

  for (var i = 0; i < RAW.length; i++) {
    var r = RAW[i];
    if (!r || !r[0]) continue;
    var name = ("" + r[0]).trim();
    var key = name.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    var def = ("" + (r[1] || "")).trim();
    var cat = r[2] && CATS[r[2]] ? r[2] : "gov";
    var lname = key;
    var aliases = [];
    var pm = name.match(/\(([^)]+)\)/g);
    if (pm) {
      for (var p = 0; p < pm.length; p++) aliases.push(pm[p].replace(/[()]/g, "").trim().toLowerCase());
      var lead = name.replace(/\s*\([^)]*\)/g, "").trim().toLowerCase();
      if (lead && lead !== lname) aliases.push(lead);
    }
    var first = name.charAt(0).toUpperCase();
    if (!/[A-Z]/.test(first)) first = "#";
    ITEMS.push({
      name: name, def: def, cat: cat, lname: lname, ldef: def.toLowerCase(),
      aliases: aliases, tokens: lname.split(/[^a-z0-9]+/).filter(Boolean), first: first
    });
  }
  ITEMS.sort(function (a, b) { return a.lname < b.lname ? -1 : a.lname > b.lname ? 1 : 0; });

  // ---------- Helpers ----------
  function stem(s) {
    if (s.length > 4 && /ies$/.test(s)) return s.slice(0, -3) + "y";
    if (s.length > 4 && /(sses|shes|ches|xes)$/.test(s)) return s.slice(0, -2);
    if (s.length > 3 && /s$/.test(s) && !/ss$/.test(s)) return s.slice(0, -1);
    return s;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    var al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    if (Math.abs(al - bl) > 3) return 99;
    var prev = new Array(bl + 1), cur = new Array(bl + 1), j;
    for (j = 0; j <= bl; j++) prev[j] = j;
    for (var ii = 1; ii <= al; ii++) {
      cur[0] = ii;
      var ca = a.charCodeAt(ii - 1);
      for (j = 1; j <= bl; j++) {
        var cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
        var del = prev[j] + 1, ins = cur[j - 1] + 1, sub = prev[j - 1] + cost;
        cur[j] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[bl];
  }

  function fuzzyTol(len) { return len <= 4 ? 1 : len <= 7 ? 2 : 3; }

  function rankItem(it, q, qStem) {
    var name = it.lname, a;
    if (name === q || name === qStem) return { rank: 0, score: 0 };
    for (a = 0; a < it.aliases.length; a++)
      if (it.aliases[a] === q || it.aliases[a] === qStem) return { rank: 0, score: 0 };
    if (name.indexOf(q) === 0) return { rank: 1, score: name.length };
    for (a = 0; a < it.aliases.length; a++)
      if (it.aliases[a].indexOf(q) === 0) return { rank: 1, score: it.aliases[a].length + 0.5 };
    var pos = name.indexOf(q);
    if (pos === -1) {
      for (a = 0; a < it.aliases.length; a++) { if (it.aliases[a].indexOf(q) !== -1) { pos = 0.9; break; } }
    }
    if (pos !== -1) {
      var wordStart = pos === 0 || name.charAt(pos - 1) === " ";
      return { rank: 2, score: (wordStart ? 0 : 100) + pos };
    }
    var dpos = it.ldef.indexOf(q);
    if (dpos === -1 && qStem !== q) dpos = it.ldef.indexOf(qStem);
    if (dpos !== -1) return { rank: 3, score: dpos };
    if (q.length >= 4) {
      var tol = fuzzyTol(q.length), best = levenshtein(q, name);
      if (best > tol) {
        for (var tk2 = 0; tk2 < it.tokens.length; tk2++) {
          var tk = it.tokens[tk2];
          if (Math.abs(tk.length - q.length) > tol) continue;
          var d = levenshtein(q, tk);
          if (d < best) best = d;
          if (best <= 1) break;
        }
      }
      if (best <= tol) return { rank: 4, score: best * 50 + name.length };
    }
    return null;
  }

  function search(q, catFilter) {
    var nq = q.trim().toLowerCase().replace(/\s+/g, " ");
    var out = [], k, it, rk;
    if (!nq) {
      for (k = 0; k < ITEMS.length; k++) {
        it = ITEMS[k];
        if (catFilter && it.cat !== catFilter) continue;
        out.push({ it: it, rank: 9, score: 0 });
      }
      return out;
    }
    var qStem = stem(nq);
    for (k = 0; k < ITEMS.length; k++) {
      it = ITEMS[k];
      if (catFilter && it.cat !== catFilter) continue;
      rk = rankItem(it, nq, qStem);
      if (rk) out.push({ it: it, rank: rk.rank, score: rk.score });
    }
    out.sort(function (a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.score !== b.score) return a.score - b.score;
      return a.it.lname < b.it.lname ? -1 : a.it.lname > b.it.lname ? 1 : 0;
    });
    return out;
  }

  // ---------- Rendering ----------
  var resultsEl, countEl, azNav;
  var ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  function esc(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;";
    });
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    var lt = text.toLowerCase(), lq = q.toLowerCase(), qs = stem(lq);
    var pos = lt.indexOf(lq), term = lq;
    if (pos === -1 && qs !== lq) { pos = lt.indexOf(qs); term = qs; }
    if (pos === -1) return esc(text);
    return esc(text.slice(0, pos)) + "<mark>" + esc(text.slice(pos, pos + term.length)) +
           "</mark>" + esc(text.slice(pos + term.length));
  }

  function render(list, q) {
    var frag = document.createDocumentFragment();
    var present = Object.create(null);
    var curLetter = null, body = null;
    for (var i = 0; i < list.length; i++) {
      var it = list[i].it, L = it.first;
      present[L] = true;
      if (L !== curLetter) {
        curLetter = L;
        var group = document.createElement("section");
        group.className = "letter-group";
        group.id = "letter-" + L;
        var h = document.createElement("h2");
        h.className = "letter-heading";
        h.textContent = L;
        group.appendChild(h);
        body = document.createElement("div");
        group.appendChild(body);
        frag.appendChild(group);
      }
      var row = document.createElement("div");
      row.className = "term";
      var nm = document.createElement("div");
      nm.className = "term-name";
      nm.innerHTML = highlight(it.name, q);
      var df = document.createElement("div");
      df.className = "term-def";
      df.innerHTML = highlight(it.def, q) + '<span class="term-cat">' + esc(CATS[it.cat]) + "</span>";
      row.appendChild(nm); row.appendChild(df);
      body.appendChild(row);
    }
    resultsEl.innerHTML = "";
    if (list.length === 0) {
      var e = document.createElement("div");
      e.className = "empty";
      e.innerHTML = "<strong>No matches found</strong>Try a shorter query, a different spelling, or " +
                    '<span class="suggest" id="clear-suggest">clear the search</span>.';
      resultsEl.appendChild(e);
      var cs = document.getElementById("clear-suggest");
      if (cs) cs.addEventListener("click", clearSearch);
    } else {
      resultsEl.appendChild(frag);
    }
    updateAz(present);
  }

  function updateCount(n, q, cat) {
    var parts = "<strong>" + n.toLocaleString() + "</strong> " + (n === 1 ? "term" : "terms");
    if (q) parts += ' for "' + esc(q) + '"';
    if (cat) parts += " in " + esc(CATS[cat]);
    countEl.innerHTML = parts;
  }

  function buildAz() {
    var html = "";
    for (var i = 0; i < ALPHA.length; i++)
      html += '<a href="#letter-' + ALPHA[i] + '" data-letter="' + ALPHA[i] + '">' + ALPHA[i] + "</a>";
    azNav.innerHTML = html;
  }

  function updateAz(present) {
    var links = azNav.querySelectorAll("a");
    for (var i = 0; i < links.length; i++) {
      var L = links[i].getAttribute("data-letter");
      if (present[L]) links[i].classList.remove("disabled");
      else links[i].classList.add("disabled");
    }
  }

  // ---------- State + wiring ----------
  var searchEl, clearBtn, searchWrap, activeCat = "", debTimer = null;

  function run() {
    var q = searchEl.value;
    var list = search(q, activeCat);
    render(list, q.trim());
    updateCount(list.length, q.trim(), activeCat);
    searchWrap.classList.toggle("has-value", q.length > 0);
  }

  function debounced() {
    if (debTimer) clearTimeout(debTimer);
    debTimer = setTimeout(run, 110);
  }

  function clearSearch() {
    searchEl.value = "";
    searchWrap.classList.remove("has-value");
    searchEl.focus();
    run();
  }

  function buildFilters() {
    var box = document.getElementById("filters");
    var html = '<button class="filter-chip" data-cat="" aria-pressed="true">All</button>';
    for (var i = 0; i < CAT_ORDER.length; i++) {
      var c = CAT_ORDER[i];
      html += '<button class="filter-chip" data-cat="' + c + '" aria-pressed="false">' + CATS[c] + "</button>";
    }
    box.innerHTML = html;
    box.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-chip");
      if (!btn) return;
      activeCat = btn.getAttribute("data-cat");
      var chips = box.querySelectorAll(".filter-chip");
      for (var j = 0; j < chips.length; j++)
        chips[j].setAttribute("aria-pressed", chips[j] === btn ? "true" : "false");
      run();
    });
  }

  function injectStructuredData() {
    var terms = [], cap = Math.min(ITEMS.length, 300);
    for (var i = 0; i < cap; i++)
      terms.push({ "@type": "DefinedTerm", "name": ITEMS[i].name, "description": ITEMS[i].def });
    var data = {
      "@context": "https://schema.org", "@type": "DefinedTermSet",
      "name": "SITG Reference Library",
      "description": "Recognised terminology across cyber, risk, governance, resilience, transformation, cryptography, PKI, post-quantum cryptography and quantum security.",
      "hasDefinedTerm": terms
    };
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  }

  function initTheme() {
    var btn = document.getElementById("theme-toggle");
    var stored = null;
    try { stored = localStorage.getItem("sitg-theme"); } catch (e) {}
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored || (prefersDark ? "dark" : "light");
    apply(theme);
    btn.addEventListener("click", function () {
      theme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      apply(theme);
      try { localStorage.setItem("sitg-theme", theme); } catch (e) {}
    });
    function apply(t) {
      document.documentElement.setAttribute("data-theme", t);
      btn.textContent = t === "dark" ? "Light mode" : "Dark mode";
    }
  }

  function initToTop() {
    var btn = document.getElementById("to-top");
    window.addEventListener("scroll", function () { btn.classList.toggle("show", window.scrollY > 400); }, { passive: true });
    btn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  }

  function init() {
    resultsEl = document.getElementById("results");
    countEl = document.getElementById("result-count");
    azNav = document.getElementById("az-nav");
    searchEl = document.getElementById("search");
    clearBtn = document.getElementById("search-clear");
    searchWrap = document.getElementById("search-wrap");
    var loadingEl = document.getElementById("loading");
    if (loadingEl) loadingEl.remove();
    document.getElementById("year").textContent = new Date().getFullYear();
    buildAz();
    buildFilters();
    initTheme();
    initToTop();
    injectStructuredData();
    searchEl.addEventListener("input", debounced);
    clearBtn.addEventListener("click", clearSearch);
    searchEl.addEventListener("keydown", function (e) { if (e.key === "Escape") clearSearch(); });
    var m = location.search.match(/[?&]q=([^&]+)/);
    if (m) { try { searchEl.value = decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) {} }
    run();
  }

  // Node-only export hook for automated testing. Inert in the browser.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { search: search, rankItem: rankItem, stem: stem, levenshtein: levenshtein, ITEMS: ITEMS, CATS: CATS };
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }
})();
