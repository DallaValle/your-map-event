"use client";

import { useState } from "react";
import { UploadButton } from "@/lib/uploadthing";
import "@uploadthing/react/styles.css";

/**
 * Image input that adapts to the deployment: with an UploadThing token the
 * admin gets a real upload button; without one (e.g. fresh local setup) it
 * degrades to a plain URL field so the app stays fully usable.
 *
 * The resolved URL is exposed through a hidden input so the surrounding
 * <form> can submit it to a server action like any other field.
 */
export function ImageField({
  name,
  label,
  endpoint,
  uploadsEnabled,
  defaultValue,
}: {
  name: string;
  label: string;
  endpoint: "teamLogo" | "poiImage";
  uploadsEnabled: boolean;
  defaultValue?: string | null;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>

      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Preview"
          className="h-28 w-full rounded-xl border border-black/10 object-cover dark:border-white/15"
        />
      )}

      {uploadsEnabled ? (
        <>
          <input type="hidden" name={name} value={url} />
          <UploadButton
            endpoint={endpoint}
            onClientUploadComplete={(res) => {
              setError(null);
              if (res[0]) setUrl(res[0].ufsUrl);
            }}
            onUploadError={(e) => setError(e.message)}
            appearance={{
              button:
                "ut-ready:bg-teal-700 ut-uploading:bg-teal-700/60 w-full rounded-xl py-3 text-sm font-semibold",
              allowedContent: "text-xs opacity-60",
            }}
          />
        </>
      ) : (
        <input
          name={name}
          type="url"
          inputMode="url"
          placeholder="https://… (image URL)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
        />
      )}

      {url && (
        <button
          type="button"
          onClick={() => setUrl("")}
          className="self-start text-sm font-medium text-red-600 dark:text-red-400"
        >
          Remove image
        </button>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
