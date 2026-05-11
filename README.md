# Static Timer

A single-page static website that runs a countdown timer in the browser and exports the same countdown as an MP4 video using WebCodecs.

## Features

- Countdown timer with hours / minutes / seconds inputs.
- Live on-page countdown with circular progress ring.
- Offline (faster-than-realtime) MP4 export at 720p or 1080p, 30 fps.
- Dark / light theme toggle, remembered in `localStorage`.

## Run

The page imports `mp4-muxer` as an ES module from a CDN, so it needs to be served over HTTP, not `file://`.

### With Docker (recommended)

```sh
docker compose up -d
```

Then open <http://localhost:8000>. Stop with `docker compose down`.

### With Python

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Controls

- **Start**: runs the on-page countdown and hides all controls. Click the timer or press **Esc** to stop.
- **Download MP4**: encodes the countdown via WebCodecs and downloads an MP4. The encoder runs in real-time mode with hardware acceleration and typically renders many times faster than the timer duration.
- **Sun / moon icon**: toggles dark / light theme. The rendered video uses the active theme.

## Browser support

- Live countdown: any modern browser.
- MP4 download: requires WebCodecs (`VideoEncoder`). Works in Chrome, Edge, and Safari 16.4+. Firefox is not yet supported and the download button is disabled automatically.

## Files

- `index.html` - markup.
- `styles.css` - theme variables and layout.
- `app.js` - timer state, canvas drawing, WebCodecs render loop.
- `Dockerfile`, `docker-compose.yml` - nginx-based static host on port 8000.
