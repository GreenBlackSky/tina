/* Whatever turns a photo or a description into numbers. Today that is Claude
   through the Anthropic API with your own key (anthropic.ts); the rest of the
   app only sees this interface, so it can move behind a server (a Firebase
   function) or to another model later without touching the screens. */

export interface EstimateOptions {
  /** photos to send along with the prompt (JPEG) */
  images?: Blob[];
  /** to stop a request when "Stop" is tapped */
  signal?: AbortSignal;
}

export interface Estimator {
  /** for the settings screen, e.g. "Claude (claude-sonnet-5-5)" */
  readonly name: string;
  /** whether photos can be sent */
  readonly canImages: boolean;
  /** Send a prompt; resolves to the JSON object the model answered with. */
  json(prompt: string, options?: EstimateOptions): Promise<unknown>;
}

/** Things that can go wrong, by code; errorMessage() turns them into words. */
export type EstimateErrorCode =
  | 'no_key'
  | 'invalid_key'
  | 'permission'
  | 'billing'
  | 'rate_limited'
  | 'overloaded'
  | 'image_rejected'
  | 'refused'
  | 'invalid_json'
  | 'empty_completion'
  | 'network'
  | 'cancelled'
  | 'unknown';

export class EstimateError extends Error {
  constructor(
    readonly code: EstimateErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** What to tell the person, in plain words ('' when they cancelled). */
export function errorMessage(error: unknown): string {
  const code = error instanceof EstimateError ? error.code : 'unknown';
  switch (code) {
    case 'cancelled':
      return '';
    case 'no_key':
      return 'Photo and text estimates need a Claude API key. Add one under Targets → Claude. You can still add foods with Search.';
    case 'invalid_key':
      return 'Your Claude API key was refused. Check it under Targets → Claude.';
    case 'permission':
      return 'This API key isn’t allowed to use that model. Pick another model under Targets → Claude.';
    case 'billing':
      return 'Your Anthropic account is out of credit. Add credit in the Anthropic Console, then try again.';
    case 'rate_limited':
      return 'You’ve hit a usage limit for now. Try again in a little while.';
    case 'overloaded':
      return 'Claude is busy right now. Try again in a minute.';
    case 'image_rejected':
      return 'That image couldn’t be used. Try a JPEG or PNG photo.';
    case 'refused':
      return 'Claude couldn’t help with that input. Try a different photo or description.';
    case 'invalid_json':
    case 'empty_completion':
      return 'The answer came back garbled. Tap the button to try again.';
    case 'network':
      return 'Couldn’t reach Claude. Check your connection and try again.';
    default:
      return 'Something went wrong reaching Claude. Tap the button to try again.';
  }
}
