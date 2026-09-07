import { beforeEach, describe, expect, it, vi } from "vitest";
import { v2 as cloudinary } from "cloudinary";
import { SettingsController } from "../../src/modules/settings/settings.controller";
import { SettingsService } from "../../src/modules/settings/settings.service";
import { CloudinaryProvider } from "../../src/lib/upload/cloudinary.provider";

describe("Profile avatar persistence", () => {
  const url = "https://res.cloudinary.com/test/image/upload/laz-avatars/photo.webp";
  const publicId = "laz-avatars/photo";

  it.each(["SUPER_ADMIN", "FINANCE_PLATFORM", "LEMBAGA_ADMIN", "CUSTOM_STAFF"])(
    "saves the uploaded Cloudinary reference for %s using the authenticated user ID",
    async (roleName) => {
      const prisma = { user: {
        findUnique: vi.fn().mockResolvedValue({ id: "current-user", avatarPublicId: null }),
        update: vi.fn().mockResolvedValue({ avatarUrl: url, avatarPublicId: publicId }),
      } };
      const audit = { log: vi.fn().mockResolvedValue(undefined) };
      const controller = new SettingsController(new SettingsService(prisma as any, audit as any));
      await expect(controller.updateAvatar({ url, publicId }, { id: "current-user", roleName } as any))
        .resolves.toEqual({ avatarUrl: url });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "current-user" }, data: { avatarUrl: url, avatarPublicId: publicId },
      });
    },
  );

  it("rejects an unparsed multipart body instead of saving an empty avatar", async () => {
    const updateAvatar = vi.fn();
    const controller = new SettingsController({ updateAvatar } as any);
    await expect(controller.updateAvatar(undefined as any, { id: "current-user" } as any)).rejects.toThrow();
    expect(updateAvatar).not.toHaveBeenCalled();
  });
});

describe("Cloudinary avatar cleanup", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(cloudinary, "config").mockReturnValue({ cloud_name: "test" } as any);
  });

  it("deletes image assets using the image resource type", async () => {
    const destroy = vi.spyOn(cloudinary.uploader, "destroy").mockResolvedValue({ result: "ok" });
    await new CloudinaryProvider().delete("laz-avatars/old");
    expect(destroy).toHaveBeenCalledExactlyOnceWith("laz-avatars/old", { resource_type: "image" });
  });

  it("falls back to raw when Cloudinary returns not found without throwing", async () => {
    const destroy = vi.spyOn(cloudinary.uploader, "destroy")
      .mockResolvedValueOnce({ result: "not found" }).mockResolvedValueOnce({ result: "ok" });
    await new CloudinaryProvider().delete("documents/old");
    expect(destroy).toHaveBeenNthCalledWith(2, "documents/old", { resource_type: "raw" });
  });
});
