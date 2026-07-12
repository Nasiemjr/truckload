/**
 * Minimal ESM stand-in for the CommonJS `debug` package, aliased in vite.config.ts
 * for the nitro server environment. nitro 3.0.0's unenv mock of `debug` lacks
 * `.extend()` (crashing @workflow/core's logger), and the real package is CJS,
 * which vite's module runner can't inline. Logging is enabled via DEBUG=... as usual.
 */

type DebugFn = {
  (...args: unknown[]): void;
  namespace: string;
  enabled: boolean;
  color: string;
  log: (...args: unknown[]) => void;
  extend: (sub: string, delimiter?: string) => DebugFn;
};

// bracket access + String() on purpose: the workflow build statically replaces the
// literal `process.env.DEBUG` with a boolean, which would crash `.split`
const patterns = String(process.env['DEBUG'] ?? '')
  .split(/[\s,]+/)
  .filter(Boolean)
  .map((pattern) => new RegExp(`^${pattern.replace(/\*/g, '.*?')}$`));

function createDebug(namespace: string): DebugFn {
  const enabled = patterns.some((pattern) => pattern.test(namespace));
  const fn = ((...args: unknown[]) => {
    if (fn.enabled) fn.log(`${namespace}`, ...args);
  }) as DebugFn;
  fn.namespace = namespace;
  fn.enabled = enabled;
  fn.color = '';
  fn.log = console.error.bind(console);
  fn.extend = (sub: string, delimiter = ':') => createDebug(`${namespace}${delimiter}${sub}`);
  return fn;
}

createDebug.enable = (_namespaces?: string) => {};
createDebug.disable = () => '';
createDebug.enabled = (namespace: string) => patterns.some((pattern) => pattern.test(namespace));
createDebug.names = [] as RegExp[];
createDebug.skips = [] as RegExp[];
createDebug.formatters = {} as Record<string, (value: unknown) => string>;
createDebug.log = console.error.bind(console);
createDebug.selectColor = (_namespace: string) => '';

export default createDebug;
