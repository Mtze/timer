# Static Timer

A single-page static website that runs a countdown timer in the browser and exports the same countdown as an MP4 video using WebCodecs.

## Features

- Countdown timer with hours / minutes / seconds inputs.
- Live on-page countdown with circular progress ring.
- Offline (faster-than-realtime) MP4 export at 720p or 1080p, 30 fps.
- Dark / light theme toggle, remembered in `localStorage`.

## Run

The page imports `mp4-muxer` as an ES module from a CDN, so it needs to be served over HTTP, not `file://`. From this directory:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Browser support

- Live countdown: any modern browser.
- MP4 download: requires WebCodecs (`VideoEncoder`). Works in Chrome, Edge, and Safari 16.4+. Firefox is not yet supported and the download button is disabled automatically.

## Files

- `index.html` - markup.
- `styles.css` - theme variables and layout.
- `app.js` - timer state, canvas drawing, WebCodecs render loop.
