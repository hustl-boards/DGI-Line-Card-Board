/* DGI office TV board. board-version: 2
   One interval drives the clock, weather, and scene changes.
   One watchdog timeout advances a scene that stays up too long.
   The page reloads about every six hours, and only while online.
   Scenes are built once. Later ticks only toggle classes and text. */
(function () {
  if (window.__dgiBoardStarted) return;
  window.__dgiBoardStarted = true;

  var BOARD_VERSION = 2;
  var SCENE_MS = readInterval();
  var TICK_MS = 500;
  var RELOAD_MS = 6 * 60 * 60 * 1000;
  var WATCHDOG_GRACE_MS = 2500;
  var freeze = query("freeze") === "1";
  var booted = Date.now();
  var nextSceneAt = booted + SCENE_MS;
  var sceneShownAt = booted;
  var timer = null;
  var watchdog = null;
  var listening = false;
  var failures = 0;
  var gaveUp = false;
  var reloading = false;
  var current = 0;
  var sceneNodes = [];
  var sceneLabels = [];
  var timeNode = null;
  var dateNode = null;
  var labelNode = null;
  var countNode = null;
  var progressBar = null;
  var lastClockKey = "";
  var FALLBACK_SRC = "assets/img/dgi-initials.png";
  var preloaded = {};

  var WEATHER_MS = 30 * 60 * 1000;
  var WEATHER_TIMEOUT_MS = 8000;
  var WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=42.0834&longitude=-71.0184&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=3";
  var WEATHER_KEY = "dgi-board-weather";
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var clockFormat = null;
  try {
    clockFormat = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch (err) {
    clockFormat = null;
  }
  var weatherBusy = false;
  var weatherShown = false;
  var weatherStarted = 0;
  var nextWeatherAt = 0;
  var weatherAbort = null;
  var weatherToken = 0;

  var LINES = [
    { id: "rms", name: "RMS", wall: "RMS", src: "assets/img/rms.jpg", alt: "RMS, Rainwater Management Solutions", lines: [], blurb: "Rainwater Management Solutions", note: "", fact: "RMS: rainwater management solutions." },
    { id: "multi", name: "Multi Fittings", wall: "Multi Fittings", src: "assets/img/multi-fittings.png", alt: "Multi Fittings", lines: [], blurb: "", note: "", fact: "Multi Fittings: pipe fittings." },
    { id: "matco", name: "Matco-Norca", wall: "Matco-Norca", src: "assets/img/matco-norca.png", alt: "Matco-Norca", lines: ["Valves", "Fittings", "Nipples", "Faucets", "Plumbing Specialties"], blurb: "", note: "New England (minus CT), Vermont and Upstate NY only.", fact: "Matco-Norca: valves, fittings, nipples, faucets, and plumbing specialties." },
    { id: "elbi", name: "Elbi", wall: "Elbi", src: "assets/img/elbi.jpg", alt: "Elbi of America", lines: [], blurb: "Residential and commercial products. Founded in 1990.", note: "", fact: "Elbi: residential and commercial products, founded in 1990." },
    { id: "zurn", name: "Zurn", wall: "Zurn", src: "assets/img/zurn.png", alt: "Zurn", lines: ["Faucets", "Fixtures", "Flush Valves", "Green Turtle", "Just Sinks", "Soap Dispensers", "Traps & Supplies", "Wade Specification Drainage", "World Dryer", "Zurn Wilkins", "Zurn Specification Drainage"], blurb: "", note: "", fact: "Zurn: commercial plumbing fixtures, flush valves, drainage and backflow prevention." },
    { id: "elkay", name: "Elkay", wall: "Elkay", src: "assets/img/elkay.jpg", alt: "Elkay", lines: ["Drinking Solutions", "Faucets", "Sinks (Variety)", "Water Filtration System"], blurb: "", note: "", fact: "Elkay: drinking solutions, faucets, sinks, and water filtration." },
    { id: "fayette", name: "Fayette Pipe", wall: "Fayette Pipe", src: "assets/img/fayette.jpg", alt: "Fayette Pipe", lines: [], blurb: "Veteran-owned. Standard pipe, threading, and specifications.", note: "", fact: "Fayette Pipe: veteran-owned standard pipe, threading, and specifications." },
    { id: "klein", name: "Klein Tools", wall: "Klein Tools", src: "assets/img/klein.png", alt: "Klein Tools", lines: [], blurb: "", note: "", fact: "Klein Tools: hand tools." },
    { id: "armacell", name: "Armacell", wall: "Armacell", src: "assets/img/armacell.jpg", alt: "Armacell", lines: [], blurb: "", note: "", fact: "Armacell: pipe insulation." },
    { id: "oetiker", name: "Oetiker", wall: "Oetiker", src: "assets/img/oetiker.svg", alt: "Oetiker", lines: [], blurb: "Connecting solutions. Founded in Switzerland in 1942.", note: "", fact: "Oetiker: connecting solutions, founded in Switzerland in 1942." },
    { id: "dgi", name: "DGI Products", wall: "DGI Products", src: "assets/img/dgi-initials.png", alt: "David Gooding, Inc. products", lines: ["Brass Fittings & Nipples", "Chrome Fittings & Nipples", "Imported Malleable Fittings", "Monoflow Tees", "Cast Iron Baseboard", "Cast Iron Radiators", "Copper Tubing Types K, L & M", "ACR & Coils", "Line Sets"], blurb: "", note: "", fact: "DGI Products: fittings and nipples, cast iron radiation, copper tubing, ACR, coils, and line sets." },
    { id: "ocs", name: "OCS Industries", wall: "OCS Industries", src: "assets/img/ocs.jpg", alt: "OCS Industries", lines: ["Cast Iron Radiator & Baseboard", "Convector Cabinets", "Convection Heating Needs"], blurb: "", note: "", fact: "OCS Industries: cast iron radiators and baseboard, convector cabinets, and convection heating." },
    { id: "heatflo", name: "Heat-Flo", wall: "Heat-Flo", src: "assets/img/heat-flo.jpg", alt: "Heat-Flo", lines: ["Indirect Water Heaters", "Dual Coil Indirects", "Hydronic Buffer Tanks", "Hot Water Storage Tanks", "Indirects with Electric Backups"], blurb: "", note: "", fact: "Heat-Flo: indirect water heaters, buffer tanks, and hot water storage tanks." },
    { id: "armstrong", name: "Armstrong Fluid Technology", wall: "Armstrong", src: "assets/img/armstrong.jpg", alt: "Armstrong", lines: ["Integrated Pumping System Controls", "Domestic Water Booster Systems", "Design Envelope Technology", "Air & Expansion Controls", "Heat Exchangers", "Replacement Parts", "CBV\u2019s, FTV\u2019s & Suction Guides", "Residential & Commercial Pumps"], blurb: "", note: "", fact: "Armstrong: pumps, booster systems, heat exchangers, and expansion controls." },
    { id: "navien", name: "Navien", wall: "Navien", src: "assets/img/navien.jpg", alt: "Navien", lines: ["On-Demand Hot Water Heater", "Heat & Hot Water Combi Unit", "Commercial/Residential Water Heater Model", "Condensing Hydronic Furnace"], blurb: "", note: "", fact: "Navien: on-demand water heaters, heat and hot water combi units, and condensing hydronic furnaces." },
    { id: "ideal", name: "Ideal-Tridon", wall: "Ideal-Tridon", src: "assets/img/ideal-tridon.jpg", alt: "Ideal Tridon", lines: ["No Hub Couplings", "CISPI Standard Two Band", "Mid-Range Four Band", "Heavy-Duty Four Band", "\u201CClassic\u201D Import"], blurb: "", note: "", fact: "Ideal-Tridon: no-hub couplings." },
    { id: "fernco", name: "Fernco", wall: "Fernco", src: "assets/img/fernco.jpg", alt: "Fernco", lines: ["Flexible Couplings"], blurb: "", note: "", fact: "Fernco: flexible couplings." },
    { id: "panasonic", name: "Panasonic", wall: "Panasonic", src: "assets/img/panasonic.svg", alt: "Panasonic", lines: ["Full Line of Energy Star Products", "Advanced Ventilating Fans", "Whole-House Ventilation Systems"], blurb: "", note: "", fact: "Panasonic: ventilating fans and whole-house ventilation systems." },
    { id: "roth", name: "Roth", wall: "Roth", src: "assets/img/roth.png", alt: "Roth", lines: ["Radiant & Snowmelt", "Oil Storage Tanks"], blurb: "", note: "United States and Canada since 1995.", fact: "Roth: radiant and snowmelt systems and oil storage tanks." },
    { id: "endot", name: "Endot", wall: "Endot", src: "assets/img/endot.jpg", alt: "Endot", lines: ["Endopoly Pipe", "Endopure Water Pipe", "Endotrace", "Yellow Gas Pipe", "Green Sewer Pipe"], blurb: "", note: "", fact: "Endot: water pipe, gas pipe, and sewer pipe." },
    { id: "nibco", name: "NIBCO", wall: "NIBCO", src: "assets/img/nibco.jpg", alt: "NIBCO", lines: ["Copper Fittings", "PVC/ABS DWV Fittings", "Schedule 40 Pressure Fittings", "PVC80 & CPVC80 Fittings & Valves", "Bronze & Iron Valves", "Ball & Butterfly Valves", "Fire Protection & Irrigation Valves", "NIBCO Press 1/2\" to 4\" Fittings, Valves & Tools", "NIBCO PEX Piping Systems"], blurb: "", note: "", fact: "NIBCO: copper, PVC, ABS, CPVC, bronze, and iron fittings and valves, plus press and PEX." }
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

  function preloadImage(src) {
    if (!src || preloaded[src]) return;
    var image = new Image();
    preloaded[src] = image;
    image.onerror = function () {
      image.onerror = null;
    };
    image.src = src;
  }

  function preloadLogos() {
    var seen = {};
    var n;
    function once(src) {
      if (!src || seen[src]) return;
      seen[src] = true;
      preloadImage(src);
    }
    once(FALLBACK_SRC);
    var header = document.querySelector(".brand-lockup img");
    if (header) once(header.getAttribute("src"));
    for (n = 0; n < LINES.length; n++) once(LINES[n].src);
  }

  function bindImage(image, src) {
    image.onerror = function () {
      image.onerror = null;
      if (image.getAttribute("data-fallback") === "1" || src === FALLBACK_SRC) {
        image.style.visibility = "hidden";
        return;
      }
      image.setAttribute("data-fallback", "1");
      image.onerror = function () {
        image.onerror = null;
        image.style.visibility = "hidden";
      };
      image.src = FALLBACK_SRC;
    };
    image.src = src;
  }

  function armHeaderLogo() {
    var img = document.querySelector(".brand-lockup img");
    if (!img || img.getAttribute("data-armed") === "1") return;
    img.setAttribute("data-armed", "1");
    var src = img.getAttribute("src");
    img.onerror = function () {
      img.onerror = null;
      if (img.getAttribute("data-fallback") === "1" || src === FALLBACK_SRC) {
        img.style.visibility = "hidden";
        return;
      }
      img.setAttribute("data-fallback", "1");
      img.onerror = function () {
        img.onerror = null;
        img.style.visibility = "hidden";
      };
      img.src = FALLBACK_SRC;
    };
    if (img.complete && img.naturalWidth === 0) img.onerror();
  }

  function lineImage(line) {
    var image = document.createElement("img");
    image.alt = line.alt || line.name;
    bindImage(image, line.src);
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
    if (line.fact) copy.appendChild(el("p", "fact", line.fact));
    if (line.note) copy.appendChild(el("p", "note", line.note));
    if (line.lines.length) copy.appendChild(lineList(line));
    else if (line.blurb && !line.fact) copy.appendChild(el("p", "blurb", line.blurb));
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
    image.alt = "David Gooding, Inc.";
    bindImage(image, "assets/img/dgi-initials.png");
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
    if (!progressBar) progressBar = document.getElementById("progress-bar");
    if (!progressBar) return;
    if (freeze) {
      progressBar.style.animation = "none";
      progressBar.style.transform = "scaleX(1)";
      return;
    }
    progressBar.style.animation = "none";
    progressBar.style.transform = "";
    void progressBar.offsetWidth;
    progressBar.style.animation = "fill " + SCENE_MS + "ms linear forwards";
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
    if (!labelNode) labelNode = document.getElementById("scene-label");
    if (!countNode) countNode = document.getElementById("scene-count");
    if (labelNode) labelNode.textContent = sceneLabels[current];
    if (countNode) countNode.textContent = two(current + 1) + "  /  " + two(sceneNodes.length);
    restartProgress();
    sceneShownAt = Date.now();
    nextSceneAt = sceneShownAt + SCENE_MS;
    armWatchdog();
  }

  function advance() {
    activate((current + 1) % sceneNodes.length);
  }

  function updateClock() {
    var now = new Date();
    var minuteKey = now.getFullYear() + "-" + now.getMonth() + "-" + now.getDate() + "-" + now.getHours() + "-" + now.getMinutes();
    if (minuteKey === lastClockKey) return;
    var timeText;
    var dateText;
    if (clockFormat && clockFormat.formatToParts) {
      var parts = clockFormat.formatToParts(now);
      var hour = "";
      var minute = "";
      var dayPeriod = "";
      var weekday = "";
      var month = "";
      var day = "";
      var n;
      for (n = 0; n < parts.length; n++) {
        var type = parts[n].type;
        var value = parts[n].value;
        if (type === "hour") hour = value;
        else if (type === "minute") minute = value;
        else if (type === "dayPeriod") dayPeriod = value;
        else if (type === "weekday") weekday = value;
        else if (type === "month") month = value;
        else if (type === "day") day = value;
      }
      timeText = (hour + ":" + minute + " " + dayPeriod).replace(/\u202f|\u00a0/g, " ");
      dateText = weekday + ", " + month + " " + day;
    } else {
      var h = now.getHours();
      var m = now.getMinutes();
      var ampm = h >= 12 ? "PM" : "AM";
      var hr = h % 12;
      if (hr === 0) hr = 12;
      var mm = m < 10 ? "0" + m : "" + m;
      timeText = hr + ":" + mm + " " + ampm;
      dateText = DAYS[now.getDay()] + ", " + MONTHS[now.getMonth()] + " " + now.getDate();
    }
    if (!timeText || timeText.indexOf("undefined") !== -1) return;
    lastClockKey = minuteKey;
    if (!timeNode) timeNode = document.getElementById("clock-time");
    if (!dateNode) dateNode = document.getElementById("clock-date");
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

  function isOnline() {
    return typeof navigator === "undefined" || navigator.onLine !== false;
  }

  function cleanup() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    clearWatchdog();
    if (weatherAbort) {
      try { weatherAbort.abort(); } catch (err) {}
      weatherAbort = null;
    }
    weatherToken += 1;
    weatherBusy = false;
    if (listening) {
      window.removeEventListener("resize", fit);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", noteFailure);
      listening = false;
    }
  }

  function safeReload() {
    if (reloading) return;
    if (!isOnline()) return;
    reloading = true;
    cleanup();
    location.reload();
  }

  function clearWatchdog() {
    if (watchdog !== null) {
      clearTimeout(watchdog);
      watchdog = null;
    }
  }

  function armWatchdog() {
    clearWatchdog();
    if (freeze || gaveUp || reloading || !sceneNodes.length) return;
    var expected = current;
    watchdog = setTimeout(function () {
      watchdog = null;
      if (gaveUp || reloading || freeze) return;
      if (current !== expected) return;
      try {
        advance();
      } catch (err) {
        noteFailure();
      }
    }, SCENE_MS + WATCHDOG_GRACE_MS);
  }

  function onWindowError(event) {
    var target = event && event.target;
    if (target && target !== window && target.nodeType === 1) return;
    noteFailure();
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
      clearWatchdog();
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

  function weekdayName(iso) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return "";
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    if (!y || !m || !d) return "";
    var date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return "";
    return WEEKDAYS[date.getDay()];
  }

  function weatherKind(code) {
    if (code === 0) return "clear";
    if (code === 1 || code === 2) return "partly";
    if (code === 3) return "cloudy";
    if (code === 45 || code === 48) return "fog";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
    if (code >= 95) return "storm";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
    return "cloudy";
  }

  function validWeather(data) {
    if (!data || data.v !== 1) return false;
    if (typeof data.temp !== "number" || !isFinite(data.temp)) return false;
    if (typeof data.code !== "number" || !isFinite(data.code)) return false;
    if (!data.days || data.days.length < 3) return false;
    var n;
    for (n = 0; n < 3; n++) {
      var day = data.days[n];
      if (!day || typeof day.d !== "string" || !day.d) return false;
      if (typeof day.hi !== "number" || typeof day.lo !== "number") return false;
      if (!isFinite(day.hi) || !isFinite(day.lo)) return false;
    }
    return true;
  }

  function packWeather(json) {
    var cur = json && json.current;
    var daily = json && json.daily;
    if (!cur || !daily || !daily.time || !daily.temperature_2m_max || !daily.temperature_2m_min) return null;
    var temp = Math.round(Number(cur.temperature_2m));
    var code = Number(cur.weather_code);
    if (!isFinite(temp) || !isFinite(code)) return null;
    var days = [];
    var n;
    for (n = 0; n < 3; n++) {
      var name = weekdayName(daily.time[n]);
      var hi = Math.round(Number(daily.temperature_2m_max[n]));
      var lo = Math.round(Number(daily.temperature_2m_min[n]));
      if (!name || !isFinite(hi) || !isFinite(lo)) return null;
      days.push({ d: name, hi: hi, lo: lo });
    }
    return { v: 1, temp: temp, code: code, days: days };
  }

  function readWeatherCache() {
    try {
      var data = JSON.parse(localStorage.getItem(WEATHER_KEY) || "null");
      if (!validWeather(data)) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function hideWeather() {
    var box = document.getElementById("weather");
    if (box) box.hidden = true;
    weatherShown = false;
  }

  function useCachedOrHide() {
    if (weatherShown) return;
    var cached = null;
    try { cached = readWeatherCache(); } catch (err) { cached = null; }
    if (cached) paintWeather(cached);
    else hideWeather();
  }

  function paintWeather(data) {
    if (!validWeather(data)) return;
    var box = document.getElementById("weather");
    var icon = document.getElementById("wx-icon");
    var temp = document.getElementById("wx-temp");
    var days = box ? box.getElementsByClassName("wx-day") : [];
    if (!box || !icon || !temp || days.length < 3) return;
    icon.setAttribute("data-kind", weatherKind(data.code));
    temp.textContent = data.temp + "\u00b0F";
    var n;
    for (n = 0; n < 3; n++) {
      var dow = days[n].getElementsByClassName("wx-dow")[0];
      var range = days[n].getElementsByClassName("wx-range")[0];
      if (dow) dow.textContent = data.days[n].d;
      if (range) range.textContent = data.days[n].hi + "\u00b0/" + data.days[n].lo + "\u00b0";
    }
    box.hidden = false;
    weatherShown = true;
  }

  function refreshWeather() {
    if (weatherBusy || reloading) return;
    var now = Date.now();
    if (typeof fetch !== "function" || typeof AbortController !== "function") {
      useCachedOrHide();
      nextWeatherAt = now + WEATHER_MS;
      return;
    }
    weatherBusy = true;
    weatherStarted = now;
    nextWeatherAt = now + WEATHER_MS;
    var token = weatherToken;
    var controller = null;
    try {
      controller = new AbortController();
      weatherAbort = controller;
      fetch(WEATHER_URL, { signal: controller.signal })
        .then(function (res) {
          if (!res || !res.ok) throw new Error("wx");
          return res.json();
        })
        .then(function (json) {
          if (token !== weatherToken) return;
          try {
            var data = packWeather(json);
            if (!validWeather(data)) throw new Error("wx");
            try { localStorage.setItem(WEATHER_KEY, JSON.stringify(data)); } catch (err) {}
            paintWeather(data);
          } catch (err2) {
            useCachedOrHide();
          }
        })
        .catch(function () {
          if (token !== weatherToken) return;
          useCachedOrHide();
        })
        .then(function () {
          if (token !== weatherToken) return;
          weatherBusy = false;
          if (weatherAbort === controller) weatherAbort = null;
        });
    } catch (err) {
      weatherBusy = false;
      if (weatherAbort === controller) weatherAbort = null;
      useCachedOrHide();
    }
  }

  function tick() {
    if (gaveUp) {
      try { updateClock(); } catch (err) {}
      return;
    }
    try {
      var now = Date.now();
      updateClock();
      if (weatherBusy && weatherAbort && now - weatherStarted >= WEATHER_TIMEOUT_MS) {
        try { weatherAbort.abort(); } catch (abortErr) {}
        weatherAbort = null;
      }
      if (weatherBusy && now - weatherStarted >= WEATHER_TIMEOUT_MS + 2000) {
        weatherBusy = false;
        weatherToken += 1;
        useCachedOrHide();
      }
      if (!weatherBusy && now >= nextWeatherAt) refreshWeather();
      if (!freeze && now - booted >= RELOAD_MS && now >= nextSceneAt) {
        if (isOnline()) {
          safeReload();
          return;
        }
      }
      if (!freeze && sceneShownAt && now - sceneShownAt >= SCENE_MS + WATCHDOG_GRACE_MS) advance();
      else if (!freeze && now >= nextSceneAt) advance();
    } catch (err) {
      noteFailure();
    }
  }

  function cacheNodes() {
    timeNode = document.getElementById("clock-time");
    dateNode = document.getElementById("clock-date");
    labelNode = document.getElementById("scene-label");
    countNode = document.getElementById("scene-count");
    progressBar = document.getElementById("progress-bar");
  }

  function boot() {
    cacheNodes();
    preloadLogos();
    armHeaderLogo();
    build();
    fit();
    updateClock();
    try { paintWeather(readWeatherCache()); } catch (err) {}
    try { refreshWeather(); } catch (err2) {}
    activate(startIndex());
    if (timer === null) timer = setInterval(tick, TICK_MS);
    if (!listening) {
      window.addEventListener("resize", fit);
      window.addEventListener("error", onWindowError);
      window.addEventListener("unhandledrejection", noteFailure);
      listening = true;
    }
    window.__dgiBoard = {
      version: BOARD_VERSION,
      sceneCount: sceneNodes.length,
      sceneMs: SCENE_MS,
      reloadMs: RELOAD_MS,
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
