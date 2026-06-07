precision highp float;

uniform vec2 resolution;
uniform float time;
uniform float turnIntensity;

#define FAR 30.0
#define MAX_STEPS 96
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

        // Slight color variation
        vec3 starCol = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.95, 0.8), hash(h * 23.0));
        col += star * starCol;
    }

    return col;
}

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Smooth interpolation for camera path
vec3 smoothPath(vec3 a, vec3 b, float t) {
    t = t * t * (3.0 - 2.0 * t); // smoothstep
    return mix(a, b, t);
}

// Twist for visual interest
float getTwist(float z) {
    return z * 0.00;
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

float matID = 0.0;

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
    vec3 wp = p + warp * 0.2;

    // Layer 1: Large frame (8 units)
    vec3 q = abs(mod(wp, 8.0) - 4.0);
    float d = min(max(q.x, q.y), min(max(q.y, q.z), max(q.x, q.z))) - 8.0 / 3.0;

    // Layer 2: (4 units)
    q = abs(mod(wp, 4.0) - 2.0);
    d = max(d, min(max(q.x, q.y), min(max(q.y, q.z), max(q.x, q.z))) - 4.0 / 3.0);

    // Layer 3: (2 units) - slow breathing
    q = abs(mod(wp, 2.0) - 1.0);
    float anim3 = 2.0 / 3.0 + 0.2 * sin(oz * 0.05 + time * 0.3);
    d = max(d, min(max(q.x, q.y), min(max(q.y, q.z), max(q.x, q.z))) - anim3);

    // Layer 4: finer detail - faster counter-breathing
    q = abs(mod(wp, 1.0) - 0.5);
    float anim4 = 1.0 / 3.0 + 0.25 * sin(oz * 0.15 - time * 0.7);
    d = max(d, min(max(q.x, q.y), min(max(q.y, q.z), max(q.x, q.z))) - anim4);

    return d;
}

float trace(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < MAX_STEPS; i++) {
        float d = map(ro + rd * t);
        if (d < 0.002 * (t * 0.1 + 1.0) || t > FAR) break;
        t += d * 0.9;
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

    float t = time * 0.8;

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
    float saveMat = matID;

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

        // Material color - white normally, fades to dark red during turns
        float tex1 = fbm(p * 3.0);
        vec3 baseCol = vec3(0.95, 0.95, 0.97);
        vec3 turnCol = vec3(0.55, 0.08, 0.05);
        vec3 matCol = mix(baseCol, turnCol, turnIntensity);
        matCol *= 0.9 + tex1 * 0.1;

        // Shading
        col = matCol * (diff * 0.7 + 0.3);
        col += vec3(1.0) * spec * 0.6;
        col *= ao * atten;

        // Rim light
        float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
        col += vec3(0.5, 0.6, 0.8) * rim * 0.15;

        // Distance fog - fade to stars before FAR to avoid artifacts
        float fog = smoothstep(FAR * 0.4, FAR * 0.9, dist);
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
