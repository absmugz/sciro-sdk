# Sciro SDK

Detect learner confusion in video-based lessons using rewind behavior.

Sciro observes video seek events and emits structured **insight events** when it detects potential confusion (e.g. multiple rewinds within a short window).

---

## 🚀 Installation

Add the SDK script to your page:

```html
<script src="https://sciro-sdk.pages.dev/sciro.js"></script>
```

Then initialize:

```html
<script>
  const video = document.querySelector("video")

  Sciro.init({
    videoElement: video,
    onInsight: (insight) => {
      console.log("Sciro insight:", insight)
    }
  })
</script>
```

That’s it.

---

## 🧠 How It Works (v0.3+)

Sciro monitors:

- `timeupdate`
- `seeking`
- `seeked`
- `pause` / `play` (optional signal strength)

It detects meaningful rewinds (default: ≥ 2.5 seconds). It also considers **where** rewinds happen (segment concentration) and whether a learner **pauses shortly after rewinding**.

Sciro evaluates learner state continuously and can emit:

- `ok`
- `struggling`
- `confused`

Windowing is **adaptive by default** (based on video length), but can be overridden.

Example insight:

```js
{
  event_type: "sciro.insight",
  insight_type: "learner_state",
  state: "confused",
  confidence: 0.55 - 0.95,
  rewinds: 3,
  window_ms: 60000
}
```

---

## ⚙️ Configuration

```js
Sciro.init({
  videoElement: HTMLVideoElement,   // required

  // Optional metadata
  userId: "user_123",
  topic: "Algebra: Quadratics",
  lessonId: "lesson_01",
  sessionId: "uuid",

  // Optional webhook endpoint
  apiEndpoint: "https://your-api.com/sciro-events",

  // Insight callback
  onInsight: (insight) => {},

  // Detection tuning (NEW)
  rules: {
    // Leave null for adaptive windowing, or set a fixed value (ms)
    windowMs: null,

    minRewinds: 2,
    minRewindSeconds: 2.5,

    // Buckets rewinds by location in the video
    segmentSizeSeconds: 20,

    // Emission policy
    cooldownMs: 8000,
    emitOnlyOnStateChange: true,
    emitStateRefreshMs: 30000,

    // Extra signals
    pauseNearRewindSeconds: 6,
    minPauseSeconds: 1.0,

    // Confidence blending
    weights: {
      rewinds: 0.45,
      sameSegment: 0.35,
      pauseNearRewind: 0.20
    }
  },

  // Optional UI plugin system
  ui: { ... }
})
```

---

## 📡 Webhook Integration

If `apiEndpoint` is provided, Sciro will POST insight events:

```json
POST /your-endpoint
Content-Type: application/json
{
  "event_type": "sciro.insight",
  "state": "confused",
  "confidence": 0.88,
  "rewinds": 3
}
```

If no endpoint is provided, Sciro logs simulated POSTs to the console (when `debug: true`).

---

## 🎨 UI Plugin System

Sciro supports a customizable UI layer.

Example:

```js
Sciro.init({
  videoElement: video,
  ui: {
    containerId: "sciro-alert-root",
    autoDismissMs: 15000,
    onAction: (action, insight) => {
      console.log("User clicked:", action)
    },
    render: ({ insight }) => {
      // Only show UI when learner isn't "ok"
      if (insight.state === "ok") return ""

      return `
        <div style="background:#111;color:white;padding:16px;border-radius:12px;">
          <strong>Need help?</strong>
          <p>We noticed ${insight.rewinds} rewinds.</p>
          <button data-sciro="dismiss">Close</button>
        </div>
      `
    }
  }
})
```

Any element with:

```html
data-sciro="action_name"
```

will trigger:

```js
ui.onAction(action_name, insight)
```

---

## 📊 Insight Payload Structure

```js
{
  event_type: "sciro.insight",
  insight_type: "learner_state",
  state: "ok" | "struggling" | "confused",
  confidence: Number,

  rewinds: Number,
  last_rewind: { fromTime, toTime, delta, segment, at },
  rewinds_in_window: [...],

  // Video context
  video_current_time: Number,
  video_duration: Number,

  // Extra computed context (v0.3+)
  dominant_segment: String | null,
  max_segment_rewinds: Number,
  pause_near_rewind: Boolean,

  // Metadata (optional)
  user_id,
  topic,
  lesson_id,
  session_id,

  // Timing
  window_ms: Number,
  created_at: ISOString,

  sdk: {
    name: "sciro-inline",
    version: "0.3.0"
  }
}
```

---

## 🛠 Detection Rules (v0.3)

Default behavior (configurable via `rules`):

- **Adaptive window**: ~8% of video duration (clamped 30s–120s), unless `windowMs` is set
- Minimum rewind: **2.5s**
- Trigger threshold: **2 rewinds**
- Segment concentration: repeated rewinds in the same segment increases confidence
- Pause-near-rewind: pausing soon after a rewind increases confidence
- Cooldown between evaluations: **8s**
- Emit policy: emit on state changes (and optional periodic refresh)

---

## 🌍 CDN

Hosted globally via Cloudflare:

https://sciro-sdk.pages.dev/sciro.js

---

## 🔒 Privacy

Sciro does not collect:
- Personal data
- Cookies
- Local storage
- Video content

It only observes client-side playback behavior and emits aggregated interaction signals.

---

## 📄 License

MIT
