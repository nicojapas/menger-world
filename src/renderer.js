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
        };
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
