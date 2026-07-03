// Eval-process-only module shims. The `server-only` package throws when
// imported outside a React Server Component build; the eval runner IS
// server-side (a Node process), so we stub it to an empty module.
import { register } from 'node:module';
register(new URL('./shim-loader.mjs', import.meta.url));
