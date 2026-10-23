// Shared script for every page. Each part only runs on the page that has its section.
(function () {
  // Prices confirmed by Jamo, Oct 2026. Change them here and every page updates.
  var SERVICES = [
    { id: "tune", name: "Clean, wax & sharpen", price: 30, why: "Strips old wax and dirt, hot waxes by hand in the wax you pick, and sharpens the edges for grip on hardpack and ice." },
    { id: "ptex", name: "Base repair (P-Tex)", price: 20, why: "Fills scratches and gouges in the base." },
    { id: "epoxy", name: "Top layer repair (epoxy)", price: 20, why: "Seals chips and cracks in the top so water stays out of the core." }
  ];
  // Wax choices for anything that gets waxed. Set a price to charge extra for a wax.
  var WAXES = [
    { id: "universal", name: "Universal", temp: "any weather", price: 0 },
    { id: "bone", name: "Bone Chilling Cold", temp: "0–14°F", price: 5 },
    { id: "cold", name: "It's Kinda Cold Out Today", temp: "10–21°F", price: 5 },
    { id: "hot", name: "It's Kind of Hot Today", temp: "25–39°F", price: 5 },
    { id: "rocks", name: "Watch Out for Rocks", temp: "32–50°F", price: 5 }
  ];
  // Packages are priced per pair of skis or per snowboard.
  var PACKAGES = [
    { id: "ultra", name: "The Ultra", price: 50, includes: ["tune", "ptex", "epoxy"], blurb: "Everything I do, in one tune. Clean, wax, sharpen and fix the base and top.", feature: true },
    { id: "opener", name: "Season Opener", price: 25, includes: ["tune"], blurb: "Start the season fast: a full clean, a hot wax and sharp edges." }
  ];
  var SEASON = 100;
  var PICKUP = 15;
  var PHONE = "+17205458843";
  // Paste the Google Apps Script web app URL here to turn on online booking and photo sending.
  // While it's empty, the forms fall back to "text it to Jamo".
  var INBOX_URL = "https://script.google.com/macros/s/AKfycbz-ndjSfm58u5Q4eGCnBXDsXTzqFZ1IysnFBjysduyxYPyUTSX2EEIMu6PfscgZLMHC/exec";

  var $ = function (id) { return document.getElementById(id); };
  var money = function (n) { return "$" + (n % 1 ? n.toFixed(2) : n); };
  var REF_OFF = 0.15;
  // Influencer codes. Keep in sync with PROMO_CODES in the Google script.
  var PROMOS = { VILL: 0.20, PEAKED: 0.20 };
  var REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  // Jamo's weekly hours (0 = Sunday). Days not listed are closed. Edit here to change the booking form and the hours on the home page.
  var WINDOWS = ["Morning (8–11)", "Midday (11–2)", "Afternoon (2–5)", "Evening (5–8)"];
  var SPANS = [[8, 11], [11, 14], [14, 17], [17, 20]];
  var HOURS = { 0: WINDOWS, 2: [WINDOWS[0]], 3: [WINDOWS[0]], 4: WINDOWS, 5: [WINDOWS[3]], 6: WINDOWS };
  var ARROW = '<svg class="arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13M9 3l5 5-5 5"/></svg>';
  var byId = {}, pkgById = {}, waxById = {};
  SERVICES.forEach(function (t) { byId[t.id] = t; });
  WAXES.forEach(function (w) { waxById[w.id] = w; });
  PACKAGES.forEach(function (p) { pkgById[p.id] = p; });
  function sum(ids) { return ids.reduce(function (s, id) { return s + byId[id].price; }, 0); }
  function names(ids) { return ids.map(function (id) { return byId[id].name; }).join(", "); }

  // Old links to sections of the one-page site (like /#book) go to the new pages.
  if ($("hours") && /^#(quote|photos|book)$/.test(location.hash)) { location.replace(location.hash.slice(1) + ".html" + location.search); return; }

  // The quote is saved in this browser so it carries from the Quote page to the Book page.
  var KEY = "jamo-quote", CODE_KEY = "jamo-code", booked = false;
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (err) { return null; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (err) {} }
  function forget(k) { try { localStorage.removeItem(k); } catch (err) {} }

  // Flyer QR codes link here with ?code=VILL, and the code is kept until they book.
  try { var linkCode = new URLSearchParams(location.search).get("code"); if (linkCode) store(CODE_KEY, linkCode.slice(0, 20)); } catch (err) {}

  function clean(g) {
    if (!g || typeof g !== "object") return null;
    // Quotes saved before cleaning, waxing and edges became one service still work.
    var picks = (Array.isArray(g.picks) ? g.picks : []).map(function (id) { return id === "cleanwax" || id === "edge" ? "tune" : id; })
      .filter(function (id, i, a) { return byId[id] && a.indexOf(id) === i; });
    return { kind: g.kind === "Snowboard" ? "Snowboard" : "Skis", picks: picks, season: !!g.season, wax: waxById[g.wax] ? g.wax : "universal", demo: !!g.demo };
  }
  var saved = load(KEY) || {};
  var gear = Array.isArray(saved.gear) ? saved.gear.map(clean).filter(Boolean) : null;
  // A first visit to the Quote page starts with one example item so the ticket shows how it works.
  if (!gear) gear = $("gear") ? [{ kind: "Skis", picks: ["tune"], season: false, wax: "universal", demo: true }] : [];
  var pickup = !!saved.pickup;
  function save() { if (!booked) store(KEY, { gear: gear, pickup: pickup }); }

  function waxed(g) { return g.season || g.picks.indexOf("tune") > -1; }
  function waxLabel(w) { return w.name + " (" + (w.id === "universal" ? "free" : w.temp) + ")" + (w.price ? ", +" + money(w.price) : ""); }
  // Each item gets the lowest price: services one by one, or a package plus any extras. A paid wax is added on top.
  function priceOf(g) {
    var b = basePrice(g);
    if (waxed(g)) b.price += waxById[g.wax].price;
    return b;
  }
  function basePrice(g) {
    if (g.season) return { price: SEASON };
    var best = { price: sum(g.picks) };
    if (g.picks.length) PACKAGES.forEach(function (p) {
      var extra = g.picks.filter(function (id) { return p.includes.indexOf(id) < 0; });
      var cost = p.price + sum(extra);
      if (cost < best.price) best = { price: cost, pkg: p, extra: extra, bonus: p.includes.filter(function (id) { return g.picks.indexOf(id) < 0; }) };
    });
    return best;
  }
  function describe(g, full) {
    var w = waxById[g.wax], wax = waxed(g) ? (full ? ", wax: " + waxLabel(w) : ", " + w.name + " wax" + (w.price ? " (+" + money(w.price) + ")" : "")) : "";
    if (g.season) return "Season Pass" + wax;
    var b = basePrice(g);
    if (b.pkg) return b.pkg.name + (full ? " package (" + names(b.pkg.includes) + ")" : "") + (b.extra.length ? " + " + names(b.extra) : "") + wax;
    return g.picks.length ? names(g.picks) + wax : "nothing checked yet";
  }
  function noteFor(g) {
    var b = basePrice(g);
    if (!b.pkg) return "";
    return b.pkg.name + " price" + (b.extra.length ? " + " + names(b.extra).toLowerCase() : "") + ": " + money(b.price) + " instead of " + money(sum(g.picks)) + "." +
      (b.bonus.length ? " It adds " + names(b.bonus).toLowerCase() + " for free." : "");
  }

  function refCode() {
    var el = $("b-ref"), v = el ? el.value : (load(CODE_KEY) || "");
    return String(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  function totals() {
    var sub = gear.reduce(function (s, g) { return s + priceOf(g).price; }, 0);
    var pick = pickup ? PICKUP : 0;
    var full = sub + pick;
    // 15% off with a friend's referral code, or an influencer code's rate. The sheet checks the code and confirms it.
    var code = refCode(), rate = code ? (PROMOS[code] || REF_OFF) : 0;
    var off = Math.round(full * rate * 100) / 100;
    return { sub: sub, pick: pick, full: full, off: off, rate: rate, promo: !!PROMOS[code], total: full - off };
  }

  // A saved code shows as a gold note in the header, so people from a flyer know it's applied.
  if ($("codebar") && !$("b-ref") && refCode()) {
    var c = refCode();
    $("codebar").textContent = "Code " + c + " is saved: " + (PROMOS[c] ? Math.round(PROMOS[c] * 100) + "% off your order" : "15% off your first booking") + " when you book.";
    $("codebar").hidden = false;
  }

  if ($("svcs")) {
    $("svcs").innerHTML = SERVICES.map(function (t, i) {
      return "<li><h3>" + t.name + '</h3><span class="price">' + money(t.price) + "</span><p>" + t.why + "</p></li>";
    }).join("");
  }
  if ($("waxes")) {
    $("waxes").innerHTML = WAXES.map(function (w) {
      return '<li data-w="' + w.id + '"><i class="puck" aria-hidden="true"></i><strong>' + w.name + '</strong><span class="temp">' + (w.id === "universal" ? "Any weather" : w.temp) + '</span><span class="cost">' + (w.price ? "+" + money(w.price) : "Free") + "</span></li>";
    }).join("");
  }
  // Home page hours panel, grouped into runs of days with the same hours.
  if ($("hours")) {
    var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], rows = [];
    var hr = function (h) { return (h % 12 || 12); }, ap = function (h) { return h < 12 ? "am" : "pm"; };
    var span = function (d) {
      var w = HOURS[d]; if (!w) return "";
      var a = SPANS[WINDOWS.indexOf(w[0])][0], b = SPANS[WINDOWS.indexOf(w[w.length - 1])][1];
      return ap(a) === ap(b) ? hr(a) + "–" + hr(b) + " " + ap(b) : hr(a) + " " + ap(a) + "–" + hr(b) + " " + ap(b);
    };
    [1, 2, 3, 4, 5, 6, 0].forEach(function (d) {
      var last = rows[rows.length - 1], txt = span(d);
      if (last && last.txt === txt) last.to = d; else rows.push({ from: d, to: d, txt: txt });
    });
    $("hours").innerHTML = rows.map(function (r) {
      return "<div" + (r.txt ? "" : ' class="closed"') + "><dt>" + DAYS[r.from] + (r.to !== r.from ? "–" + DAYS[r.to] : "") + "</dt><dd>" + (r.txt || "Closed") + "</dd></div>";
    }).join("");
  }

  function addPackage(id) {
    var p = pkgById[id]; if (!p) return;
    gear = gear.filter(function (g) { return !g.demo; });
    var last = gear[gear.length - 1];
    var item = { kind: last ? last.kind : "Skis", picks: p.includes.slice(), season: false, wax: "universal" };
    if (last && !last.season && !last.picks.length) gear[gear.length - 1] = item; else gear.push(item);
    save();
  }

  if ($("pkgs")) {
    $("pkgs").innerHTML = PACKAGES.map(function (p) {
      var value = sum(p.includes);
      return '<article class="pkg' + (p.feature ? " feature" : "") + '"><div class="pkg-top"><h3>' + p.name + '</h3><span class="tag">Save ' + money(value - p.price) + "</span></div>" +
        '<p class="pkg-price"><strong>' + money(p.price) + "</strong><span><s>" + money(value) + "</s> value</span></p>" +
        "<p>" + p.blurb + '</p><ul class="ticks">' + p.includes.map(function (id) { return "<li>" + byId[id].name + "</li>"; }).join("") + "<li>Universal wax</li></ul>" +
        '<button type="button" class="btn ' + (p.feature ? "btn-primary" : "btn-line") + '" data-pkg="' + p.id + '">Add to my quote ' + ARROW + "</button></article>";
    }).join("");
    $("pkgs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-pkg]"); if (!b) return;
      addPackage(b.dataset.pkg);
      if (!$("gear")) { location.href = "quote.html#build"; return; }
      renderGear();
      var cards = $("gear").querySelectorAll(".gear"), last = cards[cards.length - 1];
      if (last) { last.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" }); last.classList.add("flash"); }
    });
  }

  // The total counts up or down to its new value with a small bump.
  var shownTotal = null;
  function setTotal(v) {
    var el = $("total");
    if (shownTotal === null || REDUCED || shownTotal === v) { el.textContent = money(v); shownTotal = v; return; }
    var from = shownTotal, t0 = performance.now(), box = el.parentNode;
    shownTotal = v;
    box.classList.remove("bump"); void box.offsetWidth; box.classList.add("bump");
    (function step(now) {
      if (shownTotal !== v) return;
      var k = Math.min(1, (now - t0) / 380), cur = from + (v - from) * (1 - Math.pow(1 - k, 3));
      el.textContent = money(k < 1 ? Math.round(cur) : v);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  function renderTicket() {
    save();
    if (!$("lines")) return;
    var t = totals();
    $("lines").innerHTML = gear.length ? gear.map(function (g) {
      return "<li><span>" + g.kind + ": " + describe(g) + "</span><span>" + money(priceOf(g).price) + "</span></li>";
    }).join("") + (t.pick ? "<li><span>Pickup &amp; dropoff</span><span>" + money(PICKUP) + "</span></li>" : "") +
      (t.off ? "<li><span>" + (t.promo ? refCode() + " discount" : "Referral discount") + " (" + Math.round(t.rate * 100) + "%)</span><span>−" + money(t.off) + "</span></li>" : "")
      : $("gear") ? '<li class="empty">Add skis or a snowboard to start.</li>'
      : '<li class="empty">Nothing in your quote yet. <a href="quote.html">Build your quote</a>, or just book and tell me what you need in the notes.</li>';
    gear.forEach(function (g, i) {
      var n = document.querySelector('[data-note="' + i + '"]'); if (!n) return;
      n.textContent = noteFor(g); n.hidden = !n.textContent;
      document.querySelector('[data-waxbox="' + i + '"]').hidden = !waxed(g);
    });
    setTotal(t.total);
  }

  // Quote page: gear cards and the ticket.
  function renderGear() {
    $("gear").innerHTML = gear.map(function (g, i) {
      return '<div class="gear"><div class="gear-top"><div class="kind">' +
        ["Skis", "Snowboard"].map(function (k) {
          return '<button type="button" class="chip" data-i="' + i + '" data-kind="' + k + '" aria-pressed="' + (g.kind === k) + '">' + k + "</button>";
        }).join("") + '</div><button type="button" class="remove" data-rm="' + i + '">Remove</button></div>' +
        '<div class="checks' + (g.season ? " covered" : "") + '" role="group" aria-label="Services for item ' + (i + 1) + '">' +
        SERVICES.map(function (t) {
          return '<label><input type="checkbox" data-i="' + i + '" value="' + t.id + '"' + (g.picks.indexOf(t.id) > -1 ? " checked" : "") + "><span>" + t.name + "</span><em>" + money(t.price) + "</em></label>";
        }).join("") + "</div>" +
        '<div class="field wax-pick" data-waxbox="' + i + '" data-w="' + (g.wax || "universal") + '"><label for="wax-' + i + '">Wax</label><select id="wax-' + i + '" data-wax="' + i + '">' +
        WAXES.map(function (w) { return '<option value="' + w.id + '"' + (g.wax === w.id ? " selected" : "") + ">" + waxLabel(w) + "</option>"; }).join("") + "</select></div>" +
        '<p class="pkg-note" data-note="' + i + '" hidden></p>' +
        '<label class="season-pick"><input type="checkbox" data-season="' + i + '"' + (g.season ? " checked" : "") + "><span><strong>Season Pass instead, " + money(SEASON) + "</strong>. Everything above, all season.</span></label></div>";
    }).join("");
    renderTicket();
  }

  if ($("gear")) {
    $("gear").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.kind) { gear[+b.dataset.i].kind = b.dataset.kind; gear[+b.dataset.i].demo = false; renderGear(); }
      if (b.dataset.rm) { gear.splice(+b.dataset.rm, 1); renderGear(); }
    });
    $("gear").addEventListener("change", function (e) {
      var el = e.target;
      if (el.dataset.season) { gear[+el.dataset.season].season = el.checked; gear[+el.dataset.season].demo = false; renderGear(); return; }
      if (el.dataset.wax) { gear[+el.dataset.wax].wax = el.value; gear[+el.dataset.wax].demo = false; el.parentNode.dataset.w = el.value; renderTicket(); return; }
      var g = gear[+el.dataset.i]; if (!g) return;
      g.demo = false;
      g.picks = g.picks.filter(function (id) { return id !== el.value; });
      if (el.checked) g.picks.push(el.value);
      renderTicket();
    });
    document.querySelectorAll("[data-add]").forEach(function (b) {
      b.addEventListener("click", function () { gear.push({ kind: b.dataset.add, picks: [], season: false, wax: "universal" }); renderGear(); });
    });
    $("pickup").checked = pickup;
    $("pickup").addEventListener("change", function () { pickup = $("pickup").checked; renderTicket(); });
    renderGear();
  }

  // Shared by the booking and photo forms.
  function send(payload) {
    return fetch(INBOX_URL, { method: "POST", body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (res) { if (!res.ok) throw new Error(res.error || "Request failed"); return res; });
  }
  function busy(btn, on, label) { btn.disabled = on; btn.textContent = label; }

  // Book page: the saved quote, days and times, and the booking form.
  if ($("book-form")) {
    $("b-ref").value = load(CODE_KEY) || "";
    $("b-ref").addEventListener("input", function () {
      var v = $("b-ref").value.trim();
      if (v) store(CODE_KEY, v); else forget(CODE_KEY);
      renderTicket();
    });
    var syncAddr = function () { $("addr-field").hidden = $("b-how").value !== "pickup"; };
    $("b-how").value = pickup ? "pickup" : "drop";
    syncAddr();
    $("b-how").addEventListener("change", function () { pickup = $("b-how").value === "pickup"; syncAddr(); renderTicket(); });
    renderTicket();

    var DAYS_AHEAD = 21;
    var fillTimes = function () {
      var opt = $("b-date").selectedOptions[0];
      var list = opt ? HOURS[opt.dataset.dow] : [];
      $("b-time").innerHTML = list.map(function (w) { return "<option>" + w + "</option>"; }).join("");
    };
    (function fillDays() {
      var opts = [], d = new Date();
      for (var i = 1; i <= DAYS_AHEAD; i++) {
        d.setDate(d.getDate() + 1);
        if (!HOURS[d.getDay()]) continue;
        var label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        opts.push('<option value="' + label + '" data-dow="' + d.getDay() + '">' + label + "</option>");
      }
      $("b-date").innerHTML = opts.join("");
      fillTimes();
    })();
    $("b-date").addEventListener("change", fillTimes);

    var orderText = function () {
      return gear.map(function (g) { return "- " + g.kind + ": " + describe(g, true) + " (" + money(priceOf(g).price) + ")"; }).join("\n") +
        (pickup ? "\n- Pickup & dropoff (" + money(PICKUP) + ")" : "");
    };
    var showBookFallback = function () {
      var t = totals();
      var txt = "Hi Jamo, I'd like to book a tune.\n" +
        "Name: " + $("b-name").value + "\nPhone: " + $("b-phone").value +
        "\nDay: " + $("b-date").value + ", " + $("b-time").value +
        "\n" + ($("b-how").value === "pickup" ? "Pickup at: " + ($("b-addr").value || "(address)") : "I'll drop it off") +
        "\n\nOrder:\n" + orderText() +
        "\nEstimated total: " + money(t.total) +
        ($("b-ref").value ? "\nReferral code: " + $("b-ref").value : "") +
        ($("b-notes").value ? "\n\nNotes: " + $("b-notes").value : "");
      $("book-text").textContent = txt;
      $("sms-book").href = "sms:" + PHONE + "?&body=" + encodeURIComponent(txt);
      $("book-result").hidden = false;
    };

    $("book-form").addEventListener("submit", function (e) {
      e.preventDefault();
      $("book-done").hidden = true; $("book-result").hidden = true;
      if (!INBOX_URL) { showBookFallback(); return; }
      var btn = $("book-send");
      busy(btn, true, "Sending...");
      send({
        type: "booking", website: $("b-hp").value,
        name: $("b-name").value, phone: $("b-phone").value,
        day: $("b-date").value, time: $("b-time").value,
        method: $("b-how").value === "pickup" ? "Pickup" : "Drop-off", address: $("b-addr").value,
        order: orderText(), total: money(totals().total), subtotal: totals().full, notes: $("b-notes").value,
        referral: $("b-ref").value
      }).then(function (res) {
        $("my-code").hidden = !res.code; $("my-code-val").textContent = res.code || "";
        var note = "";
        if (res.discount) note = "Your discount (" + money(res.discount) + ") is applied. Estimated total: " + res.total + ".";
        else if (res.refNote) note = res.refNote + " Your estimated total is " + res.total + ".";
        $("ref-note").textContent = note; $("ref-note").hidden = !note;
        $("book-done").hidden = false; busy(btn, false, "Send booking request");
        // Booked: start fresh next time.
        booked = true; forget(KEY); forget(CODE_KEY);
      }, function () {
        // If sending fails, give them the text version so the request isn't lost.
        showBookFallback(); busy(btn, false, "Send booking request");
      });
    });
    $("copy-book").addEventListener("click", function () {
      var b = this, txt = $("book-text").textContent;
      var done = function () { b.textContent = "Copied"; };
      var fallback = function () { var r = document.createRange(); r.selectNodeContents($("book-text")); var s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Selected, press copy"; };
      try { navigator.clipboard.writeText(txt).then(done, fallback); } catch (err) { fallback(); }
    });
  }

  // Photos page: photos are shrunk in the browser before sending so uploads stay fast on phones.
  if ($("photo-form")) {
    var photoFiles = [];
    var showFiles = function (files) {
      photoFiles = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); }).slice(0, 5);
      $("thumbs").innerHTML = "";
      photoFiles.forEach(function (f) {
        var img = document.createElement("img"); img.alt = f.name; img.src = URL.createObjectURL(f); $("thumbs").appendChild(img);
      });
    };
    var shrink = function (file) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, 1600 / Math.max(img.width, img.height));
          var c = document.createElement("canvas");
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve({ mime: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] });
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    };
    var photoResult = function (head, msg) { $("photo-head").textContent = head; $("photo-msg").innerHTML = msg; $("photo-result").hidden = false; };
    var textUs = 'Text your photos to <span class="phone" style="font-size:1.1rem">720-545-8843</span> instead.';

    $("photo-input").addEventListener("change", function () { showFiles(this.files); });
    var drop = $("drop");
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { showFiles(e.dataTransfer.files); });
    $("photo-form").addEventListener("submit", function (e) {
      e.preventDefault();
      $("photo-result").hidden = true;
      if (!INBOX_URL) { photoResult("Almost there.", "Photo sending isn't connected yet. " + textUs); return; }
      if (!photoFiles.length) { photoResult("Add a photo first.", "Tap the box above to choose photos from your phone or computer."); return; }
      var btn = $("photo-send");
      busy(btn, true, "Sending photos...");
      Promise.all(photoFiles.map(shrink)).then(function (photos) {
        return send({ type: "photos", website: $("p-hp").value, name: $("p-name").value, phone: $("p-phone").value, notes: $("p-notes").value, photos: photos });
      }).then(function () {
        photoResult("Got your photos!", "I'll take a look and text you back with what I'd recommend.");
        $("photo-form").reset(); showFiles([]);
        busy(btn, false, "Send photos to Jamo");
      }, function () {
        photoResult("That didn't go through.", "Something went wrong sending your photos. " + textUs);
        busy(btn, false, "Send photos to Jamo");
      });
    });
  }
})();

