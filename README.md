# Sciro SDK

Detect learner confusion in video-based lessons using rewind behavior.

Sciro observes video seek events and emits structured **insight events**
when it detects potential confusion (e.g. multiple rewinds within a
short window).

------------------------------------------------------------------------

## 🚀 Installation

Add the SDK script to your page:

``` html
<script src="https://sciro-sdk.pages.dev/sciro.js"></script>
```

Then initialize:

``` html
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

That's it.

------------------------------------------------------------------------

## 🧠 How It Works

Sciro monitors:

-   `timeupdate`
-   `seeking`
-   `seeked`

It detects meaningful rewinds (default: ≥ 2.5 seconds).

If a learner rewinds **2 or more times within 60 seconds**, Sciro emits:

``` js
{
  event_type: "sciro.insight",
  insight_type: "learner_state",
  state: "confused",
  confidence: 0.84 - 0.92
}
```

------------------------------------------------------------------------

## ⚙️ Configuration

``` js
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

  // Optional UI plugin system
  ui: { ... }
})
```

------------------------------------------------------------------------

## 📡 Webhook Integration

If `apiEndpoint` is provided, Sciro will POST insight events:

``` json
POST /your-endpoint
Content-Type: application/json
{
  "event_type": "sciro.insight",
  "state": "confused",
  "confidence": 0.88,
  "rewinds": 3
}
```

If no endpoint is provided, Sciro logs simulated POSTs to the console.

------------------------------------------------------------------------

## 🎨 UI Plugin System

Sciro supports a customizable UI layer.

Example:

``` js
Sciro.init({
  videoElement: video,
  ui: {
    containerId: "sciro-alert-root",
    autoDismissMs: 15000,
    onAction: (action, insight) => {
      console.log("User clicked:", action)
    },
    render: ({ insight }) => {
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

``` html
data-sciro="action_name"
```

will trigger:

``` js
ui.onAction(action_name, insight)
```

------------------------------------------------------------------------

## 📊 Insight Payload Structure

``` js
{
  event_type: "sciro.insight",
  insight_type: "learner_state",
  state: "confused",
  confidence: Number,
  rewinds: Number,
  last_rewind: { fromTime, toTime, delta, at },
  rewinds_in_window: [...],
  video_current_time: Number,
  video_duration: Number,
  user_id,
  topic,
  lesson_id,
  session_id,
  window_ms: 60000,
  created_at: ISOString,
  sdk: {
    name: "sciro-inline",
    version: "0.2.0"
  }
}
```

------------------------------------------------------------------------

## 🛠 Detection Rules (v1)

-   Rolling window: 60 seconds
-   Minimum rewind: 2.5 seconds
-   Trigger threshold: 2 rewinds
-   Cooldown between insights: 12 seconds
-   Debounce for seek drag: 500ms

------------------------------------------------------------------------

## 🌍 CDN

Hosted globally via Cloudflare:

https://sciro-sdk.pages.dev/sciro.js

------------------------------------------------------------------------

## 🔒 Privacy

Sciro does not collect: - Personal data - Cookies - Storage - Video
content

It only observes client-side playback behavior.

------------------------------------------------------------------------

## 📄 License

MIT
