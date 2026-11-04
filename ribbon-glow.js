/* Ribbon Glow shaders and field constants adapted from the user-provided Originkit source. */
const MAX_DPR = 2;
const LAYERS = 84;
const TWIST = 1.25;
const DRAG = 0.18;
const NAME = "RibbonGlow";
const DEFAULTS = { background: "#0B0A10", color1: "#2FD3F2", color2: "#7B61FF" };

const VERT_SRC = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }
`

const FIELD_SRC = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uC1;
uniform vec3 uC2;
uniform float uSize;
uniform float uAngle;
uniform vec2 uMouse;
uniform float uOn;
uniform float uReach;
uniform vec2 uVel;
out vec4 o;

const float TAU = 6.28318530718;
const float LAYERS = ${LAYERS.toFixed(1)};
const float TWIST = ${TWIST.toFixed(3)};
const float DRAG = ${DRAG.toFixed(3)};
const float GAIN = 0.62;
const vec2 CENTRE = vec2(-0.62, 0.24);
const float TILT = 0.6;
const float ZOOM = 1.05;
const float THETA = 2.13;
const float SHEAR = 0.963;
const float SHRINK = 0.953;
const vec2 WARP_FREQ = vec2(0.42, 2.4);
const vec2 WARP_AMP = vec2(0.13, 0.027);
const vec2 ASPECT = vec2(2.1, 0.17);
const float OFFSET = 0.36;
const float GLOW = 0.0021;
const float SOFT = 0.0019;
const float FALLOFF = 0.37;
const float PHASE = 12.0;
const float CYCLE = 0.16;
const float HUE_TRAVEL = 2.0;

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

void main() {
  vec2 R = uRes;
  vec2 pos = (gl_FragCoord.xy - 0.5 * R) / R.y;

  // The plane swirls around the pointer and is dragged by its motion. Skipped
  // outright at zero weight: mouse + (pos - mouse) does not round-trip, so
  // Hover 0 would still nudge the frame by a float ulp.
  vec2 d = pos - uMouse;
  float w = uOn * exp(-dot(d, d) / (uReach * uReach));
  if (w > 1e-4) pos = uMouse + rot(w * TWIST) * d * (1.0 - 0.3 * min(w, 1.0)) - uVel * min(w, 1.0) * DRAG;

  pos = rot(uAngle) * pos / uSize;
  float t = uTime * 0.49 + PHASE;
  float breath = (-sin(uTime * 0.735) + sin(uTime * 0.49 + 1.0)) * 0.25 + 0.5;
  vec2 u = rot(TILT) * ((pos - CENTRE) * (ZOOM - breath * 0.085));
  mat2 fold = mat2(cos(THETA), sin(THETA), -SHEAR, cos(THETA));

  vec3 col = vec3(0.0);
  for (float i = 1.0; i <= LAYERS; i += 1.0) {
    u.x -= sin(u.y * WARP_FREQ.x + t + i * 0.007) * WARP_AMP.x;
    u.y -= sin(u.x * WARP_FREQ.y - t + i * 0.02) * WARP_AMP.y;
    u = fold * u * SHRINK;
    vec2 q = (u - vec2(OFFSET + breath * 0.1, 0.0)) * ASPECT;
    float g = GLOW / (dot(q, q) + SOFT) * (0.25 + breath * 0.4);
    float r = length(u);
    float k = sin(i * CYCLE + t * 1.2 + r * HUE_TRAVEL) * 0.5 + 0.5;
    col += g * mix(uC1, uC2, k) * (0.62 + 0.5 * k) * exp2(-r * FALLOFF);
  }
  vec3 x = max(col * GAIN, 0.0);
  col = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(0.85, 0.92, 0.98));
  col *= 1.0 - smoothstep(0.5, 1.6, length(pos)) * 0.07;
  o = vec4(col, 1.0);
}
`

const FINISH_SRC = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uBg;
uniform float uPaper;
out vec4 o;

float ign(vec2 p, float f) { p += 5.588238 * mod(f, 64.0); return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y)); }

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec3 L = max(texture(uField, frag / uRes).rgb, 0.0);
  // Dark ground: the ribbons are light, screened over it. Light ground: the
  // same hues laid on as pigment, the paper showing where the light is dim.
  vec3 dark = uBg + L * (1.0 - uBg);
  float strength = clamp(max(L.r, max(L.g, L.b)), 0.0, 1.0);
  vec3 paper = uBg * (1.0 - strength) + L * 0.96;
  vec3 col = mix(dark, paper, uPaper);
  col += (ign(frag, floor(uTime * 24.0)) - 0.5) / 255.0;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

