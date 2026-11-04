/* Smooth, centre-focused project rail adapted from the user-provided slider. */
(() => {
    const SLIDE_GAP = 40;
    const MAX_SCALE = 2.5;
    const MIN_SCALE = 0.1;
    const sliders = new WeakMap();

    function wrap(value, span) {
        return ((value % span) + span) % span;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function rebuild(grid, state, resetPosition = false) {
        grid.querySelectorAll(':scope > .project-card[data-slider-copy]').forEach((card) => card.remove());

        const sourceCards = [...grid.querySelectorAll(':scope > .project-card:not([data-slider-copy])')]
            .filter((card) => !card.hidden);
        const width = grid.clientWidth;
        const slideWidth = sourceCards[0]
            ? Number.parseFloat(getComputedStyle(sourceCards[0]).width)
            : Math.min(400, width * 0.8);
        const step = slideWidth + SLIDE_GAP;

        state.width = width;
        state.slideWidth = slideWidth;
        state.step = step;
        state.loop = sourceCards.length >= 2;

        if (!sourceCards.length || width <= 0 || step <= 0) {
            state.slides = [];
            grid.classList.toggle('is-empty', !sourceCards.length);
            return;
        }

        grid.classList.remove('is-empty');
        const repeats = state.loop
            ? Math.max(1, Math.ceil((width + step * 2) / (sourceCards.length * step)))
            : 1;
        const slides = sourceCards.slice();

        for (let repeat = 1; repeat < repeats; repeat += 1) {
            sourceCards.forEach((source) => {
                const copy = source.cloneNode(true);
                copy.dataset.sliderCopy = 'true';
                copy.setAttribute('aria-hidden', 'true');
                copy.style.pointerEvents = 'none';
                copy.querySelectorAll('a, button').forEach((link) => { link.tabIndex = -1; });
                copy.querySelectorAll('img').forEach((image) => { image.draggable = false; });
                grid.appendChild(copy);
                slides.push(copy);
            });
        }

        state.slides = slides;
        if (resetPosition) {
            state.target = 0;
            state.current = 0;
        } else if (!state.loop) {
            const maxOffset = Math.max(0, (slides.length - 1) * step);
            state.target = clamp(state.target, 0, maxOffset);
            state.current = clamp(state.current, 0, maxOffset);
        }
    }

    function initialize(grid, resetPosition = false) {
        if (!(grid instanceof HTMLElement)) return;

        let state = sliders.get(grid);
        if (!state) {
            state = {
                slides: [],
                width: 0,
                slideWidth: 400,
                step: 440,
                loop: true,
                target: 0,
                current: 0,
                lastFrame: 0,
                pointerId: null,
                pointerStartX: 0,
                pointerLastX: 0,
                didDrag: false,
            };
            sliders.set(grid, state);

            grid.classList.add('project-slider');
            grid.setAttribute('role', 'region');
            grid.setAttribute('tabindex', '0');
            grid.setAttribute('aria-label', grid.id === 'projects-grid' ? 'Project gallery' : 'Featured project gallery');

            grid.addEventListener('wheel', (event) => {
                if (state.slides.length < 2) return;
                event.preventDefault();
                const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
                state.target += delta;
            }, { passive: false });

            grid.addEventListener('pointerdown', (event) => {
                if (event.button !== 0) return;
                if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea')) return;
                if (state.slides.length < 2) return;
                state.pointerId = event.pointerId;
                state.pointerStartX = event.clientX;
                state.pointerLastX = event.clientX;
                state.didDrag = false;
                grid.classList.add('is-dragging');
                grid.setPointerCapture(event.pointerId);
            });

            grid.addEventListener('pointermove', (event) => {
                if (state.pointerId !== event.pointerId) return;
                const delta = event.clientX - state.pointerLastX;
                state.pointerLastX = event.clientX;
                if (Math.abs(event.clientX - state.pointerStartX) > 5) state.didDrag = true;
                state.target -= delta * 1.5;
            });

            const endDrag = (event) => {
                if (state.pointerId !== event.pointerId) return;
                state.pointerId = null;
                grid.classList.remove('is-dragging');
                if (grid.hasPointerCapture(event.pointerId)) grid.releasePointerCapture(event.pointerId);
                if (state.didDrag) window.setTimeout(() => { state.didDrag = false; }, 0);
            };
            grid.addEventListener('pointerup', endDrag);
            grid.addEventListener('pointercancel', endDrag);
            grid.addEventListener('lostpointercapture', () => {
                state.pointerId = null;
                grid.classList.remove('is-dragging');
            });
            grid.addEventListener('click', (event) => {
                if (!state.didDrag) return;
                event.preventDefault();
                event.stopPropagation();
                state.didDrag = false;
            }, true);

            grid.addEventListener('keydown', (event) => {
                if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    state.target += state.step;
                } else if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    state.target -= state.step;
                }
            });

            const resizeObserver = new ResizeObserver(() => rebuild(grid, state));
            resizeObserver.observe(grid);

            const tick = (now) => {
                requestAnimationFrame(tick);
                if (document.hidden || !state.slides.length || state.width <= 0 || state.step <= 0) return;

                const delta = state.lastFrame ? Math.min((now - state.lastFrame) / 1000, 0.1) : 1 / 60;
                state.lastFrame = now;
                const span = state.slides.length * state.step;

                if (state.loop) {
                    if (state.current > span || state.current < -span) {
                        const shift = Math.trunc(state.current / span) * span;
                        state.current -= shift;
                        state.target -= shift;
                    }
                } else {
                    state.target = clamp(state.target, 0, Math.max(0, (state.slides.length - 1) * state.step));
                }

                const ease = 0.02;
                const amount = 1 - Math.pow(1 - ease, delta * 60);
                state.current += (state.target - state.current) * amount;

                const pad = (state.width - state.slideWidth) / 2;
                const half = state.width / 2;
                state.slides.forEach((card, index) => {
                    const raw = index * state.step - state.current + pad;
                    const x = state.loop ? wrap(raw + state.step, span) - state.step : raw;
                    const distance = x + state.slideWidth / 2 - half;
                    let scale;
                    let push = 0;
                    if (distance > 0) {
                        scale = Math.min(MAX_SCALE, 1 + distance / state.width);
                        push = (scale - 1) * state.slideWidth * 0.75;
                    } else {
                        scale = Math.max(MIN_SCALE, 1 + distance / state.width);
                    }

                    card.style.transform = `translate3d(${x + push}px, -50%, 0) scale(${scale})`;
                    if (scale < 1) {
                        const dim = (1 - scale) / (1 - MIN_SCALE);
                        card.style.filter = `brightness(${1 - dim * 0.85})`;
                    } else {
                        card.style.filter = 'none';
                    }
                });
            };
            requestAnimationFrame(tick);
        }

        rebuild(grid, state, resetPosition);
    }

    window.initializeProjectSlider = initialize;
})();
