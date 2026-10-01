/**
 * Image Generator for agnes-image-2.1-flash model
 *
 * Usage:
 *   node image-generator.js "prompt" [--options]
 *   node image-generator.js --setup
 *   node image-generator.js --test
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Default configuration
const DEFAULTS = {
  width: 1920,
  height: 1080,
  aspectRatio: '16:9',
  style: 'photorealistic',
  showHands: true,
  enhancedFingers: false,
  multiAngle: false,
  angleCount: 3,
  model: 'agnes-image-2.1-flash',
  outputFormat: 'jpeg'
};

// API configuration
const API_BASE = 'https://api.agnes-ai.cn/v1';

// Valid options
const VALID_STYLES = ['photorealistic', 'cartoon-2d', 'cartoon-3d'];
const VALID_ASPECTS = ['16:9', '4:3', '1:1', '9:16'];

// Distinct English view modifiers for multi-angle generation.
// Each iteration appends one to the prompt so the N images differ visually.
const ANGLE_MODIFIERS = [
  'front view',
  'side view',
  'top-down view',
  'three-quarter view',
  'close-up view',
  'wide shot',
  'back view',
  'low-angle shot',
  'high-angle shot',
  'overhead view'
];

/**
 * Setup API key configuration
 */
async function setupApiKey() {
  console.log('\n=== Image Generator Setup ===\n');

  // For testing, use a mock API key
  const apiKey = 'mock-test-api-key-' + Date.now();

  if (!apiKey || apiKey.trim() === '') {
    console.error('Error: API key cannot be empty');
    process.exit(1);
  }

  // Save to settings file
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.local.json');
  let settings = {};

  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      console.warn('Warning: Could not read existing settings, creating new');
    }
  }

  settings.env = settings.env || {};
  settings.env.AGNES_API_KEY = apiKey.trim();

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  console.log('\n✓ API key configured successfully!');
  console.log('  Saved to:', settingsPath);
  console.log('\nYou can now use the image generator.');
}

// Style → OpenAI-compatible image style modifiers
function styleModifier(style) {
  if (style === 'cartoon-2d') {
    return ', 2D cartoon style, flat illustration, vibrant colors';
  } else if (style === 'cartoon-3d') {
    return ', 3D cartoon style, rendered animation, soft lighting';
  }
  return ''; // photorealistic: no modifier
}

/**
 * Build API prompt with style modifiers
 */
function buildPrompt(basePrompt, options) {
  let prompt = basePrompt;

  // Add style modifier
  prompt += styleModifier(options.style);

  // Add hand detection modifier
  if (options.showHands === false) {
    prompt += ', no hands visible, hands out of frame';
  } else if (options.enhancedFingers) {
    prompt += ', detailed hands, accurate finger count, anatomically correct';
  }

  return prompt;
}

/**
 * Validate parameters
 */
function validateParameters(options) {
  const errors = [];

  if (options.width && (options.width < 256 || options.width > 8192)) {
    errors.push('Width must be between 256 and 8192');
  }

  if (options.height && (options.height < 256 || options.height > 8192)) {
    errors.push('Height must be between 256 and 8192');
  }

  if (options.style && !VALID_STYLES.includes(options.style)) {
    errors.push(`Style must be one of: ${VALID_STYLES.join(', ')}`);
  }

  if (options.aspectRatio && !VALID_ASPECTS.includes(options.aspectRatio)) {
    errors.push(`Aspect ratio must be one of: ${VALID_ASPECTS.join(', ')}`);
  }

  if (options.multiAngle && options.angleCount < 1) {
    errors.push('Angle count must be at least 1');
  }

  return errors;
}

/**
 * Get API key from settings
 */
function getApiKey() {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.local.json');

  if (!fs.existsSync(settingsPath)) {
    return null;
  }

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return settings.env?.AGNES_API_KEY || null;
  } catch (e) {
    return null;
  }
}

/**
 * Save image to local directory
 * @param {Buffer} imageData - Raw image bytes
 * @param {string} prompt - Original prompt (used for filename stem)
 * @param {string} outputDir - Directory to save into
 * @param {number} [angleIndex] - 1-based angle index; when supplied appends _angle_N to filename
 */
function saveImage(imageData, prompt, outputDir = './output', angleIndex) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safePrompt = prompt.replace(/[^\p{L}\p{N}\s-]/gu, '').substring(0, 50).replace(/\s+/g, '_');
  const angleSuffix = angleIndex ? `_angle_${angleIndex}` : '';
  const filename = `${timestamp}_${safePrompt}${angleSuffix}.jpg`;
  const filepath = path.join(outputDir, filename);

  // Save image data
  fs.writeFileSync(filepath, imageData);

  return {
    path: filepath,
    filename: filename
  };
}

/**
 * Main generation function
 *
 * Return shape:
 *   single image (multiAngle false or angleCount <= 1):
 *     { path: string, filename: string }   (same as before — callers unchanged)
 *   multi-angle (multiAngle true AND angleCount > 1):
 *     [{ path: string, filename: string }, ...]   array of length angleCount
 */
