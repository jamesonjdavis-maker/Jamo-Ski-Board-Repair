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

  // Codes are never saved or filled in for people: a code only counts when they type it on the Book page (Jameson's rule).
  // Earlier versions of the site saved codes from flyer links, so clear any that are still in the browser.
  forget(CODE_KEY);

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
    var el = $("b-ref"), v = el ? el.value : "";
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
    $("b-ref").addEventListener("input", renderTicket);
    var syncAddr = function () { $("addr-field").hidden = $("b-how").value !== "pickup"; };
    $("b-how").value = pickup ? "pickup" : "drop";
    syncAddr();
    $("b-how").addEventListener("change", function () { pickup = $("b-how").value === "pickup"; syncAddr(); renderTicket(); });
    // "How did you hear about us?" answer, with their own words when they pick "Somewhere else".
    var heard = function () {
      var v = $("b-heard").value, other = $("b-heard-other").value.trim();
      return v === "Other" ? (other ? "Other: " + other : "Other") : v;
    };
    $("b-heard").addEventListener("change", function () { $("heard-other-field").hidden = this.value !== "Other"; });
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
        (heard() ? "\nHeard about us: " + heard() : "") +
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
        referral: $("b-ref").value, heard: heard()
      }).then(function (res) {
        $("my-code").hidden = !res.code; $("my-code-val").textContent = res.code || "";
        var note = "";
        if (res.discount) note = "Your discount (" + money(res.discount) + ") is applied. Estimated total: " + res.total + ".";
        else if (res.refNote) note = res.refNote + " Your estimated total is " + res.total + ".";
        $("ref-note").textContent = note; $("ref-note").hidden = !note;
        $("book-done").hidden = false; busy(btn, false, "Send booking request");
        // Booked: start fresh next time.
        booked = true; forget(KEY);
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

// Snow page: today's weather and the snow forecast for Colorado resorts from the National Weather Service (free, no key).
// Each resort takes two requests: its forecast grid (kept for a month) and the forecast (kept for half an hour).
(function () {
  var list = document.getElementById("resorts"); if (!list) return;
  var R = [
    ["eldora", "Eldora", "Nederland", 39.9375, -105.5828, "https://www.eldora.com/", "https://www.eldora.com/the-mountain/current-conditions/snow-report-weather/"],
    ["winterpark", "Winter Park", "Grand County", 39.8869, -105.7625, "https://www.winterparkresort.com/", "https://www.winterparkresort.com/the-mountain"],
    ["loveland", "Loveland", "Clear Creek County", 39.68, -105.8979, "https://skiloveland.com/", "https://skiloveland.com/trail-lift-report/"],
    ["abasin", "Arapahoe Basin", "Summit County", 39.6423, -105.8718, "https://www.arapahoebasin.com/", "https://www.arapahoebasin.com/snow-report/"],
    ["keystone", "Keystone", "Summit County", 39.6045, -105.954, "https://www.keystoneresort.com/", "https://www.keystoneresort.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx"],
    ["copper", "Copper Mountain", "Summit County", 39.5016, -106.1516, "https://www.coppercolorado.com/", "https://www.coppercolorado.com/the-mountain/trail-lift-info/winter-trail-report/"],
    ["breck", "Breckenridge", "Summit County", 39.48, -106.0667, "https://www.breckenridge.com/", "https://www.breckenridge.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx"],
    ["vail", "Vail", "Vail Valley", 39.6061, -106.355, "https://www.vail.com/", "https://www.vail.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx"],
    ["beaver", "Beaver Creek", "Vail Valley", 39.6042, -106.5165, "https://www.beavercreek.com/", "https://www.beavercreek.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx"],
    ["steamboat", "Steamboat", "Routt County", 40.4572, -106.8045, "https://www.steamboat.com/", "https://www.steamboat.com/the-mountain/mountain-report"],
    ["monarch", "Monarch", "Chaffee County", 38.5122, -106.332, "https://skimonarch.com/", ""],
    ["aspen", "Aspen Snowmass", "Roaring Fork Valley", 39.2084, -106.949, "https://www.aspensnowmass.com/", "https://www.aspensnowmass.com/four-mountains/snow-report"],
    ["cb", "Crested Butte", "Gunnison County", 38.8991, -106.9658, "https://www.skicb.com/", "https://www.skicb.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx"],
    ["wolfcreek", "Wolf Creek", "San Juan Mountains", 37.4747, -106.793, "https://wolfcreekski.com/", ""],
    ["telluride", "Telluride", "San Juan Mountains", 37.9375, -107.8123, "https://tellurideskiresort.com/", "https://tellurideskiresort.com/snow-report-pdf/"],
    ["purgatory", "Purgatory", "San Juan Mountains", 37.6303, -107.814, "https://www.purgatory.ski/", ""]
  ].map(function (r, i) {
    // Straight-line distance from Boulder, only used to order the list.
    var dy = r[3] - 40.015, dx = (r[4] + 105.2705) * Math.cos(40 * Math.PI / 180);
    return { id: r[0], name: r[1], area: r[2], lat: r[3], lon: r[4], site: r[5], report: r[6] || r[5], near: Math.sqrt(dx * dx + dy * dy), order: i };
  });
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var store = {
    get: function (k, maxAge) { try { var v = JSON.parse(localStorage.getItem(k)); return v && Date.now() - v.t < maxAge ? v.d : null; } catch (e) { return null; } },
    put: function (k, d) { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} }
  };
  var getJSON = function (url) {
    var once = function () { return fetch(url, { headers: { Accept: "application/geo+json" } }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
    // The weather service sometimes fails a request for a moment, so each one gets a second try.
    return once().catch(function () { return new Promise(function (ok) { setTimeout(ok, 1500); }).then(once); });
  };

  // "New snow accumulation of 1 to 3 inches possible." and its variations, turned into a low and high amount in inches.
  var snowIn = function (text) {
    var m = /snow accumulation of ([a-z0-9. ]+?) inch/i.exec(text || "");
    if (!m) return [0, 0];
    var p = m[1].toLowerCase(), n = p.match(/\d+(\.\d+)?/g) || [];
    if (/less than/.test(p)) return [0, n.length ? +n[0] : /half/.test(p) ? .5 : 1];
    if (n.length > 1) return [+n[0], +n[1]];
    if (n.length) return [+n[0], +n[0]];
    return /one/.test(p) ? [1, 1] : [0, 0];
  };
  var total = function (periods) {
    return periods.reduce(function (s, p) { var a = snowIn(p.detailedForecast); return [s[0] + a[0], s[1] + a[1]]; }, [0, 0]);
  };
  var inches = function (s) {
    if (!s[1]) return "None";
    if (!s[0] && s[1] <= 1) return "Under 1 in";
    return s[0] === s[1] ? s[1] + " in" : s[0] + "–" + s[1] + " in";
  };

  // Small weather icons drawn from the forecast words.
  var ICONS = {
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>',
    rain: '<path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.5 1.5 3.3 3.3 0 0 1 0 6.5zM9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
    storm: '<path d="M7 14a4 4 0 0 1 .5-8 5 5 0 0 1 9.5 1.5 3.3 3.3 0 0 1 0 6.5h-2M12 13l-2 4h3l-2 4"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1 .5-9 5.5 5.5 0 0 1 10.6 1.7A3.7 3.7 0 0 1 17.5 18z"/>',
    partly: '<path d="M9 3.5v1.5M3.5 9H5M5 5l1 1M13 5l-1 1M6.3 11.3A3.5 3.5 0 1 1 12.4 8M9 20a4 4 0 0 1 .4-8 5 5 0 0 1 9.5 1.6A3.2 3.2 0 0 1 18.5 20z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
    wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8"/>',
    fog: '<path d="M4 9h16M6 13h12M4 17h16"/>'
  };
  var icon = function (p) {
    var f = (p.shortForecast || "").toLowerCase(), k =
      /thunder/.test(f) ? "storm" : /snow|flurr|blizzard|sleet/.test(f) ? "snow" : /rain|shower|drizzle/.test(f) ? "rain" :
      /fog|haze|smoke/.test(f) ? "fog" : /wind|breezy|blustery/.test(f) ? "wind" : /partly|mostly sunny|mostly clear/.test(f) ? "partly" :
      /cloud|overcast/.test(f) ? "cloud" : p.isDaytime === false ? "moon" : "sun";
    return '<svg class="wx" viewBox="0 0 24 24" aria-hidden="true" data-wx="' + k + '">' + ICONS[k] + "</svg>";
  };

  var data = {}, sortBy = "near";
  var card = function (r) {
    var d = data[r.id], links =
      '<div class="resort-links"><a class="btn btn-line btn-sm" href="' + esc(r.report) + '" target="_blank" rel="noopener">Trails &amp; lifts open</a>' +
      '<a class="link-arrow" href="' + esc(r.site) + '" target="_blank" rel="noopener"><span>Website</span></a></div>';
    var head = '<div class="resort-head"><h3>' + esc(r.name) + '</h3><span class="fine">' + esc(r.area) + "</span></div>";
    if (!d) return '<li class="resort loading" data-id="' + r.id + '">' + head + '<div class="wx-now"><span class="skel"></span><span class="skel short"></span></div>' + links + "</li>";
    if (d.error) return '<li class="resort" data-id="' + r.id + '">' + head + '<p class="fine wx-error">The weather service didn\'t answer just now. Check back in a few minutes, or open the resort\'s report.</p>' + links + "</li>";
    var now = d.periods[0], next = d.periods[1];
    return '<li class="resort" data-id="' + r.id + '"' + (d.snow3[1] >= 3 ? ' data-powder=""' : "") + ">" + head +
      '<div class="wx-now">' + icon(now) + '<div><p class="temp"><strong>' + now.temperature + "°</strong> " + esc(now.name) + "</p>" +
      '<p class="fine">' + esc(now.shortForecast) + "</p></div></div>" +
      '<dl class="wx-stats"><div><dt>Snow, next 24 hrs</dt><dd>' + inches(d.snow1) + "</dd></div>" +
      "<div><dt>Snow, next 3 days</dt><dd>" + inches(d.snow3) + "</dd></div>" +
      "<div><dt>Wind</dt><dd>" + esc((now.windSpeed || "–").replace(" to ", "–")) + "</dd></div>" +
      (next ? "<div><dt>" + esc(next.name) + "</dt><dd>" + (next.isDaytime ? "High " : "Low ") + next.temperature + "°</dd></div>" : "") + "</dl>" + links + "</li>";
  };
  var draw = function () {
    var rs = R.slice().sort(sortBy === "snow"
      ? function (a, b) { var x = data[a.id], y = data[b.id]; return ((y && y.snow3 ? y.snow3[1] : -1) - (x && x.snow3 ? x.snow3[1] : -1)) || a.near - b.near; }
      : function (a, b) { return a.near - b.near; });
    list.innerHTML = rs.map(card).join("");
    var times = R.map(function (r) { return data[r.id] && data[r.id].updated; }).filter(Boolean).sort();
    var done = R.filter(function (r) { return data[r.id]; }).length;
    $updated.textContent = done < R.length ? "Loading the latest forecasts…" : times.length
      ? "Forecasts updated " + new Date(times[0]).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " or later"
      : "The weather service isn't answering right now. Try again in a few minutes.";
  };
  var $updated = document.getElementById("snow-updated");
  Array.prototype.forEach.call(document.querySelectorAll("[data-sort]"), function (b) {
    b.addEventListener("click", function () {
      sortBy = b.dataset.sort;
      Array.prototype.forEach.call(document.querySelectorAll("[data-sort]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      draw();
    });
  });

  var load = function (r) {
    var cached = store.get("jamo-wx-" + r.id, 30 * 60e3);
    if (cached) return Promise.resolve(cached);
    var grid = store.get("jamo-grid-" + r.id, 30 * 864e5);
    return (grid ? Promise.resolve(grid) : getJSON("https://api.weather.gov/points/" + r.lat + "," + r.lon).then(function (j) {
      var u = j.properties.forecast; store.put("jamo-grid-" + r.id, u); return u;
    })).then(getJSON).then(function (j) {
      var ps = j.properties.periods.slice(0, 6).map(function (p) {
        return { name: p.name, temperature: p.temperature, isDaytime: p.isDaytime, shortForecast: p.shortForecast, windSpeed: p.windSpeed, detailedForecast: p.detailedForecast };
      });
      var d = { periods: ps, snow1: total(ps.slice(0, 2)), snow3: total(ps), updated: j.properties.updateTime || j.properties.generatedAt };
      store.put("jamo-wx-" + r.id, d);
      return d;
    });
  };
  draw();
  // Four resorts at a time, so the weather service isn't asked for everything at once.
  var queue = R.slice().sort(function (a, b) { return a.near - b.near; });
  var worker = function () {
    var r = queue.shift(); if (!r) return Promise.resolve();
    return load(r).then(function (d) { data[r.id] = d; }, function () { data[r.id] = { error: true }; }).then(function () { draw(); return worker(); });
  };
  for (var i = 0; i < 4; i++) worker();
})();

// Time of day: the sky starts at the visitor's own time and keeps up with the clock. Dragging the sun along the slider in the header
// moves the sky, sun and mountain light (assets/sky.js does the coloring), and that time stays for the rest of the visit.
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
  setInterval(function () {
    if (sky.picked()) return;
    var t = sky.clock(); sky.set(t); dial.value = Math.round(t * dial.max); show(t);
  }, 60000);
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