const root = document.querySelector(".ribbon-glow-page-stage");
const canvas = root?.querySelector("canvas");

if (root && canvas) {
    function parseColor(input) {
        const match = /^#([0-9a-f]{6})$/i.exec(input || "");
        if (!match) return [0, 0, 0];
        const value = parseInt(match[1], 16);
        return [(value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255];
    }

    function link(gl, fragmentSource, label) {
        const compileShader = (type, source) => {
            const shader = gl.createShader(type);
            if (!shader) return null;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error(`${NAME} ${label} shader:`, gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        };
        const vertex = compileShader(gl.VERTEX_SHADER, VERT_SRC);
        const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        if (!vertex || !fragment) return null;
        const program = gl.createProgram();
        if (!program) return null;
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(`${NAME} ${label} link:`, gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    function locations(gl, program, names) {
        return Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
    }

    function createFieldTarget(gl) {
        const framebuffer = gl.createFramebuffer();
        if (!framebuffer) throw new Error("Unable to create the Ribbon Glow field framebuffer.");
        let texture = null, width = 0, height = 0;
        let halfFloat = Boolean(gl.getExtension("EXT_color_buffer_float"));
        return {
            framebuffer,
            texture: () => texture,
            width: () => width,
            height: () => height,
            resize(nextWidth, nextHeight) {
                if (nextWidth === width && nextHeight === height && texture) return;
                for (let attempt = 0; attempt < 2; attempt += 1) {
                    if (texture) gl.deleteTexture(texture);
                    texture = gl.createTexture();
                    if (!texture) throw new Error("Unable to create the Ribbon Glow field texture.");
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.texImage2D(gl.TEXTURE_2D, 0, halfFloat ? gl.RGBA16F : gl.RGBA8, nextWidth, nextHeight, 0,
                        gl.RGBA, halfFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
                    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
                    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
                    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                    if (complete) break;
                    if (!halfFloat || attempt === 1) throw new Error("Ribbon Glow could not allocate its render target.");
                    halfFloat = false;
                }
                width = nextWidth;
                height = nextHeight;
            },
        };
    }

    try {
        const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false });
        if (!gl) throw new Error("WebGL 2 is not available in this browser.");

        const fieldProgram = link(gl, FIELD_SRC, "field");
        const finishProgram = link(gl, FINISH_SRC, "finish");
        if (!fieldProgram || !finishProgram) throw new Error("Ribbon Glow shaders failed to initialize.");
        const fieldUniforms = locations(gl, fieldProgram, ["uRes", "uTime", "uC1", "uC2", "uSize", "uAngle", "uMouse", "uOn", "uReach", "uVel"]);
        const finishUniforms = locations(gl, finishProgram, ["uField", "uRes", "uTime", "uBg", "uPaper"]);
        const vertexArray = gl.createVertexArray();
        if (!vertexArray) throw new Error("Unable to create the Ribbon Glow vertex array.");
        gl.bindVertexArray(vertexArray);
        const target = createFieldTarget(gl);
        const pointer = { x: 0, y: 0, inside: false, seen: false };
        const readPointer = (event) => {
            const bounds = root.getBoundingClientRect();
            const scaleX = root.offsetWidth / (bounds.width || 1);
            const scaleY = root.offsetHeight / (bounds.height || 1);
            pointer.x = (event.clientX - bounds.left) * scaleX;
            pointer.y = (event.clientY - bounds.top) * scaleY;
            pointer.inside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
            pointer.seen = true;
        };
        const pointerOut = (event) => { if (!event.relatedTarget) pointer.inside = false; };

        let mouseX = 0, mouseY = 0, velocityX = 0, velocityY = 0, presence = 0;
        let frame = 0, last = -1, clock = 0, isVisible = true, disposed = false;
        const color1 = parseColor(DEFAULTS.color1), color2 = parseColor(DEFAULTS.color2), background = parseColor(DEFAULTS.background);
        const backgroundLuminance = 0.2126 * background[0] + 0.7152 * background[1] + 0.0722 * background[2];

        function render(now) {
            if (disposed) return;
            frame = requestAnimationFrame(render);
            if (!isVisible || document.hidden) { last = 0; return; }
            const dt = last < 0 || !last ? 0 : Math.min((now - last) / 1000, 0.05);
            last = now;
            clock = (clock + dt) % 3600;

            const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
            const cssWidth = canvas.clientWidth || 1200;
            const cssHeight = canvas.clientHeight || 420;
            const bufferWidth = Math.max(1, Math.round(cssWidth * dpr));
            const bufferHeight = Math.max(1, Math.round(cssHeight * dpr));
            if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
                canvas.width = bufferWidth;
                canvas.height = bufferHeight;
            }
            target.resize(Math.max(1, Math.round(bufferWidth / 2)), Math.max(1, Math.round(bufferHeight / 2)));

            const targetPresence = pointer.inside ? 1 : 0;
            if (targetPresence && presence < 0.02) { mouseX = pointer.x; mouseY = pointer.y; }
            presence += (targetPresence - presence) * (1 - Math.exp(-dt * 5));
            const ease = 1 - Math.exp(-dt * 16);
            const nextX = mouseX + (pointer.x - mouseX) * ease;
            const nextY = mouseY + (pointer.y - mouseY) * ease;
            if (dt > 0) {
                const velocityEase = 1 - Math.exp(-dt * 8);
                velocityX += ((nextX - mouseX) / dt - velocityX) * velocityEase;
                velocityY += ((nextY - mouseY) / dt - velocityY) * velocityEase;
            }
            mouseX = nextX;
            mouseY = nextY;
            const velocityLength = Math.hypot(velocityX, velocityY) / cssHeight;
            const velocityCap = velocityLength > 3 ? 3 / velocityLength : 1;

            gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
            gl.viewport(0, 0, target.width(), target.height());
            gl.useProgram(fieldProgram);
            gl.uniform2f(fieldUniforms.uRes, target.width(), target.height());
            gl.uniform1f(fieldUniforms.uTime, clock);
            gl.uniform3f(fieldUniforms.uC1, ...color1);
            gl.uniform3f(fieldUniforms.uC2, ...color2);
            gl.uniform1f(fieldUniforms.uSize, 1);
            gl.uniform1f(fieldUniforms.uAngle, -Math.PI);
            gl.uniform2f(fieldUniforms.uMouse, (mouseX - cssWidth / 2) / cssHeight, (cssHeight / 2 - mouseY) / cssHeight);
            gl.uniform1f(fieldUniforms.uOn, presence);
            gl.uniform1f(fieldUniforms.uReach, 240 / cssHeight);
            gl.uniform2f(fieldUniforms.uVel, (velocityX / cssHeight) * velocityCap, (-velocityY / cssHeight) * velocityCap);
            gl.drawArrays(gl.TRIANGLES, 0, 3);

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, bufferWidth, bufferHeight);
            gl.useProgram(finishProgram);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, target.texture());
            gl.uniform1i(finishUniforms.uField, 0);
            gl.uniform2f(finishUniforms.uRes, bufferWidth, bufferHeight);
            gl.uniform1f(finishUniforms.uTime, clock);
            gl.uniform3f(finishUniforms.uBg, ...background);
            gl.uniform1f(finishUniforms.uPaper, Math.max(0, Math.min(1, (backgroundLuminance - 0.35) / 0.3)));
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            root.classList.add("ribbon-glow-ready");
        }

        window.addEventListener("pointermove", readPointer, { passive: true });
        window.addEventListener("pointerdown", readPointer, { passive: true });
        document.addEventListener("pointerout", pointerOut, { passive: true });
        const resizeObserver = new ResizeObserver(() => { last = -1; });
        resizeObserver.observe(root);
        const visibilityObserver = new IntersectionObserver((entries) => {
            isVisible = entries.some((entry) => entry.isIntersecting);
            last = -1;
        }, { rootMargin: "128px" });
        visibilityObserver.observe(root);
        document.addEventListener("visibilitychange", () => { last = -1; });
        canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); cancelAnimationFrame(frame); });
        canvas.addEventListener("webglcontextrestored", () => { last = -1; frame = requestAnimationFrame(render); });
        frame = requestAnimationFrame(render);
    } catch (error) {
        root.classList.add("ribbon-glow-failed");
        console.error("Ribbon Glow could not start; using its CSS fallback.", error);
    }
}
