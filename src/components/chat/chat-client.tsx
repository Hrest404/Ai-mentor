"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { startConversation } from "@/app/app/(main)/pro/chat/actions";
import { SpeakButton } from "@/components/lesson/speak-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { splitReply } from "@/lib/chat-format";
import { CHAT_MESSAGE_MAX_LENGTH, CHAT_SCENARIOS, getScenario } from "@/lib/chat-scenarios";
import { cn } from "@/lib/cn";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface InitialChat {
  conversationId: string;
  scenario: string;
  messages: ChatMessage[];
}

function AssistantBubble({ content, streaming }: { content: string; streaming?: boolean }) {
  const { reply, correction } = splitReply(content, !streaming);
  return (
    <div className="flex max-w-[92%] flex-col gap-2 self-start">
      <div className="flex items-start gap-2">
        <div className="rounded-lg rounded-tl-sm border border-line bg-surface px-4 py-3">
          <p lang="en" className="whitespace-pre-wrap text-lg">
            {reply || (streaming ? "…" : "")}
          </p>
        </div>
        {!streaming && reply && (
          <SpeakButton text={reply} label="" className="size-11 min-h-11 shrink-0 justify-center px-0 [&>svg]:size-5" />
        )}
      </div>
      {correction && (
        <div className="rounded-lg bg-xp-soft px-4 py-3">
          <p className="mb-1 text-sm font-medium text-xp">Поправка</p>
          <p className="whitespace-pre-wrap">{correction}</p>
        </div>
      )}
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="max-w-[88%] self-end rounded-lg rounded-tr-sm bg-action px-4 py-3 text-action-ink">
      <p lang="en" className="whitespace-pre-wrap text-lg">
        {content}
      </p>
    </div>
  );
}

export function ChatClient({ initial }: { initial: InitialChat | null }) {
  const [conv, setConv] = useState<{ id: string; scenario: string } | null>(
    initial ? { id: initial.conversationId, scenario: initial.scenario } : null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initial?.messages ?? []);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, streaming]);

  async function start(scenarioId: string) {
    setStarting(scenarioId);
    setError(null);
    try {
      const res = await startConversation({ scenario: scenarioId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setConv({ id: res.conversationId, scenario: res.scenario });
      setMessages([{ role: "assistant", content: res.opening }]);
    } catch {
      setError("Не получилось начать диалог. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setStarting(null);
    }
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const message = text.trim();
    if (!conv || !message || sending) return;
    setSending(true);
    setError(null);
    setText("");
    const before = messages;
    setMessages([...before, { role: "user", content: message }]);
    setStreaming("");

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conv.id, message }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Не получилось отправить сообщение");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreaming(full);
      }
      full += decoder.decode();
      setMessages((m) => [...m, { role: "assistant", content: full.trim() }]);
    } catch (err) {
      if (controller.signal.aborted) return;
      // Сервер сообщение не сохранил: возвращаем его в поле ввода.
      setMessages(before);
      setText(message);
      setError(err instanceof Error ? err.message : "Не получилось отправить сообщение");
    } finally {
      setStreaming(null);
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  if (!conv) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl">Чат-ментор</h1>
          <p className="text-muted">
            Выберите ситуацию и общайтесь по-английски. После каждой вашей реплики Репетитор отвечает в роли и
            коротко поправляет ошибки по-русски.
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-danger">
            {error}
          </p>
        )}
        <div className="grid gap-6 sm:grid-cols-2">
          {CHAT_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={starting !== null}
              onClick={() => void start(s.id)}
              className="lift text-left disabled:opacity-60"
            >
              <Card className="flex h-full flex-col gap-2">
                <h2 className="text-xl">{s.title}</h2>
                <p className="text-muted">{s.description}</p>
                {starting === s.id && <p className="text-sm text-action">Открываем диалог…</p>}
              </Card>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const scenario = getScenario(conv.scenario);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-3xl">Чат-ментор</h1>
          <p className="text-muted">{scenario?.title ?? "Диалог"}</p>
        </div>
        <Button
          variant="secondary"
          disabled={sending}
          onClick={() => {
            setConv(null);
            setMessages([]);
            setError(null);
          }}
        >
          Другой сценарий
        </Button>
      </div>

      <div role="log" aria-label="Диалог" className="flex min-h-[40dvh] flex-col gap-4">
        {messages.map((m, i) =>
          m.role === "user" ? <UserBubble key={i} content={m.content} /> : <AssistantBubble key={i} content={m.content} />,
        )}
        {streaming !== null && <AssistantBubble content={streaming} streaming />}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={send}
        className="sticky bottom-[4.5rem] flex flex-col gap-2 bg-bg pb-2 pt-2 md:bottom-0"
        aria-label="Новое сообщение"
      >
        {error && (
          <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-danger">
            {error}
          </p>
        )}
        <div className="flex items-end gap-3">
          <textarea
            lang="en"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            rows={2}
            disabled={sending}
            placeholder="Напишите по-английски…"
            aria-label="Ваше сообщение"
            autoComplete="off"
            spellCheck={false}
            className={cn(
              "min-h-14 flex-1 resize-none rounded-lg border border-line bg-surface px-4 py-3 text-lg transition-colors hover:border-muted",
              "disabled:opacity-60",
            )}
          />
          <Button type="submit" size="lg" loading={sending} disabled={!text.trim()}>
            Отправить
          </Button>
        </div>
        <p className="text-sm text-muted">
          Enter отправляет, Shift+Enter переносит строку. До {CHAT_MESSAGE_MAX_LENGTH} символов.
        </p>
      </form>
    </div>
  );
}
