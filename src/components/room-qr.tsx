"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Room-specific join QR (PRD §5). Rendered large enough to read from a
 * classroom smartboard — we use a high error-correction level so a smudged
 * screen or an angle still scans.
 */
export function RoomQr({
  url,
  size = 260,
  className,
}: {
  url: string;
  size?: number;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const failed = failedUrl === url;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#221812", light: "#ffffff" },
    })
      .then((d) => {
        if (!cancelled) {
          setDataUrl(d);
          setFailedUrl(null);
        }
      })
      .catch(() => {
        if (!cancelled) setFailedUrl(url);
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (failed) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-label="QR code unavailable"
      >
        <a
          href={url}
          className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-4 text-center text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="font-semibold text-foreground">QR unavailable</span>
          <span className="break-all">{url}</span>
        </a>
      </div>
    );
  }

  return (
    <div className={className} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl ?? undefined}
        alt={`Scan to join ${url}`}
        width={size}
        height={size}
        className="h-full w-full rounded-2xl bg-white object-contain p-1 shadow-[0_8px_30px_-12px_rgba(34,24,18,0.45)]"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
