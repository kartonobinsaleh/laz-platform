import { describe, it, expect, beforeEach, vi } from "vitest";
import { HttpException, HttpStatus } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { z } from "zod";
import { AllExceptionsFilter } from "../../src/common/filters/all-exceptions.filter";
import { AppError } from "../../src/common/errors/app.error";

vi.mock("@prisma/client", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    clientVersion: string;
    meta?: object;

    constructor(message: string, args: { code: string; clientVersion: string; meta?: object }) {
      super(message);
      this.name = "PrismaClientKnownRequestError";
      this.code = args.code;
      this.clientVersion = args.clientVersion;
      this.meta = args.meta;
    }
  }
  return {
    Prisma: { PrismaClientKnownRequestError },
  };
});

import { Prisma } from "@prisma/client";

function makeHost(): { host: ArgumentsHost; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, json };
}

describe("AllExceptionsFilter", () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it("maps ZodError → 422 VALIDATION_ERROR with flattened details", () => {
    const { host, json } = makeHost();
    const zodError = z.object({ name: z.string() }).safeParse({ name: 123 }).error!;

    filter.catch(zodError, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      }),
    );
  });

  it("maps Prisma P2002 → 409 CONFLICT", () => {
    const { host, json } = makeHost();
    const err = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
      code: "P2002",
      clientVersion: "7.0.0",
    });

    filter.catch(err, host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: "CONFLICT", message: "Data sudah ada (constraint unik)" },
    });
  });

  it("maps Prisma P2025 → 404 NOT_FOUND", () => {
    const { host, json } = makeHost();
    const err = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "7.0.0",
    });

    filter.catch(err, host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: "NOT_FOUND", message: "Data tidak ditemukan" },
    });
  });

  it("maps Prisma P2003 → 409 with a clear related-data message", () => {
    const { host, json } = makeHost();
    const err = new Prisma.PrismaClientKnownRequestError("Foreign key constraint", {
      code: "P2003",
      clientVersion: "7.0.0",
    });

    filter.catch(err, host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "RELATED_DATA_EXISTS",
        message: "Data tidak dapat dihapus karena masih digunakan oleh data lain",
      },
    });
  });

  it("maps AppError → its own status code and machine-readable code", () => {
    const { host, json } = makeHost();
    const err = new AppError("EMAIL_TAKEN", "Email sudah terdaftar", 409);

    filter.catch(err, host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: "EMAIL_TAKEN", message: "Email sudah terdaftar" },
    });
  });

  it("maps HttpException → its status with code derived from error field", () => {
    const { host, json } = makeHost();
    const err = new HttpException(
      { message: "Forbidden resource", error: "Forbidden" },
      HttpStatus.FORBIDDEN,
    );

    filter.catch(err, host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: "FORBIDDEN", message: "Forbidden resource" },
    });
  });

  it("maps HttpException with string body → 401 with fallback code", () => {
    const { host, json } = makeHost();
    const err = new HttpException("Unauthorized", HttpStatus.UNAUTHORIZED);

    filter.catch(err, host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      error: expect.objectContaining({ message: "Unauthorized" }),
    });
  });

  it("maps Multer file-size errors to a clear upload-limit response", () => {
    const { host, json } = makeHost();
    const err = Object.assign(new Error("File too large"), { code: "LIMIT_FILE_SIZE" });

    filter.catch(err, host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: "Ukuran file terlalu besar. Maksimum 10 MB per file.",
      },
    });
  });

  it("maps unknown Error → 500 INTERNAL_ERROR without leaking details", () => {
    const { host, json } = makeHost();

    filter.catch(new Error("Database connection lost"), host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan sistem" },
    });
  });

  it("maps non-Error thrown value → 500 INTERNAL_ERROR", () => {
    const { host, json } = makeHost();

    filter.catch("some string thrown", host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan sistem" },
    });
  });
});
