"use client";

import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface IntegrationStatus {
  [key: string]: {
    status: "success" | "failed" | "pending";
    lastSync?: string;
    nextSync?: string;
    message?: string;
  };
}

export default function IntegrationStatus() {
  const [status, setStatus] = useState<IntegrationStatus>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/integrations/status`);
        setStatus(response.data);
      } catch (error) {
        console.error("Failed to fetch status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const integrations = [
    { name: "Email", key: "gmail", icon: "📧" },
    { name: "Intercom", key: "intercom", icon: "💬" },
    { name: "Luciq", key: "luciq", icon: "🐛" },
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Integration Status</h3>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => {
            const intStatus = status[integration.key];
            const isConnected = intStatus?.status === "success";

            return (
              <div
                key={integration.key}
                className="p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{integration.icon}</span>
                    <span className="font-medium text-gray-900">
                      {integration.name}
                    </span>
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isConnected ? "bg-green-500" : "bg-red-500"
                    }`}
                  ></div>
                </div>

                {intStatus && (
                  <div className="mt-2 text-xs text-gray-600 space-y-1">
                    <p>
                      Status: <span className="font-medium">{intStatus.status}</span>
                    </p>
                    {intStatus.lastSync && (
                      <p>
                        Last sync:{" "}
                        <span className="font-medium">
                          {new Date(intStatus.lastSync).toLocaleTimeString()}
                        </span>
                      </p>
                    )}
                    {intStatus.message && (
                      <p className="text-gray-500">{intStatus.message}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
