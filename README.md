# @prosopo/result

A Rust-style `Result` type for TypeScript and JavaScript. Errors become typed values that you return, instead of exceptions you throw and hope someone catches.

```bash
npm install @prosopo/result
```

ESM and CommonJS, no dependencies, Node 18+ and modern browsers.

## Why

`try`/`catch` doesn't show up in a function's type. Nothing tells the caller that `parseConfig()` can fail, or how, and the error is always `unknown` in the `catch` block. A `Result<T, E>` puts both outcomes in the return type, so the compiler makes you handle them:

```ts
import { err, ok, type Result } from "@prosopo/result";

type ParseError = { kind: "empty" } | { kind: "nan"; input: string };

const parse = (input: string): Result<number, ParseError> => {
	if (input === "") return err({ kind: "empty" });
	const value = Number(input);
	return Number.isNaN(value) ? err({ kind: "nan", input }) : ok(value);
};

const result = parse(userInput);
if (result.ok) {
	result.value; // number
} else {
	result.error; // ParseError
}
```

## API

### Creating results

| Function                                | Returns                                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ok(value)`                             | `Result<T, never>` holding a value                                                                                                    |
| `err(error)`                            | `Result<never, E>` holding an error                                                                                                   |
| `tryCatch(fn, mapError?)`               | Runs `fn`, returning `Ok` with its value or `Err` with what it threw. Pass `mapError` to turn the `unknown` throw into a typed error. |
| `tryCatchAsync(promiseOrFn, mapError?)` | The same for a promise, or a function returning one. Resolves to a `Result`; never rejects.                                           |
| `all(results)`                          | `Ok` with every value, or the first `Err`                                                                                             |

### Checking results

Every result has an `ok` property (`true` or `false`) that TypeScript narrows on. There are also type guards:

- `isOk(result)` / `isErr(result)`: standalone guards, handy with `Array.prototype.filter`.
- `result.isOk()` / `result.isErr()`: the same, as methods.

```ts
const values = inputs
	.map(parse)
	.filter(isOk)
	.map((r) => r.value); // number[]
```

### Methods

| Method               | On `Ok(value)`           | On `Err(error)`               |
| -------------------- | ------------------------ | ----------------------------- |
| `map(fn)`            | `Ok(fn(value))`          | unchanged                     |
| `mapErr(fn)`         | unchanged                | `Err(fn(error))`              |
| `andThen(fn)`        | `fn(value)` (a `Result`) | unchanged                     |
| `orElse(fn)`         | unchanged                | `fn(error)` (a `Result`)      |
| `match({ ok, err })` | `ok(value)`              | `err(error)`                  |
| `unwrap()`           | `value`                  | throws `UnwrapError`          |
| `expect(message)`    | `value`                  | throws `UnwrapError(message)` |
| `unwrapOr(fallback)` | `value`                  | `fallback`                    |
| `unwrapOrElse(fn)`   | `value`                  | `fn(error)`                   |
| `unwrapErr()`        | throws `UnwrapError`     | `error`                       |

`UnwrapError` keeps the original error on both `.error` and `.cause`.

## Development

```bash
pnpm install
pnpm run lint
pnpm run build:tsc
pnpm run test    # vitest, 100% coverage enforced
pnpm run build   # dist/esm and dist/cjs
```

Releases: bump `version` in `package.json`, merge, then publish a GitHub release tagged `v<version>`. `.github/workflows/publish.yml` publishes to npm with provenance.

## Licence

Apache-2.0
