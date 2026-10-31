import { EstimateError, type EstimateOptions, type Estimator } from './types';

/* Claude through the Anthropic API, called straight from the browser with the
   person's own API key.

   Browsers block calls to other sites unless the site allows it (CORS);
   Anthropic allows it only when the request says, with the
   'anthropic-dangerous-direct-browser-access' header, that the caller knows
   the key is visible to anyone who can use this browser. That is acceptable
   for a personal app with one user, with a key that has a spending limit. For
   anything shared, the key belongs on a server (a Firebase function) — see
   docs/ROADMAP.md. The key lives only in this browser's localStorage: never
   in the code, the database or a backup file. */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MAX_TOKENS = 2048;

export const MODELS: Array<{ id: string; label: string }> = [
  { id: 'claude-sonnet-5-5', label: 'Sonnet — best balance (default)' },
  { id: 'claude-haiku-5-5', label: 'Haiku — fastest and cheapest' },
  { id: 'claude-opus-5-5', label: 'Opus — most careful, costs most' },
];
export const DEFAULT_MODEL = MODELS[0].id;

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** The JSON object in a reply, even when wrapped in ```json fences or prose. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new EstimateError('invalid_json', 'No JSON object in the reply');
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new EstimateError('invalid_json', 'The reply was not valid JSON');
  }
}

/** Map an HTTP error from the API to one of our codes. */
function errorFor(status: number, body: string): EstimateError {
  const lower = body.toLowerCase();
  if (status === 401) {
    return new EstimateError('invalid_key', body);
  }
  if (status === 403) {
    return new EstimateError('permission', body);
  }
  if (status === 429) {
    return new EstimateError('rate_limited', body);
  }
  if (status === 529 || status === 503) {
    return new EstimateError('overloaded', body);
  }
  if (lower.includes('credit balance')) {
    return new EstimateError('billing', body);
  }
  if (status === 400 && lower.includes('image')) {
    return new EstimateError('image_rejected', body);
  }
  return new EstimateError('unknown', `HTTP ${status}: ${body.slice(0, 200)}`);
}

export class AnthropicEstimator implements Estimator {
  readonly canImages = true;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  get name(): string {
    return `Claude (${this.model})`;
  }

  async json(prompt: string, options: EstimateOptions = {}): Promise<unknown> {
    const images = await Promise.all(
      (options.images ?? []).map(async (image) => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.type || 'image/jpeg',
          data: await toBase64(image),
        },
      })),
    );
    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        signal: options.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': API_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: MAX_TOKENS,
          messages: [{ role: 'user', content: [...images, { type: 'text', text: prompt }] }],
        }),
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        throw new EstimateError('cancelled', 'Stopped');
      }
      throw new EstimateError('network', (e as Error).message);
    }
    if (!response.ok) {
      throw errorFor(response.status, await response.text());
    }
    const reply = (await response.json()) as {
      stop_reason?: string;
      content?: Array<{ type: string; text?: string }>;
    };
    if (reply.stop_reason === 'refusal') {
      throw new EstimateError('refused', 'Claude declined');
    }
    const text = (reply.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
    if (!text.trim()) {
      throw new EstimateError('empty_completion', 'Empty reply');
    }
    return extractJson(text);
  }
}
