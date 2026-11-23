/* The Internet Catalysts — small progressive enhancements. The page works without this file. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Header: background on scroll + mobile menu ---------- */
  var header = document.querySelector("[data-header]");
  if (header) {
    var toggle = header.querySelector(".menu-toggle");
    var panel = document.getElementById("mobile-nav");

    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    var setOpen = function (open) {
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      header.classList.toggle("is-open", open);
    };
    toggle.addEventListener("click", function () { setOpen(panel.hidden); });
    panel.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) setOpen(false);
    });
  }

  /* ---------- Sliding top bar: duplicate the list so the loop is seamless ---------- */
  document.querySelectorAll("[data-marquee]").forEach(function (bar) {
    var track = bar.querySelector(".marquee-track");
    var group = track.querySelector(".marquee-group");
    track.appendChild(group.cloneNode(true));
    bar.classList.add("is-running");
  });

  /* ---------- Hero demo: thread scene ↔ subreddit scene ---------- */
  document.querySelectorAll("[data-demo]").forEach(function (demo) {
    var DURATION = 7500;
    var scenes = demo.querySelectorAll(".demo-scene");
    var tabs = demo.querySelectorAll(".demo-tab");
    var active = 0;
    var timer = null;
    demo.style.setProperty("--dur", DURATION + "ms");

    function show(index) {
      active = index;
      scenes.forEach(function (scene, i) {
        var on = i === index;
        scene.dataset.active = String(on);
        scene.setAttribute("aria-hidden", String(!on));
        scene.inert = !on;
      });
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.setAttribute("aria-pressed", String(on));
        tab.classList.remove("is-active");
        if (on) {
          void tab.offsetWidth; // restart the progress-bar animation
          tab.classList.add("is-active");
        }
      });
      clearTimeout(timer);
      if (!reduceMotion.matches) {
        timer = setTimeout(function () { show((active + 1) % scenes.length); }, DURATION);
      }
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { show(i); });
    });
    show(0);
  });

  /* ---------- Sheet forms (contact form, Reddit user form) ----------
     Each form posts to the Google Apps Script web app in its action="…", which adds a row to the
     Google Sheet and emails a copy. Backend code: google-apps-script/Code.gs in the GitHub repo
     (Ujjwal1327/ankit). data-required lists the fields the script insists on. */
  document.querySelectorAll("[data-sheet-form]").forEach(function (form) {
    var panel = form.parentElement;
    var success = panel.querySelector("[data-form-success]");
    var status = form.querySelector("[data-form-status]");
    var submitBtn = form.querySelector("[data-submit]");
    var submitLabel = form.querySelector("[data-submit-label]");
    var submitText = submitLabel.textContent;
    var required = (form.dataset.required || "").split(",").filter(Boolean);

    // Contact form: buttons around the site link here as contact.html?interest=pilot|enterprise|work|report
    var packageSelect = form.querySelector('select[name="package"]');
    var interest = new URLSearchParams(window.location.search).get("interest");
    if (interest && packageSelect) {
      Array.prototype.forEach.call(packageSelect.options, function (o) {
        if (o.dataset.interest === interest) packageSelect.value = o.value;
      });
    }

    var setStatus = function (message) {
      status.textContent = message || "";
    };
    var setSending = function (sending) {
      submitBtn.disabled = sending;
      submitLabel.textContent = sending ? "Sending…" : submitText;
    };
    var showSuccess = function () {
      form.hidden = true;
      success.hidden = false;
      success.focus();
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (submitBtn.disabled) return;
      setStatus("");

      var data = new FormData(form);

      // spam trap was filled: act like it worked, send nothing
      if (data.get("company_hp")) {
        form.reset();
        showSuccess();
        return;
      }

      // the sheet script rejects blank required fields, so catch whitespace-only answers here
      var missing = required.filter(function (k) { return !String(data.get(k) || "").trim(); });
      if (missing.length) {
        setStatus("Please fill in all the required fields.");
        form.elements[missing[0]].focus();
        return;
      }

      // Reddit user form: make sure the profile field looks like a Reddit profile
      var reddit = form.querySelector("[data-reddit-profile]");
      if (reddit && !/(reddit\.com\/(u|user)\/[^\s/]+|^\/?u\/[^\s/]+)/i.test(reddit.value.trim())) {
        setStatus("Please enter your Reddit profile link, like https://www.reddit.com/user/yourname");
        reddit.focus();
        return;
      }

      setSending(true);
      fetch(form.action, { method: "POST", body: new URLSearchParams(data) })
        .then(function (response) { return response.json(); })
        .then(function (result) {
          if (result.result !== "success") throw new Error(result.error || "Unknown error");
          form.reset();
          showSuccess();
        })
        .catch(function (err) {
          console.error("Form error:", err);
          setStatus("Something went wrong. Please try again, or email us directly.");
        })
        .finally(function () { setSending(false); });
    });

    var resetBtn = panel.querySelector("[data-form-reset]");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        form.reset();
        setStatus("");
        success.hidden = true;
        form.hidden = false;
        form.elements.name.focus();
      });
    }
  });

  /* ---------- Social dropdown: pick WhatsApp / Telegram / Discord, then the link box appears ---------- */
  document.querySelectorAll("[data-social-select]").forEach(function (select) {
    var field = select.form.querySelector("[data-social-field]");
    var input = field.querySelector("input");
    var label = field.querySelector("[data-social-label]");

    function update() {
      var option = select.options[select.selectedIndex];
      var chosen = Boolean(select.value);
      field.hidden = !chosen;
      input.disabled = !chosen; // disabled fields aren't sent
      input.required = chosen;
      if (chosen) {
        label.textContent = option.dataset.label;
        input.placeholder = option.dataset.placeholder;
      } else {
        input.value = "";
      }
    }

    select.addEventListener("change", function () {
      update();
      if (select.value) input.focus();
    });
    select.form.addEventListener("reset", function () { setTimeout(update, 0); });
    update();
  });

  /* ---------- Growth chart: built from data-points="Jan:2,Feb:3,…" ---------- */
  var SVG_NS = "http://www.w3.org/2000/svg";
  var chartCount = 0;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function niceMax(v) {
    var step = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / (step / 2)) * (step / 2);
  }

  document.querySelectorAll("[data-chart]").forEach(function (fig) {
    var data = fig.dataset.points.split(",").map(function (pair) {
      var parts = pair.split(":");
      return { label: parts[0].trim(), value: Number(parts[1]) };
    });
    if (data.length < 2) return;

    var title = fig.dataset.title || "Chart";
    var last = data.length - 1;
    var max = niceMax(Math.max.apply(null, data.map(function (d) { return d.value; })));
    var ticks = [0, max / 3, (2 * max) / 3, max].map(Math.round);
    var xp = function (i) { return (i / last) * 100; };
    var yp = function (v) { return 100 - (v / max) * 100; };
    var gradId = "chart-grad-" + ++chartCount;

    // header
    var head = el("figcaption", "chart-head");
    head.append(el("span", null, title), el("span", null, "Last " + data.length + " months"));
    var total = el("p", "chart-total", String(data[last].value));
    total.append(el("span", null, "in " + data[last].label));

    // plot
    var wrap = el("div", "chart-plot-wrap");
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", title + ": grew from " + data[0].value + " in " + data[0].label +
      " to " + data[last].value + " in " + data[last].label + ". Use left and right arrow keys to read each month.");
    var plot = el("div", "chart-plot");
    wrap.append(plot);

    ticks.forEach(function (t) {
      var tick = el("div", "chart-tick");
      tick.style.top = yp(t) + "%";
      tick.append(el("span", null, String(t)));
      plot.append(tick);
    });
    data.forEach(function (d, i) {
      if ((last - i) % 2 !== 0) return; // every other month, always including the latest
      var x = el("span", "chart-x", d.label);
      x.style.left = xp(i) + "%";
      plot.append(x);
    });

    var line = data.map(function (d, i) {
      return (i === 0 ? "M" : "L") + xp(i).toFixed(2) + "," + yp(d.value).toFixed(2);
    }).join(" ");
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML =
      '<defs><linearGradient id="' + gradId + '" x1="0" x2="0" y1="0" y2="1">' +
      '<stop offset="0%" stop-color="#e0480b" stop-opacity="0.14"/>' +
      '<stop offset="100%" stop-color="#e0480b" stop-opacity="0.02"/></linearGradient></defs>' +
      '<path d="' + line + ' L100,100 L0,100 Z" fill="url(#' + gradId + ')"/>' +
      '<path d="' + line + '" fill="none" stroke="#e0480b" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
    plot.append(svg);

    var endDot = el("span", "chart-dot");
    endDot.style.left = xp(last) + "%";
    endDot.style.top = yp(data[last].value) + "%";
    var cross = el("div", "chart-cross");
    var hoverDot = el("span", "chart-dot");
    var tip = el("div", "chart-tip");
    var tipValue = el("strong");
    var tipLabel = el("small");
    tip.append(tipValue, tipLabel);
    cross.hidden = hoverDot.hidden = tip.hidden = true;
    var hit = el("div", "chart-hit");
    plot.append(endDot, cross, hoverDot, tip, hit);

    // screen-reader table
    var table = el("table", "sr-only");
    var caption = el("caption", null, title);
    var tbody = el("tbody");
    data.forEach(function (d) {
      var tr = el("tr");
      var th = el("th", null, d.label);
      th.scope = "row";
      tr.append(th, el("td", null, String(d.value)));
      tbody.append(tr);
    });
    table.append(caption, tbody);

    fig.replaceChildren(head, total, wrap, table);

    // hover / keyboard
    var current = null;
    function setHover(i) {
      current = i;
      var off = i === null;
      cross.hidden = tip.hidden = off;
      hoverDot.hidden = off || i === last;
      if (off) return;
      var left = xp(i) + "%";
      var top = yp(data[i].value);
      cross.style.left = left;
      hoverDot.style.left = left;
      hoverDot.style.top = top + "%";
      tipValue.textContent = String(data[i].value);
      tipLabel.textContent = data[i].label;
      tip.style.left = left;
      tip.style.top = "calc(" + top + "% - 10px)";
      var shiftX = i > last * 0.75 ? "-100%" : i < last * 0.15 ? "0%" : "-50%";
      tip.style.transform = "translate(" + shiftX + ", -100%)";
    }
    function fromPointer(e) {
      var rect = plot.getBoundingClientRect();
      var i = Math.round(((e.clientX - rect.left) / rect.width) * last);
      setHover(Math.max(0, Math.min(last, i)));
    }
    hit.addEventListener("pointermove", fromPointer);
    hit.addEventListener("pointerdown", fromPointer);
    hit.addEventListener("pointerleave", function () { setHover(null); });
    wrap.addEventListener("blur", function () { setHover(null); });
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") setHover(Math.min(last, current === null ? 0 : current + 1));
      else if (e.key === "ArrowLeft") setHover(Math.max(0, current === null ? last : current - 1));
      else if (e.key === "Escape") setHover(null);
      else return;
      e.preventDefault();
    });
  });
})();
