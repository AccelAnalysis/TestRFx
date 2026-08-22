"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExchangeCardPlacement, ExchangeCardStatus, ExchangeLensIconId, ExchangeRecord } from "@/lib/exchange/contracts";
import type { ResolvedExchangeCardMedia } from "@/lib/exchange/card-presentation";
import { buildApprovedVideoEmbedUrl } from "@/lib/media/approved-video";
import { ExchangeIcon } from "./exchange-nav-icon";
import styles from "./card-media.module.css";

type ActiveExchangeCardPlayback = { key: string; stop: () => void };
let activeExchangeCardPlayback: ActiveExchangeCardPlayback | null = null;

const fallbackIcon: Record<ExchangeRecord["type"], ExchangeLensIconId> = {
  rfx: "opportunity-document",
  resource: "resource-ecosystem",
  intelligence: "intelligence-signal",
  capability: "capability-stack",
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

function pauseElement(video?: HTMLVideoElement | null) {
  if (!video) return;
  try { video.pause(); } catch {}
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

  const externalEmbedUrl = useMemo(() => {
    if (media.kind !== "video" || !media.videoProvider || !media.providerVideoId) return undefined;
    if (media.videoProvider !== "youtube" && media.videoProvider !== "vimeo") return undefined;
    return buildApprovedVideoEmbedUrl(media.videoProvider, media.providerVideoId);
  }, [media.kind, media.providerVideoId, media.videoProvider]);
  const playbackKey = `${record.id}:${media.videoProvider ?? "hosted"}:${media.providerVideoId ?? media.videoSrc ?? "video"}`;
  const visualSrc = media.kind === "video" ? (media.poster ?? media.src) : media.src;
  const directVideo = media.kind === "video" && Boolean(media.videoSrc);
  const playableVideo = media.kind === "video" && Boolean((directVideo || externalEmbedUrl) && !mediaFailed);
  const showFallback = media.fallback || mediaFailed || !visualSrc;

  function stopPlayback() {
    pauseElement(videoRef.current);
    setPlaying(false);
    if (activeExchangeCardPlayback?.key === playbackKey) activeExchangeCardPlayback = null;
  }

  useEffect(() => {
    if (!playing) return;
    if (activeExchangeCardPlayback && activeExchangeCardPlayback.key !== playbackKey) activeExchangeCardPlayback.stop();
    activeExchangeCardPlayback = { key: playbackKey, stop: stopPlayback };

    if (directVideo) {
      const video = videoRef.current;
      if (!video) return;
      video.muted = true;
      void video.play().catch(() => {
        stopPlayback();
        setMediaFailed(true);
      });
    }
  }, [directVideo, playbackKey, playing]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.28)) stopPlayback();
    }, { threshold: [0, 0.28, 0.6] });
    observer.observe(root);
    return () => observer.disconnect();
  }, [playbackKey]);

  useEffect(() => () => stopPlayback(), [playbackKey]);

  function failMedia() {
    stopPlayback();
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

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-media-kind={media.kind}
      data-media-fallback={showFallback ? "true" : "false"}
      data-video-playing={playing ? "true" : "false"}
    >
      {playing && externalEmbedUrl ? (
        <div className={styles.embedFrame}>
          <iframe
            src={externalEmbedUrl}
            title={media.alt || `${record.title} video`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <button
          type="button"
          className={styles.open}
          onClick={openRecord}
          onFocus={onSelect}
          aria-label={`Open ${record.title} details`}
        >
          {playing && directVideo ? (
            <video
              ref={videoRef}
              className={styles.visual}
              src={media.videoSrc}
              poster={visualSrc}
              muted
              playsInline
              preload="none"
              onEnded={stopPlayback}
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
              <span className={styles.fallbackGlyph}>
                <ExchangeIcon icon={fallbackIcon[record.type]} size={52} strokeWidth={1.7} />
              </span>
              <span className={styles.fallbackLabel}>{media.label}</span>
            </span>
          )}
        </button>
      )}

      <div className={styles.topBadges}>
        {status ? <span className={`${styles.status} ${statusTone[status.tone ?? "neutral"]}`}>{status.label}</span> : null}
        {placement !== "organic" ? <span className={styles.placement}>{placement === "sponsored" ? "Sponsored" : "Featured"}</span> : null}
      </div>

      {media.kind === "video" ? <span className={styles.mediaKind}>Video</span> : media.kind === "visualization" ? <span className={styles.mediaKind}>Insight visual</span> : null}

      {playableVideo && !playing ? (
        <button type="button" className={styles.play} onClick={startVideo} aria-label={`Play video preview for ${record.title}`}>
          <span aria-hidden>▶</span>
        </button>
      ) : null}
      {playing ? (
        <button type="button" className={styles.play} onClick={stopPlayback} aria-label={`Pause video preview for ${record.title}`}>
          <span aria-hidden>Ⅱ</span>
        </button>
      ) : null}
    </div>
  );
}
