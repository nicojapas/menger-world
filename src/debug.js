/**
 * Debug UI overlay with sliders for tweaking shader parameters
 */

const DEFAULT_VALUES = {
    breathingEnabled: 1.0,
    breathingScale: 0.1,
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
    // Camera & turns
    cameraSpeed: 1.0,
    turnSoundsEnabled: 1.0,
    turnVisualEnabled: 1.0,
    // Layer noise
    layer2Noise: 0.5,
    layer3Noise: 0.5,
};

export class DebugUI {
    constructor() {
        this.values = { ...DEFAULT_VALUES };
        this.visible = true;
        this.panel = null;
        this.onChange = null;
    }

    init() {
        this.createPanel();
        this.setupKeyboardToggle();
    }

    createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'debug-panel';
        this.panel.innerHTML = `
            <style>
                #debug-panel {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: rgba(0, 0, 0, 0.85);
                    color: #fff;
                    font-family: monospace;
                    font-size: 12px;
                    padding: 15px;
                    border-radius: 8px;
                    z-index: 1000;
                    width: 280px;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                #debug-panel h3 {
                    margin: 0 0 10px 0;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #444;
                    font-size: 14px;
                }
                #debug-panel .section {
                    margin-bottom: 15px;
                }
                #debug-panel .section-title {
                    color: #888;
                    font-size: 10px;
                    text-transform: uppercase;
                    margin-bottom: 8px;
                }
                #debug-panel .slider-row {
                    display: flex;
                    align-items: center;
                    margin-bottom: 6px;
                }
                #debug-panel label {
                    flex: 1;
                    min-width: 100px;
                }
                #debug-panel input[type="range"] {
                    flex: 1;
                    margin: 0 8px;
                }
                #debug-panel .value {
                    width: 45px;
                    text-align: right;
                    color: #0f0;
                }
                #debug-panel button {
                    background: #333;
                    border: 1px solid #555;
                    color: #fff;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 5px;
                    margin-top: 5px;
                }
                #debug-panel button:hover {
                    background: #444;
                }
                #debug-panel button.active {
                    background: #060;
                    border-color: #0a0;
                }
                #debug-panel .hint {
                    color: #666;
                    font-size: 10px;
                    margin-top: 10px;
                }
            </style>
            <h3>🎛️ Debug Controls</h3>

            <div class="section">
                <div class="section-title">Camera & Turns</div>
                ${this.createSlider('cameraSpeed', 'Travel Speed', 0, 3, 0.1)}
                <button id="btn-turnSounds">Turn Sounds: ON</button>
                <button id="btn-turnVisual">Turn Visual: ON</button>
            </div>

            <div class="section">
                <div class="section-title">Breathing Animation</div>
                <button id="btn-breathing">Breathing: ON</button>
                ${this.createSlider('breathingScale', 'Scale', 0, 3, 0.1)}
                ${this.createSlider('breathingSpeed', 'Speed', 0, 3, 0.1)}
            </div>

            <div class="section">
                <div class="section-title">Per-Layer Amplitude</div>
                ${this.createSlider('layer3Anim', 'Layer 3 (2u)', 0, 0.5, 0.01)}
                ${this.createSlider('layer4Anim', 'Layer 4 (1u)', 0, 0.5, 0.01)}
                ${this.createSlider('layer5Anim', 'Layer 5 (0.5u)', 0, 0.2, 0.01)}
                ${this.createSlider('layer6Anim', 'Layer 6 (0.25u)', 0, 0.1, 0.01)}
            </div>

            <div class="section">
                <div class="section-title">Layer Hole Noise</div>
                ${this.createSlider('layer2Noise', 'Layer 2 (4u)', 0, 1, 0.01)}
                ${this.createSlider('layer3Noise', 'Layer 3 (2u)', 0, 1, 0.01)}
            </div>

            <div class="section">
                <div class="section-title">Geometry</div>
                ${this.createSlider('iterations', 'Iterations', 1, 6, 1)}
                ${this.createSlider('domainWarp', 'Domain Warp', 0, 1, 0.05)}
                ${this.createSlider('twistAmount', 'Twist', 0, 0.2, 0.01)}
            </div>

            <div class="section">
                <div class="section-title">Lighting</div>
                ${this.createSlider('fogStart', 'Fog Start', 0.1, 1.0, 0.05)}
                ${this.createSlider('lightIntensity', 'Light', 0.2, 3.0, 0.1)}
                ${this.createSlider('aoStrength', 'AO', 0, 2, 0.1)}
            </div>

            <div class="section">
                <button id="btn-reset">Reset All</button>
                <button id="btn-copy">Copy Values</button>
            </div>

            <div class="hint">Press H to hide/show panel</div>
        `;

