/* Cobalt Sprite renderer adapted from the user-provided Originkit source.
   The original React/Framer wrapper is replaced with this static-page mount. */

const VERT = `
attribute vec2 aPos;
void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
uniform vec2  uCenter;   // capsule centre, device px
uniform float uRadius;   // capsule radius, device px
uniform vec3  uSeamN;    // seam plane normal, view space, toward the clear half
uniform float uSeamD;
uniform float uRi;       // inner radius of the shell
uniform float uLip;      // inner radius of the seam lip
uniform vec3  uBallC;
uniform float uBallR;
uniform mat3  uRot;      // sprite local -> view
uniform vec4  uEye;      // half gap, half segment length, half width (rad), openness
uniform float uFace;
uniform vec3  uBall;
uniform vec3  uEyeCol;
uniform vec3  uBg;
uniform float uFrost;    // 0 clear, 1 the reference, 2 near opaque milk
uniform float uGloss;
uniform float uGlow;
uniform float uGrain;
uniform vec2  uLight;    // cos, sin of the studio's roll
uniform float uDpr;
uniform float uTime;

const float IOR = 1.5;

float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}

/* ------------------------------------------------------------ studio */

// A soft stadium in mirror-ball space. blur widens it for rough
// surfaces and lowers its peak so the energy stays about the same.
float stad(vec2 m, vec2 c, float a, float hl, float hw, float blur) {
    vec2 d = m - c;
    float ca = cos(a), sa = sin(a);
    vec2 q = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y);
    q.x = max(abs(q.x) - hl, 0.0);
    float w = hw + blur;
    float k = length(q) / w;
    // a crisp core with a bloom skirt, as a photographed window reads
    float v = smoothstep(1.0, 0.6, k) * 0.8 + exp(-k * k * 0.9) * 0.2;
    return v * (hw / w) * ((hl + hw) / (hl + w));
}

vec2 polar(float r, float deg) {
    float a = radians(deg);
    return r * vec2(cos(a), sin(a));
}

/* The reference's studio, painted where its reflections land on the
   front of a unit sphere: each light's centre, half length and half
   width are the measured blob, in shell radii (widened by the blur the
   picture's bloom put on them). ring scales the bright surround, upper
   the three lights along the top; mz pulls the map in toward the centre
   (see shadeBall). */
vec3 env(vec3 R, float blur, float ring, float mz, float upper) {
    vec3 h = R + vec3(0.0, 0.0, 1.0);
    float lh = length(h);
    vec2 m = lh > 1e-4 ? h.xy / lh : normalize(R.xy + 1e-6);
    m *= mz;
    m = vec2(uLight.x * m.x + uLight.y * m.y, -uLight.y * m.x + uLight.x * m.y);
    float rm = length(m);

    // All five lights sit in the top right, inside x > -0.25, y > 0.25;
    // 0.3 past that their bloom is below a thousandth of a level, so most
    // directions skip the lot
    vec3 c = vec3(0.0);
    float mg = 0.3 + blur * 3.0;
    if (m.x > -0.25 - mg && m.y > 0.25 - mg) {
        float s = 0.0;
        s += stad(m, polar(0.884, 92.7), radians(161.0), 0.040, 0.024, blur) * upper;
        s += stad(m, polar(0.839, 73.1), radians(149.0), 0.130, 0.040, blur) * upper;
        s += stad(m, polar(0.892, 61.1), radians(144.0), 0.145, 0.033, blur) * upper;
        s += stad(m, polar(0.884, 33.4), radians(120.0), 0.160, 0.036, blur) * 0.9;
        s += stad(m, polar(0.825, 34.2), radians(116.0), 0.105, 0.040, blur);
        c = vec3(1.0, 0.99, 0.98) * 30.0 * s;
    }

    // the bright surround behind the capsule: every grazing view of the
    // glass picks it up, which is the white rim all round the reference
    c += vec3(0.93, 0.95, 1.0) * 3.2 * smoothstep(0.982, 0.999, rm) * ring;
    // a broad dim softbox overhead, so the dark dome is never a hole
    c += vec3(0.9, 0.93, 1.0) * 0.05 * smoothstep(-0.2, 0.9, m.y) * (1.0 - rm * rm * 0.5);
    return c;
}

float fres(float c) {
    c = clamp(c, 0.0, 1.0);
    return 0.04 + 0.96 * pow(1.0 - c, 5.0);
}

/* ------------------------------------------------------------ frost */

// How brightly the frosted half glows at P, a point on its wall. It is
// a lampshade: lit from outside, it glows where the lights are behind it.
// The key sits low on the left in front (ext weights it - the far wall
// barely sees it), a second light low on the right behind. A third, up
// by the camera, comes in through the clear dome, and the sprite stands
// in its way: the navy crescent tucked under its lower right.
float frostLight(vec3 P, float ext) {
    vec3 n = normalize(P);
    float kl = max(dot(n, normalize(vec3(-0.95, -0.15, 0.30))), 0.0);
    float kb = max(dot(n, normalize(vec3(0.55, -0.60, -0.60))), 0.0);
    vec3 Lo = normalize(vec3(-0.10, 0.15, 0.98));
    vec3 oc = uBallC - P;
    float tc = max(dot(oc, Lo), 0.0);
    float dist = length(oc - Lo * tc);
    float shade = smoothstep(uBallR * 0.95, uBallR * 1.12, dist);
    return 0.02 + ext * 1.1 * kl * kl * kl + (0.85 * kb * kb + 0.05) * shade;
}

/* -------------------------------------------------------------- ball */

vec2 sphereHit(vec3 ro, vec3 rd, vec3 c, float r) {
    vec3 oc = ro - c;
    float b = dot(oc, rd);
    float h = b * b - (dot(oc, oc) - r * r);
    if (h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
}

// One pill in the sprite's local frame: q is east/north in radians
// round its centre. Returns coverage and the outward bend of the normal.
vec4 pill(vec2 q, float px) {
    float open = max(uEye.w, 0.12);
    float hl = uEye.y * open;
    float hw = uEye.z * mix(0.7, 1.0, open);
    vec2 a = vec2(q.x, max(abs(q.y) - hl, 0.0) * sign(q.y));
    // a closing pill squashes into a flat dash, not a shrinking one
    a.y /= mix(0.45, 1.0, open);
    float dd = length(a);
    float cov = smoothstep(hw + px, hw - px, dd);
    float hgt = sqrt(max(hw * hw - dd * dd, 0.0));
    vec2 dir = dd > 1e-5 ? a / dd : vec2(0.0);
    return vec4(cov, dir * dd, hgt);
}

vec3 shadeBall(vec3 P, vec3 rd, float px) {
    vec3 N = normalize(P - uBallC);
    vec3 nl = N * uRot;
    vec3 albedo = uBall;
    float eye = 0.0;
    vec3 Ns = N;

    // only the cap round the face can hold a pill: skip the trig elsewhere
    if (uFace > 0.5 && nl.z > cos(min(uEye.x + uEye.y + uEye.z + 0.05, 3.0))) {
        float lon = atan(nl.x, nl.z);
        float lat = asin(clamp(nl.y, -1.0, 1.0));
        float cl = cos(lat);
        float pa = px / uBallR * 1.2;
        float side = lon < 0.0 ? -1.0 : 1.0;
        vec2 q = vec2((lon - side * uEye.x) * cl, lat);
        vec4 e = pill(q, pa);
        if (e.x > 0.0) {
            // east and north on the sphere, in local space
            vec3 tu = vec3(cos(lon), 0.0, -sin(lon));
            vec3 tv = vec3(-sin(lat) * sin(lon), cl, -sin(lat) * cos(lon));
            vec3 bent = normalize(nl * max(e.w, 1e-4) + (tu * e.y + tv * e.z) * 0.85);
            Ns = normalize(uRot * bent);
            eye = e.x;
            albedo = mix(albedo, uEyeCol, e.x);
        }
    }

    vec3 n = normalize(mix(N, Ns, eye));
    // Flat, heavily wrapped diffuse: the frosted bowl fills the shadow
    // side, so the reference's sprite only drops to ~0.8 of its mid tone
    vec3 Lk = normalize(vec3(0.62, 0.62, 0.48));
    float d = clamp((dot(n, Lk) + 0.6) / 1.6, 0.0, 1.0);
    vec3 c = albedo * (0.80 + 0.30 * d);
    // satin sheen: the reference's sprite is saturated straight on and
    // whitens toward its rim on the lit side (up and right), not across
    // the middle - a grazing-angle lift, as velvety plastic does
    float rimLift = pow(1.0 - clamp(n.z, 0.0, 1.0), 1.6) *
                    smoothstep(-0.5, 0.7, dot(n.xy, vec2(0.55, 0.83)));
    c += vec3(0.30, 0.31, 0.29) * rimLift * (1.0 - eye);
    // and the big softbox up and right washes that whole side pale
    float wash = pow(max(dot(n, normalize(vec3(0.62, 0.62, 0.35))), 0.0), 1.5);
    c += vec3(0.45, 0.46, 0.42) * wash * (1.0 - eye);
    // the pills keep a broad lobe: they are glossier than the body
    c += vec3(0.30) * pow(max(dot(n, normalize(vec3(0.58, 0.50, 0.64))), 0.0), 2.2) * eye;
    // studio reflection, blurred by the satin's roughness
    vec3 R = reflect(rd, n);
    float F = 0.04 + 0.96 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
    // The reference's highlights sit at 0.75 of the sprite's radius, not
    // at the 0.86 an orthographic mirror would put them: its camera is
    // perspective, close enough that the sprite sees the studio wider.
    // And only the right-hand pair shows on it, as two soft streaks by
    // the right eye; the top three are lost in its pale lit crown.
    c += env(R, mix(0.06, 0.04, eye), 0.10, 1.15, 0.15) * mix(F * 1.2, F * 1.8 + 0.03, eye) * uGloss;
    // the pills are pale but not paper: their shade side cools to lilac
    c = mix(c, c * vec3(0.86, 0.87, 1.0), eye * (1.0 - d));
    return c;
}

/* --------------------------------------------------------- back wall */

vec3 backWall(vec3 Pw, vec3 rd, float px) {
    vec3 Nin = -Pw / uRi;
    float side = dot(uSeamN, Pw) - uSeamD;
    float fm = smoothstep(0.012, -0.012, side) * min(uFrost, 1.0);

    // clear: the room behind the capsule, plus the inner surface's own
    // concave reflection of the studio
    float F = fres(dot(-rd, Nin));
    vec3 clear = uBg * 0.85 + env(reflect(rd, Nin), 0.02, 0.4, 1.0, 1.0) * F * 0.55 * uGloss;
    // smoky toward the rim: the far wall seen ever more edge on
    float g = smoothstep(0.25, 0.8, 1.0 - abs(dot(rd, Nin)));
    clear += vec3(0.003, 0.0035, 0.005) + vec3(0.040, 0.042, 0.052) * g * g;

    // frosted: seen from inside, lit as the rest of the bowl is
    if (fm <= 0.0) return clear;
    vec3 frosted = vec3(0.84, 0.88, 0.97) * 0.42 * frostLight(Pw, 0.25);
    return mix(clear, frosted, fm);
}

/* -------------------------------------------------------------- seam */

// The lip of the seam: an annulus on the cut plane from uLip out to the
// shell. s runs 0 at its inner edge to 1 at the shell's outer surface.
vec4 seamBand(vec2 p, float px) {
    if (abs(uSeamN.z) < 1e-3) return vec4(0.0, 0.0, -9.0, 0.0);
    float zp = (uSeamD - uSeamN.x * p.x - uSeamN.y * p.y) / uSeamN.z;
    vec3 P = vec3(p, zp);
    float rp = length(P);
    if (rp < uLip - 0.02 || rp > 1.0) return vec4(0.0, 0.0, zp, 0.0);
    vec2 g = (P.xy - P.z * uSeamN.xy / uSeamN.z) / max(rp, 1e-4);
    float sw = 1.0 - uLip;
    float s = (rp - uLip) / sw;
    float ds = length(g) * px / sw; // s per device pixel
    float body = smoothstep(-ds, ds, s) * smoothstep(1.0 + ds, 1.0 - ds, s);
    // the glass edges: bright where the faces meet, a dark refracted
    // line beside each
    float w = max(1.3 * ds, 0.07);
    float lines = 0.0;
    lines += 1.00 * smoothstep(max(1.8 * ds, 0.14), 0.0, abs(s - 0.90));
    lines += 0.70 * smoothstep(w, 0.0, abs(s - 0.50));
    lines += 0.85 * smoothstep(w, 0.0, abs(s - 0.08));
    float dark = 0.0;
    dark += smoothstep(w * 1.3, 0.0, abs(s - 0.70));
    dark += smoothstep(w * 1.1, 0.0, abs(s - 0.29));
    return vec4(body, clamp(lines, 0.0, 1.0), zp, clamp(dark, 0.0, 1.0));
}

/* -------------------------------------------------------------- main */

float tone(float x) {
    return x < 0.8 ? x : 0.8 + 0.2 * (1.0 - exp(-(x - 0.8) / 0.2));
}

void main() {
    float px = 1.0 / uRadius;
    vec2 p = (gl_FragCoord.xy - uCenter) * px;
    float r = length(p);
    vec3 rd = vec3(0.0, 0.0, -1.0);

    // bloom round the silhouette, measured off the reference: a tight
    // core and a wider skirt
    float x = max(r - 1.0, 0.0);
    vec3 halo = vec3(0.92, 0.95, 1.0) * (0.11 * exp(-x / 0.006) + 0.03 * exp(-x / 0.02)) * uGlow;

    vec3 col = uBg;
    float cov = 1.0 - smoothstep(1.0 - px, 1.0 + px, r);
    if (cov > 0.0) {
        float rr = min(r, 0.99999);
        vec3 P0 = vec3(p, sqrt(1.0 - rr * rr));
        vec3 N0 = P0;
        float Fo = fres(N0.z);
        vec3 refl = env(reflect(rd, N0), 0.0, 1.0, 1.0, 1.0) * Fo * uGloss;
        float frontSide = dot(uSeamN, P0) - uSeamD;
        float fm = smoothstep(0.012, -0.012, frontSide) * min(uFrost, 1.0);
        // past the reference the frost thickens: milk spreads inward
        float thick = max(uFrost - 1.0, 0.0);

        vec3 r1 = refract(rd, N0, 1.0 / IOR);
        vec2 hi = sphereHit(P0, r1, vec3(0.0), uRi);
        vec3 Pi = P0 + r1 * hi.x;
        vec3 Ni = Pi / uRi;
        vec3 r2 = refract(r1, Ni, IOR);
        vec3 inner;
        float ballZ = -9.0;
        float tir = 1.0 - step(0.0, hi.x) * step(1e-4, dot(r2, r2));

        if (tir < 0.5) {
            // into the cavity: the sprite, or the far wall
            vec2 hb = sphereHit(Pi, r2, uBallC, uBallR);
            if (hb.x > 0.0) {
                vec3 Pb = Pi + r2 * hb.x;
                ballZ = Pb.z;
                inner = shadeBall(Pb, r2, px);
            } else {
                vec2 hw = sphereHit(Pi, r2, vec3(0.0), uRi);
                inner = backWall(Pi + r2 * hw.y, r2, px);
            }
            // glass tint through two walls
            inner *= vec3(0.96, 0.975, 0.985);

            // frosted front: the cavity blurs into a soft glow
            if (fm > 0.0) {
                vec3 oc = uBallC - Pi;
                float tc = max(dot(oc, r2), 0.0);
                float dist = length(oc - r2 * tc);
                float bc = smoothstep(uBallR + 0.24, uBallR - 0.22, dist);
                vec3 behind = mix(inner * 0.35, uBall * 0.60, bc);
                // straight on, frost only softens; toward the rim the path
                // through it grows and it turns to milk - measured, it
                // climbs from a tenth to full between r 0.78 and 0.97
                float milk = pow(smoothstep(0.80 + 0.2 * thick, 0.22, N0.z), 1.8 - 1.0 * thick);
                float sharp = smoothstep(0.75, 0.95, N0.z) * (1.0 - thick);
                behind = mix(behind, inner, sharp * 0.3);
                // the milk glows all round the bowl's rim, the lights only
                // tint how brightly
                float scatter = (0.55 + frostLight(P0, 0.85)) * (0.02 + 0.98 * milk);
                vec3 frosted = behind * (1.0 - milk * 0.8) + vec3(0.88, 0.90, 0.97) * scatter;
                inner = mix(inner, frosted, fm);
            }
        } else {
            // totally internally reflected inside the wall: the ray runs
            // round the glass and leaves through the outer surface
            vec3 rt = reflect(r1, normalize(Pi));
            if (hi.x <= 0.0) rt = r1;
            vec2 ho = sphereHit(P0 + r1 * max(hi.x, 0.0), rt, vec3(0.0), 1.0);
            vec3 P2 = P0 + r1 * max(hi.x, 0.0) + rt * ho.y;
            vec3 r3 = refract(rt, -normalize(P2), IOR);
            if (dot(r3, r3) < 1e-4) r3 = rt;
            // clear: a smoky grey band with a bright line where it
            // starts - the inner surface seen edge on
            float b = (r - uRi) / (1.0 - uRi);
            vec3 clearRim = uBg * 0.6 + env(r3, 0.03, 0.05, 1.0, 1.0) * 0.20 + vec3(0.040, 0.042, 0.052) * (0.8 + 0.6 * b);
            // the line is brightest where the overhead softbox feeds it
            clearRim += vec3(0.9, 0.93, 1.0) * 0.6 * exp(-pow(b / 0.12, 2.0)) * smoothstep(-0.1, 0.8, p.y);
            inner = clearRim;
            if (fm > 0.0) {
                vec3 frostRim = vec3(0.88, 0.90, 0.97) * (0.55 + frostLight(P0, 0.85)) * 1.15;
                inner = mix(clearRim, frostRim, fm);
            }
        }

        col = inner * (1.0 - Fo) + refl;

        // the seam's lip, in front of or behind the sprite
        vec4 sb = seamBand(p, px);
        if (sb.x > 0.0 && sb.z > ballZ) {
            float hidden = sb.z < 0.0 ? fm * 0.85 : 0.0;
            float a = sb.x * (1.0 - hidden);
            vec3 edge = vec3(0.95, 0.97, 1.0) * 1.6;
            // the lip is the cut face of the glass - milky where it is
            // the frosted half's - so it reads as a pale solid body
            vec3 c2 = col * 0.62 + vec3(0.12, 0.125, 0.15) * (0.6 + 0.6 * min(uFrost, 1.0));
            c2 = mix(c2, c2 * 0.35, sb.w * 0.8);
            c2 = mix(c2, edge, sb.y);
            col = mix(col, c2, a);
        }
    }

    col = mix(uBg + halo, col, cov);

    col = vec3(tone(col.r), tone(col.g), tone(col.b));
    col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
    // film grain at a fixed size in CSS pixels, like the reference's
    vec2 gp = floor(gl_FragCoord.xy / max(uDpr, 1.0));
    col += (hash13(vec3(gp, uTime)) - 0.5) * (4.0 / 255.0) * uGrain;
    gl_FragColor = vec4(col, 1.0);
}
`

