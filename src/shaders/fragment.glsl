precision highp float;

uniform vec2 resolution;
uniform float time;
uniform float turnIntensity;
uniform float isAlternate;

// Debug controls
uniform float breathingEnabled;
uniform float breathingScale;
uniform float breathingSpeed;
uniform float iterations;
uniform float domainWarp;
uniform float twistAmount;
uniform float fogStart;
uniform float lightIntensity;
uniform float aoStrength;
uniform float layer3Anim;
uniform float layer4Anim;
uniform float layer5Anim;
uniform float layer6Anim;
uniform float cameraSpeed;
uniform float turnVisualEnabled;
uniform float layer2Noise;
uniform float layer3Noise;

#define FAR 30.0
#define MAX_STEPS 128
#define PI 3.14159265

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

float hash(float n) {
    return fract(cos(n) * 45758.5453);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = i.x + i.y * 57.0 + i.z * 113.0;
    return mix(
        mix(mix(hash(n), hash(n + 1.0), f.x),
            mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
        mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
            mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
}

float fbm(vec3 p) {
    float f = 0.0;
    f += 0.5 * noise(p); p *= 2.02;
    f += 0.25 * noise(p); p *= 2.03;
    f += 0.125 * noise(p); p *= 2.01;
    f += 0.0625 * noise(p);
    return f / 0.9375;
}

// Cross SDF - intersection of 3 axis-aligned square rods
float sdCross(vec3 q) {
    return min(max(q.x, q.y), min(max(q.y, q.z), max(q.x, q.z)));
}

float sdCrossCircle(vec3 q) {
    return min(length(q.xy), min(length(q.yz), length(q.xz)));
}

float voronoi(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    float minDist = 1.0;
    for (int z = -1; z <= 1; z++) {
        for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
                vec3 lattice = vec3(float(x), float(y), float(z));
                // Función de aleatoriedad simple para las posiciones de las celdas
                vec3 randSign = sin(dot(i + lattice, vec3(7.0, 157.0, 113.0))) * vec3(43758.5453);
                vec3 offset = fract(randSign);
                vec3 r = lattice + offset - f;
                float d = dot(r, r);
                minDist = min(minDist, d);
            }
        }
    }
    return sqrt(minDist);
}

// Starfield background
vec3 stars(vec3 rd) {
    vec3 col = vec3(0.0);

    // Multiple layers of stars at different scales
    for (int i = 0; i < 3; i++) {
        float scale = 80.0 + float(i) * 60.0;
        vec3 p = rd * scale;
        vec3 id = floor(p);
        vec3 f = fract(p) - 0.5;

        // Random star position within cell
        float h = hash(dot(id, vec3(127.1, 311.7, 74.7)));
        vec3 offset = vec3(hash(h * 13.0), hash(h * 57.0), hash(h * 113.0)) - 0.5;

        float d = length(f - offset * 0.4);

        // Star brightness varies
        float brightness = hash(h * 7.0);
        brightness = pow(brightness, 8.0); // Most stars dim, few bright

        // Sharp star points
        float star = smoothstep(0.1, 0.0, d) * brightness;
        col += star;
    }

    return col;
}

// Smooth interpolation for camera path
vec3 smoothPath(vec3 a, vec3 b, float t) {
    t = t * t * (3.0 - 2.0 * t); // smoothstep
    return mix(a, b, t);
}

// Twist for visual interest
float getTwist(float z) {
    float camTime = time * 0.8 * cameraSpeed;
    float seg = min(mod(camTime, 20.0) / 10.0, 1.0);
    float twist = sin(seg * PI) * twistAmount;

    return z * twist;
}

// Get waypoint by index using float comparison (WebGL 1.0 compatible)
// ONLY use main corridor positions (multiples of 4) to avoid wall collisions
vec3 getWaypoint(float i) {
    float idx = mod(i, 8.0);
    if (idx < 0.5) return vec3(0.0, 0.0, 0.0);      // Start
    if (idx < 1.5) return vec3(0.0, 0.0, 16.0);     // Forward
    if (idx < 2.5) return vec3(4.0, 0.0, 16.0);     // Turn right
    if (idx < 3.5) return vec3(4.0, 0.0, 32.0);     // Forward
    if (idx < 4.5) return vec3(4.0, 4.0, 32.0);     // Turn up
    if (idx < 5.5) return vec3(4.0, 4.0, 48.0);     // Forward
    if (idx < 6.5) return vec3(0.0, 4.0, 48.0);     // Turn left
    if (idx < 7.5) return vec3(0.0, 4.0, 64.0);     // Forward (loop)
    return vec3(0.0, 0.0, 0.0);
}

