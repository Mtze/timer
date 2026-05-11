import { Muxer, ArrayBufferTarget } from 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/+esm';

const $ = (id) => document.getElementById(id);
const appEl = document.querySelector('.app');
const canvas = $('preview');
const ctx = canvas.getContext('2d', { alpha: false });
const hoursInput = $('hours');
const minutesInput = $('minutes');
const secondsInput = $('seconds');
const resolutionSelect = $('resolution');
const startBtn = $('start');
const downloadBtn = $('download');
const statusEl = $('status');
const themeToggle = $('theme-toggle');
const themeIcon = $('theme-icon');

const THEME_KEY = 'static-timer-theme';
const FPS = 30;

const SUN_ICON = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>';
const MOON_ICON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';

let durationMs = 0;
let startTime = null;
let rafId = null;
let isRendering = false;
let layout = null;

initTheme();
applyResolution();
resetPreview();
checkVideoSupport();

themeToggle.addEventListener('click', toggleTheme);
resolutionSelect.addEventListener('change', () => {
    applyResolution();
    if (!rafId) resetPreview();
});
startBtn.addEventListener('click', () => {
    if (rafId) stopLive();
    else startLive();
});
downloadBtn.addEventListener('click', renderAndDownload);
[hoursInput, minutesInput, secondsInput].forEach((input) => {
    input.addEventListener('input', () => {
        if (!rafId && !isRendering) resetPreview();
    });
});
canvas.addEventListener('click', () => {
    if (rafId) stopLive();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && rafId) stopLive();
});

function checkVideoSupport() {
    if (typeof window.VideoEncoder === 'undefined') {
        downloadBtn.disabled = true;
        statusEl.classList.add('warning');
        statusEl.textContent = 'Video export needs WebCodecs (Chrome, Edge, or Safari 16.4+).';
    }
}

function initTheme() {
    let theme = localStorage.getItem(THEME_KEY);
    if (!theme) {
        theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    setTheme(theme);
}

function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    if (!rafId && !isRendering) resetPreview();
}

function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeIcon.innerHTML = theme === 'dark' ? SUN_ICON : MOON_ICON;
}

function applyResolution() {
    const [w, h] = resolutionSelect.value.split('x').map(Number);
    canvas.width = w;
    canvas.height = h;
    layout = computeLayout(ctx, w, h);
}

function computeLayout(targetCtx, width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.4;
    const ringWidth = Math.max(10, radius * 0.06);

    const digitFamily = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    const labelFamily = '-apple-system, "Inter", "Segoe UI", Roboto, sans-serif';

    const maxTextWidth = (radius - ringWidth) * 2 * 0.78;
    let fontSize = Math.floor(radius * 0.55);
    targetCtx.save();
    targetCtx.font = `600 ${fontSize}px ${digitFamily}`;
    const sampleWidth = targetCtx.measureText('00:00:00').width;
    if (sampleWidth > maxTextWidth) {
        fontSize = Math.max(12, Math.floor(fontSize * (maxTextWidth / sampleWidth)));
    }
    targetCtx.restore();

    const labelSize = Math.max(12, Math.floor(fontSize * 0.2));

    return {
        cx, cy, radius, ringWidth, fontSize, labelSize,
        digitFont: `600 ${fontSize}px ${digitFamily}`,
        labelFont: `600 ${labelSize}px ${labelFamily}`,
    };
}

function readDurationMs() {
    const h = clampInt(hoursInput.value, 0, 99);
    const m = clampInt(minutesInput.value, 0, 59);
    const s = clampInt(secondsInput.value, 0, 59);
    return (h * 3600 + m * 60 + s) * 1000;
}

function clampInt(value, min, max) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return 0;
    return Math.max(min, Math.min(max, n));
}

function pad(n) {
    return String(n).padStart(2, '0');
}

function readThemeColors() {
    const style = getComputedStyle(document.documentElement);
    const get = (name, fallback) => (style.getPropertyValue(name).trim() || fallback);
    return {
        bg: get('--bg', '#0a0a0a'),
        fg: get('--fg', '#fafafa'),
        muted: get('--muted', '#8a8a8a'),
        ringTrack: get('--ring-track', '#262626'),
        ringFill: get('--ring-fill', '#60a5fa'),
    };
}

