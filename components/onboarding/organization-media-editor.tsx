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
  logoUrl: string;
  introVideo: OrganizationIntroVideo | null;
  linkedVideo: { providers: readonly ["youtube", "vimeo"]; maxSeconds: number };
  uploadVideo: { enabled: false; maxSeconds: number };
};

export function OrganizationMediaEditor({
  organizationId,
  organizationName,
  logoUrl,
  onLogoChange,
  onSaveLogo,
  savingLogo,
}: {
  organizationId?: string;
  organizationName: string;
  logoUrl: string;
  onLogoChange: (value: string) => void;
  onSaveLogo: () => void;
  savingLogo: boolean;
}) {
  const [snapshot, setSnapshot] = useState<MediaSnapshot | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      if (next.introVideo?.source === "linked") setVideoUrl(next.introVideo.canonicalUrl);
    } catch {
      setError("Media could not be loaded.");
    }
  }

  async function saveVideo() {
    if (!organizationId || !parsedDraft) return;
    setWorking(true);
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
      setSnapshot(payload as MediaSnapshot);
      setNotice("Introduction video saved.");
    } catch {
      setError("Video could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  async function removeVideo() {
    if (!organizationId) return;
    setWorking(true);
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
      setWorking(false);
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
            {logoUrl ? <img src={logoUrl} alt={`${organizationName} logo`} /> : <span>{organizationName.slice(0, 2).toUpperCase()}</span>}
          </div>
          <label>
            <span>Logo URL</span>
            <input value={logoUrl} onChange={(event) => onLogoChange(event.target.value)} inputMode="url" placeholder="https://" />
          </label>
          <button type="button" onClick={onSaveLogo} disabled={savingLogo || !organizationId}>{savingLogo ? "Saving…" : "Save"}</button>
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
              title={`${organizationName} introduction video`}
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <div>
              <strong>{approvedVideoProviderLabel(intro.provider)}</strong>
              <span>{intro.status === "ready" ? "Ready" : "Saved · checking length"}</span>
              <button type="button" onClick={() => void removeVideo()} disabled={working}>Remove</button>
            </div>
          </div>
        ) : null}

        <div className={styles.linkRow}>
          <label>
            <span>YouTube or Vimeo link</span>
            <input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} inputMode="url" placeholder="Paste video link" />
          </label>
          <button type="button" onClick={() => void saveVideo()} disabled={working || !organizationId || !parsedDraft}>{working ? "Saving…" : intro ? "Change" : "Add video"}</button>
        </div>
        {videoUrl && !parsedDraft ? <p className={styles.inlineError}>Use a YouTube or Vimeo link.</p> : null}
      </section>

      <section className={`${styles.section} ${styles.future}`}>
        <div className={styles.sectionTitle}>
          <div><h2>Upload a short video</h2><p>Direct RFxchange upload is prepared for a later media-service release.</p></div>
          <span>{ORGANIZATION_UPLOAD_VIDEO_MAX_SECONDS}s max</span>
        </div>
        <button type="button" disabled>Upload video</button>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}
      {notice ? <p className={styles.notice}>{notice}</p> : null}
    </div>
  );
}
