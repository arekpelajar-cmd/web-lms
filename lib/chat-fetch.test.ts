import { describe, expect, it } from "vitest";
import { CHAT_SERVICE_ERROR, validateChatResponse } from "@/lib/chat-fetch";

describe("chat response validation", () => {
  it("rejects HTML server errors without exposing the response body", async () => {
    const response = new Response("<html>Internal Server Error</html>", {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });

    await expect(validateChatResponse(response)).rejects.toThrow(CHAT_SERVICE_ERROR);
  });

  it("rejects non-OK JSON responses with a user-safe error", async () => {
    const response = Response.json({ error: "Database connection details" }, {
      status: 401,
    });

    await expect(validateChatResponse(response)).rejects.toThrow(CHAT_SERVICE_ERROR);
  });

  it("rejects successful responses that are not event streams", async () => {
    const response = Response.json({ message: "unexpected" });

    await expect(validateChatResponse(response)).rejects.toThrow(CHAT_SERVICE_ERROR);
  });

  it("returns successful server-sent event responses", async () => {
    const response = new Response("data: {}\n\n", {
      headers: { "content-type": "text/event-stream" },
    });

    await expect(validateChatResponse(response)).resolves.toBe(response);
  });
});
