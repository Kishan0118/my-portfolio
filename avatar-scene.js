import * as THREE from "three";

const stage = document.getElementById("avatar-stage");
const canvas = document.getElementById("avatar-canvas");
const effectNames = ["globe", "liquid-film", "cobalt-sprite", "rain-pane", "juiceeffect"];
const requestedEffect = new URLSearchParams(window.location.search).get("effect");
const effect = effectNames.includes(requestedEffect) ? requestedEffect : "rain-pane";
const globeVisible = effect !== "liquid-film" && effect !== "cobalt-sprite";

if (stage && canvas) {
    document.body.dataset.heroEffect = effect;
    stage.setAttribute("aria-label", ["globe", "rain-pane", "juiceeffect"].includes(effect) ? "Interactive 3D globe highlighting my work" : `${effect} animated portfolio visual`);

    try {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // Keep the portfolio globe gently rotating even when the OS requests
        // reduced motion; it is the hero's main visual and remains user-draggable.
        const shouldAnimate = globeVisible || !reducedMotion;
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setClearColor(0x000000, 0);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
        camera.position.set(0, 0.02, 6.15);
        scene.add(new THREE.AmbientLight(0xb8d6ff, 1.45));

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
        keyLight.position.set(-3, 4, 5);
        scene.add(keyLight);
        const blueLight = new THREE.PointLight(0x467aff, 21, 9);
        blueLight.position.set(2.5, 1.1, 2.4);
        scene.add(blueLight);
        const mintLight = new THREE.PointLight(0x38e6cf, 12, 8);
        mintLight.position.set(-2, -1.8, 1.8);
        scene.add(mintLight);

        const heroRoot = new THREE.Group();
        scene.add(heroRoot);
        const globe = new THREE.Group();
        heroRoot.add(globe);

        const landPolygons = [
            [[-168, 69], [-145, 72], [-125, 60], [-112, 53], [-95, 50], [-82, 25], [-98, 14], [-111, 28], [-126, 43], [-151, 58]],
            [[-81, 12], [-69, 10], [-51, 2], [-35, -9], [-45, -27], [-52, -48], [-68, -54], [-77, -32]],
            [[-52, 82], [-24, 78], [-38, 60], [-54, 62]],
            [[-11, 36], [-9, 53], [2, 58], [7, 71], [31, 72], [44, 63], [69, 70], [91, 74], [111, 69], [134, 54], [160, 61], [178, 51], [151, 42], [138, 35], [127, 42], [120, 29], [110, 20], [102, 8], [91, 6], [80, 8], [75, 20], [69, 25], [61, 25], [54, 38], [42, 42], [35, 31], [27, 35], [17, 37], [10, 35], [3, 43], [-4, 40]],
            [[-18, 35], [4, 38], [30, 31], [43, 12], [50, 3], [40, -13], [34, -34], [18, -35], [7, -18], [-2, -5], [-14, 10]],
            [[36, 30], [48, 31], [56, 25], [52, 15], [43, 12]],
            [[68, 25], [78, 31], [88, 28], [91, 21], [85, 7], [79, 6], [75, 15]],
            [[96, 20], [108, 21], [119, 8], [112, -7], [103, -4]],
            [[112, -11], [129, -10], [145, -17], [154, -29], [146, -39], [127, -35], [114, -25]],
            [[47, -13], [50, -16], [49, -25], [44, -24]],
            [[-8, 58], [-3, 59], [0, 54], [-4, 50]],
            [[129, 32], [142, 45], [145, 40], [138, 34]],
            [[-180, -72], [-120, -75], [-60, -73], [0, -76], [60, -73], [120, -75], [180, -72], [150, -82], [0, -84], [-150, -82]]
        ];

        function insideLand(longitude, latitude) {
            return landPolygons.some((polygon) => {
                let inside = false;
                for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                    const [xi, yi] = polygon[i];
                    const [xj, yj] = polygon[j];
                    const crosses = (yi > latitude) !== (yj > latitude)
                        && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
                    if (crosses) inside = !inside;
                }
                return inside;
            });
        }

        function spherePoint(longitude, latitude, radius = 1.72) {
            const lon = THREE.MathUtils.degToRad(longitude);
            const lat = THREE.MathUtils.degToRad(latitude);
            return new THREE.Vector3(
                radius * Math.cos(lat) * Math.sin(lon),
                radius * Math.sin(lat),
                radius * Math.cos(lat) * Math.cos(lon)
            );
        }

        function addDottedGlobe() {
            const radius = 1.72;
            const ocean = new THREE.Mesh(
                new THREE.SphereGeometry(radius * 0.995, 72, 54),
                new THREE.MeshPhongMaterial({ color: 0x0a1930, transparent: true, opacity: 0.57, shininess: 90, specular: 0x214c88 })
            );
            globe.add(ocean);

            const positions = [];
            const colors = [];
            const count = 7200;
            const goldenAngle = Math.PI * (3 - Math.sqrt(5));
            const land = new THREE.Color(0xd8f5ff);
            for (let i = 0; i < count; i += 1) {
                const y = 1 - (i / (count - 1)) * 2;
                const longitude = THREE.MathUtils.radToDeg((goldenAngle * i) % (Math.PI * 2) - Math.PI);
                const latitude = THREE.MathUtils.radToDeg(Math.asin(y));
                const onLand = insideLand(longitude, latitude);
                if (!onLand) continue;
                const point = spherePoint(longitude, latitude, radius + 0.012);
                positions.push(point.x, point.y, point.z);
                const color = land.clone();
                if (i % 17 === 0 || (latitude > 20 && latitude < 36 && longitude > 70 && longitude < 94)) {
                    color.lerp(new THREE.Color(0x42eed3), 0.4);
                }
                colors.push(color.r, color.g, color.b);
            }
            const dotGeometry = new THREE.BufferGeometry();
            dotGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
            dotGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
            const dots = new THREE.Points(dotGeometry, new THREE.PointsMaterial({ size: 0.025, vertexColors: true, transparent: true, opacity: 0.92, sizeAttenuation: true }));
            globe.add(dots);

            const lineMaterial = new THREE.LineBasicMaterial({ color: 0x7eb3db, transparent: true, opacity: 0.12 });
            const outlineMaterial = new THREE.LineBasicMaterial({ color: 0xb9efff, transparent: true, opacity: 0.32 });
            function addPath(points, material, closed = false, pathRadius = radius + 0.02) {
                const verts = points.map(([lon, lat]) => spherePoint(lon, lat, pathRadius));
                if (closed && verts.length) verts.push(verts[0].clone());
                globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(verts), material));
            }

            for (let latitude = -75; latitude <= 75; latitude += 15) {
                const points = [];
                for (let longitude = -180; longitude <= 180; longitude += 4) points.push([longitude, latitude]);
                addPath(points, lineMaterial, false, radius + 0.014);
            }
            for (let longitude = -180; longitude < 180; longitude += 15) {
                const points = [];
                for (let latitude = -88; latitude <= 88; latitude += 4) points.push([longitude, latitude]);
                addPath(points, lineMaterial, false, radius + 0.014);
            }
            landPolygons.slice(0, -1).forEach((polygon) => addPath(polygon, outlineMaterial, true));

            const markerPosition = spherePoint(86.98, 25.24, radius + 0.035);
            const marker = new THREE.Group();
            marker.position.copy(markerPosition);
            marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), markerPosition.clone().normalize());
            marker.add(new THREE.Mesh(new THREE.SphereGeometry(0.047, 16, 12), new THREE.MeshBasicMaterial({ color: 0x44ffe0 })));
            const pinHalo = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.008, 8, 44), new THREE.MeshBasicMaterial({ color: 0x44ffe0, transparent: true, opacity: 0.8 }));
            pinHalo.position.z = -0.025;
            marker.add(pinHalo);
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 6), new THREE.MeshBasicMaterial({ color: 0x44ffe0, transparent: true, opacity: 0.72 }));
            stem.position.z = 0.09;
            marker.add(stem);
            globe.add(marker);
            globe.userData.marker = marker;
            globe.rotation.set(0.16, -1.5, -0.08);
        }

        function addLiquidFilm() {
            const filmMaterial = new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                uniforms: { uTime: { value: 0 }, uPointer: { value: new THREE.Vector2(0.5, 0.5) }, uClick: { value: new THREE.Vector2(-2, -2) }, uClickTime: { value: -10 } },
                vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                fragmentShader: `
                    varying vec2 vUv; uniform float uTime; uniform vec2 uPointer; uniform vec2 uClick; uniform float uClickTime;
                    void main(){
                        vec2 p=vUv; float t=uTime*.22;
                        p.x += .035*sin(p.y*7.0+t*1.7)+.018*sin(p.y*19.0-t);
                        p.y += .024*sin(p.x*8.0-t*1.3);
                        vec2 d=p-uPointer; float drag=exp(-dot(d,d)*17.0);
                        float ringAge=uTime-uClickTime; float ring=exp(-abs(length(p-uClick)-ringAge*.29)*38.0)*step(0.0,ringAge)*step(ringAge,2.8);
                        float phase=(p.x*.84+p.y+sin(p.x*4.0+t)*.045)*58.0+sin(p.x*14.0-t*1.5)*1.2+drag*.95+ring*.8;
                        float strands=exp(-pow(sin(phase)*8.0,2.0));
                        strands+=.38*exp(-pow(sin(phase*.54+2.0)*10.0,2.0));
                        float edge=smoothstep(0.0,.16,vUv.x)*smoothstep(0.0,.13,1.0-vUv.x);
                        float alpha=smoothstep(.12,.92,strands)*edge*.83;
                        vec3 color=mix(vec3(.12,.94,.75),vec3(.34,.22,1.0),smoothstep(.08,.95,vUv.x));
                        color+=vec3(.38,.7,1.0)*ring*.48;
                        gl_FragColor=vec4(color,alpha);
                    }`
            });
            const film = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 4.6), filmMaterial);
            film.position.z = 0.2;
            heroRoot.add(film);
            heroRoot.userData.filmMaterial = filmMaterial;
            heroRoot.userData.film = film;
        }

        function addCobaltSprite() {
            const sprite = new THREE.Group();
            heroRoot.add(sprite);
            const shellMaterial = new THREE.MeshPhysicalMaterial({ color: 0x6694ff, metalness: 0.12, roughness: 0.08, transmission: 0.55, thickness: 0.7, clearcoat: 1, clearcoatRoughness: 0.06, transparent: true, opacity: 0.34 });
            const shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.68, 1.06, 8, 32), shellMaterial);
            sprite.add(shell);
            const core = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 0.9, 6, 24), new THREE.MeshPhysicalMaterial({ color: 0x1745aa, metalness: 0.42, roughness: 0.22, emissive: 0x1045c4, emissiveIntensity: 1.0, clearcoat: 0.8 }));
            core.position.z = -0.02;
            sprite.add(core);
            const innerGlow = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), new THREE.MeshBasicMaterial({ color: 0x6be6ff, transparent: true, opacity: 0.18 }));
            innerGlow.scale.set(0.86, 1.2, 0.52);
            innerGlow.position.set(-0.1, 0.15, 0.26);
            sprite.add(innerGlow);
            const rimMaterial = new THREE.MeshBasicMaterial({ color: 0x9bcaff, transparent: true, opacity: 0.8 });
            [-0.76, 0.76].forEach((y) => {
                const rim = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.018, 8, 48), rimMaterial);
                rim.position.y = y;
                sprite.add(rim);
            });
            const flecks = [];
            for (let i = 0; i < 12; i += 1) {
                const fleck = new THREE.Mesh(new THREE.SphereGeometry(0.018 + (i % 3) * 0.006, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x72f5ff : 0x9dbeff, transparent: true, opacity: 0.8 }));
                const angle = i * 2.4;
                fleck.position.set(Math.cos(angle) * 0.3, Math.sin(angle * 1.3) * 0.72, 0.36);
                sprite.add(fleck);
                flecks.push(fleck);
            }
            sprite.userData.flecks = flecks;
            heroRoot.userData.sprite = sprite;
        }

        if (effect === "liquid-film") addLiquidFilm();
        else if (effect === "cobalt-sprite") addCobaltSprite();
        else addDottedGlobe();

        let width = 0;
        let height = 0;
        let pointerX = 0;
        let pointerY = 0;
        let animationFrame = 0;
        let isDragging = false;
        let previousPointerX = 0;
        let previousPointerY = 0;
        let clickTime = -10;
        const timer = new THREE.Timer();
        timer.connect(document);

        function resize() {
            const bounds = stage.getBoundingClientRect();
            width = Math.max(1, Math.round(bounds.width));
            height = Math.max(1, Math.round(bounds.height));
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.position.z = width < 500 ? (globeVisible ? 6.8 : 6.4) : 6.15;
            camera.updateProjectionMatrix();
        }

        function updatePointer(event) {
            const bounds = stage.getBoundingClientRect();
            pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
            pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
            const material = heroRoot.userData.filmMaterial;
            if (material) material.uniforms.uPointer.value.set((event.clientX - bounds.left) / bounds.width, 1 - (event.clientY - bounds.top) / bounds.height);
        }

        function renderFrame() {
            animationFrame = 0;
            timer.update();
            const delta = Math.min(timer.getDelta(), 0.04);
            const elapsed = timer.getElapsed();
            heroRoot.rotation.y += (pointerX * 0.045 - heroRoot.rotation.y) * 0.035;
            heroRoot.rotation.x += (pointerY * 0.035 - heroRoot.rotation.x) * 0.035;

            if (globeVisible) {
                if (!isDragging) globe.rotation.y -= delta * (reducedMotion ? 0.1 : 0.16);
                if (globe.userData.marker && !reducedMotion) globe.userData.marker.scale.setScalar(1 + Math.sin(elapsed * 2.2) * 0.08);
            } else if (effect === "liquid-film") {
                heroRoot.userData.filmMaterial.uniforms.uTime.value = elapsed;
                heroRoot.userData.filmMaterial.uniforms.uClickTime.value = clickTime;
            } else if (effect === "cobalt-sprite") {
                const sprite = heroRoot.userData.sprite;
                if (sprite && !reducedMotion) {
                    sprite.position.y = Math.sin(elapsed * 0.85) * 0.12;
                    sprite.rotation.y = Math.sin(elapsed * 0.55) * 0.28 - 0.26;
                    sprite.rotation.x = Math.sin(elapsed * 0.4) * 0.07;
                    sprite.userData.flecks.forEach((fleck, index) => { fleck.position.y += Math.sin(elapsed * 1.6 + index) * 0.0008; });
                }
            }
            renderer.render(scene, camera);
            if (!stage.classList.contains("scene-ready")) stage.classList.add("scene-ready");
            if (shouldAnimate && !document.hidden) animationFrame = window.requestAnimationFrame(renderFrame);
        }

        function draw() {
            resize();
            if (!shouldAnimate) renderFrame();
            else if (!document.hidden && !animationFrame) animationFrame = window.requestAnimationFrame(renderFrame);
        }

        stage.addEventListener("pointerleave", () => { pointerX = 0; pointerY = 0; });
        stage.addEventListener("pointerdown", (event) => {
            if (globeVisible) isDragging = true;
            previousPointerX = event.clientX;
            previousPointerY = event.clientY;
            const bounds = stage.getBoundingClientRect();
            const material = heroRoot.userData.filmMaterial;
            if (material) material.uniforms.uClick.value.set((event.clientX - bounds.left) / bounds.width, 1 - (event.clientY - bounds.top) / bounds.height);
        });
        stage.addEventListener("pointermove", (event) => {
            updatePointer(event);
            if (isDragging) {
                globe.rotation.y += (event.clientX - previousPointerX) * 0.006;
                globe.rotation.x += (event.clientY - previousPointerY) * 0.006;
                previousPointerX = event.clientX;
                previousPointerY = event.clientY;
            }
        }, { passive: true });
        window.addEventListener("pointerup", () => { isDragging = false; });
        stage.addEventListener("click", () => { clickTime = timer.getElapsed(); });
        stage.addEventListener("pointercancel", () => { isDragging = false; });

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(stage);
        document.addEventListener("visibilitychange", () => {
            if (document.hidden && animationFrame) {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = 0;
            } else if (shouldAnimate) draw();
        });
        draw();
    } catch (error) {
        stage.classList.add("scene-failed");
        console.warn("The 3D portfolio visual is unavailable; using its illustration fallback.", error);
    }
}
