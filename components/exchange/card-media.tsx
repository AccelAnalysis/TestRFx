"use client";

import { useEffect, useRef, useState } from "react";
import type { ExchangeCardPlacement, ExchangeCardStatus, ExchangeRecord } from "@/lib/exchange/contracts";
import type { ResolvedExchangeCardMedia } from "@/lib/exchange/card-presentation";
import styles from "./card-media.module.css";

let activeExchangeCardVideo: HTMLVideoElement | null = null;

const fallbackGlyph: Record<ExchangeRecord["type"], string> = {
  rfx: "⌁",
  resource: "◫",
  intelligence: "◉",
  capability: "◇",
};

const fallbackTone: Record<ExchangeRecord["type"], string> = {
  rfx: styles.rfxFallback,
  resource: styles.resourceFallback,
  intelligence: styles.intelligenceFallback,
  capability: styles.capabilityFallback,
};

const statusTone: Record<NonNullable<ExchangeCardStatus["tone"]>, string> = {
  neutral: styles.statusNeutral,
  info: styles.statusInfo,
  success: styles.statusSuccess,
  warning: styles.statusWarning,
  critical: styles.statusCritical,
};

function safePause(video?: HTMLVideoElement | null) {
  if (!video) return;
  try { video.pause(); } catch {}
  if (activeExchangeCardVideo === video) activeExchangeCardVideo = null;
}

export function CardMedia({
  record,
  media,
  placement,
  status,
  onSelect,
  onOpen,
}: {
  record: ExchangeRecord;
  media: ResolvedExchangeCardMedia;
  placement: ExchangeCardPlacement;
  status?: ExchangeCardStatus;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);

  const visualSrc = media.kind === "video" ? (media.poster ?? media.src) : media.src;
  const playableVideo = media.kind === "video" && Boolean(media.videoSrc && visualSrc) && !mediaFailed;
  const showFallback = media.fallback || mediaFailed || !visualSrc;

  useEffect(() => {
    if (!playing) return;
    const video = videoRef.current;
    if (!video) return;
    if (activeExchangeCardVideo && activeExchangeCardVideo !== video) safePause(activeExchangeCardVideo);
    activeExchangeCardVideo = video;
    video.muted = true;
    void video.play().catch(() => {
      safePause(video);
      setPlaying(false);
      setMediaFailed(true);
    });
  }, [playing]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.28)) {
        safePause(videoRef.current);
        setPlaying(false);
      }
    }, { threshold: [0, 0.28, 0.6] });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => safePause(videoRef.current), []);

  function failMedia() {
    safePause(videoRef.current);
    setPlaying(false);
    setMediaFailed(true);
  }

  function openRecord() {
    onSelect();
    onOpen();
  }

  function startVideo() {
    if (!playableVideo) return;
    onSelect();
    setPlaying(true);
  }

  function pauseVideo() {
    safePause(videoRef.current);
    setPlaying(false);
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-media-kind={media.kind}
      data-media-fallback={showFallback ? "true" : "false"}
      data-video-playing={playing ? "true" : "false"}
    >
      <button
        type="button"
        className={styles.open}
        onClick={openRecord}
        onFocus={onSelect}
        aria-label={`Open ${record.title} details`}
      >
        {playing && playableVideo ? (
          <video
            ref={videoRef}
            className={styles.visual}
            src={media.videoSrc}
            poster={visualSrc}
            muted
            playsInline
            preload="none"
            onEnded={() => setPlaying(false)}
            onError={failMedia}
            aria-label={media.alt || `${record.title} video preview`}
          />
        ) : !showFallback && visualSrc ? (
          <img
            className={`${styles.visual}${media.kind === "logo" ? ` ${styles.logoVisual}` : ""}`}
            src={visualSrc}
            alt={media.alt}
            loading="lazy"
            decoding="async"
            onError={failMedia}
          />
        ) : (
          <span className={`${styles.fallback} ${fallbackTone[record.type]}`} aria-hidden="true">
            <span className={styles.fallbackGlyph}>{fallbackGlyph[record.type]}</span>
            <span className={styles.fallbackLabel}>{media.label}</span>
          </span>
        )}
      </button>

      <div className={styles.topBadges} aria-hidden="true">
        {status ? <span className={`${styles.status} ${statusTone[status.tone ?? "neutral"]}`}>{status.label}</span> : null}
        {placement !== "organic" ? <span className={styles.placement}>{placement === "sponsored" ? "Sponsored" : "Featured"}</span> : null}
      </div>

      {media.kind === "video" ? <span className={styles.mediaKind}>{media.videoSrc ? "Video" : "Video preview"}</span> : media.kind === "visualization" ? <span className={styles.mediaKind}>Insight visual</span> : null}

      {playableVideo && !playing ? (
        <button type="button" className={styles.play} onClick={startVideo} aria-label={`Play video preview for ${record.title}`}>
          <span aria-hidden>▶</span>
        </button>
      ) : null}
      {playing ? (
        <button type="button" className={styles.play} onClick={pauseVideo} aria-label={`Pause video preview for ${record.title}`}>
          <span aria-hidden>Ⅱ</span>
        </button>
      ) : null}
    </div>
  );
}
