import { describe, expect, it } from "vitest";
import {
  ORGANIZATION_LINKED_VIDEO_MAX_SECONDS,
  ORGANIZATION_UPLOAD_VIDEO_MAX_SECONDS,
  buildApprovedVideoEmbedUrl,
  parseApprovedVideoUrl,
} from "@/lib/media/approved-video";

describe("approved organization video providers", () => {
  it("normalizes common YouTube URLs", () => {
    expect(parseApprovedVideoUrl("https://www.youtube.com/watch?v=abcDEF_1234")).toMatchObject({
      provider: "youtube",
      videoId: "abcDEF_1234",
      canonicalUrl: "https://www.youtube.com/watch?v=abcDEF_1234",
    });
    expect(parseApprovedVideoUrl("https://youtu.be/abcDEF_1234?t=3")?.videoId).toBe("abcDEF_1234");
    expect(parseApprovedVideoUrl("https://youtube.com/shorts/abcDEF_1234")?.videoId).toBe("abcDEF_1234");
  });

  it("normalizes Vimeo URLs", () => {
    expect(parseApprovedVideoUrl("https://vimeo.com/123456789")).toMatchObject({
      provider: "vimeo",
      videoId: "123456789",
      canonicalUrl: "https://vimeo.com/123456789",
    });
    expect(parseApprovedVideoUrl("https://player.vimeo.com/video/123456789")?.videoId).toBe("123456789");
  });

  it("rejects arbitrary or spoofed providers", () => {
    expect(parseApprovedVideoUrl("https://example.com/video/123")).toBeUndefined();
    expect(parseApprovedVideoUrl("https://youtube.com.example.com/watch?v=abcDEF_1234")).toBeUndefined();
    expect(parseApprovedVideoUrl("http://youtu.be/abcDEF_1234")).toBeUndefined();
  });

  it("builds embeds only for valid provider identifiers", () => {
    expect(buildApprovedVideoEmbedUrl("youtube", "abcDEF_1234")).toContain("youtube-nocookie.com/embed/abcDEF_1234");
    expect(buildApprovedVideoEmbedUrl("vimeo", "123456789")).toContain("player.vimeo.com/video/123456789");
    expect(buildApprovedVideoEmbedUrl("vimeo", "not-a-vimeo-id")).toBeUndefined();
  });

  it("keeps linked and uploaded duration policies distinct", () => {
    expect(ORGANIZATION_LINKED_VIDEO_MAX_SECONDS).toBe(30);
    expect(ORGANIZATION_UPLOAD_VIDEO_MAX_SECONDS).toBe(15);
  });
});
