export const CHAT_SERVICE_ERROR =
  "Maaf, layanan chatbot sedang mengalami gangguan. Silakan coba beberapa saat lagi.";

export async function validateChatResponse(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (
    !response.ok ||
    contentType.includes("text/html") ||
    !contentType.includes("text/event-stream")
  ) {
    throw new Error(CHAT_SERVICE_ERROR);
  }
  return response;
}
