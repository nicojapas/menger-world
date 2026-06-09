// Menger Sponge SDF - Canonical version (powers of 3)
// Corridors centered at origin

float sdfShape(vec3 p, float iterations, float time, vec4 layerAnim) {
    float scale = 0.6;
    p *= scale;

    float d;
    float period = 9.0;
    float pScale = 1.0;

    for (int i = 0; i < 6; i++) {
        if (float(i) >= iterations) break;

        float offset = period * 0.5;
        vec3 q = abs(mod(p * pScale + offset, period) - offset);
        float crossSize = period / 3.0;
        float c = (min(max(q.x, q.y), min(max(q.y, q.z), max(q.x, q.z))) - crossSize) / pScale;

        d = (i == 0) ? c : max(d, c);

        // Next iteration: period /= 3, but clamp to 1.0 and scale p instead for precision
        if (period > 1.0) {
            period /= 3.0;
        } else {
            pScale *= 3.0;
        }
    }

    return d / scale;
}