function drawFrame(targetCtx, elapsedMs, totalMs, width, height, colors, L) {
    colors = colors || readThemeColors();
    L = L || layout || computeLayout(targetCtx, width, height);

    targetCtx.fillStyle = colors.bg;
    targetCtx.fillRect(0, 0, width, height);

    const safeTotal = Math.max(totalMs, 1);
    const remaining = Math.max(0, totalMs - elapsedMs);
    const progress = Math.min(1, Math.max(0, elapsedMs / safeTotal));

    targetCtx.lineWidth = L.ringWidth;
    targetCtx.lineCap = 'round';
    targetCtx.strokeStyle = colors.ringTrack;
    targetCtx.beginPath();
    targetCtx.arc(L.cx, L.cy, L.radius, 0, Math.PI * 2);
    targetCtx.stroke();

    if (progress < 1) {
        targetCtx.strokeStyle = colors.ringFill;
        targetCtx.beginPath();
        const start = -Math.PI / 2 + Math.PI * 2 * progress;
        const end = -Math.PI / 2 + Math.PI * 2;
        targetCtx.arc(L.cx, L.cy, L.radius, start, end);
        targetCtx.stroke();
    }

    const totalSec = Math.ceil(remaining / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const text = `${pad(h)}:${pad(m)}:${pad(s)}`;

    targetCtx.fillStyle = colors.fg;
    targetCtx.font = L.digitFont;
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    targetCtx.fillText(text, L.cx, L.cy - L.fontSize * 0.05);

    targetCtx.fillStyle = colors.muted;
    targetCtx.font = L.labelFont;
    targetCtx.fillText('REMAINING', L.cx, L.cy + L.fontSize * 0.7);
}

function resetPreview() {
    durationMs = readDurationMs();
    drawFrame(ctx, 0, durationMs, canvas.width, canvas.height);
}

function setControlsDisabled(disabled) {
    hoursInput.disabled = disabled;
    minutesInput.disabled = disabled;
    secondsInput.disabled = disabled;
    resolutionSelect.disabled = disabled;
}

function startLive() {
    durationMs = readDurationMs();
    if (durationMs <= 0) {
        showStatus('Set a duration greater than zero.', true);
        return;
    }
    showStatus('');
    startTime = performance.now();
    appEl.classList.add('running');
    tick();
}

function tick() {
    const elapsed = performance.now() - startTime;
    if (elapsed >= durationMs) {
        drawFrame(ctx, durationMs, durationMs, canvas.width, canvas.height);
        finishLive();
        return;
    }
    drawFrame(ctx, elapsed, durationMs, canvas.width, canvas.height);
    rafId = requestAnimationFrame(tick);
}

function finishLive() {
    rafId = null;
    appEl.classList.remove('running');
    startBtn.textContent = 'Start';
    setControlsDisabled(false);
    if (typeof window.VideoEncoder !== 'undefined') downloadBtn.disabled = false;
}

function stopLive() {
    if (rafId) cancelAnimationFrame(rafId);
    finishLive();
    resetPreview();
}

function showStatus(text, warning = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('warning', warning);
}

async function renderAndDownload() {
    if (isRendering) return;
    durationMs = readDurationMs();
    if (durationMs <= 0) {
        showStatus('Set a duration greater than zero.', true);
        return;
    }

    isRendering = true;
    startBtn.disabled = true;
    downloadBtn.disabled = true;
    setControlsDisabled(true);
    themeToggle.disabled = true;
    showStatus('Preparing encoder...');

    const width = canvas.width;
    const height = canvas.height;
    const colors = readThemeColors();
    const L = computeLayout(ctx, width, height);
    const totalFrames = Math.ceil((durationMs / 1000) * FPS) + 1;
    const frameIntervalUs = 1_000_000 / FPS;
    const renderStart = performance.now();
    const yieldEvery = FPS * 4;
    const keyframeEvery = FPS * 2;

    try {
        const muxer = new Muxer({
            target: new ArrayBufferTarget(),
            video: { codec: 'avc', width, height },
            fastStart: 'in-memory',
        });

        let encoderError = null;
        const encoder = new VideoEncoder({
            output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            error: (e) => { encoderError = e; },
        });

        const codec = width >= 1920 ? 'avc1.42E028' : 'avc1.42E01F';
        encoder.configure({
            codec,
            width,
            height,
            framerate: FPS,
            bitrate: width >= 1920 ? 5_000_000 : 3_000_000,
            bitrateMode: 'variable',
            latencyMode: 'realtime',
            hardwareAcceleration: 'prefer-hardware',
        });

        for (let i = 0; i < totalFrames; i++) {
            if (encoderError) throw encoderError;

            while (encoder.encodeQueueSize > 8) {
                await new Promise((r) => setTimeout(r, 0));
                if (encoderError) throw encoderError;
            }

            const elapsedMs = Math.min((i / FPS) * 1000, durationMs);
            drawFrame(ctx, elapsedMs, durationMs, width, height, colors, L);
            const frame = new VideoFrame(canvas, { timestamp: i * frameIntervalUs });
            encoder.encode(frame, { keyFrame: i % keyframeEvery === 0 });
            frame.close();

            if (i % yieldEvery === 0 || i === totalFrames - 1) {
                const pct = Math.floor(((i + 1) / totalFrames) * 100);
                const elapsedRender = (performance.now() - renderStart) / 1000;
                showStatus(`Encoding ${pct}% (${i + 1} / ${totalFrames} frames, ${elapsedRender.toFixed(1)}s)...`);
                await new Promise((r) => setTimeout(r, 0));
            }
        }

        showStatus('Finalizing...');
        await encoder.flush();
        if (encoderError) throw encoderError;
        muxer.finalize();

        const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const totalSec = Math.round(durationMs / 1000);
        const fname = `timer-${pad(Math.floor(totalSec / 3600))}${pad(Math.floor((totalSec % 3600) / 60))}${pad(totalSec % 60)}.mp4`;

        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        const seconds = ((performance.now() - renderStart) / 1000).toFixed(1);
        const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
        const realtime = (durationMs / 1000) / parseFloat(seconds);
        showStatus(`Done. ${fname} (${sizeMb} MB) rendered in ${seconds}s (${realtime.toFixed(1)}x realtime).`);
    } catch (err) {
        console.error(err);
        showStatus(`Render failed: ${err.message || err}`, true);
    } finally {
        isRendering = false;
        startBtn.disabled = false;
        if (typeof window.VideoEncoder !== 'undefined') downloadBtn.disabled = false;
        setControlsDisabled(false);
        themeToggle.disabled = false;
        resetPreview();
    }
}
