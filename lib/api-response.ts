import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function okJson<T extends Record<string, unknown>>(body: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...body }, init);
}

export function errorJson(error: string | Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(typeof error === "string" ? { error } : error, init);
}

export function validationErrorJson(error: ZodError, init?: ResponseInit) {
  return errorJson({ error: error.flatten() }, { status: 400, ...init });
}

export function badRequestJson(error: string | Record<string, unknown>, init?: ResponseInit) {
  return errorJson(error, { status: 400, ...init });
}

export function notFoundJson(error: string | Record<string, unknown>, init?: ResponseInit) {
  return errorJson(error, { status: 404, ...init });
}

export function conflictJson(error: string | Record<string, unknown>, init?: ResponseInit) {
  return errorJson(error, { status: 409, ...init });
}