// Camera navigates through different corridors
vec3 camPath(float t) {
    // Segment length
    float segLen = 10.0;

    // Which segment are we in
    float segF = t / segLen;
    float seg = floor(segF);
    float f = fract(segF);

    float idx = mod(seg, 8.0);
    float nextIdx = mod(seg + 1.0, 8.0);

    vec3 curr = getWaypoint(idx);
    vec3 next = getWaypoint(nextIdx);

    // Add offset for looping (64 is the Z span of one full loop)
    float loopZ = floor(seg / 8.0) * 64.0;
    curr.z += loopZ;
    next.z += loopZ;
    if (nextIdx < idx) next.z += 64.0;

    vec3 pos = smoothPath(curr, next, f);

    // Apply INVERSE twist to camera so it follows the twisted corridors
    // The structure rotates by +twist, so camera must rotate by -twist to stay in corridors
    float twist = getTwist(pos.z);
    pos.xy = rot(-twist) * pos.xy;

    return pos;
}

// Get camera forward direction based on path
vec3 camDir(float t) {
    vec3 p0 = camPath(t);
    vec3 p1 = camPath(t + 0.5);
    return normalize(p1 - p0);
}

// Twisting Menger structure
float map(vec3 p) {
    float oz = p.z;

    // Gentle twist for visual interest
    float twist = getTwist(oz);
    p.xy = rot(twist) * p.xy;

    // Offset so corridor runs through origin
    p.xy += 2.0;

    // Domain warping - curves the straight lines
    vec3 warp = vec3(
        sin(p.y * 0.5 + p.z * 0.3) * 0.3,
        sin(p.x * 0.5 + p.z * 0.2) * 0.3,
        sin(p.x * 0.3 + p.y * 0.3) * 0.2
    );
    vec3 wp = p + warp * domainWarp;

    // Breathing multipliers (scaled down for subtlety)
    float bEnabled = breathingEnabled;
    float bScale = breathingScale * 0.1;
    float bSpeed = breathingSpeed;

    // Layer 1: Large frame (8 units)
    vec3 q = abs(mod(wp, 8.0) - 4.0);
    float d = sdCrossCircle(q) - 8.0 / 3.0;

    // Layer 2: (4 units)
    if (iterations >= 2.0) {
        q = abs(mod(wp, 4.0) - 2.0);
        d = max(d, sdCross(q) - (2.0 - layer2Noise));
    }

    // Layer 3: (2 units) - slow breathing
    if (iterations >= 3.0) {
        q = abs(mod(wp, 2.0) - 1.0);
        float phase3 = oz * 0.05 + time * 0.3 * bSpeed * bEnabled;
        float anim3 = 2.0 / 3.0 + layer3Anim * bScale * sin(phase3);
        d = max(d, sdCross(q) - (anim3 + 0.5 - layer3Noise));
    }

    // Layer 4: finer detail - faster counter-breathing
    if (iterations >= 4.0) {
        q = abs(mod(wp, 1.0) - 0.5);
        float phase4 = oz * 0.15 - time * 0.7 * bSpeed * bEnabled;
        float anim4 = 1.0 / 3.0 + layer4Anim * bScale * sin(phase4);
        d = max(d, sdCross(q) - (anim4));
    }

    // Layer 5: very fine detail (0.5 units) - subtle shimmer
    if (iterations >= 5.0) {
        q = abs(mod(wp, 0.5) - 0.25);
        float phase5 = oz * 0.25 + time * 1.1 * bSpeed * bEnabled;
        float anim5 = 0.5 / 3.0 + layer5Anim * bScale * sin(phase5);
        d = max(d, sdCross(q) - (anim5));
    }

    // Layer 6: micro detail (0.25 units) - fast ripple
    if (iterations >= 6.0) {
        q = abs(mod(wp, 0.25) - 0.125);
        float phase6 = oz * 0.4 - time * 1.5 * bSpeed * bEnabled;
        float anim6 = 0.25 / 3.0 + layer6Anim * bScale * sin(phase6);
        d = max(d, sdCross(q) - anim6);
    }

    float turnFx = max(turnIntensity - 0.2, 0.0);
    return d + noise(p * 2.0) * (turnFx) * 0.0 * turnVisualEnabled;
}

