"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ORGANIZATION_LINKED_VIDEO_MAX_SECONDS,
  ORGANIZATION_UPLOAD_VIDEO_MAX_SECONDS,
  approvedVideoProviderLabel,
  buildApprovedVideoEmbedUrl,
  parseApprovedVideoUrl,
} from "@/lib/media/approved-video";
import type { OrganizationIntroVideo } from "@/lib/onboarding/organization-profile";
import styles from "./organization-media-editor.module.css";

type MediaSnapshot = {
  organizationName: string;
  logoUrl: string;
  introVideo: OrganizationIntroVideo | null;
  linkedVideo: { providers: readonly ["youtube", "vimeo"]; maxSeconds: number };
  uploadVideo: { enabled: false; maxSeconds: number };
};

export function OrganizationMediaEditor({
  organizationId,
  organizationName = "Organization",
}: {
  organizationId?: string;
  organizationName?: string;
}) {
  const [snapshot, setSnapshot] = useState<MediaSnapshot | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [working, setWorking] = useState<"logo" | "video" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const displayName = snapshot?.organizationName || organizationName;
  const parsedDraft = useMemo(() => parseApprovedVideoUrl(videoUrl), [videoUrl]);
  const intro = snapshot?.introVideo ?? null;
  const linkedEmbed = intro?.source === "linked"
    ? buildApprovedVideoEmbedUrl(intro.provider, intro.videoId)?.replace("&autoplay=1", "")
    : undefined;

  useEffect(() => {
    if (!organizationId) return;
    void load();
  }, [organizationId]);

  async function load() {
    if (!organizationId) return;
    setError(null);
    try {
      const response = await fetch(`/api/onboarding/organization-media?organization=${encodeURIComponent(organizationId)}`, { headers: { Accept: "application/json" } });
      const payload = await response.json() as MediaSnapshot | { error?: string };
      if (!response.ok) {
        setError("error" in payload && payload.error ? payload.error : "Media could not be loaded.");
        return;
      }
      const next = payload as MediaSnapshot;
      setSnapshot(next);
      setLogoUrl(next.logoUrl);
      setVideoUrl(next.introVideo?.source === "linked" ? next.introVideo.canonicalUrl : "");
    } catch {
      setError("Media could not be loaded.");
    }
  }

  async function saveLogo() {
    if (!organizationId) return;
    setWorking("logo");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/onboarding/organization-media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, logoUrl }),
      });
      const payload = await response.json() as MediaSnapshot | { error?: string };
      if (!response.ok) {
        setError("error" in payload && payload.error ? payload.error : "Logo could not be saved.");
        return;
      }
      const next = payload as MediaSnapshot;
      setSnapshot(next);
      setLogoUrl(next.logoUrl);
      setNotice("Logo saved.");
    } catch {
      setError("Logo could not be saved.");
    } finally {
      setWorking(null);
    }
  }

  async function saveVideo() {
    if (!organizationId || !parsedDraft) return;
    setWorking("video");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/onboarding/organization-media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, videoUrl: parsedDraft.canonicalUrl }),
      });
      const payload = await response.json() as MediaSnapshot | { error?: string };
      if (!response.ok) {
        setError("error" in payload && payload.error ? payload.error : "Video could not be saved.");
        return;
      }
      const next = payload as MediaSnapshot;
      setSnapshot(next);
      setVideoUrl(next.introVideo?.source === "linked" ? next.introVideo.canonicalUrl : videoUrl);
      setNotice("Introduction video saved.");
    } catch {
      setError("Video could not be saved.");
    } finally {
      setWorking(null);
    }
  }

  async function removeVideo() {
    if (!organizationId) return;
    setWorking("video");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/onboarding/organization-media?organization=${encodeURIComponent(organizationId)}`, { method: "DELETE" });
      const payload = await response.json() as MediaSnapshot | { error?: string };
      if (!response.ok) {
        setError("error" in payload && payload.error ? payload.error : "Video could not be removed.");
        return;
      }
      setSnapshot(payload as MediaSnapshot);
      setVideoUrl("");
      setNotice("Introduction video removed.");
    } catch {
      setError("Video could not be removed.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className={styles.editor}>
      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <div><h2>Logo</h2><p>Shown with your organization across RFxchange.</p></div>
        </div>
        <div className={styles.logoRow}>
          <div className={styles.logoPreview}>
            {logoUrl ? <img src={logoUrl} alt={`${displayName} logo`} /> : <span>{displayName.slice(0, 2).toUpperCase()}</span>}
          </div>
          <label>
            <span>Logo URL</span>
            <input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} inputMode="url" placeholder="https://" />
          </label>
          <button type="button" onClick={() => void saveLogo()} disabled={working !== null || !organizationId}>{working === "logo" ? "Saving…" : "Save"}</button>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <div><h2>Introduction video</h2><p>A quick introduction to your organization.</p></div>
          <span>{ORGANIZATION_LINKED_VIDEO_MAX_SECONDS}s max</span>
        </div>

        {intro?.source === "linked" && linkedEmbed ? (
          <div className={styles.videoPreview}>
            <iframe
              src={linkedEmbed}
              title={`${displayName} introduction video`}
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <div>
              <strong>{approvedVideoProviderLabel(intro.provider)}</strong>
              <span>{intro.status === "ready" ? "Ready" : "Saved · checking length"}</span>
              <button type="button" onClick={() => void removeVideo()} disabled={working !== null}>Remove</button>
            </div>
          </div>
        ) : null}

        <div className={styles.linkRow}>
          <label>
            <span>YouTube or Vimeo link</span>
            <input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} inputMode="url" placeholder="Paste video link" />
          </label>
          <button type="button" onClick={() => void saveVideo()} disabled={working !== null || !organizationId || !parsedDraft}>{working === "video" ? "Saving…" : intro ? "Change" : "Add video"}</button>
        </div>
        {videoUrl && !parsedDraft ? <p className={styles.inlineError}>Use a YouTube or Vimeo link.</p> : null}
      </section>

      <section className={`${styles.section} ${styles.future}`}>
        <div className={styles.sectionTitle}>
          <div><h2>Upload a short video</h2><p>Direct upload will be available here.</p></div>
          <span>{ORGANIZATION_UPLOAD_VIDEO_MAX_SECONDS}s max</span>
        </div>
        <button type="button" disabled>Upload video</button>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}
      {notice ? <p className={styles.notice}>{notice}</p> : null}
    </div>
  );
}
