import request from "supertest";
import { createTestApp } from "../helpers/createApp.js";
import { generateTestToken } from "../helpers/auth.js";

const app = createTestApp();

describe("requireAuth middleware", () => {
  it("returns 401 when no Authorization header is provided", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("returns 401 when token format is invalid", async () => {
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "InvalidFormat token123");
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is expired or invalid", async () => {
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer invalid.token.here");
    expect(res.status).toBe(401);
  });

  it("attaches user to request with valid token", async () => {
    const token = generateTestToken({ email: "alice@test.com", role: "agent" });
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe("alice@test.com");
    expect(res.body.user.role).toBe("agent");
  });
});

describe("requireRole middleware", () => {
  it("returns 403 when user role is not admin", async () => {
    const token = generateTestToken({ role: "agent" });
    const res = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");
  });

  it("allows access when user role is admin", async () => {
    const token = generateTestToken({ role: "admin" });
    const res = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe("requireWriteAccess middleware", () => {
  it("allows GET requests for viewers", async () => {
    const token = generateTestToken({ role: "viewer" });
    const res = await request(app)
      .get("/write-test")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("blocks POST requests for viewers", async () => {
    const token = generateTestToken({ role: "viewer" });
    const res = await request(app)
      .post("/write-test")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("read-only");
  });

  it("allows POST requests for agents", async () => {
    const token = generateTestToken({ role: "agent" });
    const res = await request(app)
      .post("/write-test")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
  });

  it("allows POST requests for admins", async () => {
    const token = generateTestToken({ role: "admin" });
    const res = await request(app)
      .post("/write-test")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
  });
});
