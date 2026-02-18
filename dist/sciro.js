const Sciro = (() => {
  let config = {}
  let events = []

  // We use last "stable" playback time as the "from" time for seeks
  let lastStableTime = 0

  // Seeking state
  let seekFrom = null
  let lastRewindRecordedAt = 0

  // Trigger control (continuous, but not spammy)
  let lastInsightTime = 0

  // UI state
  let uiRootEl = null
  let uiDismissTimer = null

  const WINDOW_MS = 60000               // rolling window
  const MIN_REWIND_SECONDS = 2.5        // ignore tiny scrubs
  const SEEK_DEBOUNCE_MS = 500          // one drag should count once
  const COOLDOWN_MS = 12000             // allow repeated triggers, but not every second

  function init(userConfig) {
    config = userConfig || {}
    attachVideoListeners()
  }

  function attachVideoListeners() {
    const video = config.videoElement
    if (!video) throw new Error("Sciro.init requires { videoElement }")

    // Keep updating lastStableTime during normal playback
    video.addEventListener("timeupdate", () => {
      lastStableTime = video.currentTime
    })

    // When a seek starts, capture the "from" time
    video.addEventListener("seeking", () => {
      if (seekFrom === null) seekFrom = lastStableTime
    })

    // When the seek ends, decide if it was a rewind
    video.addEventListener("seeked", () => {
      const now = Date.now()
      const toTime = video.currentTime
      const fromTime = seekFrom ?? lastStableTime
      seekFrom = null

      const delta = fromTime - toTime // positive means backwards

      // Debounce: avoid multiple rewind counts from one drag/seek
      if (now - lastRewindRecordedAt < SEEK_DEBOUNCE_MS) return

      if (delta >= MIN_REWIND_SECONDS) {
        lastRewindRecordedAt = now
        trackEvent("rewind", {
          fromTime: round2(fromTime),
          toTime: round2(toTime),
          delta: round2(delta),
        })
      }
    })
  }

  function trackEvent(type, meta = {}) {
    events.push({ type, meta, timestamp: Date.now() })
    cleanOldEvents()
    evaluateState()
  }

  function cleanOldEvents() {
    const cutoff = Date.now() - WINDOW_MS
    events = events.filter(e => e.timestamp > cutoff)
  }

  function evaluateState() {
    const now = Date.now()
    if (now - lastInsightTime < COOLDOWN_MS) return

    const rewindEvents = events.filter(e => e.type === "rewind")
    const rewinds = rewindEvents.length

    // ✅ v1 rule: ONLY after 2 rewinds in the rolling window
    if (rewinds >= 2) {
      const insight = buildInsightPayload({
        state: "confused",
        confidence: confidenceFromRewinds(rewinds),
        rewinds,
        rewindEvents,
      })

      emitInsight(insight)
      sendInsightToApi(insight)
      maybeRenderUI(insight) // ✅ NEW: render custom alert if configured

      lastInsightTime = now
    }
  }

  function buildInsightPayload({ state, confidence, rewinds, rewindEvents }) {
    const video = config.videoElement

    // Most useful rewind info: last rewind + all rewinds in window
    const rewindsInWindow = rewindEvents.map(e => ({
      fromTime: e.meta.fromTime,
      toTime: e.meta.toTime,
      delta: e.meta.delta,
      at: e.timestamp,
    }))

    const lastRewind = rewindsInWindow[rewindsInWindow.length - 1] || null

    return {
      // Core insight
      event_type: "sciro.insight",
      insight_type: "learner_state",
      state,
      confidence,

      // Counts / debug
      rewinds,

      // Video context
      video_current_time: round2(video?.currentTime ?? 0),
      video_duration: round2(video?.duration ?? 0),

      // Rewind context
      last_rewind: lastRewind,
      rewinds_in_window: rewindsInWindow,

      // Optional identifiers (provided by integrator)
      user_id: config.userId ?? null,
      topic: config.topic ?? null,
      lesson_id: config.lessonId ?? null,
      session_id: config.sessionId ?? null,

      // Timing
      window_ms: WINDOW_MS,
      created_at: new Date().toISOString(),

      // Useful extras (safe + helpful)
      sdk: { name: "sciro-inline", version: "0.2.0" },
      page: {
        url: safe(() => window.location.href),
        referrer: safe(() => document.referrer) || null,
        user_agent: safe(() => navigator.userAgent),
      },
    }
  }

  function emitInsight(insight) {
    config.onInsight?.(insight)
  }

  async function sendInsightToApi(insight) {
    const endpoint = config.apiEndpoint

    // ✅ If no endpoint, simulate the POST
    if (!endpoint) {
      console.log("[Sciro] (SIMULATED) Would POST to apiEndpoint:", insight)
      return
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(insight),
      })

      if (!res.ok) {
        console.warn("[Sciro] Webhook failed:", res.status, await safeJson(res))
      } else {
        console.log("[Sciro] Webhook sent ✅", { status: res.status })
      }
    } catch (err) {
      console.warn("[Sciro] Webhook error:", err)
    }
  }

  // -----------------------------
  // ✅ UI PLUGIN SYSTEM (NEW)
  // -----------------------------

  function maybeRenderUI(insight) {
    const ui = config.ui
    if (!ui || typeof ui.render !== "function") return

    const root = getOrCreateUiRoot(ui)

    const html = ui.render({
      insight,
      actions: {
        dismiss: () => dismissUi("dismiss", insight),
        action: (name) => dismissUi(name, insight),
      },
    })

    // If integrator returns nothing, do nothing
    if (!html) return

    root.innerHTML = html
    wireUiClicks(root, insight, ui)

    // Optional auto-dismiss
    const autoMs = typeof ui.autoDismissMs === "number" ? ui.autoDismissMs : 15000
    if (autoMs > 0) {
      clearTimeout(uiDismissTimer)
      uiDismissTimer = setTimeout(() => dismissUi("auto_dismiss", insight), autoMs)
    }
  }

  function getOrCreateUiRoot(ui) {
    if (uiRootEl) return uiRootEl

    const id = ui.containerId || "sciro-alert-root"
    let el = document.getElementById(id)

    // If not present, create a default floating container
    if (!el) {
      el = document.createElement("div")
      el.id = id
      document.body.appendChild(el)

      // Default positioning (integrator can override with CSS)
      el.style.position = "fixed"
      el.style.right = "16px"
      el.style.bottom = "16px"
      el.style.width = "360px"
      el.style.maxWidth = "calc(100vw - 32px)"
      el.style.zIndex = "9999"
    }

    uiRootEl = el
    return uiRootEl
  }

  function wireUiClicks(root, insight, ui) {
    root.querySelectorAll("[data-sciro]").forEach((el) => {
      el.addEventListener("click", () => {
        const action = el.getAttribute("data-sciro") || "unknown"

        // Dismiss UI for any action (keeps v1 simple)
        dismissUi(action, insight)

        // Notify integrator
        if (typeof ui.onAction === "function") {
          ui.onAction(action, insight)
        }
      })
    })
  }

  function dismissUi(reason, insight) {
    if (!uiRootEl) return
    clearTimeout(uiDismissTimer)
    uiDismissTimer = null
    uiRootEl.innerHTML = ""

    // Optional: log action
    if (config.debug) {
      console.log("[Sciro] UI action:", reason, insight)
    }
  }

  // -----------------------------
  // Helpers
  // -----------------------------

  function confidenceFromRewinds(rewinds) {
    if (rewinds >= 4) return 0.92
    if (rewinds === 3) return 0.88
    return 0.84 // rewinds === 2
  }

  function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100
  }

  function safe(fn) {
    try { return fn() } catch { return null }
  }

  async function safeJson(res) {
    try { return await res.json() } catch { return await res.text() }
  }

  return { init }
})()
