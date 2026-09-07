import { Injectable } from "@nestjs/common";
import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse } from "cloudinary";
import type { IUploadProvider, UploadFile, UploadOptions, UploadResult } from "./provider";

/**
 * Cloudinary implementation of the upload provider.
 * Uses the `CLOUDINARY_URL` env var (or individual Cloudinary env vars) for auth.
 *
 * Configuration is validated lazily (on first actual upload/delete call), not
 * in the constructor — this provider is now DI-injected and instantiated
 * eagerly at Nest bootstrap, so throwing here would crash app startup
 * whenever Cloudinary env vars are unset (e.g. local dev without uploads).
 */
@Injectable()
export class CloudinaryProvider implements IUploadProvider {
  private ensureConfigured(): void {
    if (cloudinary.config().cloud_name) return;

    if (process.env.CLOUDINARY_URL) {
      const url = new URL(process.env.CLOUDINARY_URL);
      cloudinary.config({
        cloud_name: url.hostname,
        api_key: url.username,
        api_secret: url.password,
        secure: true,
      });
    } else if (
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    } else {
      throw new Error("Cloudinary configuration is missing in environment variables");
    }
  }

  async upload(file: UploadFile, options?: UploadOptions): Promise<UploadResult> {
    this.ensureConfigured();
    const folder = options?.folder ?? "";
    const transformation = options?.transformation;

    // Stream the binary buffer directly. Encoding it as a base64 data URI adds
    // roughly 33% to the request body, so a valid file below our 10 MB limit
    // can be rejected by an upstream/provider request-size limit.
    const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          transformation,
          // Let Cloudinary route images and PDFs to the appropriate resource type.
          resource_type: "auto",
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error("Cloudinary did not return an upload result"));
          resolve(result);
        },
      );

      stream.end(file.buffer);
    });

    return {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      resourceType: uploadResult.resource_type as string,
    };
  }

  async delete(publicId: string): Promise<void> {
    this.ensureConfigured();
    // Missing assets return "not found", rather than throwing an error.
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    if (result.result === "not found") {
      await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
    }
  }
}
