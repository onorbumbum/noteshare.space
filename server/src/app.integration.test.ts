import app from "./app";
import request from "supertest";
import { describe, it, expect } from "vitest";
import prisma from "./client";

const testNote = {
  ciphertext: "sample_ciphertext",
  hmac: "sample_hmac",
};

describe("GET /api/test", () => {
  it('should respond "Hello world!"', async () => {
    const res = await request(app).get("/api/test");
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe("Hello world!");
  });
});

describe("GET /api/note", () => {
  it("returns a note for valid ID", async () => {
    // Insert a note
    const { id } = await prisma.encryptedNote.create({
      data: testNote,
    });

    // Make get request
    const res = await request(app).get(`/api/note/${id}`);

    // Validate returned note
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("expire_time");
    expect(res.body).toHaveProperty("insert_time");
    expect(res.body).toHaveProperty("ciphertext");
    expect(res.body).toHaveProperty("hmac");
    expect(res.body.id).toEqual(id);
    expect(res.body.ciphertext).toEqual(testNote.ciphertext);
    expect(res.body.hmac).toEqual(testNote.hmac);
  });

  it("responds 404 for invalid ID", async () => {
    // Insert a note
    // Make get request
    const res = await request(app).get(`/api/note/NaN`);

    // Validate returned note
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/note", () => {
  it("returns a view_url on correct POST body", async () => {
    const res = await request(app).post("/api/note").send(testNote);
    expect(res.statusCode).toBe(200);

    // Returned body has correct fields
    expect(res.body).toHaveProperty("expire_time");
    expect(res.body).toHaveProperty("view_url");

    // View URL is properly formed
    expect(res.body.view_url).toMatch(/^http[s]?:\/\//);

    // A future expiry date is assigned
    expect(new Date(res.body.expire_time).getTime()).toBeGreaterThan(
      new Date().getTime()
    );
  });

  it("returns a valid view_url on correct POST body", async () => {
    // Make post request
    let res = await request(app).post("/api/note").send(testNote);

    // Extract note id from post response
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("view_url");
    const match = (res.body.view_url as string).match(/note\/(.+)$/);
    expect(match).not.toBeNull();
    expect(match).toHaveLength(2);
    const note_id = (match as RegExpMatchArray)[1];

    // Make get request
    res = await request(app).get(`/api/note/${note_id}`);

    // Validate returned note
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("expire_time");
    expect(res.body).toHaveProperty("insert_time");
    expect(res.body).toHaveProperty("ciphertext");
    expect(res.body).toHaveProperty("hmac");
    expect(res.body.id).toEqual(note_id);
    expect(res.body.ciphertext).toEqual(testNote.ciphertext);
    expect(res.body.hmac).toEqual(testNote.hmac);
  });
});