        document.body.appendChild(this.panel);
        this.bindEvents();
    }

    createSlider(id, label, min, max, step) {
        const value = this.values[id];
        return `
            <div class="slider-row">
                <label for="${id}">${label}</label>
                <input type="range" id="${id}"
                    min="${min}" max="${max}" step="${step}"
                    value="${value}">
                <span class="value" id="${id}-val">${value}</span>
            </div>
        `;
    }

    bindEvents() {
        // Turn sounds toggle
        const btnTurnSounds = document.getElementById('btn-turnSounds');
        btnTurnSounds.addEventListener('click', () => {
            this.values.turnSoundsEnabled = this.values.turnSoundsEnabled > 0.5 ? 0 : 1;
            btnTurnSounds.textContent = `Turn Sounds: ${this.values.turnSoundsEnabled > 0.5 ? 'ON' : 'OFF'}`;
            btnTurnSounds.classList.toggle('active', this.values.turnSoundsEnabled > 0.5);
            this.emitChange();
        });
        btnTurnSounds.classList.add('active');

        // Turn visual toggle
        const btnTurnVisual = document.getElementById('btn-turnVisual');
        btnTurnVisual.addEventListener('click', () => {
            this.values.turnVisualEnabled = this.values.turnVisualEnabled > 0.5 ? 0 : 1;
            btnTurnVisual.textContent = `Turn Visual: ${this.values.turnVisualEnabled > 0.5 ? 'ON' : 'OFF'}`;
            btnTurnVisual.classList.toggle('active', this.values.turnVisualEnabled > 0.5);
            this.emitChange();
        });
        btnTurnVisual.classList.add('active');

        // Breathing toggle
        const btnBreathing = document.getElementById('btn-breathing');
        btnBreathing.addEventListener('click', () => {
            this.values.breathingEnabled = this.values.breathingEnabled > 0.5 ? 0 : 1;
            btnBreathing.textContent = `Breathing: ${this.values.breathingEnabled > 0.5 ? 'ON' : 'OFF'}`;
            btnBreathing.classList.toggle('active', this.values.breathingEnabled > 0.5);
            this.emitChange();
        });
        btnBreathing.classList.add('active');

        // Reset button
        document.getElementById('btn-reset').addEventListener('click', () => {
            this.values = { ...DEFAULT_VALUES };
            this.updateAllSliders();
            btnBreathing.textContent = 'Breathing: ON';
            btnBreathing.classList.add('active');
            btnTurnSounds.textContent = 'Turn Sounds: ON';
            btnTurnSounds.classList.add('active');
            btnTurnVisual.textContent = 'Turn Visual: ON';
            btnTurnVisual.classList.add('active');
            this.emitChange();
        });

        // Copy values button
        document.getElementById('btn-copy').addEventListener('click', () => {
            const text = JSON.stringify(this.values, null, 2);
            navigator.clipboard.writeText(text);
            alert('Values copied to clipboard!');
        });

        // All sliders
        Object.keys(DEFAULT_VALUES).forEach(id => {
            const slider = document.getElementById(id);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    this.values[id] = val;
                    document.getElementById(`${id}-val`).textContent =
                        val % 1 === 0 ? val : val.toFixed(2);
                    this.emitChange();
                });
            }
        });
    }

    updateAllSliders() {
        Object.keys(DEFAULT_VALUES).forEach(id => {
            const slider = document.getElementById(id);
            const valDisplay = document.getElementById(`${id}-val`);
            if (slider && valDisplay) {
                slider.value = this.values[id];
                const val = this.values[id];
                valDisplay.textContent = val % 1 === 0 ? val : val.toFixed(2);
            }
        });
    }

    setupKeyboardToggle() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'h' || e.key === 'H') {
                this.visible = !this.visible;
                this.panel.style.display = this.visible ? 'block' : 'none';
            }
        });
    }

    emitChange() {
        if (this.onChange) {
            this.onChange(this.values);
        }
    }

    getValues() {
        return this.values;
    }
}
