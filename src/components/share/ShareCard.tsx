"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Makes the attendee-facing URL impossible to miss and one-tap shareable:
 * copy, QR code (screen + downloadable PNG for posters), native share sheet,
 * and direct links to the common socials/messengers.
 */
export function ShareCard({
  slug,
  teamName,
  published,
}: {
  slug: string;
  teamName: string;
  published: boolean;
}) {
  // window.location is unavailable during SSR/prerender — resolve on mount.
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/${slug}`);
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, [slug]);

  async function toggleQr() {
    if (qr) {
      setQr(null);
      return;
    }
    // High error-correction + generous size so printed posters scan well.
    setQr(
      await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: "H",
      }),
    );
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const text = `${teamName} — event map`;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);

  const socials = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodedText}%20${encodedUrl}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
    { label: "Email", href: `mailto:?subject=${encodedText}&body=${encodedText}%0A${encodedUrl}` },
  ];

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-teal-700/30 bg-teal-700/5 p-4">
      <div>
        <h2 className="text-sm font-bold">
          📢 Attendees open your map here{published ? "" : " (once published)"}
        </h2>
        {!published && (
          <p className="mt-0.5 text-xs opacity-60">
            The link goes live as soon as you publish a map.
          </p>
        )}
      </div>

      <div className="flex items-stretch gap-2">
        <code className="flex min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap rounded-xl bg-white px-3 py-2.5 text-sm font-semibold dark:bg-neutral-900">
          {url || `…/${slug}`}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white active:scale-95"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleQr}
          className="rounded-xl border border-teal-700/40 px-4 py-2.5 text-sm font-semibold text-teal-700 dark:text-teal-400"
        >
          {qr ? "Hide QR code" : "⊞ QR code"}
        </button>
        {canNativeShare && (
          <button
            type="button"
            onClick={() => navigator.share({ title: text, url }).catch(() => {})}
            className="rounded-xl border border-teal-700/40 px-4 py-2.5 text-sm font-semibold text-teal-700 dark:text-teal-400"
          >
            ↗ Share…
          </button>
        )}
      </div>

      {qr && (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 dark:bg-neutral-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR code for ${url}`} className="size-52 rounded-lg" />
          <a
            href={qr}
            download={`${slug}-map-qr.png`}
            className="text-sm font-semibold text-teal-700 dark:text-teal-400"
          >
            ⬇ Download PNG (for posters & badges)
          </a>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {socials.map((social) => (
          <a
            key={social.label}
            href={social.href}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-white px-3.5 py-2 text-xs font-semibold shadow-sm dark:bg-neutral-900"
          >
            {social.label}
          </a>
        ))}
      </div>
    </section>
  );
}