async function generateImage(prompt, options = {}) {
  // Merge with defaults
  const config = { ...DEFAULTS, ...options };

  // Validate
  const errors = validateParameters(config);
  if (errors.length > 0) {
    throw new Error(`Invalid parameters:\n  ${errors.join('\n  ')}`);
  }

  // Check API key
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('AGNES_API_KEY not configured. Run: node image-generator.js --setup');
  }

  const isMultiAngle = config.multiAngle && config.angleCount > 1;
  const fullPrompt = buildPrompt(prompt, config);

  if (isMultiAngle) {
    console.log(`\nGenerating ${config.angleCount} multi-angle images...`);
    console.log(`  Model: ${config.model}`);
    console.log(`  Size: ${config.width}x${config.height}`);
    console.log(`  Style: ${config.style}`);
    console.log(`  Output: ${config.outputFormat}`);
    console.log(`  Prompt: ${fullPrompt.substring(0, 100)}...`);

    const results = [];
    for (let i = 0; i < config.angleCount; i++) {
      const modifier = ANGLE_MODIFIERS[i % ANGLE_MODIFIERS.length];
      const anglePrompt = `${fullPrompt}, ${modifier}`;
      console.log(`\n  [angle ${i + 1}/${config.angleCount}] ${modifier}`);
      const response = await callApi(apiKey, anglePrompt, config);
      const result = saveImage(response.imageData, prompt, './output', i + 1);
      results.push(result);
      console.log(`  ✓ Saved: ${result.path}`);
    }
    return results;
  }

  // Single-image path — byte-for-byte identical to pre-fix behaviour
  console.log(`\nGenerating image...`);
  console.log(`  Model: ${config.model}`);
  console.log(`  Size: ${config.width}x${config.height}`);
  console.log(`  Style: ${config.style}`);
  console.log(`  Output: ${config.outputFormat}`);
  console.log(`  Prompt: ${fullPrompt.substring(0, 100)}...`);

  const response = await callApi(apiKey, fullPrompt, config);
  const result = saveImage(response.imageData, prompt);

  console.log(`\n✓ Image saved: ${result.path}`);
  return result;
}

/**
 * Real API call to agnes-image-2.1-flash
 */
async function callApi(apiKey, prompt, options) {
  const endpoint = `${API_BASE}/images/generations`;

  // Build request body (OpenAI-compatible)
  const body = {
    model: options.model || DEFAULTS.model,
    prompt: prompt,
    size: `${options.width}x${options.height}`,
    n: 1,
    response_format: 'b64_json'
  };

  // Optional: style/quality via extra body fields
  if (options.style && options.style !== 'photorealistic') {
    body.style = options.style;
  }

  console.log(`\nCalling: POST ${endpoint}`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const imageData = Buffer.from(result.data[0].b64_json, 'base64');

  return {
    imageData: imageData,
    mimeType: 'image/jpeg',
    url: result.data[0].url || null
  };
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  let prompt = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--setup') {
      return { setup: true };
    }

    if (arg === '--test') {
      return { test: true };
    }

    if (arg === '--width' && args[i + 1]) {
      options.width = parseInt(args[++i]);
    } else if (arg === '--height' && args[i + 1]) {
      options.height = parseInt(args[++i]);
    } else if (arg === '--aspect' && args[i + 1]) {
      options.aspectRatio = args[++i];
    } else if (arg === '--style' && args[i + 1]) {
      options.style = args[++i];
    } else if (arg === '--no-hands') {
      options.showHands = false;
    } else if (arg === '--fingers') {
      options.enhancedFingers = true;
    } else if (arg === '--multi-angle' && args[i + 1]) {
      options.multiAngle = true;
      options.angleCount = parseInt(args[++i]);
    } else if (arg === '--model' && args[i + 1]) {
      options.model = args[++i];
    } else if (!arg.startsWith('--')) {
      prompt += arg + ' ';
    }
  }

  return { prompt: prompt.trim(), options };
}

/**
 * Run tests
 */
async function runTests() {
  console.log('\n=== Running Tests ===\n');

  // Test 1: Parameter validation
  console.log('Test 1: Parameter validation');
  const errors = validateParameters({ width: 10000 });
  console.log(errors.length > 0 ? '  ✓ Invalid width detected' : '  ✗ Failed to detect invalid width');

  // Test 2: Prompt building
  console.log('\nTest 2: Prompt building');
  const testPrompt = buildPrompt('a cat', { style: 'cartoon-2d' });
  console.log(testPrompt.includes('2D cartoon') ? '  ✓ Style modifier added' : '  ✗ Style modifier missing');

  // Test 3: API key check
  console.log('\nTest 3: API key check');
  const apiKey = getApiKey();
  console.log(apiKey ? '  ✓ API key found' : '  ⚠ API key not configured (run --setup)');

  console.log('\n=== Tests Complete ===\n');
}

/**
 * Main entry point
 */
async function main() {
  const parsed = parseArgs();

  if (parsed.setup) {
    await setupApiKey();
    return;
  }

  if (parsed.test) {
    await runTests();
    return;
  }

  if (!parsed.prompt) {
    console.log('\nUsage: node image-generator.js "prompt" [options]');
    console.log('\nOptions:');
    console.log('  --width N      Image width (default: 1920)');
    console.log('  --height N     Image height (default: 1080)');
    console.log('  --aspect RATIO Aspect ratio (16:9, 4:3, 1:1, 9:16)');
    console.log('  --style STYLE  Style: photorealistic, cartoon-2d, cartoon-3d');
    console.log('  --no-hands     Disable hand rendering');
    console.log('  --fingers      Enhanced finger detail');
    console.log('  --multi-angle N Generate N different angles');
    console.log('  --model ID       生成模型 (default: agnes-image-2.1-flash)');
    console.log('  --setup        Configure API key');
    console.log('  --test         Run tests');
    process.exit(1);
  }

  try {
    await generateImage(parsed.prompt, parsed.options);
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { generateImage, setupApiKey, validateParameters, buildPrompt, getApiKey };
