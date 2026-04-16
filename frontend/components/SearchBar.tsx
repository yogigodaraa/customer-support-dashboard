"use client";

import { useState } from "react";

interface SearchBarProps {
  onSearch: (email?: string, userId?: string) => void;
  isLoading: boolean;
}

export default function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [searchType, setSearchType] = useState<"email" | "userId">("email");
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchType === "email") {
      onSearch(query, undefined);
    } else {
      onSearch(undefined, query);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            value="email"
            checked={searchType === "email"}
            onChange={(e) => setSearchType(e.target.value as "email")}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-gray-700">Search by Email</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            value="userId"
            checked={searchType === "userId"}
            onChange={(e) => setSearchType(e.target.value as "userId")}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-gray-700">Search by User ID</span>
        </label>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder={
            searchType === "email"
              ? "Enter user email..."
              : "Enter user ID..."
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !query}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </div>
    </form>
  );
}
