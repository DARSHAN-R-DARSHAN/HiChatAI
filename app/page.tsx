"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { Menu, Plus, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import CodeBlock from "@/components/CodeBlock";

type Conversation = {
  id: string;
  title: string;
  messages: UIMessage[];
};

function convertDatabaseMessages(messages: any[]): UIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [
      {
        type: "text",
        text: message.content,
      },
    ],
  }));
}

function generateTitle(text: string) {
  const cleanText = text.trim();

  if (cleanText.length <= 40) {
    return cleanText;
  }

  return cleanText.slice(0, 40) + "...";
}

export default function Home() {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChatIdRef = useRef<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat({
    onFinish: async ({ messages: finishedMessages }) => {
      const chatId = activeChatIdRef.current;

      if (!chatId) return;

      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === chatId
            ? {
                ...conversation,
                messages: finishedMessages,
              }
            : conversation
        )
      );

      const lastMessage = finishedMessages[finishedMessages.length - 1];

      if (lastMessage?.role === "assistant") {
        const content = lastMessage.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("");

        await fetch("/api/conversations/message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId: chatId,
            role: "assistant",
            content,
          }),
        });
      }
    },
  });


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "auto",
    });
  }, [messages]);

  useEffect(() => {
    async function loadConversations() {
      const response = await fetch("/api/conversations");

      if (!response.ok) {
        console.error("Failed to load conversations");
        return;
      }

      const data = await response.json();

      const formattedConversations = data.map((conversation: any) => ({
        id: conversation.id,
        title: conversation.title,
        messages: convertDatabaseMessages(conversation.messages),
      }));

      setConversations(formattedConversations);

      // Automatically restore the most recent conversation
      if (formattedConversations.length > 0) {
        const savedChatId = localStorage.getItem("activeChatId");

        const conversationToRestore =
          formattedConversations.find(
            (conversation: Conversation) => conversation.id === savedChatId
          ) ?? formattedConversations[0];

        setActiveChatId(conversationToRestore.id);
        activeChatIdRef.current = conversationToRestore.id;
        setMessages(conversationToRestore.messages);
      }
    }

    loadConversations();
  }, []);


  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!input.trim()) return;

    const text = input.trim();

    if (status === "streaming" || status === "submitted") {
      return;
    }

    let chatId = activeChatIdRef.current;

    // Create a new conversation if needed
    if (!chatId) {
      const response = await fetch("/api/conversations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: generateTitle(text),
        }),
      });

      if (!response.ok) {
        console.error("Failed to create conversation");
        return;
      }

      const conversation = await response.json();

      chatId = conversation.id;

      setConversations((previous) => [
        {
          id: conversation.id,
          title: conversation.title,
          messages: [],
        },
        ...previous,
      ]);

      setActiveChatId(chatId);
      activeChatIdRef.current = chatId;
      localStorage.setItem("activeChatId", conversation.id);
    }

    // Save the user message
    const messageResponse = await fetch("/api/conversations/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId: chatId,
        role: "user",
        content: text,
      }),
    });

    if (!messageResponse.ok) {
      console.error("Failed to save user message");
      return;
    }

    // Send message to AI
    await sendMessage({ text });

    setInput("");
  }

  function handleNewChat() {
    if (status === "streaming" || status === "submitted") {
      stop();
    }

    setMessages([]);
    setActiveChatId(null);
    activeChatIdRef.current = null;
    localStorage.removeItem("activeChatId");
    setInput("");
  }

  async function handleSelectChat(chatId: string) {
    if (status === "streaming" || status === "submitted") {
      stop();
    }

    localStorage.setItem("activeChatId", chatId);

    const response = await fetch(`/api/conversations/${chatId}`);

    if (!response.ok) {
      console.error("Failed to load conversation");
      return;
    }

    const conversation = await response.json();

    const formattedMessages = convertDatabaseMessages(
      conversation.messages
    );

    setActiveChatId(chatId);
    activeChatIdRef.current = chatId;
    setMessages(formattedMessages);
  }

  return (
    <main className="flex h-screen bg-white text-gray-900">
      {/* Sidebar */}
      <aside className="hidden w-64 border-r bg-gray-50 p-4 md:block">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-gray-100"
        >
          <Plus size={18} />
          New chat
        </button>

        <div className="mt-8">
          <p className="mb-3 px-2 text-xs font-semibold uppercase text-gray-500">
            Recent
          </p>

          <div className="space-y-1">
            {conversations.map((chat) => (
              <button
                key={chat.id}
                onClick={() => handleSelectChat(chat.id)}
                className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                  activeChatId === chat.id ? "bg-gray-200" : ""
                }`}
              >
                {chat.title}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main section */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center border-b px-4">
          <button className="mr-3 rounded-lg p-2 hover:bg-gray-100 md:hidden">
            <Menu size={20} />
          </button>

          <h1 className="font-semibold">HiChatAI</h1>
        </header>

        {/* Messages */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8">
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.length === 0 ? (
              <div className="flex h-[60vh] items-center justify-center">
                <div className="text-center">
                  <h2 className="text-3xl font-semibold">
                    Hi, I&apos;m HiChatAI 👋
                  </h2>

                  <p className="mt-3 text-gray-500">
                    How can I help you today?
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`min-w-0 max-w-[80%] overflow-hidden rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-black text-white"
                        : "bg-gray-100"
                    }`}
                  >
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        return (
                          <ReactMarkdown
                            key={index}
                            components={{
                              code({
                                className,
                                children,
                                ...props
                              }) {
                                const match =
                                  /language-(\w+)/.exec(
                                    className || ""
                                  );

                                if (match) {
                                  return (
                                    <CodeBlock
                                      code={String(children).replace(
                                        /\n$/,
                                        ""
                                      )}
                                      language={match[1]}
                                    />
                                  );
                                }

                                return (
                                  <code
                                    className="rounded bg-gray-200 px-1.5 py-0.5 text-sm"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                );
                              },
                            }}
                          >
                            {part.text}
                          </ReactMarkdown>
                        );
                      }

                      return null;
                    })}
                  </div>
                </div>
              ))
            )}

            {/* Auto-scroll marker */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t px-4 py-4">
          <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-2xl"
          >
            <div className="flex items-center rounded-2xl border bg-white px-4 py-2 shadow-sm">
              <input
                type="text"
                value={input}
                onChange={(event) =>
                  setInput(event.target.value)
                }
                placeholder="Message HiChatAI..."
                disabled={status === "streaming"}
                className="flex-1 bg-transparent py-3 outline-none"
              />

              {status === "submitted" || status === "streaming" ? (
              <button
                type="button"
                onClick={stop}
                className="rounded-xl bg-black p-2 text-white hover:bg-gray-800"
              >
                <div className="h-4 w-4 rounded-sm bg-white" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="rounded-xl bg-black p-2 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={18} />
              </button>
            )}
            </div>

            <p className="mt-3 text-center text-xs text-gray-400">
              HiChatAI can make mistakes. Check important information.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}