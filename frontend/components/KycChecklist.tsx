"use client";

import { useState } from "react";
import axios from "axios";
import { useToast } from "./Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type ChecklistValue = boolean | null;

interface ChecklistState {
  id_verified: ChecklistValue;
  address_verified: ChecklistValue;
  face_match: ChecklistValue;
}

interface KycChecklistProps {
  caseId: string;
  checklist: ChecklistState | null;
  canWrite: boolean;
  onChanged?: (updated: Record<string, boolean | null>) => void;
}

type ChecklistKey = keyof ChecklistState;

const ITEMS: { key: ChecklistKey; label: string }[] = [
  { key: "id_verified", label: "ID Document" },
  { key: "address_verified", label: "Address Verified" },
  { key: "face_match", label: "Face Match" },
];

function cycleValue(current: ChecklistValue): ChecklistValue {
  if (current === null) return true;
  if (current === true) return false;
  return null;
}

function StateIcon({ value }: { value: ChecklistValue }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex-shrink-0">
        ✓
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex-shrink-0">
        ✗
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-gray-300 bg-white flex-shrink-0" />
  );
}

export default function KycChecklist({
  caseId,
  checklist,
  canWrite,
  onChanged,
}: KycChecklistProps) {
  const { toast } = useToast();

  // Local optimistic state
  const [localChecklist, setLocalChecklist] = useState<ChecklistState>({
    id_verified: checklist?.id_verified ?? null,
    address_verified: checklist?.address_verified ?? null,
    face_match: checklist?.face_match ?? null,
  });
  const [updatingKey, setUpdatingKey] = useState<ChecklistKey | null>(null);

  async function handleToggle(key: ChecklistKey) {
    if (!canWrite || updatingKey) return;
    const nextValue = cycleValue(localChecklist[key]);
    const optimistic = { ...localChecklist, [key]: nextValue };
    setLocalChecklist(optimistic);
    setUpdatingKey(key);
    try {
      const res = await axios.patch(
        `${API}/api/kyc/cases/${caseId}/checklist`,
        { [key]: nextValue }
      );
      const updated: ChecklistState = res.data ?? optimistic;
      setLocalChecklist({
        id_verified: updated.id_verified ?? null,
        address_verified: updated.address_verified ?? null,
        face_match: updated.face_match ?? null,
      });
      onChanged?.({
        id_verified: updated.id_verified ?? null,
        address_verified: updated.address_verified ?? null,
        face_match: updated.face_match ?? null,
      });
    } catch {
      // Roll back
      setLocalChecklist((prev) => ({ ...prev, [key]: localChecklist[key] }));
      toast("Failed to update checklist", "error");
    } finally {
      setUpdatingKey(null);
    }
  }

  const trueCount = Object.values(localChecklist).filter((v) => v === true).length;
  const total = ITEMS.length;
  const allVerified = trueCount === total;

  return (
    <div className="flex flex-col gap-2">
      {/* Rows */}
      <div className="flex flex-col gap-1">
        {ITEMS.map(({ key, label }) => {
          const value = localChecklist[key];
          const isUpdating = updatingKey === key;
          return (
            <div key={key} className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={!canWrite || !!updatingKey}
                onClick={() => handleToggle(key)}
                className={`flex items-center gap-2.5 flex-1 rounded-lg px-2.5 py-1.5 transition text-left ${
                  canWrite && !updatingKey
                    ? "hover:bg-gray-50 cursor-pointer"
                    : "cursor-default"
                }`}
                aria-label={`Toggle ${label}`}
              >
                {isUpdating ? (
                  <span className="inline-flex items-center justify-center w-6 h-6 flex-shrink-0">
                    <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  </span>
                ) : (
                  <StateIcon value={value} />
                )}
                <span
                  className={`text-sm ${
                    value === true
                      ? "text-green-700 font-medium"
                      : value === false
                      ? "text-red-600 font-medium"
                      : "text-gray-600"
                  }`}
                >
                  {label}
                </span>
                {value === null && (
                  <span className="ml-auto text-[10px] text-gray-400">Unset</span>
                )}
                {value === true && (
                  <span className="ml-auto text-[10px] text-green-600 font-medium">
                    Verified
                  </span>
                )}
                {value === false && (
                  <span className="ml-auto text-[10px] text-red-500 font-medium">
                    Failed
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
          allVerified
            ? "bg-green-50 border-green-200 text-green-700"
            : "bg-gray-50 border-gray-200 text-gray-500"
        }`}
      >
        {allVerified ? (
          <>
            <span className="text-green-600">✓</span>
            <span>All verified</span>
          </>
        ) : (
          <>
            <span
              className={`font-bold ${
                trueCount > 0 ? "text-gray-700" : "text-gray-400"
              }`}
            >
              {trueCount} / {total}
            </span>
            <span>verified</span>
          </>
        )}
      </div>
    </div>
  );
}
