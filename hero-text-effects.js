const query = new URLSearchParams(window.location.search);
const acceptedEffects = ["globe", "liquid-film", "cobalt-sprite", "rain-pane", "juiceeffect"];
const requestedEffect = query.get("effect");
const effect = acceptedEffects.includes(requestedEffect) ? requestedEffect : "rain-pane";
document.body.dataset.heroEffect = effect;

function mountJuiceEffect(heading) {
    if (!heading || heading.dataset.juiceMounted) return;

    const label = heading.textContent.trim().replace(/\s+/g, " ");
    const canvas = document.createElement("canvas");
    canvas.className = "juice-effect-canvas";
    canvas.setAttribute("aria-hidden", "true");
    heading.append(canvas);

    const context = canvas.getContext("2d", { alpha: true });
    const mask = document.createElement("canvas");
    const maskContext = mask.getContext("2d", { willReadFrequently: true });
    if (!context || !maskContext) {
        canvas.remove();
        return;
    }

    heading.dataset.juiceMounted = "true";
    heading.classList.add("juice-effect-text");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motionScale = reduceMotion ? 0.9 : 1;
    const motionRate = reduceMotion ? 0.8 : 1;
    const colors = ["#ffe8b6", "#ffd092", "#ffae79", "#ff8b6d", "#ee6966"];
    let particles = [];
    let frame = 0;
    let startTime = performance.now();
    let pixelRatio = 1;
    let isVisible = false;
    let pointerX = -1000;
    let pointerY = -1000;
    let pointerInside = false;

    heading.addEventListener("pointermove", (event) => {
        const bounds = heading.getBoundingClientRect();
        pointerX = event.clientX - bounds.left;
        pointerY = event.clientY - bounds.top;
        pointerInside = true;
    }, { passive: true });
    heading.addEventListener("pointerleave", () => {
        pointerInside = false;
    }, { passive: true });

    function rebuildMask() {
        const bounds = heading.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return false;

        pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
        const width = Math.max(1, Math.ceil(bounds.width * pixelRatio));
        const height = Math.max(1, Math.ceil(bounds.height * pixelRatio));
        canvas.width = width;
        canvas.height = height;
        mask.width = width;
        mask.height = height;
        canvas.style.width = `${bounds.width}px`;
        canvas.style.height = `${bounds.height}px`;

        const style = getComputedStyle(heading);
        const fontSize = parseFloat(style.fontSize) || 16;
        const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.1;
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        const paddingRight = parseFloat(style.paddingRight) || 0;
        const availableWidth = Math.max(1, bounds.width - paddingLeft - paddingRight);
        maskContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        maskContext.clearRect(0, 0, bounds.width, bounds.height);
        maskContext.fillStyle = "#fff";
        maskContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        maskContext.textBaseline = "middle";
        maskContext.textAlign = style.textAlign === "center" ? "center" : style.textAlign === "right" ? "right" : "left";
        if ("letterSpacing" in maskContext) maskContext.letterSpacing = style.letterSpacing;

        const lines = [];
        let line = "";
        label.split(" ").forEach((word) => {
            const candidate = line ? `${line} ${word}` : word;
            if (line && maskContext.measureText(candidate).width > availableWidth) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        });
        if (line) lines.push(line);

        const totalHeight = lines.length * lineHeight;
        const firstBaseline = Math.max(lineHeight / 2, (bounds.height - totalHeight) / 2 + lineHeight / 2);
        const alignX = maskContext.textAlign === "center"
            ? bounds.width / 2
            : maskContext.textAlign === "right"
                ? bounds.width - paddingRight
                : paddingLeft;
        lines.forEach((text, index) => maskContext.fillText(text, alignX, firstBaseline + index * lineHeight, availableWidth));

        const pixels = maskContext.getImageData(0, 0, width, height).data;
        const step = Math.max(3, Math.round(3.4 * pixelRatio));
        const sampled = [];
        for (let y = Math.round(step / 2); y < height; y += step) {
            for (let x = Math.round(step / 2); x < width; x += step) {
                const alpha = pixels[(y * width + x) * 4 + 3] / 255;
                if (alpha > 0.42) {
                    const seed = Math.random();
                    sampled.push({
                        x: x / pixelRatio,
                        y: y / pixelRatio,
                        radius: 1.5 + seed * 1.35,
                        phase: seed * Math.PI * 2,
                        color: colors[Math.floor(seed * colors.length)],
                        alpha: 0.68 + seed * 0.32
                    });
                }
            }
        }
        const stride = Math.max(1, Math.ceil(sampled.length / 1250));
        particles = sampled.filter((_, index) => index % stride === 0);
        return true;
    }

    function draw(now) {
        frame = 0;
        if (!isVisible || document.hidden) return;
        const elapsed = ((now - startTime) / 1000) * motionRate;
        const width = canvas.width / pixelRatio;
        const height = canvas.height / pixelRatio;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, width, height);
        for (const particle of particles) {
            const sway = Math.sin(elapsed * 1.8 + particle.phase) * 1.8 * motionScale;
            const rise = Math.sin(elapsed * 1.15 + particle.phase * 1.4) * 2.6 * motionScale;
            const breathe = Math.sin(elapsed * 2.1 + particle.phase) * 0.22 * motionScale;
            const radius = particle.radius * (1 + breathe);
            const baseX = particle.x + sway;
            const baseY = particle.y + rise;
            const dx = baseX - pointerX;
            const dy = baseY - pointerY;
            const distance = Math.max(1, Math.hypot(dx, dy));
            const proximity = pointerInside ? Math.max(0, 1 - distance / 74) : 0;
            const push = proximity * proximity * 12 * motionScale;
            const x = baseX + (dx / distance) * push;
            const y = baseY + (dy / distance) * push;
            const glow = context.createRadialGradient(x - radius * 0.32, y - radius * 0.38, 0, x, y, radius * 1.22);
            glow.addColorStop(0, particle.color);
            glow.addColorStop(0.72, particle.color);
            glow.addColorStop(1, "rgba(255,128,104,0)");
            const shimmer = 0.72 + (0.28 * motionScale * (0.5 + Math.sin(elapsed * 2.4 + particle.phase) * 0.5));
            context.globalAlpha = Math.min(1, particle.alpha * (shimmer + proximity * 0.3));
            context.fillStyle = glow;
            context.beginPath();
            context.arc(x, y, radius * 1.22, 0, Math.PI * 2);
            context.fill();
        }
        context.globalAlpha = 1;
        context.globalCompositeOperation = "destination-in";
        context.drawImage(mask, 0, 0, width, height);
        context.globalCompositeOperation = "source-over";
        if (pointerInside) {
            const glowRadius = 48;
            const hoverGlow = context.createRadialGradient(pointerX, pointerY, 0, pointerX, pointerY, glowRadius);
            hoverGlow.addColorStop(0, "rgba(255, 231, 190, .22)");
            hoverGlow.addColorStop(0.38, "rgba(255, 154, 118, .12)");
            hoverGlow.addColorStop(1, "rgba(255, 120, 96, 0)");
            context.globalCompositeOperation = "screen";
            context.fillStyle = hoverGlow;
            context.fillRect(pointerX - glowRadius, pointerY - glowRadius, glowRadius * 2, glowRadius * 2);
            context.globalCompositeOperation = "source-over";
        }
        if (!document.hidden) frame = window.requestAnimationFrame(draw);
    }

    function restart() {
        if (frame) window.cancelAnimationFrame(frame);
        if (!rebuildMask()) return;
        startTime = performance.now();
        if (isVisible && !document.hidden) frame = window.requestAnimationFrame(draw);
    }

    const resizeObserver = new ResizeObserver(restart);
    resizeObserver.observe(heading);
    document.fonts?.ready.then(restart);
    if ("IntersectionObserver" in window) {
        const visibilityObserver = new IntersectionObserver(([entry]) => {
            isVisible = entry.isIntersecting;
            if (isVisible) restart();
            else if (frame) {
                window.cancelAnimationFrame(frame);
                frame = 0;
            }
        }, { threshold: 0.08 });
        visibilityObserver.observe(heading);
    } else {
        isVisible = true;
        restart();
    }
    document.addEventListener("visibilitychange", () => {
        if (document.hidden && frame) {
            window.cancelAnimationFrame(frame);
            frame = 0;
        } else if (!document.hidden && isVisible) restart();
    });
}

document.querySelectorAll("[data-juice-effect]").forEach(mountJuiceEffect);
if (effect === "juiceeffect") mountJuiceEffect(document.querySelector(".hero h1 .hero-accent"));
