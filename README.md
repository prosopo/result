# @prosopo/result

A Rust-style `Result` type for TypeScript and JavaScript. Errors become typed values that you return, instead of exceptions you throw and hope someone catches.

```bash
npm install @prosopo/result
```

- No dependencies.
- ESM and CommonJS, with TypeScript types included.
- Node 18+ and modern browsers.

## Contents

- [Why](#why)
- [Quick start](#quick-start)
- [Guides](#guides)
  - [Checking a result](#checking-a-result)
  - [Typed error unions](#typed-error-unions)
  - [Wrapping code that throws](#wrapping-code-that-throws)
  - [Async code](#async-code)
  - [Passing an error up](#passing-an-error-up)
  - [Chaining](#chaining)
  - [Working with lists](#working-with-lists)
  - [Getting the value out](#getting-the-value-out)
  - [When to still throw](#when-to-still-throw)
- [API reference](#api-reference)
- [CommonJS](#commonjs)
- [FAQ](#faq)
- [Development](#development)
- [Releasing](#releasing)

## Why

`try`/`catch` doesn't show up in a function's type:

```ts
declare function loadConfig(path: string): { port: number };
```

Nothing tells the caller that `loadConfig` can fail, or how. Forgetting to catch compiles fine. When you do catch, the error is `unknown`, and the same `catch` also swallows any bug that happened to throw inside the `try`.

A `Result<T, E>` puts both outcomes in the return type, so the compiler makes you handle them:

```ts
import type { Result } from "@prosopo/result";

type ConfigError = { kind: "not-found" } | { kind: "invalid" };

declare function loadConfig(
	path: string,
): Result<{ port: number }, ConfigError>;
```

## Quick start

```ts
import { err, ok, type Result } from "@prosopo/result";

type ParseError = { kind: "empty" } | { kind: "nan"; input: string };

const parse = (input: string): Result<number, ParseError> => {
	if (input === "") {
		return err({ kind: "empty" });
	}
	const value = Number(input);
	return Number.isNaN(value) ? err({ kind: "nan", input }) : ok(value);
};

const result = parse("42");
if (result.ok) {
	console.log(result.value + 1); // result.value: number
} else {
	console.error(result.error.kind); // result.error: ParseError
}
```

## Guides

### Checking a result

Every result has an `ok` property that is `true` for a success and `false` for a failure. Checking it narrows the type, so `value` only exists on the success branch and `error` only on the failure branch:

```ts
import type { Result } from "@prosopo/result";

declare const result: Result<number, string>;

if (result.ok) {
	result.value; // number
} else {
	result.error; // string
}
```

The same narrowing works with the `isOk` and `isErr` methods, or the standalone `isOk` and `isErr` functions:

```ts
import { isErr, type Result } from "@prosopo/result";

declare const result: Result<number, string>;

if (result.isErr()) {
	result.error; // string
}
if (isErr(result)) {
	result.error; // string
}
```

### Typed error unions

Use a union with a `kind` field for the error type. A `switch` on `kind` then narrows each case, and TypeScript will flag the function if a new kind is added and not handled:

```ts
type ConfigError =
	| { kind: "not-found"; path: string }
	| { kind: "invalid-json"; message: string }
	| { kind: "invalid-shape"; issues: string[] };

const describe = (error: ConfigError): string => {
	switch (error.kind) {
		case "not-found":
			return `No config at ${error.path}`;
		case "invalid-json":
			return `Config isn't valid JSON: ${error.message}`;
		case "invalid-shape":
			return `Config has problems: ${error.issues.join(", ")}`;
	}
};
```

### Wrapping code that throws

`tryCatch` runs a function and turns a throw into an `Err`. Without a second argument, the error is `unknown`, because JavaScript can throw anything:

```ts
import { tryCatch } from "@prosopo/result";

const json = tryCatch((): unknown => JSON.parse("{"));
// json: Result<unknown, unknown>
```

Pass a `mapError` function to turn it into a typed error:

```ts
import { tryCatch } from "@prosopo/result";

const json = tryCatch(
	(): unknown => JSON.parse("{"),
	(error) => ({ kind: "invalid-json" as const, message: String(error) }),
);
// json: Result<unknown, { kind: "invalid-json"; message: string }>
```

Keep each `tryCatch` around the one call that can throw, not a whole block. That way a bug elsewhere still throws loudly instead of being mistaken for an expected failure.

### Async code

`tryCatchAsync` takes a promise, or a function that returns one. It resolves to a `Result` and never rejects:

```ts
import { tryCatchAsync } from "@prosopo/result";

const response = await tryCatchAsync(fetch("https://example.com"), () => ({
	kind: "network" as const,
}));
// response: Result<Response, { kind: "network" }>

const body = await tryCatchAsync(async () => {
	const res = await fetch("https://example.com");
	return res.text();
});
// body: Result<string, unknown>
```

Pass a function rather than a promise when the code might throw before it returns its promise. `tryCatchAsync` catches that too.

### Passing an error up

To hand a failure on to your own caller, re-wrap its error with `err`:

```ts
import { err, ok, type Result, tryCatch } from "@prosopo/result";

type Config = { port: number };
type ConfigError = { kind: "invalid-json" } | { kind: "no-port" };

const parseConfig = (text: string): Result<Config, ConfigError> => {
	const json = tryCatch(
		(): unknown => JSON.parse(text),
		() => ({ kind: "invalid-json" as const }),
	);
	if (!json.ok) {
		return err(json.error);
	}
	const value = json.value;
	if (
		typeof value !== "object" ||
		value === null ||
		!("port" in value) ||
		typeof value.port !== "number"
	) {
		return err({ kind: "no-port" });
	}
	return ok({ port: value.port });
};
```

This is Rust's `?` operator, spelled out. Write `return err(json.error)` rather than `return json`. Here `json` is a `Result<unknown, …>` and the function returns a `Result<Config, …>`, so TypeScript won't accept `json` as it is, even though it holds an error.

### Chaining

If you prefer chaining to early returns, the methods follow Rust's:

```ts
import { err, ok, type Result } from "@prosopo/result";

declare const parse: (input: string) => Result<number, "nan">;

const positive = (value: number): Result<number, "negative"> =>
	value < 0 ? err("negative") : ok(value);

const result = parse("5")
	.andThen(positive) // Result<number, "nan" | "negative">
	.map((value) => value * 2) // Result<number, "nan" | "negative">
	.mapErr((error) => `bad input: ${error}`); // Result<number, string>

const message = result.match({
	ok: (value) => `got ${value}`,
	err: (error) => error,
});
```

- `map` changes the value and leaves an error alone.
- `mapErr` changes the error and leaves a value alone.
- `andThen` runs the next step that can fail, and stops at the first error. Its error type is a union of both steps' errors.
- `orElse` tries to recover from an error.
- `match` handles both cases and returns one value.

### Working with lists

`isOk` and `isErr` work as `filter` callbacks, and TypeScript keeps the narrowed type:

```ts
import { isErr, isOk, type Result } from "@prosopo/result";

declare const results: Result<number, string>[];

const values = results.filter(isOk).map((r) => r.value); // number[]
const errors = results.filter(isErr).map((r) => r.error); // string[]
```

`all` turns a list of results into one result. It's `Ok` with every value if they all succeeded, or the first `Err` if any failed:

```ts
import { all, type Result } from "@prosopo/result";

declare const parse: (input: string) => Result<number, string>;

const numbers = all(["1", "2", "3"].map(parse)); // Result<number[], string>
```

### Getting the value out

| Method               | On success | On failure                    |
| -------------------- | ---------- | ----------------------------- |
| `unwrapOr(fallback)` | the value  | `fallback`                    |
| `unwrapOrElse(fn)`   | the value  | `fn(error)`                   |
| `unwrap()`           | the value  | throws `UnwrapError`          |
| `expect(message)`    | the value  | throws `UnwrapError(message)` |

```ts
import type { Result } from "@prosopo/result";

declare const port: Result<number, string>;

const withDefault = port.unwrapOr(8080);
const mustHave = port.expect("PORT must be set");
```

Only use `unwrap` and `expect` where a failure is a bug, such as in tests, or at startup when the program can't run without the value.

### When to still throw

`Result` isn't a ban on exceptions:

- **Return a `Result`** for failures a caller is expected to handle: invalid input, a missing record, a timeout, a declined payment.
- **Throw** for bugs and broken invariants, where stopping is the right answer. `unwrap` and `expect` do this for you.

## API reference

### Types

```ts
type Result<T, E = unknown> = Ok<T, E> | Err<T, E>;
```

The success type is `T` and the error type is `E`. `E` defaults to `unknown`, so `Result<T>` matches what `tryCatch` returns with no `mapError`.

`Ok<T, E>` has `ok: true` and `value: T`. `Err<T, E>` has `ok: false` and `error: E`. Both are classes, so `instanceof Ok` and `instanceof Err` work too.

```ts
type Matcher<T, E, U> = { ok: (value: T) => U; err: (error: E) => U };
```

The argument to `match`.

### Functions

| Function                               | Returns                       | Description                                                                                                                  |
| -------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ok(value)`                            | `Result<T, never>`            | A success holding `value`.                                                                                                   |
| `err(error)`                           | `Result<never, E>`            | A failure holding `error`.                                                                                                   |
| `isOk(result)`                         | `result is Ok<T, E>`          | Type guard for a success.                                                                                                    |
| `isErr(result)`                        | `result is Err<T, E>`         | Type guard for a failure.                                                                                                    |
| `tryCatch(fn)`                         | `Result<T, unknown>`          | Runs `fn`. `Ok` with its return value, or `Err` with what it threw.                                                          |
| `tryCatch(fn, mapError)`               | `Result<T, E>`                | As above, with the thrown value passed through `mapError`.                                                                   |
| `tryCatchAsync(promiseOrFn)`           | `Promise<Result<T, unknown>>` | Awaits a promise, or calls a function and awaits what it returns. `Ok` with the value, or `Err` with the rejection or throw. |
| `tryCatchAsync(promiseOrFn, mapError)` | `Promise<Result<T, E>>`       | As above, with the error passed through `mapError`.                                                                          |
| `all(results)`                         | `Result<T[], E>`              | `Ok` with every value in order, or the first `Err`.                                                                          |

### Methods

| Method               | On `Ok(value)`                        | On `Err(error)`                       |
| -------------------- | ------------------------------------- | ------------------------------------- |
| `isOk()`             | `true` (type guard)                   | `false`                               |
| `isErr()`            | `false`                               | `true` (type guard)                   |
| `map(fn)`            | `Ok(fn(value))`                       | `Err(error)`                          |
| `mapErr(fn)`         | `Ok(value)`                           | `Err(fn(error))`                      |
| `andThen(fn)`        | `fn(value)`, which returns a `Result` | `Err(error)`                          |
| `orElse(fn)`         | `Ok(value)`                           | `fn(error)`, which returns a `Result` |
| `match({ ok, err })` | `ok(value)`                           | `err(error)`                          |
| `unwrap()`           | `value`                               | throws `UnwrapError`                  |
| `expect(message)`    | `value`                               | throws `UnwrapError` with `message`   |
| `unwrapOr(fallback)` | `value`                               | `fallback`                            |
| `unwrapOrElse(fn)`   | `value`                               | `fn(error)`                           |
| `unwrapErr()`        | throws `UnwrapError`                  | `error`                               |

### `UnwrapError`

Thrown by `unwrap`, `expect` and `unwrapErr` when the result isn't the kind they expected. It extends `Error`, has `name` set to `"UnwrapError"`, and keeps the result's contents on both `.error` and the standard `.cause`:

```ts
import { err, UnwrapError } from "@prosopo/result";

try {
	err({ kind: "not-found" }).unwrap();
} catch (thrown) {
	if (thrown instanceof UnwrapError) {
		thrown.error; // { kind: "not-found" }
	}
}
```

## CommonJS

```js
const { ok, err, tryCatch } = require("@prosopo/result");
```

## FAQ

**How is this different from `Promise`'s rejection?**
A rejected promise is still an exception: it isn't in the type, and the reason is `any`. `tryCatchAsync` turns it into a `Result` you can see and type.

**Can I check `result.ok` in plain JavaScript?**
Yes. Results are ordinary objects with `ok`, `value` and `error` properties, so `if (result.ok)` works without TypeScript.

**Why does `return result` fail to compile when passing an error up?**
See [Passing an error up](#passing-an-error-up). Use `return err(result.error)`.

**Should every function return a `Result`?**
No. Start at the edges, where your code meets files, networks and user input, and use it for failures callers should handle.

## Development

```bash
pnpm install
pnpm run lint       # biome
pnpm run build:tsc  # type check, tests included
pnpm run test       # vitest, 100% coverage enforced
pnpm run build      # dist/esm and dist/cjs
```

CI runs all four on every pull request and on pushes to `main` (`.github/workflows/ci.yml`).

## Releasing

1. Bump `version` in `package.json` and merge.
2. Publish a GitHub release tagged `v<version>`, for example `v0.2.0`.
3. `.github/workflows/publish.yml` checks the tag matches `package.json`, runs the tests and publishes to npm with provenance. It uses npm trusted publishing, so no npm token is stored in the repo.

The very first version has to be published by hand (`npm publish --access public --provenance=false`), because npm only allows a trusted publisher to be added to a package that already exists.

## Licence

Apache-2.0
