"use client";

import { useEffect, useRef, useState } from "react";

export interface FileItem {
  url: string;           // authenticated blob URL or direct URL
  filename: string;
  mimeType: string;
  size?: number;         // bytes
}

interface Props {
  file: FileItem;
  onClose: () => void;
  /** Called when user clicks "Download" */
  onDownload?: () => void;
}

function fmt(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv")) return "📊";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar")) return "🗜️";
  return "📎";
}

function isImage(m: string) { return m.startsWith("image/"); }
function isVideo(m: string) { return m.startsWith("video/"); }
function isAudio(m: string) { return m.startsWith("audio/"); }
function isPdf(m: string)   { return m === "application/pdf"; }

export default function FileViewer({ file, onClose, onDownload }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [imgError, setImgError] = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  function download() {
    if (onDownload) { onDownload(); return; }
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.filename;
    a.click();
  }

  const canPreview = (isImage(file.mimeType) && !imgError) || isVideo(file.mimeType) || isAudio(file.mimeType) || isPdf(file.mimeType);

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
    >
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900/90 border-b border-white/10 flex-shrink-0">
        <span className="text-xl">{fileIcon(file.mimeType)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{file.filename}</p>
          {file.size && <p className="text-xs text-gray-400">{fmt(file.size)}</p>}
        </div>
        <button
          onClick={download}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex-shrink-0"
        >
          ↓ Download
        </button>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition flex-shrink-0"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-4">
        {isImage(file.mimeType) && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={file.filename}
            onError={() => setImgError(true)}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        ) : isVideo(file.mimeType) ? (
          <video
            src={file.url}
            controls
            autoPlay={false}
            className="max-w-full max-h-full rounded-lg shadow-2xl"
          >
            Your browser does not support video playback.
          </video>
        ) : isAudio(file.mimeType) ? (
          <div className="bg-gray-800 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
            <span className="text-6xl">🎵</span>
            <p className="text-white font-medium">{file.filename}</p>
            <audio src={file.url} controls className="w-80" />
          </div>
        ) : isPdf(file.mimeType) ? (
          <iframe
            src={`${file.url}#toolbar=1&navpanes=0`}
            className="w-full h-full max-w-4xl rounded-lg shadow-2xl bg-white"
            title={file.filename}
          />
        ) : (
          /* Generic — can't preview, offer download */
          <div className="bg-gray-800 rounded-2xl p-10 flex flex-col items-center gap-4 shadow-2xl text-center">
            <span className="text-7xl">{fileIcon(file.mimeType)}</span>
            <p className="text-white font-semibold text-lg">{file.filename}</p>
            {file.size && <p className="text-gray-400 text-sm">{fmt(file.size)}</p>}
            <p className="text-gray-500 text-sm">Preview not available for this file type</p>
            <button
              onClick={download}
              className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition"
            >
              ↓ Download file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
