/**
 * Shared API route utilities for consistent error handling and responses.
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

/** Standard JSON success response */
export function jsonResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Standard JSON error response */
export function errorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Generate a new UUID */
export function newId(): string {
  return randomUUID();
}

/** Parse JSON body from a Request, returning null on failure */
export async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
