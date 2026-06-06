# cool-room

![WebGL](https://img.shields.io/badge/WebGL-990000?style=flat&logo=webgl&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![ElevenLabs](https://img.shields.io/badge/ElevenLabs-000000?style=flat)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

WebGL fractal corridor with procedural audio. Raymarched Menger sponge structure with breathing animations, synchronized to layered soundscapes generated via ElevenLabs.

## Run

```bash
npm install
npx serve .
```

## Audio Generation

```bash
cp .env.example .env  # add ELEVENLABS_API_KEY
npm run generate-audio
```

## Stack

- WebGL 1.0 / GLSL fragment shader
- Web Audio API with convolution reverb
- ElevenLabs sound effects API

## License

MIT