const stage = document.getElementById("cobalt-sprite-stage");
const canvas = document.getElementById("cobalt-sprite-canvas");

if (stage && canvas) {
    const DEFAULTS = {
        face: "eyes", background: "#000000", scale: 90, spriteColor: "#1400F6",
        frost: 5, follow: "page", reach: 10, lean: 10, blink: 10, float: 15,
    };
    const A = {
        restX: 12, restY: 10, roll: -10, maxTurn: 38, seamAngle: 55,
        seamTilt: 64, seamOffset: -5, shell: 4.5, lip: 6, spriteSize: 59.3,
        eyeGap: 45, eyeLength: 34, eyeWidth: 10, eyeColor: "#F3F2F8",
        lightAngle: 0, gloss: 100, glow: 100, grain: 100, followMs: 90, blinkMs: 150,
    };
    const DEG = Math.PI / 180;
    const FIT = 0.709;
    const DPR_CAP = 2;
    const CAPSULE_PX = 1600;
    const rot = new Float32Array(9);
    const colorCache = new Map();

    function toRGB(css) {
        if (!css) return [0, 0, 0];
        const hex = /^#([0-9a-f]{3,8})$/i.exec(css.trim());
        if (hex) {
            let value = hex[1];
            if (value.length === 3 || value.length === 4) value = value.split("").map((c) => c + c).join("");
            const color = parseInt(value.slice(0, 6), 16);
            return [(color >> 16 & 255) / 255, (color >> 8 & 255) / 255, (color & 255) / 255];
        }
        const resolved = document.createElement("canvas").getContext("2d");
        if (resolved) {
            resolved.fillStyle = "#000000";
            resolved.fillStyle = css;
            if (resolved.fillStyle[0] === "#") return toRGB(resolved.fillStyle);
        }
        return [0, 0, 0];
    }

    function linearColor(css) {
        if (colorCache.has(css)) return colorCache.get(css);
        const color = toRGB(css).map((channel) => Math.pow(channel, 2.2));
        if (colorCache.size > 32) colorCache.clear();
        colorCache.set(css, color);
        return color;
    }

    function compile(gl, type, source) {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Cobalt Sprite shader compile failed:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    function rotX(v, angle) {
        const c = Math.cos(angle), s = Math.sin(angle);
        return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
    }

    function rotY(v, angle) {
        const c = Math.cos(angle), s = Math.sin(angle);
        return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]];
    }

    try {
        const gl = canvas.getContext("webgl", {
            alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power",
        });
        if (!gl) throw new Error("WebGL is unavailable in this browser.");

        const highPrecision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        const precision = highPrecision && highPrecision.precision > 0 ? "highp" : "mediump";
        const vertexShader = compile(gl, gl.VERTEX_SHADER, VERT);
        const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, `precision ${precision} float;\n${FRAG}`);
        if (!vertexShader || !fragmentShader) throw new Error("Cobalt Sprite shader could not be compiled.");

        const program = gl.createProgram();
        if (!program) throw new Error("WebGL could not create the Cobalt Sprite program.");
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.bindAttribLocation(program, 0, "aPos");
        gl.linkProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program) || "Cobalt Sprite shader could not be linked.");
        }
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        if (!buffer) throw new Error("WebGL could not create the Cobalt Sprite geometry.");
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        const uniformNames = [
            "uCenter", "uRadius", "uSeamN", "uSeamD", "uRi", "uLip", "uBallC", "uBallR", "uRot",
            "uEye", "uFace", "uBall", "uEyeCol", "uBg", "uFrost", "uGloss", "uGlow", "uGrain",
            "uLight", "uDpr", "uTime",
        ];
        const uni = Object.fromEntries(uniformNames.map((name) => [name, gl.getUniformLocation(program, name)]));
        const pointer = { x: 0, y: 0, u: 0.5, v: 0.5, active: false, down: false, moved: false, lastMove: -1e9 };
        let cssW = Math.max(1, stage.clientWidth);
        let cssH = Math.max(1, stage.clientHeight);
        let dpr = 1, quality = 1, rectDirty = true, onScreen = true;
        let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let raf = 0, disposed = false, lastNow = 0, clock = 0;
        let yaw = A.restX * DEG, pitch = A.restY * DEG, leanX = 0, leanY = 0;
        let eyeOpen = 1, squint = 0, nextBlink = 1.6, blinkTime = -1, doubleBlink = false;
        let lastDraw = -1e9, drawnSize = "", forceDraw = true, frameMs = 16.7;
        let postDrawMs = 16.7, slowFor = 0, fastFor = 0, justDrew = false;

        function applySize() {
            const device = Math.min(window.devicePixelRatio || 1, DPR_CAP);
            const radius = FIT * (DEFAULTS.scale / 100) * Math.min(cssW, cssH) * 0.5;
            const budget = radius > 0 ? CAPSULE_PX / (radius * 2) : device;
            dpr = Math.max(0.5, Math.min(device, budget) * quality);
            const width = Math.max(1, Math.round(cssW * dpr));
            const height = Math.max(1, Math.round(cssH * dpr));
            if (canvas.width === width && canvas.height === height) return false;
            canvas.width = width;
            canvas.height = height;
            gl.viewport(0, 0, width, height);
            return true;
        }

        function updatePointerPosition() {
            const bounds = stage.getBoundingClientRect();
            if (bounds.width > 0 && bounds.height > 0) {
                pointer.u = (pointer.x - bounds.left) / bounds.width;
                pointer.v = (pointer.y - bounds.top) / bounds.height;
            }
            pointer.moved = false;
            rectDirty = false;
        }

        function step(dt, now) {
            const still = reducedMotion;
            clock += dt;
            const radius = FIT * (DEFAULTS.scale / 100) * Math.min(cssW, cssH) * 0.5;
            const floatStrength = still ? 0 : DEFAULTS.float / 10;
            const cx = cssW * 0.5 + Math.sin(clock * 0.53) * floatStrength * 0.035 * radius;
            const cy = cssH * 0.5 + Math.sin(clock * 0.8) * floatStrength * 0.07 * radius;

            if (pointer.active && (pointer.moved || rectDirty)) updatePointerPosition();

            let targetYaw = A.restX * DEG, targetPitch = A.restY * DEG;
            let targetLeanX = 0, targetLeanY = 0;
            if (DEFAULTS.follow !== "off" && pointer.active) {
                const dx = (pointer.u * cssW - cx) / radius;
                const dy = -(pointer.v * cssH - cy) / radius;
                if (DEFAULTS.reach > 0) {
                    const distance = 16 / DEFAULTS.reach;
                    const limit = A.maxTurn * DEG;
                    targetYaw = Math.max(-limit, Math.min(limit, Math.atan2(dx, distance)));
                    targetPitch = Math.max(-limit, Math.min(limit, Math.atan2(dy, Math.hypot(dx, distance))));
                }
                const lean = (DEFAULTS.lean / 10) * 22 * DEG;
                targetLeanX = Math.max(-1, Math.min(1, dx / 2.5)) * lean;
                targetLeanY = Math.max(-1, Math.min(1, dy / 2.5)) * lean;
            } else if (!still) {
                targetYaw += Math.sin(clock * 0.37) * 6 * DEG * floatStrength + Math.sin(clock * 0.91) * 2 * DEG * floatStrength;
                targetPitch += Math.sin(clock * 0.29 + 1.3) * 4 * DEG * floatStrength;
            }
            if (!still) {
                targetLeanX += Math.sin(clock * 0.53) * 3 * DEG * floatStrength;
                targetLeanY += Math.sin(clock * 0.41 + 0.7) * 2 * DEG * floatStrength;
            }

            const previous = [yaw, pitch, leanX, leanY];
            const ease = 1 - Math.exp(-dt / Math.max(0.005, A.followMs / 1000));
            yaw += (targetYaw - yaw) * ease;
            pitch += (targetPitch - pitch) * ease;
            const leanEase = 1 - Math.exp(-dt / 0.35);
            leanX += (targetLeanX - leanX) * leanEase;
            leanY += (targetLeanY - leanY) * leanEase;

            const blinkDuration = Math.max(0.04, A.blinkMs / 1000);
            if (!still && DEFAULTS.blink > 0) {
                nextBlink -= dt;
                if (nextBlink <= 0 && blinkTime < 0) {
                    blinkTime = 0;
                    const gap = (11 - DEFAULTS.blink) * (0.5 + Math.random());
                    if (doubleBlink) doubleBlink = false;
                    else doubleBlink = Math.random() < 0.25;
                    nextBlink = doubleBlink ? blinkDuration + 0.12 : gap;
                }
            }
            let openness = 1;
            if (blinkTime >= 0) {
                blinkTime += dt;
                const progress = blinkTime / blinkDuration;
                openness = progress < 0.4 ? 1 - progress / 0.4 : Math.min(1, (progress - 0.4) / 0.6);
                if (progress >= 1) blinkTime = -1;
            }
            const targetSquint = pointer.down ? 1 : 0;
            squint += (targetSquint - squint) * (1 - Math.exp(-dt / 0.06));
            eyeOpen = Math.min(openness, 1 - squint * 0.8);

            const turn = Math.abs(yaw - previous[0]) + Math.abs(pitch - previous[1]) + Math.abs(leanX - previous[2]) + Math.abs(leanY - previous[3]);
            const speed = turn / Math.max(dt, 1e-3) * radius;
            if (speed > 12 || blinkTime >= 0 || Math.abs(targetSquint - squint) > 1e-3 || now - pointer.lastMove < 300) return "active";
            const rest = (Math.abs(targetYaw - yaw) + Math.abs(targetPitch - pitch) + Math.abs(targetLeanX - leanX) + Math.abs(targetLeanY - leanY)) * radius;
            return floatStrength > 0 || rest > 0.25 ? "idle" : "still";
        }

        function draw() {
            const width = canvas.width, height = canvas.height;
            const radius = FIT * (DEFAULTS.scale / 100) * Math.min(width, height) * 0.5;
            const floatStrength = reducedMotion ? 0 : DEFAULTS.float / 10;
            const centerX = width * 0.5 + Math.sin(clock * 0.53) * floatStrength * 0.035 * radius;
            const centerY = height * 0.5 + Math.sin(clock * 0.8) * floatStrength * 0.07 * radius;

            const cp = Math.cos(pitch);
            const fx = Math.sin(yaw) * cp, fy = Math.sin(pitch), fz = Math.cos(yaw) * cp;
            const rightLength = Math.hypot(fz, fx) || 1;
            const rx = fz / rightLength, rz = -fx / rightLength;
            const ux = fy * rz, uy = fz * rx - fx * rz, uz = -fy * rx;
            const cr = Math.cos(A.roll * DEG), sr = Math.sin(A.roll * DEG);
            rot[0] = rx * cr + ux * sr; rot[1] = uy * sr; rot[2] = rz * cr + uz * sr;
            rot[3] = ux * cr - rx * sr; rot[4] = uy * cr; rot[5] = uz * cr - rz * sr;
            rot[6] = fx; rot[7] = fy; rot[8] = fz;

            const seamAngle = A.seamAngle * DEG, seamTilt = A.seamTilt * DEG;
            let normal = [Math.cos(seamAngle) * Math.sin(seamTilt), Math.sin(seamAngle) * Math.sin(seamTilt), Math.cos(seamTilt)];
            normal = rotY(normal, leanX);
            normal = rotX(normal, -leanY);
            const innerRadius = 1 - Math.max(0.01, Math.min(0.3, A.shell / 100));
            const lip = Math.max(0.3, innerRadius - Math.max(0, A.lip / 100));
            const spriteRadius = Math.max(0.1, Math.min(innerRadius - 0.02, A.spriteSize / 100));
            const spriteBob = reducedMotion ? 0 : Math.sin(clock * 0.8 - 0.9) * floatStrength * 0.045;
            const u = (name) => uni[name];

            gl.uniform2f(u("uCenter"), centerX, height - centerY);
            gl.uniform1f(u("uRadius"), radius);
            gl.uniform3f(u("uSeamN"), normal[0], normal[1], normal[2]);
            gl.uniform1f(u("uSeamD"), A.seamOffset / 100);
            gl.uniform1f(u("uRi"), innerRadius);
            gl.uniform1f(u("uLip"), lip);
            gl.uniform3f(u("uBallC"), 0, spriteBob, 0);
            gl.uniform1f(u("uBallR"), spriteRadius);
            gl.uniformMatrix3fv(u("uRot"), false, rot);
            gl.uniform4f(u("uEye"), (A.eyeGap / 2) * DEG, Math.max(0, (A.eyeLength - A.eyeWidth) / 2) * DEG, (A.eyeWidth / 2) * DEG, eyeOpen);
            gl.uniform1f(u("uFace"), DEFAULTS.face === "eyes" ? 1 : 0);
            const ball = linearColor(DEFAULTS.spriteColor), eye = linearColor(A.eyeColor), bg = linearColor(DEFAULTS.background);
            gl.uniform3f(u("uBall"), ball[0], ball[1], ball[2]);
            gl.uniform3f(u("uEyeCol"), eye[0], eye[1], eye[2]);
            gl.uniform3f(u("uBg"), bg[0], bg[1], bg[2]);
            gl.uniform1f(u("uFrost"), Math.max(0, Math.min(2, DEFAULTS.frost / 5)));
            gl.uniform1f(u("uGloss"), A.gloss / 100);
            gl.uniform1f(u("uGlow"), A.glow / 100);
            gl.uniform1f(u("uGrain"), A.grain / 100);
            gl.uniform2f(u("uLight"), Math.cos(A.lightAngle * DEG), Math.sin(A.lightAngle * DEG));
            gl.uniform1f(u("uDpr"), Math.max(dpr, 1));
            gl.uniform1f(u("uTime"), reducedMotion ? 0 : clock % 100);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            stage.classList.add("scene-ready");
        }

        function adapt(ms) {
            postDrawMs += (ms - postDrawMs) * 0.1;
            if (postDrawMs > 26) { slowFor += ms; fastFor = 0; }
            else if (postDrawMs < 19) { fastFor += ms; slowFor = 0; }
            if (slowFor > 600 && quality > 0.6) { quality = Math.max(0.6, quality * 0.85); slowFor = 0; forceDraw = true; }
            else if (fastFor > 4000 && quality < 1) { quality = Math.min(1, quality / 0.85); fastFor = 0; forceDraw = true; }
        }

        function loop(now) {
            if (disposed) return;
            raf = requestAnimationFrame(loop);
            if (!onScreen || document.hidden) { lastNow = 0; return; }
            const ms = lastNow ? now - lastNow : 0;
            lastNow = now;
            if (ms > 0) {
                frameMs += (Math.min(ms, 100) - frameMs) * 0.1;
                if (justDrew) adapt(ms);
            }
            justDrew = false;
            const mode = step(Math.min(ms / 1000, 0.1), now);
            const size = `${stage.clientWidth}:${stage.clientHeight}:${quality}`;
            const resized = size !== drawnSize;
            const changed = forceDraw || resized;
            const interval = changed ? 1000 / 60 : mode === "active" ? 1000 / 60 : mode === "idle" ? 1000 / 30 : Infinity;
            if (now - lastDraw < interval - frameMs * 0.5) return;
            lastDraw = now;
            drawnSize = size;
            forceDraw = false;
            applySize();
            draw();
            justDrew = true;
        }

        function recordPointer(event) {
            pointer.x = event.clientX;
            pointer.y = event.clientY;
            pointer.active = true;
            pointer.moved = true;
            pointer.lastMove = performance.now();
        }
        function onPointerOut(event) {
            if (!event.relatedTarget) { pointer.active = false; pointer.lastMove = performance.now(); }
        }
        function onPointerUp() { pointer.down = false; pointer.lastMove = performance.now(); }
        function onPointerDown(event) { recordPointer(event); pointer.down = true; }
        function onScroll() { rectDirty = true; }

        const passive = { passive: true };
        // Page mode: pointer coordinates are read even while the cursor is outside the visual.
        window.addEventListener("pointermove", recordPointer, passive);
        window.addEventListener("pointerout", onPointerOut, passive);
        window.addEventListener("pointerdown", onPointerDown, passive);
        window.addEventListener("pointerup", onPointerUp, passive);
        window.addEventListener("pointercancel", onPointerUp, passive);
        window.addEventListener("scroll", onScroll, { passive: true, capture: true });

        const resizeObserver = new ResizeObserver((entries) => {
            const box = entries[entries.length - 1].contentRect;
            cssW = Math.max(1, box.width);
            cssH = Math.max(1, box.height);
            forceDraw = true;
        });
        resizeObserver.observe(stage);
        const visibilityObserver = new IntersectionObserver((entries) => {
            onScreen = entries.some((entry) => entry.isIntersecting);
            forceDraw = true;
        }, { rootMargin: "128px" });
        visibilityObserver.observe(stage);
        document.addEventListener("visibilitychange", () => { forceDraw = true; });
        const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        motionQuery.addEventListener("change", (event) => { reducedMotion = event.matches; forceDraw = true; });
        canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); cancelAnimationFrame(raf); });
        canvas.addEventListener("webglcontextrestored", () => { disposed = false; forceDraw = true; raf = requestAnimationFrame(loop); });
        raf = requestAnimationFrame(loop);
    } catch (error) {
        stage.classList.add("scene-failed");
        console.error("The Originkit Cobalt Sprite could not start; showing the static fallback.", error);
    }
}
