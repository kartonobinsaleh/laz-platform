import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../errors/app.error";

/**
 * Error handler terpusat → envelope { success: false, error: { code, message, details? } }.
 * ZodError→422 (details = flatten()), Prisma P2002→409, P2025→404,
 * HttpException→status-nya, lainnya→500 generik (jangan bocorkan internal).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    // Multer throws its own error type before the controller is entered. Keep
    // the documented upload limit visible instead of turning this into a
    // generic HTTP 500 response.
    if (
      exception instanceof Error &&
      (exception as Error & { code?: string }).code === "LIMIT_FILE_SIZE"
    ) {
      return res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        success: false,
        error: {
          code: "FILE_TOO_LARGE",
          message: "Ukuran file terlalu besar. Maksimum 10 MB per file.",
        },
      });
    }

    if (exception instanceof ZodError) {
      return res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Data tidak valid",
          details: exception.flatten(),
        },
      });
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        return res.status(HttpStatus.CONFLICT).json({
          success: false,
          error: { code: "CONFLICT", message: "Data sudah ada (constraint unik)" },
        });
      }
      if (exception.code === "P2025") {
        return res.status(HttpStatus.NOT_FOUND).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Data tidak ditemukan" },
        });
      }
      if (exception.code === "P2003") {
        return res.status(HttpStatus.CONFLICT).json({
          success: false,
          error: {
            code: "RELATED_DATA_EXISTS",
            message: "Data tidak dapat dihapus karena masih digunakan oleh data lain",
          },
        });
      }
    }

    if (exception instanceof AppError) {
      return res.status(exception.getStatus()).json({
        success: false,
        error: { code: exception.code, message: exception.message },
      });
    }

    // http-errors style (e.g. ForbiddenError from csrf-csrf) — has numeric .status
    if (
      exception instanceof Error &&
      typeof (exception as unknown as Record<string, unknown>).status === "number"
    ) {
      const httpErr = exception as Error & { status: number };
      return res.status(httpErr.status).json({
        success: false,
        error: {
          code: HttpStatus[httpErr.status as HttpStatus] ?? "ERROR",
          message: httpErr.message,
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as
        | string
        | { message?: string | string[]; error?: string };
      const message =
        typeof body === "string"
          ? body
          : Array.isArray(body.message)
            ? body.message.join(", ")
            : (body.message ?? exception.message);
      const code =
        typeof body === "object" && body.error
          ? body.error.toUpperCase().replace(/\s+/g, "_")
          : HttpStatus[status] ?? "ERROR";
      return res.status(status).json({
        success: false,
        error: { code, message },
      });
    }

    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
    );
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan sistem" },
    });
  }
}
