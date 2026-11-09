"use client";

import { useState } from "react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { Bot, LoaderCircle, MessageCircle, Send, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  async function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <section
          aria-label="Chatbot EduSpace"
          className="mb-3 flex h-[min(34rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-background shadow-xl"
        >
          <header className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div>
                <h2 className="font-semibold">Asisten Materi</h2>
                <p className="text-xs opacity-80">Jawaban berdasarkan modul kelas</p>
              </div>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Tutup chatbot"
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {messages.length === 0 && (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                Tanyakan konsep rangkaian listrik yang dibahas di materi kelasmu.
              </p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted"
                }`}
              >
                {messageText(message)}
              </div>
            ))}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error.message || "Pesan gagal dikirim. Silakan coba lagi."}
              </p>
            )}
          </div>

          <form onSubmit={submitMessage} className="flex gap-2 border-t p-3">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Tulis pertanyaan..."
              aria-label="Pertanyaan untuk chatbot"
              maxLength={2000}
              disabled={isBusy}
            />
            {isBusy ? (
              <Button type="button" size="icon" variant="outline" aria-label="Hentikan jawaban" onClick={stop}>
                {status === "submitted" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <Button type="submit" size="icon" aria-label="Kirim pertanyaan" disabled={!input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </form>
        </section>
      )}

      <Button
        type="button"
        size="icon"
        aria-label={isOpen ? "Tutup chatbot" : "Buka chatbot"}
        className="h-12 w-12 rounded-full shadow-lg"
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>
    </div>
  );
}