// Time of day: drag the sun along the slider in the header and the sky, sun and mountain light follow (assets/sky.js does the coloring).
// Each visitor's time is remembered once they let go.
(function () {
  var dial = document.getElementById("sky-dial"), sky = window.JamoSky; if (!dial || !sky) return;
  var label = dial.parentNode.querySelector(".sky-name"), raf = 0;
  var show = function (t) { var n = sky.name(t); dial.setAttribute("aria-valuetext", n); if (label) label.textContent = n; };
  var at = function () { return dial.value / dial.max; };
  dial.value = Math.round(sky.get() * dial.max);
  show(sky.get());
  dial.addEventListener("input", function () {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; sky.set(at()); show(at()); });
  });
  dial.addEventListener("change", function () { sky.set(at(), true); show(at()); });
})();

// Snow over the whole page that falls harder the faster you scroll down, and mountain layers that drift at different speeds.
// Skipped for anyone who asks for reduced motion.
(function () {
  if (!window.matchMedia || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var c = document.createElement("canvas");
  if (c.getContext) {
    c.className = "snowfall"; c.setAttribute("aria-hidden", "true");
    document.body.appendChild(c);
    var ctx = c.getContext("2d"), flakes = [], w = 0, h = 0, base = 0, max = 0, fill = "#fff", edge = "transparent";
    var make = function (y, off) {
      var z = Math.random(); // 0 is far away, 1 is close
      return { x: Math.random() * w, y: y, z: z, r: .7 + z * 2.3, s: .35 + z * .85 + Math.random() * .2, d: Math.random() * 6.3, a: off ? 0 : 1, off: off };
    };
    var colors = function () {
      var cs = getComputedStyle(document.documentElement);
      fill = cs.getPropertyValue("--flake").trim() || "#fff"; edge = cs.getPropertyValue("--flake-edge").trim() || "transparent";
    };
    var size = function () {
      var dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = c.clientWidth; h = c.clientHeight;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      base = Math.round(Math.min(60, Math.max(24, w / 22)));
      max = w < 700 ? 190 : 340;
      while (flakes.length < max) flakes.push(make(Math.random() * h, flakes.length >= base));
    };
    colors(); size();
    window.addEventListener("resize", size);
    document.addEventListener("jamo-time", colors);

    // Mountain layers: once a range is fully on screen, each layer moves down a share of the scroll, so far peaks drift slower than near ones.
    var scenes = Array.prototype.map.call(document.querySelectorAll(".range"), function (r) {
      return { el: r, shift: -1, layers: Array.prototype.map.call(r.querySelectorAll("[data-depth]"), function (l) { return { el: l, d: +l.dataset.depth }; }) };
    });
    var drift = function () {
      scenes.forEach(function (sc) {
        var r = sc.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > h) return;
        var shift = Math.max(0, h - r.bottom);
        if (shift === sc.shift) return;
        sc.shift = shift;
        sc.layers.forEach(function (l) { l.el.style.transform = l.d ? "translate3d(0," + (shift * l.d).toFixed(1) + "px,0)" : ""; });
      });
    };

    var lastY = window.scrollY, lastT = 0, storm = 0, raf = 0;
    var tick = function (now) {
      raf = requestAnimationFrame(tick);
      var dt = lastT ? Math.min(64, now - lastT) : 16, k = dt / 16; lastT = now;
      var y = window.scrollY, dy = y - lastY; lastY = y;
      // Scroll speed in pixels per millisecond. Scrolling up counts a little; scrolling down counts fully.
      var target = Math.min(1, (dy > 0 ? dy : -dy * .35) / dt / 2.4);
      storm += (target - storm) * Math.min(1, (target > storm ? .2 : .02) * k);
      if (dy) drift();
      var fall = 1 + storm * 5, wind = storm * 2.4, active = base + (max - base) * storm, streak = fall > 1.9;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = fill; ctx.strokeStyle = edge; ctx.lineCap = "round";
      for (var j = 0; j < flakes.length; j++) {
        var f = flakes[j];
        if (f.off) {
          if (j >= active) continue;
          f.off = false; f.a = 0; f.x = Math.random() * w; f.y = Math.random() * h;
        }
        f.d += .012 * k;
        var vy = f.s * fall * k, vx = (Math.sin(f.d) * .45 + wind * (.35 + f.z)) * k;
        f.y += vy; f.x += vx;
        if (f.a < 1) f.a = Math.min(1, f.a + .05 * k);
        if (f.y > h + 8 || f.x > w + 8) {
          if (j >= active) { f.off = true; continue; }
          f.y = -8; f.x = Math.random() * (w + 80) - 80 * Math.min(1, storm * 2);
        }
        ctx.globalAlpha = f.a * (.5 + f.z * .45);
        if (streak) {
          var tx = f.x - vx * 1.8, ty = f.y - vy * 1.8;
          ctx.lineWidth = f.r * 1.7 + 1.2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(f.x, f.y); ctx.stroke();
          ctx.lineWidth = f.r * 1.7; ctx.strokeStyle = fill; ctx.stroke(); ctx.strokeStyle = edge;
        } else {
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
          if (edge !== "transparent") { ctx.lineWidth = .7; ctx.stroke(); }
        }
      }
      ctx.globalAlpha = 1;
    };
    drift();
    raf = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", function () {
      cancelAnimationFrame(raf);
      if (!document.hidden) { lastT = 0; lastY = window.scrollY; raf = requestAnimationFrame(tick); }
    });
  }

  if (!("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("js-motion");
  var items = document.querySelectorAll(".facts, .split-head, .menu, .waxes, .head-row, .pkg, .builder, #photo-form, #book-form, .side, .faq details");
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px" });
  Array.prototype.forEach.call(items, function (el, i) {
    el.classList.add("reveal");
    if (el.classList.contains("pkg")) el.style.transitionDelay = (i % 3) * 110 + "ms";
    io.observe(el);
  });
})();
