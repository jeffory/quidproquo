/**
 * Thrown for anything the user can fix without code changes: missing flags,
 * malformed config, missing required settings, mismatched `--app`/`--module`.
 * The CLI catches this and exits with a non-zero status.
 */
export class SynthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SynthError';
  }
}
