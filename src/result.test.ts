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

import { describe, expect, expectTypeOf, it } from "vitest";
import {
	all,
	Err,
	err,
	isErr,
	isOk,
	Ok,
	ok,
	type Result,
	tryCatch,
	tryCatchAsync,
	UnwrapError,
} from "./index.js";

type ParseError = { kind: "empty" } | { kind: "nan"; input: string };

const parse = (input: string): Result<number, ParseError> => {
	if (input === "") {
		return err({ kind: "empty" });
	}
	const value = Number(input);
	return Number.isNaN(value) ? err({ kind: "nan", input }) : ok(value);
};

const double = (value: number): number => value * 2;

describe("ok and err", () => {
	it("narrows on the ok property", () => {
		const result: Result<number, ParseError> = parse("21");
		if (result.ok) {
			expectTypeOf(result.value).toEqualTypeOf<number>();
			expect(result.value).toBe(21);
		} else {
			expectTypeOf(result.error).toEqualTypeOf<ParseError>();
			expect.unreachable();
		}
	});

	it("narrows the error union", () => {
		const result: Result<number, ParseError> = parse("abc");
		if (!result.ok && result.error.kind === "nan") {
			expect(result.error.input).toBe("abc");
		} else {
			expect.unreachable();
		}
	});

	it("builds class instances", () => {
		expect(ok(1)).toBeInstanceOf(Ok);
		expect(err("x")).toBeInstanceOf(Err);
	});
});

describe("type guards", () => {
	it("isOk and isErr functions", () => {
		const good: Result<number, string> = ok(1);
		const bad: Result<number, string> = err("no");
		expect(isOk(good)).toBe(true);
		expect(isErr(good)).toBe(false);
		expect(isOk(bad)).toBe(false);
		expect(isErr(bad)).toBe(true);
		if (isErr(bad)) {
			expectTypeOf(bad.error).toEqualTypeOf<string>();
		}
	});

	it("isOk and isErr methods", () => {
		const good: Result<number, string> = ok(1);
		const bad: Result<number, string> = err("no");
		expect(good.isOk()).toBe(true);
		expect(good.isErr()).toBe(false);
		expect(bad.isOk()).toBe(false);
		expect(bad.isErr()).toBe(true);
		if (good.isOk()) {
			expectTypeOf(good.value).toEqualTypeOf<number>();
		}
	});

	it("filters arrays", () => {
		const results: Result<number, ParseError>[] = ["1", "", "3"].map(parse);
		const values: number[] = results.filter(isOk).map((r) => r.value);
		const errors: ParseError[] = results.filter(isErr).map((r) => r.error);
		expect(values).toEqual([1, 3]);
		expect(errors).toEqual([{ kind: "empty" }]);
	});
});

describe("map and mapErr", () => {
	it("maps the value of an Ok", () => {
		expect(parse("2").map(double).unwrap()).toBe(4);
	});

	it("leaves an Err alone when mapping the value", () => {
		expect(parse("").map(double).unwrapErr()).toEqual({ kind: "empty" });
	});

	it("maps the error of an Err", () => {
		const result: Result<number, string> = parse("").mapErr((e) => e.kind);
		expect(result.unwrapErr()).toBe("empty");
	});

	it("leaves an Ok alone when mapping the error", () => {
		expect(
			parse("2")
				.mapErr((e) => e.kind)
				.unwrap(),
		).toBe(2);
	});
});

describe("andThen and orElse", () => {
	const positive = (value: number): Result<number, "negative"> =>
		value < 0 ? err("negative") : ok(value);

	it("chains Ok values", () => {
		const result: Result<number, ParseError | "negative"> =
			parse("5").andThen(positive);
		expect(result.unwrap()).toBe(5);
	});

	it("stops at the first Err", () => {
		expect(parse("-5").andThen(positive).unwrapErr()).toBe("negative");
		expect(parse("").andThen(positive).unwrapErr()).toEqual({
			kind: "empty",
		});
	});

	it("recovers from an Err", () => {
		const result: Result<number, never> = parse("").orElse(() => ok(0));
		expect(result.unwrap()).toBe(0);
	});

	it("skips recovery for an Ok", () => {
		expect(
			parse("7")
				.orElse(() => ok(0))
				.unwrap(),
		).toBe(7);
	});
});

