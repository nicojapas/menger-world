#!/usr/bin/env node
/**
 * Generate audio loops using ElevenLabs Sound Effects API
 *
 * Usage: npm run generate-audio
 *
 * This will generate 4 short loopable audio files in the loops/ directory.
 * Total API usage: ~35 seconds of audio generation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load .env file
config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOOPS_DIR = path.join(__dirname, 'loops');

const API_KEY = process.env.ELEVENLABS_API_KEY;
const API_URL = 'https://api.elevenlabs.io/v1/sound-generation';

// Loop definitions - prompts optimized for seamless looping
const LOOPS = [
    {
        name: 'drone',
        prompt: 'deep space ambient drone, low frequency resonant hum, dark atmospheric pad, seamless loop, cinematic sci-fi atmosphere',
        duration: 10,
    },
    {
        name: 'texture',
        prompt: 'ethereal crystalline shimmer, high frequency subtle sparkle, airy cosmic texture, gentle movement, seamless loop',
        duration: 8,
    },
    {
        name: 'movement',
        prompt: 'slow whooshing wind through metallic corridors, gentle air movement, futuristic ventilation ambience, seamless loop',
        duration: 10,
    },
    {
        name: 'accent',
        prompt: 'distant metallic resonance, subtle sci-fi machinery hum, occasional soft tonal ping, mysterious atmosphere, seamless loop',
        duration: 6,
    },
    {
        name: 'turn',
        prompt: 'rusty metal scraping against metal, heavy industrial grinding, creaking mechanical pivot, eerie metallic screech, single event not looped',
        duration: 3,
    },
    {
        name: 'breathing',
        prompt: 'very slow deep alien respiration, long drawn out inhale and exhale over many seconds, massive creature breathing slowly, deep rumbling organic lung sounds, slow wet membrane expansion, seamless loop',
        duration: 12,
    },
];

async function generateLoop(loop) {
    console.log(`Generating "${loop.name}"...`);
    console.log(`  Prompt: ${loop.prompt}`);
    console.log(`  Duration: ${loop.duration}s`);

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': API_KEY,
        },
        body: JSON.stringify({
            text: loop.prompt,
            duration_seconds: loop.duration,
            prompt_influence: 0.7, // Balance between prompt adherence and quality
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error for ${loop.name}: ${response.status} - ${error}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const outputPath = path.join(LOOPS_DIR, `${loop.name}.mp3`);

    fs.writeFileSync(outputPath, Buffer.from(audioBuffer));
    console.log(`  Saved to: ${outputPath}`);
    console.log('');

    return outputPath;
}

async function main() {
    if (!API_KEY) {
        console.error('Error: ELEVENLABS_API_KEY environment variable is not set.');
        console.error('');
        console.error('To get your API key:');
        console.error('  1. Go to https://elevenlabs.io');
        console.error('  2. Sign in or create a free account');
        console.error('  3. Go to Profile Settings -> API Keys');
        console.error('  4. Copy your API key');
        console.error('');
        console.error('Then run:');
        console.error('  export ELEVENLABS_API_KEY=your_key_here');
        console.error('  node generate-loops.js');
        process.exit(1);
    }

    // Create loops directory
    if (!fs.existsSync(LOOPS_DIR)) {
        fs.mkdirSync(LOOPS_DIR, { recursive: true });
        console.log(`Created directory: ${LOOPS_DIR}`);
    }

    console.log('');
    console.log('=== ElevenLabs Sound Effects Loop Generator ===');
    console.log('');

    // Filter out loops that already exist
    const toGenerate = LOOPS.filter(loop => {
        const filePath = path.join(LOOPS_DIR, `${loop.name}.mp3`);
        if (fs.existsSync(filePath)) {
            console.log(`Skipping "${loop.name}" - already exists`);
            return false;
        }
        return true;
    });

    if (toGenerate.length === 0) {
        console.log('');
        console.log('All sounds already exist. Nothing to generate.');
        return;
    }

    console.log('');
    console.log(`Generating ${toGenerate.length} new sound(s) (~${toGenerate.reduce((a, l) => a + l.duration, 0)}s total)`);
    console.log('');

    const results = [];
    for (const loop of toGenerate) {
        try {
            const outputPath = await generateLoop(loop);
            results.push({ name: loop.name, success: true, path: outputPath });

            // Small delay between requests to be nice to the API
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
            console.error(`  Failed: ${err.message}`);
            results.push({ name: loop.name, success: false, error: err.message });
        }
    }

    console.log('=== Generation Complete ===');
    console.log('');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`Success: ${successful.length}/${LOOPS.length}`);

    if (failed.length > 0) {
        console.log('Failed:');
        failed.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
    }

    if (successful.length > 0) {
        console.log('');
        console.log('Next steps:');
        console.log('  1. Open index.html in a browser');
        console.log('  2. Click anywhere to start the audio');
        console.log('');
    }
}

main().catch(console.error);
