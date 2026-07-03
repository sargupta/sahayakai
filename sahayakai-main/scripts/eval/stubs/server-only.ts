// Empty stub for the `server-only` RSC guard, mapped ONLY by the eval
// runner's tsconfig (scripts/eval/tsconfig.json). The eval process is a
// trusted server-side Node process; the guard exists to catch client-bundle
// leaks, which cannot happen here. The app build keeps the real package.
export {};
