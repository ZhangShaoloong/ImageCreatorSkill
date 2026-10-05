/**
 * Vendor-agnostic Image-to-Image Generator (OpenAI-compatible image API)
 *
 * Transforms a reference image (local file or URL) using an edit prompt,
 * with configurable edit strength, resolution/aspect, style, and
 * multiple-variation generation.
 *
 * Defaults to the agnes-image-2.1-flash model on https://api.agnes-ai.cn/v1,
 * but every vendor-specific value (model, base URL, API key) is resolved at
 * runtime from CLI flags > environment variables > settings.local.json >
 * built-in agnes defaults, so no code change is needed to target another
 * compatible backend.
 *
 * Usage:
 *   node i2i-generator.js --input <file|url> "edit prompt" [--options]
 *   node i2i-generator.js --setup          (interactive, or --key <val>)
 *   node i2i-generator.js --test
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Default configuration
const DEFAULTS = {
  width: 1024,
  height: 1024,
  aspectRatio: '1:1',
  style: 'photorealistic',
  strength: 0.7,
  model: 'agnes-image-2.1-flash',
  apiBase: 'https://api.agnes-ai.cn/v1',
  outputFormat: 'jpeg',
  outputDir: './output',
  variations: 1,
  inputFormat: null // detected from input at runtime
};

// Vendor-agnostic. Endpoints are OpenAI-compatible paths appended to apiBase;
// the base URL itself is resolved at runtime (see resolveConfig).

// Valid options
const VALID_STYLES = ['photorealistic', 'cartoon-2d', 'cartoon-3d'];
const VALID_ASPECTS = ['16:9', '4:3', '1:1', '9:16'];

// Acceptable input image extensions
const VALID_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

/**
 * Setup API key configuration
 *
 * Interactively prompts for a real API key on stdin (no echo). Pass `key`
 * (from `--key`) to skip the prompt. The key is persisted to
 * `~/.claude/settings.local.json` under `env.AGNES_API_KEY`.
 */
async function setupApiKey({ key } = {}) {
  console.log('\n=== Image-to-Image Generator Setup ===\n');

  let apiKey = key;

  if (!apiKey || apiKey.trim() === '') {
    apiKey = await promptForKey('Enter your API key: ');
  }

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
  console.log('\nYou can now use the image-to-image generator.');
}

/**
 * Read a secret from stdin without echoing. If stdin is not a TTY (e.g. piped),
 * reads one line instead.
 */
function promptForKey(promptText) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY === false) {
      let data = '';
      process.stdin.once('data', (chunk) => { data += chunk.toString(); });
      process.stdin.once('end', () => resolve(data.trim()));
      return;
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
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

  // Low strength keeps the reference more intact; note it to the model.
  if (options.strength !== undefined && options.strength <= 0.3) {
    prompt += ', preserve the reference image closely, only minor edits';
  } else if (options.strength !== undefined && options.strength >= 0.85) {
    prompt += ', heavily transform the reference image';
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

  if (options.strength !== undefined && (options.strength < 0 || options.strength > 1)) {
    errors.push('Strength must be between 0 and 1');
  }

  if (options.variations !== undefined && options.variations < 1) {
    errors.push('Variation count must be at least 1');
  }

  return errors;
}

/**
 * Classify an input value as a URL or a local file path.
 */
function classifyInput(input) {
  if (/^https?:\/\//i.test(input)) return 'url';
  return 'path';
}

/**
 * Load the input image.
 * @returns {{ base64: string, mimeType: string, source: string }}
 */
async function loadInputImage(input, options) {
  const kind = classifyInput(input);

  if (kind === 'url') {
    const response = await fetch(input);
    if (!response.ok) {
      throw new Error(`Could not fetch input image URL (${response.status})`);
    }
    const buf = Buffer.from(await response.arrayBuffer());
    const ext = (path.extname(new URL(input).pathname) || '.jpg').replace('.', '').toLowerCase();
    const mimeType = extToMime(ext);
    return { base64: buf.toString('base64'), bytes: buf, mimeType, source: input, inputFormat: ext };
  }

  // Local file
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Input file not found: ${resolved}`);
  }
  const ext = (path.extname(resolved) || '').replace('.', '').toLowerCase();
  if (!VALID_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported input image format: .${ext}. Use ${VALID_EXTENSIONS.map(e => '.' + e).join(', ')}`);
  }
  const buf = fs.readFileSync(resolved);
  const mimeType = extToMime(ext);
  return { base64: buf.toString('base64'), bytes: buf, mimeType, source: resolved, inputFormat: ext };
}

/**
 * Reconstruct a Buffer from a base64 string (for constructing the
 * multipart Blob). Present on the image object returned by loadInputImage.
 */
