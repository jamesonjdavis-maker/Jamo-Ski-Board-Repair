// Jamo's sky: turns a time of day into the colors of the sky, the sun or moon, and the light on the mountains.
// Time runs from 0 to 1: 0 is midnight, .25 sunrise, .5 noon, .75 sunset. Each visit starts at the visitor's own time of day,
// using Boulder's sunrise and sunset for today. A time they drag to is kept for the rest of that visit, across pages.
// This file loads in the page head so the sky is right before the page paints. site.js connects the drag slider in the header.
(function () {
  // Colors at night, sunrise, noon and sunset. Pairs are [lit side, shade side]; sky is five stops from top to horizon.
  var KEYS = [
    { sky: ["#07111b", "#0c1d2c", "#132637", "#1a2e41", "#213649"], sun: "#e8eef2", glow: "#e8eef2",
      far: ["#3a5873", "#1c2f42"], farcap: ["#93abbd", "#4e6577"], mid: ["#2c4560", "#162638"], midcap: ["#7690a3", "#3f5668"],
      rock: ["#74442f", "#3f2419"], ta: ["#1f3e36", "#0f231e"], tb: ["#294c3f", "#142c24"], tc: ["#4a633f", "#273a25"],
      td: ["#88502e", "#4d2a17"], te: "#8d9aa3", trunk: "#2a2420", floor: "#13261f", shade: "#16222b" },
    { sky: ["#86a7d3", "#a9bedc", "#e3cdc9", "#f5c1a5", "#f8d39f"], sun: "#fff3dc", glow: "#ffc89c",
      far: ["#ecc9c2", "#8a92ad"], farcap: ["#fff1ea", "#d9c2c6"], mid: ["#bfa7ab", "#6d7a97"], midcap: ["#fde3dc", "#c8b4bc"],
      rock: ["#e08d62", "#874a38"], ta: ["#3e5e4c", "#223a2f"], tb: ["#5b7b56", "#344c37"], tc: ["#aa9e5f", "#6b6a43"],
      td: ["#e8904c", "#9c5530"], te: "#f1ddd2", trunk: "#5a4034", floor: "#2f4a3c", shade: "#ead8d4" },
    { sky: ["#1b4db3", "#2560c4", "#2f6dcc", "#5f9fe2", "#a6cff1"], sun: "#fffdf4", glow: "#fff1cc",
      far: ["#c9d5e2", "#6f88a6"], farcap: ["#ffffff", "#c6d6e7"], mid: ["#9aaec0", "#556c86"], midcap: ["#f6f9fc", "#b3c5d7"],
      rock: ["#d37d52", "#8c4a30"], ta: ["#32634b", "#1b3a2c"], tb: ["#518653", "#2d5434"], tc: ["#9cae5e", "#5e7140"],
      td: ["#e08842", "#a2552a"], te: "#eeeae0", trunk: "#5b4636", floor: "#24453a", shade: "#dde5ea" },
    { sky: ["#2c3f78", "#3a538e", "#5b6696", "#d0866b", "#f2b467"], sun: "#ffe7b8", glow: "#ffa860",
      far: ["#eeb48c", "#6b6c8e"], farcap: ["#ffe0c2", "#c6a7a6"], mid: ["#c09280", "#525c7e"], midcap: ["#f7cfab", "#b29797"],
      rock: ["#e9824b", "#7a3d2b"], ta: ["#405341", "#1f2d2a"], tb: ["#5f7048", "#33402f"], tc: ["#ae8e4b", "#69583a"],
      td: ["#ec7f3c", "#984926"], te: "#f3cfae", trunk: "#4a352b", floor: "#2b3a33", shade: "#e3d3cc" }
  ];
  var PAIRS = ["far", "farcap", "mid", "midcap", "rock", "ta", "tb", "tc", "td"];
  var SUN_ICON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'%3E%3Ccircle cx='13' cy='13' r='13' fill='%23ffc94d'/%3E%3Ccircle cx='13' cy='13' r='7' fill='%23fff3cf'/%3E%3C/svg%3E\")";
  var MOON_ICON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'%3E%3Ccircle cx='13' cy='13' r='13' fill='%23182838'/%3E%3Cpath d='M18 17.5A7.5 7.5 0 0 1 9.5 7a7.5 7.5 0 1 0 8.5 10.5z' fill='%23e8eef2'/%3E%3C/svg%3E\")";

  var hex = function (h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
  KEYS.forEach(function (k) {
    for (var n in k) k[n] = typeof k[n] === "string" ? hex(k[n]) : k[n].map(hex);
  });
  var mix = function (a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; };
  var rgb = function (c, a) { c = c.map(Math.round); return a == null ? "rgb(" + c + ")" : "rgba(" + c + "," + a + ")"; };
  // Relative luminance, used to keep text over the sky readable at every time of day.
  var lin = function (v) { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  var lum = function (c) { return .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]); };
  var INK = hex("#0b1a2a"), WHITE = [255, 255, 255];
  // Moves a color toward a target just far enough to pass a luminance limit.
  var push = function (c, to, ok) {
    if (ok(c)) return c;
    var lo = 0, hi = 1;
    for (var n = 0; n < 12; n++) { var m = (lo + hi) / 2; if (ok(mix(c, to, m))) hi = m; else lo = m; }
    return mix(c, to, hi);
  };
  var pct = function (v) { return (v * 100).toFixed(2) + "%"; };
  var root = document.documentElement, now = .5, night = null, picked = false;

  function name(t) { return t < .15 || t > .85 ? "Night" : t < .36 ? "Sunrise" : t < .64 ? "Day" : "Sunset"; }

  function set(t, save) {
    now = t = Math.min(1, Math.max(0, t));
    var s = root.style, at = t * 4 % 4, i = Math.floor(at) % 4, k = at - Math.floor(at);
    k = k * k * (3 - 2 * k); // ease so each time of day lingers a little
    var A = KEYS[i], B = KEYS[(i + 1) % 4], c = {};
    for (var n in A) c[n] = Array.isArray(A[n][0]) ? A[n].map(function (v, j) { return mix(v, B[n][j], k); }) : mix(A[n], B[n], k);

    // The sun crosses the sky from sunrise to sunset; the moon takes the other half of the day.
    var isDay = t >= .25 && t <= .75, p = isDay ? (t - .25) * 2 : ((t + .25) % 1) * 2;
    var x = .08 + .84 * p, arc = Math.sin(Math.PI * p);
    s.setProperty("--sun-x", pct(x)); s.setProperty("--sun-y", pct(.62 - .54 * arc));
    s.setProperty("--sun-o", Math.min(1, arc * 3).toFixed(3));
    s.setProperty("--sun", isDay
      ? "radial-gradient(circle, " + rgb(c.sun) + " 0 16%, " + rgb(c.glow, .55) + " 28%, " + rgb(c.glow, 0) + " 68%)"
      : "radial-gradient(circle, " + rgb(KEYS[0].sun) + " 0 10%, " + rgb(KEYS[0].sun, .14) + " 12%, " + rgb(KEYS[0].sun, 0) + " 46%)");
    s.setProperty("--thumb", isDay ? SUN_ICON : MOON_ICON);
    s.setProperty("--star-o", (Math.min(1, Math.max(0, (Math.abs(t - .5) - .22) / .1)) * .75).toFixed(3));

    // The top of the sky sits behind the header text, so it never stays in the middle tones where no text color reads well.
    var top = lum(c.sky[0]) < .24 ? push(c.sky[0], INK, function (v) { return lum(v) <= .12; })
                                  : push(c.sky[0], WHITE, function (v) { return lum(v) >= .5; });
    c.sky[0] = top;
    s.setProperty("--sky-top", rgb(top));
    s.setProperty("--sky", "linear-gradient(180deg, " + c.sky.map(function (v, j) { return rgb(v) + " " + [0, 20, 38, 56, 74][j] + "%"; }).join(", ") + ")");

    // Faces turned toward the sun get its light; the others fall into shade.
    var lit = .5 + .45 * Math.max(-1, Math.min(1, (.5 - x) * 2.4 + .35));
    PAIRS.forEach(function (n) {
      s.setProperty("--" + n + "-l", rgb(mix(c[n][1], c[n][0], lit)));
      s.setProperty("--" + n + "-r", rgb(mix(c[n][1], c[n][0], 1 - lit)));
    });
    s.setProperty("--te", rgb(c.te)); s.setProperty("--trunk", rgb(c.trunk));
    s.setProperty("--floor", rgb(c.floor)); s.setProperty("--snow-shade", rgb(c.shade));

    // Text over the sky: dark when the sky is pale (around sunrise), light the rest of the time.
    // Panels behind the page text are a frosted piece of that same sky, dense enough to read over white snow or dark trees.
    var pale = lum(top) >= .3, dark = lum(top) < .03, isNight = t < .15 || t > .85;
    s.setProperty("--scene-ink", pale ? "#13202a" : dark ? "#e8ecee" : "#ffffff");
    s.setProperty("--scene-muted", pale ? "#3d4853" : dark ? "#b4c0c9" : "#dce8f8");
    s.setProperty("--scene-em", pale ? "#9c3a24" : dark ? "#8dbbe3" : "#ffd66e");
    s.setProperty("--sky-line", pale ? "rgba(19, 32, 42, .14)" : "rgba(255, 255, 255, .18)");
    s.setProperty("--glass", pale ? "rgba(255, 255, 255, .84)" : rgb(push(mix(top, INK, .3), INK, function (v) { return lum(v) <= .06; }), .86));
    s.setProperty("--glass-line", pale ? "rgba(255, 255, 255, .9)" : "rgba(255, 255, 255, .2)");

    if (isNight !== night) {
      night = isNight;
      if (isNight) root.dataset.time = "night"; else delete root.dataset.time;
      if (document.body) document.dispatchEvent(new Event("jamo-time"));
    }
    if (save) { picked = true; try { sessionStorage.setItem("jamo-sky", String(t)); } catch (e) {} }
  }

  // The time of day right now on the visitor's clock, placed so Boulder's sunrise lands on .25 and sunset on .75.
  // Dawn and dusk last about an hour and a quarter, the glow around sunrise and sunset about an hour and a half; night and midday hold steady.
  function clock(d) {
    d = d || new Date();
    var rad = Math.PI / 180, lat = 40.015 * rad, n = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    var dec = 23.44 * rad * Math.sin(2 * Math.PI * (284 + n) / 365);
    var day = 2 / 15 / rad * Math.acos((Math.sin(-.833 * rad) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec)));
    var b = 2 * Math.PI * (n - 81) / 364, late = (9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)) / 60;
    // Solar noon in Boulder is near 12:00 on standard time, an hour later on daylight time, nudged by the time of year.
    var jan = new Date(d.getFullYear(), 0, 1).getTimezoneOffset(), jul = new Date(d.getFullYear(), 6, 1).getTimezoneOffset();
    var noon = 12 + .018 - late + (d.getTimezoneOffset() < Math.max(jan, jul) ? 1 : 0);
    var rise = noon - day / 2, set = noon + day / 2, h = d.getHours() + d.getMinutes() / 60, T = 1.25, D = 1.5;
    if (h < rise - T) h += 24;
    var marks = [[rise - T, .05], [rise, .25], [rise + D, .4], [set - D, .6], [set, .75], [set + T, .95], [rise - T + 24, 1.05]];
    for (var i = 1; i < marks.length; i++) {
      var a = marks[i - 1], b = marks[i];
      if (h <= b[0]) return (a[1] + (b[1] - a[1]) * (h - a[0]) / (b[0] - a[0])) % 1;
    }
    return .05;
  }

  var start = clock();
  try {
    localStorage.removeItem("jamo-sky"); localStorage.removeItem("jamo-time"); // picks saved by earlier versions of the site
    var saved = sessionStorage.getItem("jamo-sky");
    if (saved !== null && !isNaN(parseFloat(saved))) { start = parseFloat(saved); picked = true; }
  } catch (e) {}
  set(start);
  window.JamoSky = { set: set, get: function () { return now; }, name: name, clock: clock, picked: function () { return picked; } };
})();