describe("match", () => {
	const describeResult = (input: string): string =>
		parse(input).match({
			ok: (value) => `number ${value}`,
			err: (error) => `error ${error.kind}`,
		});

	it("calls the matching branch", () => {
		expect(describeResult("3")).toBe("number 3");
		expect(describeResult("")).toBe("error empty");
	});
});

describe("unwrapping", () => {
	it("returns values from an Ok", () => {
		const result = parse("9");
		expect(result.unwrap()).toBe(9);
		expect(result.expect("should parse")).toBe(9);
		expect(result.unwrapOr(0)).toBe(9);
		expect(result.unwrapOrElse(() => 0)).toBe(9);
	});

	it("returns fallbacks from an Err", () => {
		const result = parse("");
		expect(result.unwrapOr(0)).toBe(0);
		expect(result.unwrapOrElse((e) => e.kind.length)).toBe(5);
	});

	it("throws an UnwrapError carrying the error", () => {
		const thrown = tryCatch(() => parse("").unwrap());
		const error = thrown.unwrapErr();
		expect(error).toBeInstanceOf(UnwrapError);
		if (error instanceof UnwrapError) {
			expect(error.message).toBe("called unwrap on an Err");
			expect(error.error).toEqual({ kind: "empty" });
			expect(error.cause).toEqual({ kind: "empty" });
			expect(error.name).toBe("UnwrapError");
		}
	});

	it("throws the expect message", () => {
		expect(() => parse("").expect("input must be a number")).toThrow(
			"input must be a number",
		);
	});

	it("throws when unwrapping the error of an Ok", () => {
		expect(() => parse("1").unwrapErr()).toThrow("called unwrapErr on an Ok");
	});
});

describe("tryCatch", () => {
	it("wraps a returned value", () => {
		expect(tryCatch(() => JSON.parse("[1]")).unwrap()).toEqual([1]);
	});

	it("wraps a thrown error as unknown", () => {
		const result = tryCatch((): unknown => JSON.parse("{"));
		expectTypeOf(result).toEqualTypeOf<Result<unknown, unknown>>();
		expect(result.unwrapErr()).toBeInstanceOf(SyntaxError);
	});

	it("maps a thrown error to a typed one", () => {
		const result = tryCatch(
			(): unknown => JSON.parse("{"),
			() => "invalid json" as const,
		);
		expectTypeOf(result).toEqualTypeOf<Result<unknown, "invalid json">>();
		expect(result.unwrapErr()).toBe("invalid json");
	});
});

describe("tryCatchAsync", () => {
	it("accepts a promise", async () => {
		expect((await tryCatchAsync(Promise.resolve(1))).unwrap()).toBe(1);
	});

	it("accepts a function returning a promise", async () => {
		expect((await tryCatchAsync(async () => 2)).unwrap()).toBe(2);
	});

	it("catches a rejection", async () => {
		const failure = new Error("boom");
		const result = await tryCatchAsync(Promise.reject(failure));
		expect(result.unwrapErr()).toBe(failure);
	});

	it("catches a synchronous throw from the function", async () => {
		const result = await tryCatchAsync((): Promise<number> => {
			throw new Error("sync");
		});
		expect(result.isErr()).toBe(true);
	});

	it("maps a rejection to a typed error", async () => {
		const result = await tryCatchAsync(Promise.reject(new Error("x")), () => ({
			kind: "network" as const,
		}));
		expectTypeOf(result).toEqualTypeOf<Result<never, { kind: "network" }>>();
		expect(result.unwrapErr()).toEqual({ kind: "network" });
	});
});

describe("all", () => {
	it("collects every Ok value", () => {
		expect(all(["1", "2"].map(parse)).unwrap()).toEqual([1, 2]);
	});

	it("returns the first Err", () => {
		expect(all(["1", "x", ""].map(parse)).unwrapErr()).toEqual({
			kind: "nan",
			input: "x",
		});
	});

	it("returns an empty array for no results", () => {
		expect(all([]).unwrap()).toEqual([]);
	});
});