function base64ToBytes(base64) {
  return Buffer.from(base64, 'base64');
}

function extToMime(ext) {
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    default: return 'image/jpeg';
  }
}

/**
 * Read the persisted API key from settings (third priority level).
 */
function readSettingsApiKey() {
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
 * Back-compat alias for readSettingsApiKey.
 */
function getApiKey() {
  return readSettingsApiKey();
}

/**
 * Load a .env-style file into process.env. Lines are KEY=VALUE (or KEY="VALUE").
 * Blank lines and # comments are ignored. Only sets keys that are not already
 * present in process.env so real env vars always win.
 *
 * @param {string} file - Path to the file to load
 * @returns {{loaded: string[], skipped: string[]}}
 */
function loadEnvFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Env file not found: ${file}`);
  }
  const content = fs.readFileSync(file, 'utf8');
  const loaded = [];
  const skipped = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) {
      process.env[k] = v;
      loaded.push(k);
    } else {
      skipped.push(k);
    }
  }
  return { loaded, skipped };
}

/**
 * Resolve vendor-agnostic runtime config.
 *
 * Precedence (highest → lowest):
 *   CLI options (options.model/base/key)
 *   > process.env (IMAGE_MODEL / IMAGE_API_BASE / AGNES_API_BASE / IMAGE_API_KEY / AGNES_API_KEY)
 *   > settings.local.json (AGNES_API_KEY)
 *   > built-in agnes defaults
 *
 * @returns {{model: string, apiBase: string, apiKey: (string|null)}}
 */
function resolveConfig(options = {}) {
  const env = process.env;

  const model = options.model || env.IMAGE_MODEL || DEFAULTS.model;

  const apiBase = options.base || env.IMAGE_API_BASE || env.AGNES_API_BASE || DEFAULTS.apiBase;

  const apiKey = options.key || env.IMAGE_API_KEY || env.AGNES_API_KEY || readSettingsApiKey() || null;

  return { model, apiBase, apiKey };
}

/**
 * Save image to local directory
 * @param {Buffer} imageData - Raw image bytes
 * @param {string} prompt - Edit prompt (used for filename stem)
 * @param {string} outputDir - Directory to save into
 * @param {number} [variationIndex] - 1-based variation index; when supplied appends _var_N to filename
 */
function saveImage(imageData, prompt, outputDir, variationIndex) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safePrompt = prompt.replace(/[^\p{L}\p{N}\s-]/gu, '').substring(0, 50).replace(/\s+/g, '_');
  const varSuffix = variationIndex ? `_var_${variationIndex}` : '';
  const filename = `${timestamp}_${safePrompt}${varSuffix}.jpg`;
  const filepath = path.join(outputDir, filename);

  // Save image data
  fs.writeFileSync(filepath, imageData);

  return {
    path: filepath,
    filename: filename
  };
}

/**
 * Main image-to-image generation function
 *
 * Return shape:
 *   single variation (variations === 1):
 *     { path: string, filename: string }
 *   multiple variations (variations > 1):
 *     [{ path: string, filename: string }, ...]
 */
async function generateImage(input, prompt, options = {}) {
  // Merge with defaults
  const config = { ...DEFAULTS, ...options };

  // Prompt is required for an edit
  if (!prompt || prompt.trim() === '') {
    throw new Error('An edit prompt is required (describe the transformation)');
  }

  // Validate
  const errors = validateParameters(config);
  if (errors.length > 0) {
    throw new Error(`Invalid parameters:\n  ${errors.join('\n  ')}`);
  }

  // Resolve vendor-agnostic config (CLI > env > settings > built-in agnes default)
  const resolved = resolveConfig(config);

  // Check API key
  if (!resolved.apiKey) {
    throw new Error(
      'API key not configured. Set IMAGE_API_KEY (or AGNES_API_KEY), ' +
      'or run: node i2i-generator.js --setup'
    );
  }

  // Acquire the reference image
  const image = await loadInputImage(input, config);

  const isMultiVar = config.variations > 1;
  const fullPrompt = buildPrompt(prompt, config);

  const banner = () => {
    console.log(`\n${isMultiVar ? `Generating ${config.variations} image-to-image variations...` : 'Generating image-to-image edit...'}`);
    console.log(`  Model: ${resolved.model}`);
    console.log(`  Base:  ${resolved.apiBase}`);
    console.log(`  Input: ${image.source} (${image.inputFormat})`);
    console.log(`  Size: ${config.width}x${config.height}`);
    console.log(`  Strength: ${config.strength}`);
    console.log(`  Style: ${config.style}`);
    console.log(`  Output: ${config.outputFormat}`);
    console.log(`  Dir: ${config.outputDir}`);
    console.log(`  Prompt: ${fullPrompt.substring(0, 100)}...`);
  };

  if (isMultiVar) {
    banner();
    const results = [];
    for (let i = 0; i < config.variations; i++) {
      console.log(`\n  [variation ${i + 1}/${config.variations}]`);
      const response = await callApi(resolved.apiKey, image, fullPrompt, config, resolved.apiBase);
      const result = saveImage(response.imageData, prompt, config.outputDir, i + 1);
      results.push(result);
      console.log(`  ✓ Saved: ${result.path}`);
    }
    return results;
  }

  // Single-variation path
  banner();
  const response = await callApi(resolved.apiKey, image, fullPrompt, config, resolved.apiBase);
  const result = saveImage(response.imageData, prompt, config.outputDir);

  console.log(`\n✓ Image saved: ${result.path}`);
  return result;
}

/**
 * Real API call against a vendor's OpenAI-compatible /images/edits endpoint.
 */
async function callApi(apiKey, image, prompt, options, apiBase = DEFAULTS.apiBase) {
  const endpoint = `${apiBase}/images/edits`;

  // OpenAI-compatible images/edits requires the input image as a
  // multipart/form-data file upload (NOT an inline base64 string).
  const form = new FormData();
  form.append('model', options.model || DEFAULTS.model);
  form.append('prompt', prompt);
  form.append('size', `${options.width}x${options.height}`);
  form.append('strength', String(options.strength));
  form.append('n', '1');
  form.append('response_format', 'b64_json');

  // The reference image is uploaded as a multipart file part.
  const filename = `input.${image.inputFormat || 'jpg'}`;
  form.append('image', new Blob([image.bytes], { type: image.mimeType }), filename);

  // Optional: style via extra field
  if (options.style && options.style !== 'photorealistic') {
    form.append('style', options.style);
  }

  console.log(`\nCalling: POST ${endpoint} (multipart)`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
      // Do not set Content-Type manually — fetch sets the multipart boundary.
    },
    body: form
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
  let setup = false;
  let test = false;
  let input = '';
  let prompt = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--setup') {
      setup = true;
      continue;
    }

    if (arg === '--test') {
      test = true;
      continue;
    }

    if (arg === '--input' && args[i + 1]) {
      input = args[++i];
    } else if (arg === '--prompt' && args[i + 1]) {
      prompt = args[++i];
    } else if (arg === '--strength' && args[i + 1]) {
      options.strength = parseFloat(args[++i]);
    } else if (arg === '--width' && args[i + 1]) {
      options.width = parseInt(args[++i]);
    } else if (arg === '--height' && args[i + 1]) {
      options.height = parseInt(args[++i]);
    } else if (arg === '--aspect' && args[i + 1]) {
      options.aspectRatio = args[++i];
    } else if (arg === '--style' && args[i + 1]) {
      options.style = args[++i];
    } else if (arg === '--variations' && args[i + 1]) {
      options.variations = parseInt(args[++i]);
    } else if (arg === '--model' && args[i + 1]) {
      options.model = args[++i];
    } else if (arg === '--base' && args[i + 1]) {
      options.base = args[++i];
    } else if (arg === '--key' && args[i + 1]) {
      options.key = args[++i];
    } else if (arg === '--env' && args[i + 1]) {
      options.envFile = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      options.outputDir = args[++i];
    } else if (!arg.startsWith('--')) {
      prompt += arg + ' ';
    }
  }

  // setup/test take precedence; carry along any already-parsed options so that
  // e.g. `--setup --key <val>` works regardless of flag ordering.
  if (setup) return { setup: true, key: options.key, options };
  if (test) return { test: true, options };

  return { input: input.trim(), prompt: prompt.trim(), options };
}

/**
 * Run tests
 */
async function runTests() {
  console.log('\n=== Running Tests ===\n');

  // Test 1: Parameter validation
  console.log('Test 1: Parameter validation');
  const errors = validateParameters({ strength: 1.5 });
  console.log(errors.length > 0 ? '  ✓ Invalid strength detected' : '  ✗ Failed to detect invalid strength');

  // Test 2: Input classification
  console.log('\nTest 2: Input classification');
  console.log(classifyInput('https://example.com/a.png') === 'url' ? '  ✓ URL detected' : '  ✗ URL misdetected');
  console.log(classifyInput('C:\\img\\ref.jpg') === 'path' ? '  ✓ Local path detected' : '  ✗ Path misdetected');

  // Test 3: Prompt building
  console.log('\nTest 3: Prompt building');
  const testPrompt = buildPrompt('make it a watercolor', { style: 'cartoon-2d' });
  console.log(testPrompt.includes('2D cartoon') ? '  ✓ Style modifier added' : '  ✗ Style modifier missing');

  // Test 4: API key check
  console.log('\nTest 4: API key check');
  const apiKey = getApiKey();
  console.log(apiKey ? '  ✓ API key found' : '  ⚠ API key not configured (run --setup)');

  // Test 5: vendor-agnostic config resolution (built-in agnes defaults)
  console.log('\nTest 5: resolveConfig defaults');
  const savedModel = process.env.IMAGE_MODEL;
  const savedBase = process.env.IMAGE_API_BASE;
  delete process.env.IMAGE_MODEL;
  delete process.env.IMAGE_API_BASE;
  delete process.env.AGNES_API_BASE;
  delete process.env.IMAGE_API_KEY;
  delete process.env.AGNES_API_KEY;
  const d = resolveConfig({});
  const defaultOk = d.model === 'agnes-image-2.1-flash' && d.apiBase === 'https://api.agnes-ai.cn/v1';
  console.log(defaultOk ? '  ✓ Defaults fall back to agnes model + base' : `  ✗ Unexpected defaults: ${d.model} ${d.apiBase}`);
  if (savedModel !== undefined) process.env.IMAGE_MODEL = savedModel;
  if (savedBase !== undefined) process.env.IMAGE_API_BASE = savedBase;

  // Test 6: env > settings precedence (IMAGE_API_KEY wins over AGNES_API_KEY)
  console.log('\nTest 6: env precedence');
  process.env.AGNES_API_KEY = 'env-agnes-key';
  process.env.IMAGE_API_KEY = 'env-generic-key';
  const p6 = resolveConfig({});
  console.log(p6.apiKey === 'env-generic-key' ? '  ✓ Generic env key beats agnes env key' : `  ✗ got ${p6.apiKey}`);

  // Test 7: CLI option > env precedence (--key / --base / --model)
  console.log('\nTest 7: CLI option precedence');
  const p7 = resolveConfig({ key: 'cli-key', base: 'https://cli.example/v1', model: 'cli-model' });
  const cliOk = p7.apiKey === 'cli-key' && p7.apiBase === 'https://cli.example/v1' && p7.model === 'cli-model';
  console.log(cliOk ? '  ✓ CLI options beat env + defaults' : `  ✗ got ${p7.apiKey} ${p7.apiBase} ${p7.model}`);
  delete process.env.AGNES_API_KEY;
  delete process.env.IMAGE_API_KEY;

  console.log('\n=== Tests Complete ===\n');
}

/**
 * Main entry point
 */
async function main() {
  const parsed = parseArgs();

  // Load an optional .env file before resolving config (env vars win over it
  // only for keys not already present).
  if (parsed.options && parsed.options.envFile) {
    const { loaded, skipped } = loadEnvFile(parsed.options.envFile);
    if (loaded.length) console.log(`Loaded env from ${parsed.options.envFile}: ${loaded.join(', ')}`);
    if (skipped.length) console.log(`Kept existing env (skipped ${skipped.length}): ${skipped.join(', ')}`);
  }

  if (parsed.setup) {
    await setupApiKey({ key: parsed.key });
    return;
  }

  if (parsed.test) {
    await runTests();
    return;
  }

  if (!parsed.input || !parsed.prompt) {
    console.log('\nUsage: node i2i-generator.js --input <file|url> "edit prompt" [options]');
    console.log('\nOptions:');
    console.log('  --input FILE   Input image: local path or URL (required)');
    console.log('  --strength N   Edit strength 0-1 (default: 0.7)');
    console.log('  --width N      Output width (default: 1024)');
    console.log('  --height N     Output height (default: 1024)');
    console.log('  --aspect RATIO Aspect ratio (16:9, 4:3, 1:1, 9:16)');
    console.log('  --style STYLE  Style: photorealistic, cartoon-2d, cartoon-3d');
    console.log('  --variations N Generate N edits of the same input');
    console.log('  --model ID     生成模型 (default: agnes-image-2.1-flash, or IMAGE_MODEL)');
    console.log('  --base URL     API 基础地址 (default: https://api.agnes-ai.cn/v1, or IMAGE_API_BASE)');
    console.log('  --key VAL      API key (or set IMAGE_API_KEY / AGNES_API_KEY)');
    console.log('  --env FILE     从 .env 文件加载配置(优先级低于已有 env)');
    console.log('  --output DIR   Output directory (default: ./output)');
    console.log('  --setup        Configure API key (interactive, or pass --key)');
    console.log('  --test         Run tests');
    process.exit(1);
  }

  try {
    await generateImage(parsed.input, parsed.prompt, parsed.options);
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  generateImage,
  setupApiKey,
  validateParameters,
  buildPrompt,
  getApiKey,
  classifyInput,
  loadInputImage,
  resolveConfig,
  readSettingsApiKey,
  loadEnvFile
};
