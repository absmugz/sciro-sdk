const Sciro = (() => {
  let config = {}
  let events = []

  // Video state
  let lastStableTime = 0
  let seekFrom = null
  let lastSeekRecordedAt = 0
  let lastInsightAt = 0
  let lastEmittedState = null
  let lastEmittedAt = 0

  // UI state
  let uiRootEl = null
  let uiDismissTimer = null

  // Defaults (override via Sciro.init({ rules: {...} }))
  const DEFAULTS = {
    // Detection window becomes adaptive if windowMs is null
    windowMs: null,

    // Signal thresholds
    minRewindSeconds: 2.5,
    seekDebounceMs: 500,
    cooldownMs: 8000, // how often we may emit insights
    minRewinds: 2,

    // Segment logic (where in the video)
    segmentSizeSeconds: 20, // bucket rewinds into segments of N seconds

    // Extra signals
    pauseNearRewindSeconds: 6, // pause within N seconds after rewind counts
    minPauseSeconds: 1.0,      // only count “real” pauses

    // Emission policy
    emitOnlyOnStateChange: true,
    emitStateRefreshMs: 30000, // if state unchanged, emit refresh at most every X ms

    // Confidence weights (tweak for clients)
    weights: {
      rewinds: 0.45,
      sameSegment: 0.35,
      pauseNearRewind: 0.20,
    },
  }

  function init(userConfig) {
    config = userConfig || {}
    config.rules = { ...DEFAULTS, ...(config.rules || {}) }
    attachVideoListeners()
  }

  function attachVideoListeners() {
    const video = config.videoElement
    if (!video) throw new Error("Sciro.init requires { videoElement }")

    video.addEventListener("timeupdate", () => {
      lastStableTime = video.currentTime
    })

    video.addEventListener("seeking", () => {
      if (seekFrom === null) seekFrom = lastStableTime
    })

    video.addEventListener("seeked", () => {
      const now = Date.now()
      const toTime = video.currentTime
      const fromTime = seekFrom ?? lastStableTime
      seekFrom = null

      const delta = fromTime - toTime // positive => rewind

      if (now - lastSeekRecordedAt < config.rules.seekDebounceMs) return

      if (delta >= config.rules.minRewindSeconds) {
        lastSeekRecordedAt = now
        trackEvent("rewind", {
          fromTime: round2(fromTime),
          toTime: round2(toTime),
          delta: round2(delta),
          segment: segmentFor(toTime, config.rules.segmentSizeSeconds),
        })
      }
    })

    // Extra signal: pause duration (optional, but useful)
    let pauseStartedAt = null
    video.addEventListener("pause", () => {
      pauseStartedAt = Date.now()
      trackEvent("pause", { t: round2(video.currentTime) })
    })
    video.addEventListener("play", () => {
      if (pauseStartedAt) {
        const dur = (Date.now() - pauseStartedAt) / 1000
        pauseStartedAt = null
        if (dur >= config.rules.minPauseSeconds) {
          trackEvent("pause_duration", { seconds: round2(dur), t: round2(video.currentTime) })
        }
      }
    })
  }

  function trackEvent(type, meta = {}) {
    events.push({ type, meta, timestamp: Date.now() })
    cleanOldEvents()
    evaluateState()
  }

  function cleanOldEvents() {
    const cutoff = Date.now() - getWindowMs()
    events = events.filter(e => e.timestamp > cutoff)
  }

  function getWindowMs() {
    // Adaptive window (recommended): scale window by video length
    const video = config.videoElement
    if (typeof config.rules.windowMs === "number") return config.rules.windowMs

    const duration = Number(video?.duration || 0)
    if (!duration || !isFinite(duration)) return 60000

    // Heuristic: window is 8% of duration, clamped between 30s and 120s
    const ms = Math.round(duration * 0.08 * 1000)
    return clamp(ms, 30000, 120000)
  }

  function evaluateState() {
    const now = Date.now()
    if (now - lastInsightAt < config.rules.cooldownMs) return

    const rewindEvents = events.filter(e => e.type === "rewind")
    const rewinds = rewindEvents.length

    // Not enough signal => likely ok
    if (rewinds < config.rules.minRewinds) {
      maybeEmit(buildInsightPayload({ state: "ok", confidence: 0.25, rewinds, rewindEvents }))
      lastInsightAt = now
      return
    }

    // Segment concentration: repeated rewinds in same part of the video is stronger signal
    const segmentCounts = countBy(rewindEvents, e => String(e.meta.segment ?? "unknown"))
    const maxSegmentRewinds = Math.max(...Object.values(segmentCounts))
    const dominantSegment = Object.entries(segmentCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? null

    // Pause near last rewind
    const lastRewind = rewindEvents[rewinds - 1]
    const pauseNear = didPauseNear(lastRewind?.timestamp, config.rules.pauseNearRewindSeconds)

    // Compute confidence from signal strength
    const confidence = computeConfidence({
      rewinds,
      maxSegmentRewinds,
      pauseNear,
      rules: config.rules,
    })

    const state = confidence >= 0.75 ? "confused" : "struggling"

    maybeEmit(buildInsightPayload({
      state,
      confidence,
      rewinds,
      rewindEvents,
      extra: {
        dominant_segment: dominantSegment,
        max_segment_rewinds: maxSegmentRewinds,
        pause_near_rewind: pauseNear,
      }
    }))

    lastInsightAt = now
  }

  function didPauseNear(rewindTimestamp, withinSeconds) {
    if (!rewindTimestamp) return false
    const withinMs = withinSeconds * 1000
    return events.some(e =>
      (e.type === "pause" || e.type === "pause_duration") &&
      e.timestamp >= rewindTimestamp &&
      e.timestamp <= rewindTimestamp + withinMs
    )
  }

  function maybeEmit(insight) {
    const now = Date.now()
    const stateChanged = insight.state !== lastEmittedState
    const refreshAllowed = (now - lastEmittedAt) >= config.rules.emitStateRefreshMs

    if (config.rules.emitOnlyOnStateChange) {
      if (!stateChanged && !refreshAllowed) return
    }

    lastEmittedState = insight.state
    lastEmittedAt = now

    emitInsight(insight)
    sendInsightToApi(insight)
    maybeRenderUI(insight)
  }

  function buildInsightPayload({ state, confidence, rewinds, rewindEvents, extra = {} }) {
    const video = config.videoElement

    const rewindsInWindow = rewindEvents.map(e => ({
      fromTime: e.meta.fromTime,
      toTime: e.meta.toTime,
      delta: e.meta.delta,
      segment: e.meta.segment,
      at: e.timestamp,
    }))

    const lastRewind = rewindsInWindow[rewindsInWindow.length - 1] || null

    return {
      event_type: "sciro.insight",
      insight_type: "learner_state",
      state,
      confidence: round2(confidence),

      rewinds,
      video_current_time: round2(video?.currentTime ?? 0),
      video_duration: round2(video?.duration ?? 0),

      last_rewind: lastRewind,
      rewinds_in_window: rewindsInWindow,

      // Extra computed context
      ...extra,

      user_id: config.userId ?? null,
      topic: config.topic ?? null,
      lesson_id: config.lessonId ?? null,
      session_id: config.sessionId ?? null,

      window_ms: getWindowMs(),
      created_at: new Date().toISOString(),

      sdk: { name: "sciro-inline", version: "0.3.0" },
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
    if (!endpoint) {
      if (config.debug) console.log("[Sciro] (SIMULATED) Would POST:", insight)
      return
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(insight),
      })
      if (!res.ok) console.warn("[Sciro] Webhook failed:", res.status, await safeJson(res))
      else if (config.debug) console.log("[Sciro] Webhook sent ✅", { status: res.status })
    } catch (err) {
      console.warn("[Sciro] Webhook error:", err)
    }
  }

  // -----------------------------
  // UI PLUGIN SYSTEM
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

    if (!html) return

    root.innerHTML = html
    wireUiClicks(root, insight, ui)

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

    if (!el) {
      el = document.createElement("div")
      el.id = id
      document.body.appendChild(el)

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
        dismissUi(action, insight)
        if (typeof ui.onAction === "function") ui.onAction(action, insight)
      })
    })
  }

  function dismissUi(reason, insight) {
    if (!uiRootEl) return
    clearTimeout(uiDismissTimer)
    uiDismissTimer = null
    uiRootEl.innerHTML = ""
    if (config.debug) console.log("[Sciro] UI action:", reason, insight)
  }

  // -----------------------------
  // Confidence + helpers
  // -----------------------------

  function computeConfidence({ rewinds, maxSegmentRewinds, pauseNear, rules }) {
    // Normalize signals into 0..1
    const rewindScore = clamp((rewinds - rules.minRewinds) / 4, 0, 1) // 2->0, 6->1
    const segmentScore = clamp((maxSegmentRewinds - 1) / 3, 0, 1)     // 1->0, 4->1
    const pauseScore = pauseNear ? 1 : 0

    const w = rules.weights
    const blended =
      rewindScore * w.rewinds +
      segmentScore * w.sameSegment +
      pauseScore * w.pauseNearRewind

    // Map to a more realistic confidence range
    return 0.55 + blended * 0.4 // 0.55..0.95
  }

  function segmentFor(timeSeconds, segmentSizeSeconds) {
    const t = Number(timeSeconds || 0)
    const size = Math.max(5, Number(segmentSizeSeconds || 20))
    return Math.floor(t / size)
  }

  function countBy(arr, keyFn) {
    const out = {}
    for (const item of arr) {
      const k = keyFn(item)
      out[k] = (out[k] || 0) + 1
    }
    return out
  }

  function clamp(n, a, b) {
    return Math.min(b, Math.max(a, n))
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