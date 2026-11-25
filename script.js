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

  /* ---------- Light interactions: scroll reveal, active nav link, lit steps ----------
     The hidden "before" state only applies when <html> has the "js" class (set by a tiny inline script
     in each page's <head>), so without JavaScript everything is simply visible. */
  var root = document.documentElement;

  if (!("IntersectionObserver" in window)) {
    root.classList.remove("js");
    return;
  }

  // 1. Sections and cards fade up as they scroll into view.
  //    Keep this list in sync with the "Scroll reveal" rule in styles.css.
  var REVEAL = ".section .section-head, .feature, .compare > .own-card, .compare > .how-card, .case, .more-work, " +
    ".plans > .plan, .faq-list, .cta-box, .contact-intro, .contact-panel, .legal-head, .legal-grid";
  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(REVEAL).forEach(function (el) { revealObserver.observe(el); });
  root.classList.add("reveal-ready");

  // 2. Navbar: underline the link for the section you're reading
  var navLinks = document.querySelectorAll('.main-nav a[href^="#"], .mobile-nav a[href^="#"]');
  var spyTargets = [];
  navLinks.forEach(function (link) {
    var target = document.getElementById(link.getAttribute("href").slice(1));
    if (target && spyTargets.indexOf(target) === -1) spyTargets.push(target);
  });
  if (spyTargets.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var hash = "#" + entry.target.id;
        navLinks.forEach(function (link) { link.classList.toggle("is-active", link.getAttribute("href") === hash); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    spyTargets.forEach(function (t) { spy.observe(t); });
  }

  // 3. How We Work: each step number lights up as you reach it (and stays lit)
  var stepObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-lit");
      stepObserver.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -35% 0px" });
  document.querySelectorAll(".steps li").forEach(function (li) { stepObserver.observe(li); });

})();
