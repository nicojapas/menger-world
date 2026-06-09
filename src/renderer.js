/**
 * WebGL renderer setup and management
 * Handles shader compilation, program creation, and rendering
 */

// Vertex shader is trivial for fullscreen raymarching - just pass through the quad
const VERTEX_SHADER = `
attribute vec2 position;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
}`;

/**
 * Create and compile a WebGL shader
 * @param {WebGLRenderingContext} gl
 * @param {number} type - gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
 * @param {string} source - GLSL source code
 * @returns {WebGLShader|null}
 */
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

/**
 * Create a WebGL program from vertex and fragment shaders
 * @param {WebGLRenderingContext} gl
 * @param {string} vertexSource
 * @param {string} fragmentSource
 * @returns {WebGLProgram|null}
 */
function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
        return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return null;
    }

    return program;
}

/**
 * Renderer class - manages WebGL context and rendering
 */
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');

        if (!this.gl) {
            throw new Error('WebGL not supported');
        }

        this.program = null;
        this.uniforms = {};
    }

    /**
     * Initialize the renderer with fragment shader source
     * @param {string} fragmentSource
     */
    init(fragmentSource) {
        const gl = this.gl;

        this.program = createProgram(gl, VERTEX_SHADER, fragmentSource);
        if (!this.program) {
            throw new Error('Failed to create shader program');
        }

        gl.useProgram(this.program);

        // Create full-screen quad
        const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const positionLoc = gl.getAttribLocation(this.program, 'position');
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        // Cache uniform locations
        this.uniforms = {
            resolution: gl.getUniformLocation(this.program, 'resolution'),
            time: gl.getUniformLocation(this.program, 'time'),
            turnIntensity: gl.getUniformLocation(this.program, 'turnIntensity'),
            isAlternate: gl.getUniformLocation(this.program, 'isAlternate'),
            // Debug controls
            breathingEnabled: gl.getUniformLocation(this.program, 'breathingEnabled'),
            breathingScale: gl.getUniformLocation(this.program, 'breathingScale'),
            breathingSpeed: gl.getUniformLocation(this.program, 'breathingSpeed'),
            iterations: gl.getUniformLocation(this.program, 'iterations'),
            domainWarp: gl.getUniformLocation(this.program, 'domainWarp'),
            twistAmount: gl.getUniformLocation(this.program, 'twistAmount'),
            fogStart: gl.getUniformLocation(this.program, 'fogStart'),
            lightIntensity: gl.getUniformLocation(this.program, 'lightIntensity'),
            aoStrength: gl.getUniformLocation(this.program, 'aoStrength'),
            layer3Anim: gl.getUniformLocation(this.program, 'layer3Anim'),
            layer4Anim: gl.getUniformLocation(this.program, 'layer4Anim'),
            layer5Anim: gl.getUniformLocation(this.program, 'layer5Anim'),
            layer6Anim: gl.getUniformLocation(this.program, 'layer6Anim'),
            cameraSpeed: gl.getUniformLocation(this.program, 'cameraSpeed'),
            turnVisualEnabled: gl.getUniformLocation(this.program, 'turnVisualEnabled'),
            layer2Noise: gl.getUniformLocation(this.program, 'layer2Noise'),
            layer3Noise: gl.getUniformLocation(this.program, 'layer3Noise'),
            layer4Noise: gl.getUniformLocation(this.program, 'layer4Noise'),
            layer5Noise: gl.getUniformLocation(this.program, 'layer5Noise'),
            layer6Noise: gl.getUniformLocation(this.program, 'layer6Noise'),
            rounding: gl.getUniformLocation(this.program, 'rounding'),
        };

        // Default debug values
        this.debugValues = {
            breathingEnabled: 1.0,
            breathingScale: 0.5,
            breathingSpeed: 1.0,
            iterations: 6,
            domainWarp: 0.2,
            twistAmount: 0.05,
            fogStart: 0.4,
            lightIntensity: 1.0,
            aoStrength: 1.0,
            layer3Anim: 0.2,
            layer4Anim: 0.25,
            layer5Anim: 0.08,
            layer6Anim: 0.04,
            cameraSpeed: 1.0,
            turnSoundsEnabled: 1.0,
            turnVisualEnabled: 1.0,
            layer2Noise: 0.0,
            layer3Noise: 0.0,
            rounding: 0.0,
        };
    }

    /**
     * Update debug uniform values
     * @param {object} values - Object with debug parameter values
     */
    setDebugValues(values) {
        this.debugValues = { ...this.debugValues, ...values };
    }

    /**
     * Resize the canvas and viewport
     */
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Render a frame
     * @param {number} time - Animation time in seconds
     * @param {number} turnIntensity - Turn effect intensity (0-1)
     * @param {boolean} isAlternate - Whether this is an alternate turn (accent sound)
     */
    render(time, turnIntensity, isAlternate = false) {
        const gl = this.gl;
        gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
        gl.uniform1f(this.uniforms.time, time);
        gl.uniform1f(this.uniforms.turnIntensity, turnIntensity);
        gl.uniform1f(this.uniforms.isAlternate, isAlternate ? 1.0 : 0.0);

        // Debug uniforms
        const d = this.debugValues;
        gl.uniform1f(this.uniforms.breathingEnabled, d.breathingEnabled);
        gl.uniform1f(this.uniforms.breathingScale, d.breathingScale);
        gl.uniform1f(this.uniforms.breathingSpeed, d.breathingSpeed);
        gl.uniform1f(this.uniforms.iterations, d.iterations);
        gl.uniform1f(this.uniforms.domainWarp, d.domainWarp);
        gl.uniform1f(this.uniforms.twistAmount, d.twistAmount);
        gl.uniform1f(this.uniforms.fogStart, d.fogStart);
        gl.uniform1f(this.uniforms.lightIntensity, d.lightIntensity);
        gl.uniform1f(this.uniforms.aoStrength, d.aoStrength);
        gl.uniform1f(this.uniforms.layer3Anim, d.layer3Anim);
        gl.uniform1f(this.uniforms.layer4Anim, d.layer4Anim);
        gl.uniform1f(this.uniforms.layer5Anim, d.layer5Anim);
        gl.uniform1f(this.uniforms.layer6Anim, d.layer6Anim);
        gl.uniform1f(this.uniforms.cameraSpeed, d.cameraSpeed);
        gl.uniform1f(this.uniforms.turnVisualEnabled, d.turnVisualEnabled);
        gl.uniform1f(this.uniforms.layer2Noise, d.layer2Noise);
        gl.uniform1f(this.uniforms.layer3Noise, d.layer3Noise);
        gl.uniform1f(this.uniforms.layer4Noise, d.layer4Noise);
        gl.uniform1f(this.uniforms.layer5Noise, d.layer5Noise);
        gl.uniform1f(this.uniforms.layer6Noise, d.layer6Noise);
        gl.uniform1f(this.uniforms.rounding, d.rounding);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /**
     * Render a static frame (for overlay background)
     */
    renderStatic() {
        this.render(0, 0);
    }
}

/**
 * Load shader source from a .glsl file
 * @param {string} url - Path to shader file
 * @returns {Promise<string>}
 */
export async function loadShader(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load shader: ${url}`);
    }
    return response.text();
}
