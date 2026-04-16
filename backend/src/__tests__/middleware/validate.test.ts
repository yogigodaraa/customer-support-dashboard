import request from "supertest";
import { createTestApp } from "../helpers/createApp.js";

const app = createTestApp();

describe("validate middleware", () => {
  it("passes valid body and replaces req.body with parsed data", async () => {
    const res = await request(app)
      .post("/validate-test")
      .send({ name: "Alice", age: 30 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ name: "Alice", age: 30 });
  });

  it("returns 400 with details for invalid body", async () => {
    const res = await request(app)
      .post("/validate-test")
      .send({ name: "", age: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details).toBeDefined();
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/validate-test")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("returns 400 when body has wrong types", async () => {
    const res = await request(app)
      .post("/validate-test")
      .send({ name: 123, age: "not a number" });

    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThanOrEqual(2);
  });
});
