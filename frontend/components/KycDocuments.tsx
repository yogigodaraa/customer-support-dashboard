"use client";

import { useRef, useState, useCallback, DragEvent, ChangeEvent } from "react";
import axios from "axios";
import { useToast } from "./Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const DOC_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "utility_bill", label: "Utility Bill" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "selfie", label: "Selfie" },
  { value: "other", label: "Other" },
] as const;

type DocTypeValue = (typeof DOC_TYPES)[number]["value"];

interface KycDocument {
  id: string;
  caseId: string;
  type: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  status: "pending" | "accepted" | "rejected";
  reviewNote: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
}

interface KycDocumentsProps {
  caseId: string;
  documents: KycDocument[];
  canWrite: boolean;
  onChanged?: () => void;
}

function isImage(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/webp"].includes(mimeType);
}

function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

function formatDocType(type: string): string {
  const found = DOC_TYPES.find((d) => d.value === type);
  if (found) return found.label;
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_BADGE: Record<KycDocument["status"], string> = {
  pending: "bg-gray-100 text-gray-600",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

const STATUS_LABEL: Record<KycDocument["status"], string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
};

interface LightboxState {
  storagePath: string;
  mimeType: string;
  fileName: string;
}

interface ReviewState {
  docId: string;
  action: "reject";
  note: string;
  submitting: boolean;
}

export default function KycDocuments({
  caseId,
  documents,
  canWrite,
  onChanged,
}: KycDocumentsProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocTypeValue>("passport");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      const MAX_BYTES = 10 * 1024 * 1024;
      const ALLOWED = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ];
      if (!ALLOWED.includes(file.type)) {
        toast("Unsupported file type. Use JPEG, PNG, WebP, or PDF.", "error");
        return;
      }
      if (file.size > MAX_BYTES) {
        toast("File exceeds the 10 MB limit.", "error");
        return;
      }
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("type", docType);
        await axios.post(`${API}/api/kyc/cases/${caseId}/documents`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast("Document uploaded");
        onChanged?.();
      } catch {
        toast("Upload failed", "error");
      } finally {
        setUploading(false);
      }
    },
    [caseId, docType, onChanged, toast]
  );

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  async function acceptDoc(docId: string) {
    if (acceptingId) return;
    setAcceptingId(docId);
    try {
      await axios.patch(
        `${API}/api/kyc/cases/${caseId}/documents/${docId}`,
        { status: "accepted", reviewNote: null }
      );
      toast("Document accepted");
      onChanged?.();
    } catch {
      toast("Failed to accept document", "error");
    } finally {
      setAcceptingId(null);
    }
  }

  async function submitReject() {
    if (!review || review.submitting) return;
    setReview((r) => r && { ...r, submitting: true });
    try {
      await axios.patch(
        `${API}/api/kyc/cases/${caseId}/documents/${review.docId}`,
        { status: "rejected", reviewNote: review.note || null }
      );
      toast("Document rejected");
      setReview(null);
      onChanged?.();
    } catch {
      toast("Failed to reject document", "error");
      setReview((r) => r && { ...r, submitting: false });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Upload zone */}
      {canWrite && (
        <div className="flex flex-col gap-2">
          {/* Type selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">
              Document type
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocTypeValue)}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 px-4 cursor-pointer transition select-none ${
              dragging
                ? "border-blue-400 bg-blue-50"
                : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
            } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
          >
            {uploading ? (
              <>
                <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-500">Uploading…</span>
              </>
            ) : (
              <>
                {/* Paperclip icon */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-7 h-7 text-gray-400"
                >
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
                <p className="text-xs text-gray-500">
                  Drag a file here or{" "}
                  <span className="text-blue-600 font-medium">click to upload</span>
                </p>
                <p className="text-[10px] text-gray-400">
                  JPEG, PNG, WebP, PDF — up to 10 MB
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* Document grid */}
      {documents.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No documents uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {documents.map((doc) => {
            const isImg = isImage(doc.mimeType);
            const isPDF = isPdf(doc.mimeType);
            const isRejectingThis =
              review?.docId === doc.id && review.action === "reject";

            return (
              <div
                key={doc.id}
                className="flex flex-col border border-gray-200 rounded-xl overflow-hidden bg-white"
              >
                {/* Thumbnail */}
                <div
                  className="relative cursor-pointer"
                  onClick={() =>
                    setLightbox({
                      storagePath: doc.storagePath,
                      mimeType: doc.mimeType,
                      fileName: doc.fileName,
                    })
                  }
                >
                  {isImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API}/uploads/kyc/${doc.storagePath}`}
                      alt={doc.fileName}
                      className="w-full h-32 object-cover"
                    />
                  ) : isPDF ? (
                    <div className="w-full h-32 flex items-center justify-center bg-gray-100">
                      <span className="text-4xl select-none">📄</span>
                    </div>
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-gray-100">
                      <span className="text-4xl select-none">📎</span>
                    </div>
                  )}
                  {/* Hover overlay hint */}
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition flex items-center justify-center">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-6 h-6 opacity-0 hover:opacity-100 transition"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                  </div>
                </div>

                {/* Card body */}
                <div className="flex flex-col gap-1.5 p-2.5">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-medium text-gray-700 leading-tight truncate">
                      {formatDocType(doc.type)}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                        STATUS_BADGE[doc.status]
                      }`}
                    >
                      {STATUS_LABEL[doc.status]}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 truncate" title={doc.fileName}>
                    {doc.fileName}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {formatBytes(doc.fileSize)} · {relativeTime(doc.uploadedAt)}
                  </p>
                  {doc.reviewNote && (
                    <p className="text-[10px] text-gray-500 italic border-t border-gray-100 pt-1 line-clamp-2">
                      {doc.reviewNote}
                    </p>
                  )}

                  {/* Review actions */}
                  {canWrite && doc.status === "pending" && (
                    <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-2 mt-0.5">
                      {!isRejectingThis ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={acceptingId === doc.id}
                            onClick={() => acceptDoc(doc.id)}
                            className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg py-1 transition disabled:opacity-50"
                          >
                            {acceptingId === doc.id ? (
                              <span className="w-3 h-3 border border-green-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              "✓"
                            )}{" "}
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setReview({
                                docId: doc.id,
                                action: "reject",
                                note: "",
                                submitting: false,
                              })
                            }
                            className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg py-1 transition"
                          >
                            ✗ Reject
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <textarea
                            rows={2}
                            placeholder="Review note (optional)"
                            value={review.note}
                            onChange={(e) =>
                              setReview((r) => r && { ...r, note: e.target.value })
                            }
                            className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                          />
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setReview(null)}
                              className="flex-1 text-[11px] text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg py-1 transition"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={review.submitting}
                              onClick={submitReject}
                              className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg py-1 transition disabled:opacity-50"
                            >
                              {review.submitting && (
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              )}
                              Confirm
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-lg transition z-10"
            aria-label="Close lightbox"
          >
            ✕
          </button>

          {/* Content — stop propagation so clicking content doesn't close */}
          <div
            className="max-w-4xl w-full mx-4 max-h-screen flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {isImage(lightbox.mimeType) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${API}/uploads/kyc/${lightbox.storagePath}`}
                alt={lightbox.fileName}
                className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
              />
            ) : isPdf(lightbox.mimeType) ? (
              <iframe
                src={`${API}/uploads/kyc/${lightbox.storagePath}`}
                title={lightbox.fileName}
                className="w-full h-[88vh] rounded-xl bg-white"
              />
            ) : (
              <div className="flex flex-col items-center gap-4 text-white">
                <span className="text-6xl">📎</span>
                <p className="text-sm">{lightbox.fileName}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
