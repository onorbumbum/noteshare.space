import { EncryptedNote } from "@prisma/client";
import { describe, it, expect } from "vitest";
import { getEmbed } from "./embed.dao";
import { createNote, deleteNotes, getExpiredNotes, getNote } from "./note.dao";
import prisma from "./client";

const VALID_CIPHERTEXT = Buffer.from("sample_ciphertext").toString("base64");
const VALID_HMAC = Buffer.from("sample_hmac").toString("base64");

const VALID_NOTE = {
  ciphertext: VALID_CIPHERTEXT,
  hmac: VALID_HMAC,
  crypto_version: "v2",
  expire_time: new Date(),
} as EncryptedNote;

const VALID_EMBED = {
  embed_id: "embed_id",
  hmac: VALID_HMAC,
  ciphertext: VALID_CIPHERTEXT,
};

describe("Writes and reads", () => {
  it("should write a new note", async () => {
    const res = await createNote(VALID_NOTE);
    expect(res.id).not.toBeNull();
    expect(res.id.length).toBeGreaterThan(0);
    expect(res.ciphertext).toStrictEqual(VALID_NOTE.ciphertext);
    expect(res.hmac).toStrictEqual(VALID_NOTE.hmac);
    expect(res.crypto_version).toStrictEqual(VALID_NOTE.crypto_version);
    expect(res.expire_time).toStrictEqual(VALID_NOTE.expire_time);
    expect(res.insert_time).not.toBeNull();
    expect(res.insert_time.getTime()).toBeLessThanOrEqual(new Date().getTime());
  });

  it("should write a new note with one embed", async () => {
    const res = await createNote(VALID_NOTE, [VALID_EMBED]);
    expect(res.id).not.toBeNull();

    const res2 = await getEmbed(res.id, VALID_EMBED.embed_id);
    expect(res2).not.toBeNull();
    expect(res2?.ciphertext).toStrictEqual(VALID_EMBED.ciphertext);
    expect(res2?.hmac).toStrictEqual(VALID_EMBED.hmac);
  });

  it("should write a new note with multiple embeds", async () => {
    const res = await createNote(VALID_NOTE, [
      VALID_EMBED,
      { ...VALID_EMBED, embed_id: "embed_id2" },
    ]);
    expect(res.id).not.toBeNull();

    const res2 = await getEmbed(res.id, VALID_EMBED.embed_id);
    expect(res2?.embed_id).toStrictEqual(VALID_EMBED.embed_id);

    const res3 = await getEmbed(res.id, "embed_id2");
    expect(res3?.embed_id).toStrictEqual("embed_id2");
  }),
    it("should fail writing a new note with duplicate embed_ids", async () => {
      await expect(
        createNote(VALID_NOTE, [VALID_EMBED, VALID_EMBED])
      ).rejects.toThrowError();
    });

  it("should roll back a failed note with embeds", async () => {
    const noteCount = (await prisma.encryptedNote.findMany())?.length;
    const embedCount = (await prisma.encryptedEmbed.findMany())?.length;

    await expect(
      createNote({ ...VALID_NOTE }, [VALID_EMBED, VALID_EMBED])
    ).rejects.toThrowError();

    const noteCountAfter = (await prisma.encryptedNote.findMany())?.length;
    const embedCountAfter = (await prisma.encryptedEmbed.findMany())?.length;

    expect(noteCountAfter).toStrictEqual(noteCount);
    expect(embedCountAfter).toStrictEqual(embedCount);
  });

  it("should find an existing note by id", async () => {
    const note = await createNote(VALID_NOTE);
    const res = await getNote(note.id);
    expect(res).not.toBeNull();
    expect(res).toMatchObject(note);
  });

  it("should not find a non-existing note by id", async () => {
    const res = await getNote("non-existing-id");
    expect(res).toBeNull();
  });

  it("should properly delete notes", async () => {
    const note = await createNote(VALID_NOTE);
    const res = await getNote(note.id);
    expect(res).not.toBeNull();
    const res2 = await deleteNotes([note.id]);
    expect(res2).toBe(1);
    const res3 = await getNote(note.id);
    expect(res3).toBeNull();
  });

  it("should return expired notes", async () => {
    const expiredNote = await createNote({
      ...VALID_NOTE,
      expire_time: new Date(0),
    });
    const freshNote = await createNote({
      ...VALID_NOTE,
      expire_time: new Date(Date.now() + 1000),
    });
    const res = await getExpiredNotes();
    expect(res).toContainEqual(expiredNote);
    expect(res).not.toContainEqual(freshNote);
  });
});
