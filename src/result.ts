// Copyright 2021-2026 Prosopo (UK) Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

export type Result<T, E = unknown> = Ok<T, E> | Err<T, E>;

export type Matcher<T, E, U> = {
	ok: (value: T) => U;
	err: (error: E) => U;
};

export class UnwrapError<E> extends Error {
	readonly error: E;

	constructor(message: string, error: E) {
		super(message, { cause: error });
		this.name = "UnwrapError";
		this.error = error;
	}
}

export class Ok<T, E = unknown> {
	readonly ok = true;

	constructor(readonly value: T) {}

	isOk(): this is Ok<T, E> {
		return true;
	}

	isErr(): this is Err<T, E> {
		return false;
	}

	map<U>(fn: (value: T) => U): Result<U, E> {
		return new Ok(fn(this.value));
	}

	mapErr<F>(_fn: (error: E) => F): Result<T, F> {
		return new Ok(this.value);
	}

	andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
		return fn(this.value);
	}

	orElse<F>(_fn: (error: E) => Result<T, F>): Result<T, F> {
		return new Ok(this.value);
	}

	match<U>(matcher: Matcher<T, E, U>): U {
		return matcher.ok(this.value);
	}

	unwrap(): T {
		return this.value;
	}

	expect(_message: string): T {
		return this.value;
	}

	unwrapOr(_fallback: T): T {
		return this.value;
	}

	unwrapOrElse(_fn: (error: E) => T): T {
		return this.value;
	}

	unwrapErr(): E {
		throw new UnwrapError("called unwrapErr on an Ok", this.value);
	}
}

export class Err<T, E = unknown> {
	readonly ok = false;

	constructor(readonly error: E) {}

	isOk(): this is Ok<T, E> {
		return false;
	}

	isErr(): this is Err<T, E> {
		return true;
	}

	map<U>(_fn: (value: T) => U): Result<U, E> {
		return new Err(this.error);
	}

	mapErr<F>(fn: (error: E) => F): Result<T, F> {
		return new Err(fn(this.error));
	}

	andThen<U, F>(_fn: (value: T) => Result<U, F>): Result<U, E | F> {
		return new Err(this.error);
	}

	orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F> {
		return fn(this.error);
	}

	match<U>(matcher: Matcher<T, E, U>): U {
		return matcher.err(this.error);
	}

	unwrap(): never {
		throw new UnwrapError("called unwrap on an Err", this.error);
	}

	expect(message: string): never {
		throw new UnwrapError(message, this.error);
	}

	unwrapOr(fallback: T): T {
		return fallback;
	}

	unwrapOrElse(fn: (error: E) => T): T {
		return fn(this.error);
	}

	unwrapErr(): E {
		return this.error;
	}
}

export const ok = <T, E = never>(value: T): Result<T, E> => new Ok(value);

export const err = <E, T = never>(error: E): Result<T, E> => new Err(error);

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T, E> =>
	result.ok;

export const isErr = <T, E>(result: Result<T, E>): result is Err<T, E> =>
	!result.ok;

export function tryCatch<T>(fn: () => T): Result<T, unknown>;
export function tryCatch<T, E>(
	fn: () => T,
	mapError: (error: unknown) => E,
): Result<T, E>;
export function tryCatch<T, E>(
	fn: () => T,
	mapError?: (error: unknown) => E,
): Result<T, E | unknown> {
	try {
		return new Ok(fn());
	} catch (error) {
		return new Err(mapError ? mapError(error) : error);
	}
}

export function tryCatchAsync<T>(
	task: Promise<T> | (() => Promise<T>),
): Promise<Result<T, unknown>>;
export function tryCatchAsync<T, E>(
	task: Promise<T> | (() => Promise<T>),
	mapError: (error: unknown) => E,
): Promise<Result<T, E>>;
export async function tryCatchAsync<T, E>(
	task: Promise<T> | (() => Promise<T>),
	mapError?: (error: unknown) => E,
): Promise<Result<T, E | unknown>> {
	try {
		return new Ok(await (typeof task === "function" ? task() : task));
	} catch (error) {
		return new Err(mapError ? mapError(error) : error);
	}
}

export const all = <T, E>(results: readonly Result<T, E>[]): Result<T[], E> => {
	const values: T[] = [];
	for (const result of results) {
		if (!result.ok) {
			return new Err(result.error);
		}
		values.push(result.value);
	}
	return new Ok(values);
};
