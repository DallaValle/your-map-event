"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Always-on poster QR for the published map URL. ShareCard already has a
 * toggle QR; this one is meant to print (badges, flyers) without extra clicks.
 */
export function PosterShareAsset({
  path,
  eventName,
  published,
}: {
  path: string;
  eventName: string;
  published: boolean;
}) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    const nextUrl = `${window.location.origin}/${path}`;
    setUrl(nextUrl);
    let cancelled = false;
    QRCode.toDataURL(nextUrl, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "H",
    }).then((dataUrl) => {
      if (!cancelled) setQr(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-black/10 p-5 dark:border-white/15">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Poster QR
        </h2>
        <p className="mt-0.5 text-sm opacity-60">
          {published
            ? "Print this on badges and flyers. It opens the published map."
            : "The QR is ready. It goes live when you publish the map."}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-xl bg-black/[.03] p-4 dark:bg-white/5">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt={`Poster QR for ${eventName}`}
            className="size-52 rounded-lg bg-white p-2"
          />
        ) : (
          <div
            className="size-52 animate-pulse rounded-lg bg-black/10 dark:bg-white/10"
            aria-hidden
          />
        )}
        <p className="text-center text-sm font-semibold">{eventName}</p>
        <code className="max-w-full truncate text-xs opacity-60">
          {url || `…/${path}`}
        </code>
        {qr && (
          <a
            href={qr}
            download={`${path.replace(/\//g, "-")}-poster-qr.png`}
            className="text-sm font-semibold text-teal-700 dark:text-teal-400"
          >
            Download poster PNG
          </a>
        )}
      </div>
    </section>
  );
}
