"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useCanWrite } from "@/components/RoleGate";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Template {
  id: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

type PanelMode = "preview" | "edit" | "create" | "empty";

// Render body text with {{variable}} placeholders highlighted
function BodyWithVariables({ text }: { text: string }) {
  const parts = text.split(/({{[^}]+}})/g);
  return (
    <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
      {parts.map((part, i) =>
        /^{{[^}]+}}$/.test(part) ? (
          <span
            key={i}
            className="inline-block bg-blue-100 text-blue-700 text-xs font-mono px-1.5 py-0.5 rounded mx-0.5"
          >
            {part}
          </span>
        ) : (
          part
        )
      )}
    </p>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [panelMode, setPanelMode] = useState<PanelMode>("empty");
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Form state for create/edit
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCategory, setFormCategory] = useState("General");
  const [formSaving, setFormSaving] = useState(false);
  const canWrite = useCanWrite();

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  const fetchTemplates = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (activeCategory !== "All") params.category = activeCategory;
      const res = await axios.get(`${API_BASE}/api/templates`, { params });
      setTemplates(res.data.templates);
      setCategories(res.data.categories);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setIsLoading(false);
    }
  }, [search, activeCategory]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Keep selection valid after filter changes
  useEffect(() => {
    if (selectedId && !templates.find((t) => t.id === selectedId)) {
      setSelectedId(null);
      setPanelMode("empty");
    }
  }, [templates, selectedId]);

  function selectTemplate(t: Template) {
    setSelectedId(t.id);
    setPanelMode("preview");
    setDeleteConfirm(false);
  }

  function openCreate() {
    setSelectedId(null);
    setFormTitle("");
    setFormBody("");
    setFormCategory(activeCategory !== "All" ? activeCategory : "General");
    setPanelMode("create");
    setDeleteConfirm(false);
  }

  function openEdit() {
    if (!selected) return;
    setFormTitle(selected.title);
    setFormBody(selected.body);
    setFormCategory(selected.category);
    setPanelMode("edit");
    setDeleteConfirm(false);
  }

  async function handleSave() {
    if (!formTitle.trim() || !formBody.trim()) return;
    setFormSaving(true);
    try {
      if (panelMode === "create") {
        const res = await axios.post(`${API_BASE}/api/templates`, {
          title: formTitle,
          body: formBody,
          category: formCategory,
        });
        await fetchTemplates();
        setSelectedId(res.data.id);
        setPanelMode("preview");
      } else if (panelMode === "edit" && selected) {
        await axios.put(`${API_BASE}/api/templates/${selected.id}`, {
          title: formTitle,
          body: formBody,
          category: formCategory,
        });
        await fetchTemplates();
        setPanelMode("preview");
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    try {
      await axios.delete(`${API_BASE}/api/templates/${selected.id}`);
      setSelectedId(null);
      setPanelMode("empty");
      setDeleteConfirm(false);
      await fetchTemplates();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  function handleCopy() {
    if (!selected) return;
    navigator.clipboard.writeText(selected.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Group templates by category for the list
  const grouped: Record<string, Template[]> = {};
  for (const t of templates) {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  }

  const CATEGORY_COLORS: Record<string, string> = {
    "ID Verification": "bg-blue-100 text-blue-700",
    Billing: "bg-green-100 text-green-700",
    General: "bg-gray-100 text-gray-600",
  };
  const categoryColor = (cat: string) =>
    CATEGORY_COLORS[cat] ?? "bg-purple-100 text-purple-700";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── LEFT PANEL ── */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-semibold text-gray-900">Templates</h1>
            {canWrite && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition"
            >
              <span className="text-sm">+</span> New
            </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-1 mt-2">
            {["All", ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 text-xs rounded-full font-medium transition ${
                  activeCategory === cat
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              No templates found
            </div>
          ) : activeCategory === "All" ? (
            // Grouped by category
            Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <p className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {cat}
                </p>
                {items.map((t) => (
                  <TemplateListItem
                    key={t.id}
                    template={t}
                    selected={t.id === selectedId}
                    onClick={() => selectTemplate(t)}
                  />
                ))}
              </div>
            ))
          ) : (
            templates.map((t) => (
              <TemplateListItem
                key={t.id}
                template={t}
                selected={t.id === selectedId}
                onClick={() => selectTemplate(t)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {/* EMPTY STATE */}
        {panelMode === "empty" && (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="text-5xl mb-4">📝</div>
            <p className="text-lg font-semibold text-gray-700">Select a template</p>
            <p className="text-sm text-gray-400 mt-1 max-w-xs">
              Choose a template from the list to preview it, or create a new one.
            </p>
            {canWrite && (
            <button
              onClick={openCreate}
              className="mt-5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              + New Template
            </button>
            )}
          </div>
        )}

        {/* PREVIEW */}
        {panelMode === "preview" && selected && (
          <div className="max-w-2xl mx-auto px-6 py-6">
            {/* Title row */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selected.title}</h2>
                <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${categoryColor(selected.category)}`}>
                  {selected.category}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                    copied
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {copied ? "✓ Copied!" : "📋 Copy"}
                </button>
                {canWrite && (<>
                <button
                  onClick={openEdit}
                  className="px-3 py-1.5 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Edit
                </button>
                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="px-3 py-1.5 text-sm font-medium bg-white border border-gray-200 text-red-500 rounded-lg hover:bg-red-50 transition"
                  >
                    Delete
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleDelete}
                      className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="px-3 py-1.5 text-sm font-medium bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                </>)}
              </div>
            </div>

            {/* Body */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <BodyWithVariables text={selected.body} />
            </div>

            {/* Variable legend */}
            {/{{[^}]+}}/.test(selected.body) && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs font-semibold text-blue-700 mb-1">Variables in this template</p>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set([...selected.body.matchAll(/{{([^}]+)}}/g)].map((m) => m[0]))].map((v) => (
                    <span key={v} className="bg-blue-100 text-blue-700 text-xs font-mono px-2 py-0.5 rounded">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 mt-3">
              Last updated {new Date(selected.updatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        )}

        {/* CREATE / EDIT FORM */}
        {canWrite && (panelMode === "create" || panelMode === "edit") && (
          <div className="max-w-2xl mx-auto px-6 py-6">
            <h2 className="text-xl font-bold text-gray-900 mb-5">
              {panelMode === "create" ? "New Template" : "Edit Template"}
            </h2>

            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Driver's License Failed"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <div className="flex gap-2 flex-wrap">
                  {[...categories, "General"].filter((v, i, a) => a.indexOf(v) === i).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                        formCategory === cat
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  <input
                    type="text"
                    placeholder="Or type a new category…"
                    value={categories.includes(formCategory) ? "" : formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-dashed border-gray-300 rounded-full focus:outline-none focus:border-blue-400 w-44"
                  />
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message body
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    Use {"{{variable}}"} for placeholders
                  </span>
                </label>
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder={`Hi {{customer_name}},\n\nYour message here…`}
                  rows={14}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>

              {/* Live variable preview */}
              {/{{[^}]+}}/.test(formBody) && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Detected variables</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...new Set([...formBody.matchAll(/{{([^}]+)}}/g)].map((m) => m[0]))].map((v) => (
                      <span key={v} className="bg-blue-100 text-blue-700 text-xs font-mono px-2 py-0.5 rounded">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={handleSave}
                disabled={formSaving || !formTitle.trim() || !formBody.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {formSaving ? "Saving…" : "Save Template"}
              </button>
              <button
                onClick={() => {
                  if (selected) { setSelectedId(selected.id); setPanelMode("preview"); }
                  else setPanelMode("empty");
                }}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateListItem({
  template,
  selected,
  onClick,
}: {
  template: Template;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-50 transition ${
        selected ? "bg-blue-50 border-l-2 border-l-blue-600" : "hover:bg-gray-50"
      }`}
    >
      <p className={`text-sm font-medium truncate ${selected ? "text-blue-700" : "text-gray-900"}`}>
        {template.title}
      </p>
      <p className="text-xs text-gray-400 truncate mt-0.5">
        {template.body.replace(/\n/g, " ").slice(0, 65)}…
      </p>
    </button>
  );
}