float trace(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < MAX_STEPS; i++) {
        float d = map(ro + rd * t);
        if (d < 0.001 * (t * 0.1 + 1.0) || t > FAR) break;
        t += d * 0.85;
    }
    return t;
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.005, 0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

float calcAO(vec3 p, vec3 n) {
    float occ = 0.0, sca = 1.0;
    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i);
        occ += (h - map(p + h * n)) * sca;
        sca *= 0.7;
    }
    return clamp(1.0 - occ, 0.0, 1.0);
}


void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * resolution) / resolution.y;

    float t = time * 0.8 * cameraSpeed;

    // Camera follows path through corridors
    vec3 ro = camPath(t);
    vec3 fwd = camDir(t);

    // Light follows camera
    vec3 lightPos = ro + fwd * 4.0 + vec3(0.2, 0.3, 0);

    // Camera rolls with the twist so corridors appear upright
    float twist = getTwist(ro.z);
    vec3 worldUp = vec3(sin(twist), cos(twist), 0.0);

    // Handle gimbal lock: if fwd is nearly parallel to worldUp, use alternative up
    float upDot = abs(dot(fwd, worldUp));
    if (upDot > 0.99) {
        // Forward is nearly vertical, use Z as the up reference instead
        worldUp = vec3(0.0, 0.0, 1.0);
    }

    // Camera matrix
    vec3 rgt = normalize(cross(worldUp, fwd));
    vec3 up = cross(fwd, rgt);

    vec3 rd = normalize(fwd * 1.5 + uv.x * rgt + uv.y * up);

    float dist = trace(ro, rd);

    vec3 col = vec3(0);

    if (dist < FAR) {
        vec3 p = ro + rd * (dist - 0.01);
        vec3 n = calcNormal(p);

        // Lighting
        vec3 li = normalize(lightPos - p);
        float lDist = length(lightPos - p);
        float atten = 1.0 / (1.0 + lDist * 0.05 + lDist * lDist * 0.005);

        float diff = max(dot(n, li), 0.0);
        float spec = pow(max(dot(reflect(-li, n), -rd), 0.0), 32.0);
        float ao = calcAO(p, n);
        ao = mix(1.0, ao, aoStrength); // Apply AO strength

        // Material color - white normally, fades to red or ice blue during turns
        float tex1 = fbm(p * 3.0);
        vec3 baseCol = vec3(0.95, 0.95, 0.97);
        vec3 redCol = vec3(0.4, 0.02, 0.0);
        vec3 iceBlueCol = vec3(0.8, 0.8, 0.97);
        vec3 turnCol = isAlternate > 0.5 ? iceBlueCol : redCol;
        float effectiveTurnIntensity = turnIntensity * turnVisualEnabled;
        vec3 matCol = mix(baseCol, turnCol, effectiveTurnIntensity);
        matCol *= 0.9 + tex1 * 0.1;

        // Shading with light intensity control
        col = matCol * (diff * 0.7 * lightIntensity + 0.3);
        col += vec3(1.0) * spec * 0.6 * lightIntensity;
        col *= ao * atten;

        // Distance fog - fade to stars before FAR to avoid artifacts
        float fog = smoothstep(FAR * fogStart, FAR * 0.9, dist);
        col = mix(col, stars(rd), fog);
    } else {
        // Space background with stars
        col = stars(rd);
    }

    // Gamma
    col = pow(col, vec3(0.45));

    // Vignette
    col *= 1.0 - dot(uv, uv) * 0.3;

    gl_FragColor = vec4(col, 1.0);
}
