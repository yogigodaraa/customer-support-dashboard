import axios, { AxiosInstance } from "axios";
import logger from "../utils/logger.js";

interface LuciqBug {
  id: string;
  title: string;
  description?: string;
  email?: string;
  status: string;
  createdAt: string;
}

export interface LuciqBugStats {
  open: number;
  inProgress: number;
  newLast7Days: number;
}

class LuciqService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: "https://api.luciq.ai", // Replace with actual Luciq API endpoint
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  async searchByEmail(email: string): Promise<LuciqBug[]> {
    try {
      const response = await this.client.get("/bugs", {
        params: { email, limit: 50 },
      });
      return response.data.results || [];
    } catch (error) {
      logger.error("Luciq API error:", error);
      throw error;
    }
  }

  async searchByUserId(userId: string): Promise<LuciqBug[]> {
    try {
      const response = await this.client.get("/bugs", {
        params: { userId, limit: 50 },
      });
      return response.data.results || [];
    } catch (error) {
      logger.error("Luciq API error:", error);
      throw error;
    }
  }

  async getAllBugs(limit: number = 100): Promise<LuciqBug[]> {
    try {
      const response = await this.client.get("/bugs", { params: { limit } });
      return response.data.results || [];
    } catch (error) {
      logger.error("Luciq API error fetching all bugs:", error);
      return [];
    }
  }

  async getBugStats(): Promise<LuciqBugStats> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [openRes, inProgressRes, recentRes] = await Promise.all([
      this.client.get("/bugs", { params: { status: "open", limit: 1 } }),
      this.client.get("/bugs", { params: { status: "in_progress", limit: 1 } }),
      this.client.get("/bugs", { params: { created_after: sevenDaysAgo, limit: 100 } }),
    ]);

    return {
      open: openRes.data.total ?? openRes.data.results?.length ?? 0,
      inProgress: inProgressRes.data.total ?? inProgressRes.data.results?.length ?? 0,
      newLast7Days: recentRes.data.total ?? recentRes.data.results?.length ?? 0,
    };
  }
}

export default LuciqService;
