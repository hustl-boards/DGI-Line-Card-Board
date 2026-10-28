/* DGI office TV board.
   One interval drives the clock, scene changes, and the four-hour reload.
   Scenes are built once. Later ticks only toggle classes and text. */
(function () {
  if (window.__dgiBoardStarted) return;
  window.__dgiBoardStarted = true;

  var SCENE_MS = readInterval();
  var TICK_MS = 500;
  var RELOAD_MS = 4 * 60 * 60 * 1000;
  var freeze = query("freeze") === "1";
  var booted = Date.now();
  var nextSceneAt = booted + SCENE_MS;
  var timer = null;
  var failures = 0;
  var gaveUp = false;
  var reloading = false;
  var current = 0;
  var sceneNodes = [];
  var sceneLabels = [];

  var LINES = [
    { id: "rms", name: "RMS", wall: "RMS", src: "assets/img/rms.jpg", alt: "RMS, Rainwater Management Solutions", lines: [], blurb: "Rainwater Management Solutions", note: "" },
    { id: "multi", name: "Multi Fittings", wall: "Multi Fittings", src: "assets/img/multi-fittings.png", alt: "Multi Fittings", lines: [], blurb: "", note: "" },
    { id: "matco", name: "Matco-Norca", wall: "Matco-Norca", src: "assets/img/matco-norca.png", alt: "Matco-Norca", lines: ["Valves", "Fittings", "Nipples", "Faucets", "Plumbing Specialties"], blurb: "", note: "New England (minus CT), Vermont and Upstate NY only." },
    { id: "elbi", name: "Elbi", wall: "Elbi", src: "assets/img/elbi.jpg", alt: "Elbi of America", lines: [], blurb: "Residential and commercial products. Founded in 1990.", note: "" },
    { id: "zurn", name: "Zurn", wall: "Zurn", src: "assets/img/zurn.png", alt: "Zurn", lines: ["Faucets", "Fixtures", "Flush Valves", "Green Turtle", "Just Sinks", "Soap Dispensers", "Traps & Supplies", "Wade Specification Drainage", "World Dryer", "Zurn Wilkins", "Zurn Specification Drainage"], blurb: "", note: "" },
    { id: "elkay", name: "Elkay", wall: "Elkay", src: "assets/img/elkay.jpg", alt: "Elkay", lines: ["Drinking Solutions", "Faucets", "Sinks (Variety)", "Water Filtration System"], blurb: "", note: "" },
    { id: "fayette", name: "Fayette Pipe", wall: "Fayette Pipe", src: "assets/img/fayette.jpg", alt: "Fayette Pipe", lines: [], blurb: "Veteran-owned. Standard pipe, threading, and specifications.", note: "" },
    { id: "klein", name: "Klein Tools", wall: "Klein Tools", src: "assets/img/klein.png", alt: "Klein Tools", lines: [], blurb: "", note: "" },
    { id: "armacell", name: "Armacell", wall: "Armacell", src: "assets/img/armacell.jpg", alt: "Armacell", lines: [], blurb: "", note: "" },
    { id: "oetiker", name: "Oetiker", wall: "Oetiker", src: "assets/img/oetiker.svg", alt: "Oetiker", lines: [], blurb: "Connecting solutions. Founded in Switzerland in 1942.", note: "" },
    { id: "dgi", name: "DGI Products", wall: "DGI Products", src: "assets/img/dgi-initials.png", alt: "David Gooding, Inc. products", lines: ["Brass Fittings & Nipples", "Chrome Fittings & Nipples", "Imported Malleable Fittings", "Monoflow Tees", "Cast Iron Baseboard", "Cast Iron Radiators", "Copper Tubing Types K, L & M", "ACR & Coils", "Line Sets"], blurb: "", note: "" },
    { id: "ocs", name: "OCS Industries", wall: "OCS Industries", src: "assets/img/ocs.jpg", alt: "OCS Industries", lines: ["Cast Iron Radiator & Baseboard", "Convector Cabinets", "Convection Heating Needs"], blurb: "", note: "" },
    { id: "heatflo", name: "Heat-Flo", wall: "Heat-Flo", src: "assets/img/heat-flo.jpg", alt: "Heat-Flo", lines: ["Indirect Water Heaters", "Dual Coil Indirects", "Hydronic Buffer Tanks", "Hot Water Storage Tanks", "Indirects with Electric Backups"], blurb: "", note: "" },
    { id: "armstrong", name: "Armstrong Fluid Technology", wall: "Armstrong", src: "assets/img/armstrong.jpg", alt: "Armstrong", lines: ["Integrated Pumping System Controls", "Domestic Water Booster Systems", "Design Envelope Technology", "Air & Expansion Controls", "Heat Exchangers", "Replacement Parts", "CBV\u2019s, FTV\u2019s & Suction Guides", "Residential & Commercial Pumps"], blurb: "", note: "" },
    { id: "navien", name: "Navien", wall: "Navien", src: "assets/img/navien.jpg", alt: "Navien", lines: ["On-Demand Hot Water Heater", "Heat & Hot Water Combi Unit", "Commercial/Residential Water Heater Model", "Condensing Hydronic Furnace"], blurb: "", note: "" },
    { id: "ideal", name: "Ideal-Tridon", wall: "Ideal-Tridon", src: "assets/img/ideal-tridon.jpg", alt: "Ideal Tridon", lines: ["No Hub Couplings", "CISPI Standard Two Band", "Mid-Range Four Band", "Heavy-Duty Four Band", "\u201CClassic\u201D Import"], blurb: "", note: "" },
    { id: "fernco", name: "Fernco", wall: "Fernco", src: "assets/img/fernco.jpg", alt: "Fernco", lines: ["Flexible Couplings"], blurb: "", note: "" },
    { id: "panasonic", name: "Panasonic", wall: "Panasonic", src: "assets/img/panasonic.svg", alt: "Panasonic", lines: ["Full Line of Energy Star Products", "Advanced Ventilating Fans", "Whole-House Ventilation Systems"], blurb: "", note: "" },
    { id: "roth", name: "Roth", wall: "Roth", src: "assets/img/roth.png", alt: "Roth", lines: ["Radiant & Snowmelt", "Oil Storage Tanks"], blurb: "", note: "United States and Canada since 1995." },
    { id: "endot", name: "Endot", wall: "Endot", src: "assets/img/endot.jpg", alt: "Endot", lines: ["Endopoly Pipe", "Endopure Water Pipe", "Endotrace", "Yellow Gas Pipe", "Green Sewer Pipe"], blurb: "", note: "" },
    { id: "nibco", name: "NIBCO", wall: "NIBCO", src: "assets/img/nibco.jpg", alt: "NIBCO", lines: ["Copper Fittings", "PVC/ABS DWV Fittings", "Schedule 40 Pressure Fittings", "PVC80 & CPVC80 Fittings & Valves", "Bronze & Iron Valves", "Ball & Butterfly Valves", "Fire Protection & Irrigation Valves", "NIBCO Press 1/2\" to 4\" Fittings, Valves & Tools", "NIBCO PEX Piping Systems"], blurb: "", note: "" }
  ];

  var GROUPS = [
    { key: "heating", title: "Heating", ids: ["matco", "elbi", "fayette", "armacell", "dgi", "ocs", "heatflo", "armstrong", "navien"] },
    { key: "plumbing", title: "Plumbing", ids: ["rms", "multi", "matco", "elbi", "zurn", "elkay", "ideal", "fernco", "panasonic", "roth", "endot", "nibco"] },
    { key: "waterworks", title: "Waterworks", ids: ["rms", "multi", "matco", "fernco", "endot"] },
    { key: "showroom", title: "Showroom", ids: ["panasonic"] }
  ];

  var byId = {};
  var i;
  for (i = 0; i < LINES.length; i++) byId[LINES[i].id] = LINES[i];

  function query(name) {
    var parts = location.search.length > 1 ? location.search.substring(1).split("&") : [];
    var n;
    for (n = 0; n < parts.length; n++) {
      var pair = parts[n].split("=");
      var key = decodeURIComponent(pair[0] || "");
      if (key === name) return decodeURIComponent(pair[1] || "");
    }
    return "";
  }

  function readInterval() {
    var n = parseInt(query("interval"), 10);
    if (!n || isNaN(n)) return 14000;
    if (n < 300) return 300;
    if (n > 60000) return 60000;
    return n;
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function lineImage(line) {
    var image = document.createElement("img");
    image.src = line.src;
    image.alt = line.alt || line.name;
    return image;
  }

  function logoCard(line) {
    var card = el("div", "logo-card");
    var frame = el("div", "logo-frame");
    frame.appendChild(lineImage(line));
    card.appendChild(frame);
    card.appendChild(el("p", "logo-name", line.wall || line.name));
    return card;
  }

  function lineList(line) {
    var count = line.lines.length;
    var cls = "line-list";
    if (count <= 4) cls += " few";
    else if (count >= 9) cls += " dense";
    var list = el("ul", cls);
    var n;
    for (n = 0; n < count; n++) list.appendChild(el("li", "", line.lines[n]));
    return list;
  }

  function spotInner(line, kicker) {
    var wrap = el("div", "spot");
    var card = el("div", "spot-card");
    card.appendChild(lineImage(line));
    wrap.appendChild(card);
    var copy = el("div", "spot-copy");
    copy.appendChild(el("p", "kicker", kicker));
    copy.appendChild(el("h2", "", line.name));
    if (line.note) copy.appendChild(el("p", "note", line.note));
    if (line.lines.length) copy.appendChild(lineList(line));
    else if (line.blurb) copy.appendChild(el("p", "blurb", line.blurb));
    wrap.appendChild(copy);
    return wrap;
  }

  function categoryInner(group) {
    var wrap = el("div", "cat count-" + group.ids.length);
    var head = el("div", "cat-head");
    head.appendChild(el("p", "kicker", "New England Line Card"));
    head.appendChild(el("h2", "", group.title));
    wrap.appendChild(head);
    var grid = el("div", "cat-grid");
    var n;
    for (n = 0; n < group.ids.length; n++) grid.appendChild(logoCard(byId[group.ids[n]]));
    wrap.appendChild(grid);
    return wrap;
  }

  function welcomeInner() {
    var wrap = el("div", "welcome");
    var mark = el("div", "initials");
    var image = document.createElement("img");
    image.src = "assets/img/dgi-initials.png";
    image.alt = "David Gooding, Inc.";
    mark.appendChild(image);
    wrap.appendChild(mark);
    wrap.appendChild(el("p", "kicker", "Manufacturers\u2019 Representative  \u00b7  Founded 1980"));
    wrap.appendChild(el("h1", "", "David Gooding, Inc."));
    wrap.appendChild(el("p", "trades", "Plumbing  \u00b7  Heating  \u00b7  Waterworks"));
    wrap.appendChild(el("p", "motto-xl", "We Care."));
    wrap.appendChild(el("p", "welcome-foot", "New England   \u00b7   New York   \u00b7   Mid-Atlantic"));
    return wrap;
  }

  function wallInner() {
    var wrap = el("div", "wall");
    var head = el("div", "cat-head");
    head.appendChild(el("p", "kicker", "New England Line Card"));
    head.appendChild(el("h2", "", "The Line Card"));
    wrap.appendChild(head);
    var grid = el("div", "wall-grid");
    var n;
    for (n = 0; n < LINES.length; n++) grid.appendChild(logoCard(LINES[n]));
    wrap.appendChild(grid);
    return wrap;
  }

  function territoryInner() {
    var wrap = el("div", "territory");
    var head = el("div", "cat-head");
    head.appendChild(el("p", "kicker", "Where we work"));
    head.appendChild(el("h2", "", "Our Territory"));
    wrap.appendChild(head);
    wrap.appendChild(el("p", "blurb", "Sales representation throughout New England, New York, and the Mid-Atlantic."));
    var regions = el("div", "region-row");
    regions.appendChild(region("New England", "Headquarters in Brockton, Massachusetts"));
    regions.appendChild(region("New York", "Sales representation"));
    regions.appendChild(region("Mid-Atlantic", "Sales representation"));
    wrap.appendChild(regions);
    var locs = el("div", "loc-row");
    locs.appendChild(locationCard("Headquarters & Distribution Center", "Brockton, MA", "173 Spark Street\nBrockton, MA 02302", "508-894-2000"));
    locs.appendChild(locationCard("Distribution Center", "Salem, NH", "51 Northwestern Drive, Ste C\nSalem, NH 03079", "603-458-6100"));
    wrap.appendChild(locs);
    return wrap;
  }

  function region(title, detail) {
    var card = el("div", "region");
    card.appendChild(el("h3", "", title));
    card.appendChild(el("p", "", detail));
    return card;
  }

  function locationCard(kind, city, address, phone) {
    var card = el("div", "loc");
    card.appendChild(el("div", "label", kind));
    card.appendChild(el("h3", "", city));
    var addr = el("p", "addr");
    addr.textContent = address;
    addr.style.whiteSpace = "pre-line";
    card.appendChild(addr);
    card.appendChild(el("p", "phone", phone));
    return card;
  }

  function contactInner() {
    var wrap = el("div", "contact");
    var head = el("div", "cat-head");
    head.appendChild(el("p", "kicker", "David Gooding, Inc."));
    head.appendChild(el("h2", "", "Contact"));
    wrap.appendChild(head);
    var grid = el("div", "contact-grid");
    grid.appendChild(phoneTile("Brockton", "508-894-2000", "173 Spark Street"));
    grid.appendChild(phoneTile("Inside Sales", "1-800-836-3441", ""));
    grid.appendChild(phoneTile("Salem, NH", "603-458-6100", "Distribution center"));
    grid.appendChild(infoTile("Email", "insidesales@goodingd.com", true));
    grid.appendChild(infoTile("Web", "goodingd.com", false));
    wrap.appendChild(grid);
    var hours = el("div", "hours-banner");
    var left = el("div", "");
    left.appendChild(el("div", "when", "Customer service"));
    left.appendChild(el("strong", "", "Monday\u2013Friday  7AM\u20135PM"));
    hours.appendChild(left);
    hours.appendChild(el("div", "closed", "Saturday & Sunday  Closed"));
    wrap.appendChild(hours);
    return wrap;
  }

  function phoneTile(label, number, detail) {
    var tile = el("div", "tile");
    tile.appendChild(el("div", "label", label));
    tile.appendChild(el("div", "big", number));
    if (detail) tile.appendChild(el("div", "small", detail));
    return tile;
  }

  function infoTile(label, value, wide) {
    var tile = el("div", wide ? "tile light span-2" : "tile light");
    tile.appendChild(el("div", "label", label));
    tile.appendChild(el("div", "big", value));
    return tile;
  }

  function addScene(key, label, inner) {
    var section = el("section", "scene");
    section.setAttribute("data-scene", key);
    section.setAttribute("aria-label", label);
    section.appendChild(inner);
    sceneNodes.push(section);
    sceneLabels.push(label);
    return section;
  }

  function build() {
    var main = document.getElementById("stage-main");
    var frag = document.createDocumentFragment();
    var n;
    frag.appendChild(addScene("welcome", "Welcome", welcomeInner()));
    frag.appendChild(addScene("wall", "The Line Card", wallInner()));
    for (n = 0; n < GROUPS.length; n++) {
      if (GROUPS[n].ids.length === 1) {
        frag.appendChild(addScene(GROUPS[n].key, GROUPS[n].title, spotInner(byId[GROUPS[n].ids[0]], "Showroom")));
      } else {
        frag.appendChild(addScene(GROUPS[n].key, GROUPS[n].title, categoryInner(GROUPS[n])));
      }
    }
    for (n = 0; n < LINES.length; n++) {
      frag.appendChild(addScene(LINES[n].id, LINES[n].name, spotInner(LINES[n], "New England Line")));
    }
    frag.appendChild(addScene("territory", "Territory", territoryInner()));
    frag.appendChild(addScene("contact", "Contact", contactInner()));
    main.appendChild(frag);
  }

  function two(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function restartProgress() {
    var bar = document.getElementById("progress-bar");
    if (!bar) return;
    if (freeze) {
      bar.style.animation = "none";
      bar.style.width = "100%";
      return;
    }
    bar.style.animation = "none";
    bar.style.width = "0";
    void bar.offsetWidth;
    bar.style.animation = "fill " + SCENE_MS + "ms linear forwards";
  }

  function activate(index) {
    if (!sceneNodes.length) return;
    if (index < 0) index = 0;
    if (index >= sceneNodes.length) index = 0;
    var prev = sceneNodes[current];
    if (prev) {
      prev.classList.remove("is-active");
      prev.setAttribute("aria-hidden", "true");
    }
    current = index;
    sceneNodes[current].classList.add("is-active");
    sceneNodes[current].setAttribute("aria-hidden", "false");
    var label = document.getElementById("scene-label");
    var count = document.getElementById("scene-count");
    if (label) label.textContent = sceneLabels[current];
    if (count) count.textContent = two(current + 1) + "  /  " + two(sceneNodes.length);
    restartProgress();
    nextSceneAt = Date.now() + SCENE_MS;
  }

  function advance() {
    activate((current + 1) % sceneNodes.length);
  }

  function updateClock() {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var ampm = h >= 12 ? "PM" : "AM";
    var hr = h % 12;
    if (hr === 0) hr = 12;
    var mm = m < 10 ? "0" + m : "" + m;
    var timeText = hr + ":" + mm + " " + ampm;
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var dateText = days[now.getDay()] + ", " + months[now.getMonth()] + " " + now.getDate();
    var timeNode = document.getElementById("clock-time");
    var dateNode = document.getElementById("clock-date");
    if (timeNode && timeNode.textContent !== timeText) timeNode.textContent = timeText;
    if (dateNode && dateNode.textContent !== dateText) dateNode.textContent = dateText;
  }

  function fit() {
    var stage = document.getElementById("stage");
    if (!stage) return;
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    if (!isFinite(s) || s <= 0) s = 1;
    stage.style.transform = "scale(" + s + ")";
  }

  function safeReload() {
    if (reloading) return;
    reloading = true;
    location.reload();
  }

  function stormList() {
    try {
      var now = Date.now();
      var raw = sessionStorage.getItem("dgi-board-reloads") || "[]";
      var list = JSON.parse(raw);
      if (!list || !list.length) return [];
      var kept = [];
      var n;
      for (n = 0; n < list.length; n++) {
        if (now - list[n] < 120000) kept.push(list[n]);
      }
      return kept;
    } catch (err) {
      return [];
    }
  }

  function tooManyReloads() {
    return stormList().length >= 3;
  }

  function markReload() {
    try {
      var list = stormList();
      list.push(Date.now());
      sessionStorage.setItem("dgi-board-reloads", JSON.stringify(list));
    } catch (err) {}
  }

  function noteFailure() {
    failures += 1;
    if (failures < 3) {
      try { activate(current || 0); } catch (err) {}
      return;
    }
    if (tooManyReloads()) {
      gaveUp = true;
      try { activate(0); } catch (err2) {}
      return;
    }
    markReload();
    safeReload();
  }

  function startIndex() {
    var raw = query("scene");
    if (!raw) return 0;
    var asNumber = parseInt(raw, 10);
    if (!isNaN(asNumber) && String(asNumber) === String(raw)) {
      if (asNumber < 0) return 0;
      if (asNumber >= sceneNodes.length) return sceneNodes.length - 1;
      return asNumber;
    }
    var key = raw.toLowerCase();
    var n;
    for (n = 0; n < sceneNodes.length; n++) {
      if (sceneNodes[n].getAttribute("data-scene") === key) return n;
    }
    return 0;
  }

  function tick() {
    if (gaveUp) {
      try { updateClock(); } catch (err) {}
      return;
    }
    try {
      var now = Date.now();
      if (!freeze && now - booted >= RELOAD_MS) {
        safeReload();
        return;
      }
      updateClock();
      if (!freeze && now >= nextSceneAt) advance();
    } catch (err) {
      noteFailure();
    }
  }

  function boot() {
    build();
    var style = document.createElement("style");
    style.textContent = "@keyframes fill { from { width: 0; } to { width: 100%; } }";
    document.head.appendChild(style);
    fit();
    updateClock();
    activate(startIndex());
    if (timer === null) timer = setInterval(tick, TICK_MS);
    window.addEventListener("resize", fit);
    window.addEventListener("error", noteFailure);
    window.addEventListener("unhandledrejection", noteFailure);
    window.__dgiBoard = {
      sceneCount: sceneNodes.length,
      sceneMs: SCENE_MS,
      get index() { return current; },
      get label() { return sceneLabels[current]; },
      get errors() { return failures; },
      get nodes() { return document.getElementsByTagName("*").length; }
    };
  }

  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  } catch (err) {
    noteFailure();
  }
})();
