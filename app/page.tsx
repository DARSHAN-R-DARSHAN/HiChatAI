"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import CodeBlock from "@/components/CodeBlock";
import { UserButton } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import {
  Menu,
  Plus,
  Send,
  Sun,
  Moon,
  Monitor,
  Copy,
  MoreHorizontal,
} from "lucide-react";

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
  const [chatError, setChatError] = useState<string | null>(null);
  const { isLoaded, isSignedIn } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [chatToRename, setChatToRename] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [openChatMenu, setOpenChatMenu] = useState<string | null>(null);

  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    if (typeof window === "undefined") {
      return "system";
    }

    const savedTheme = localStorage.getItem("theme");

    if (
      savedTheme === "light" ||
      savedTheme === "dark" ||
      savedTheme === "system"
    ) {
      return savedTheme;
    }

    return "system";
  });

  const filteredConversations = conversations.filter((chat) =>
    chat.title
      .toLowerCase()
      .includes(conversationSearch.toLowerCase())
  );

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        conversationId: activeChatIdRef.current,
      }),
    }),
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

        await fetch("/api/conversations/assistant-message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
          conversationId: chatId,
          content,
        }),
        });
      }
    },
    onError: (error) => {
      console.error("CHAT ERROR:", error);
      setChatError("Something went wrong. Please try again.");
    },
  });


  useEffect(() => {
    const root = document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

      root.classList.toggle("dark", prefersDark);
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    function handleClickOutside() {
      setOpenChatMenu(null);
    }

    if (openChatMenu) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [openChatMenu]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "auto",
    });
  }, [messages]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

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
  }, [isLoaded, isSignedIn]);


  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!input.trim()) return;

    const text = input.trim();
    setChatError(null);

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
      setChatError("Failed to send your message. Please try again.");
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

  function toggleTheme() {
    if (theme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
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

  async function handleDeleteChat(chatId: string) {
    const response = await fetch(
      `/api/conversations/${chatId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      setChatError("Failed to delete chat. Please try again.");
      return;
    }

    setConversations((previous) =>
      previous.filter((chat) => chat.id !== chatId)
    );

    if (activeChatIdRef.current === chatId) {
      setMessages([]);
      setActiveChatId(null);
      activeChatIdRef.current = null;
      localStorage.removeItem("activeChatId");
    }
  }

  async function regenerateResponse() {
    const chatId = activeChatIdRef.current;

    if (!chatId) {
      return;
    }

    if (status === "streaming" || status === "submitted") {
      return;
    }

    setChatError(null);

    const currentMessages = [...messages];

    const lastUserMessage = [...currentMessages]
      .reverse()
      .find((message) => message.role === "user");

    if (!lastUserMessage) {
      return;
    }

    const text = lastUserMessage.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("");

    if (!text) {
      return;
    }

    const response = await fetch(
      "/api/conversations/regenerate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: chatId,
        }),
      }
    );

    if (!response.ok) {
      setChatError(
        "Failed to regenerate response. Please try again."
      );
      return;
    }

    // Remove only the latest assistant message.
    const lastAssistantIndex = [...currentMessages]
      .map((message, index) => ({
        message,
        index,
      }))
      .reverse()
      .find(
        ({ message }) => message.role === "assistant"
      )?.index;

    if (lastAssistantIndex !== undefined) {
      setMessages(
        currentMessages.filter(
          (_, index) => index !== lastAssistantIndex
        )
      );
    }

    await sendMessage({ text });
  }

  async function handleRenameChat(chatId: string) {
    const title = renameValue.trim();

    if (!title) {
      setChatError("Chat title cannot be empty.");
      return;
    }

    const response = await fetch(
      `/api/conversations/${chatId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
        }),
      }
    );

    if (!response.ok) {
      setChatError("Failed to rename chat. Please try again.");
      return;
    }

    setConversations((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              title,
            }
          : chat
      )
    );

    setChatToRename(null);
    setRenameValue("");
  }

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">HiChatAI</h1>

          <div className="mx-auto mt-4 h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-4xl font-bold">HiChatAI</h1>

          <p className="mt-4 text-gray-600">
            Your AI assistant for coding, learning, and everyday questions.
          </p>

          <div className="mt-8 flex justify-center gap-3">
            <a
              href="/sign-in"
              className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Sign in
            </a>

            <a
              href="/sign-up"
              className="rounded-lg border bg-white px-5 py-3 text-sm font-medium hover:bg-gray-100"
            >
              Create account
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-gray-200 bg-gray-50 p-3 transition-transform duration-200 dark:border-gray-800 dark:bg-gray-900 md:hidden ${
          mobileSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="px-3 text-sm font-semibold">
            HiChatAI
          </span>

          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-800"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            handleNewChat();
            setMobileSidebarOpen(false);
          }}
          className="mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-800"
        >
          <Plus size={18} />
          New chat
        </button>

        <div className="mt-6 flex-1 overflow-y-auto">
          <input
            type="text"
            value={conversationSearch}
            onChange={(e) => setConversationSearch(e.target.value)}
            placeholder="Search chats..."
            className="mb-4 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:placeholder:text-gray-500"
          />
          <p className="mb-2 px-3 text-xs font-semibold uppercase text-gray-500">
            Recent
          </p>

          <div className="space-y-1">
            {filteredConversations.map((chat) => (
            <div
              key={chat.id}
              className={`group relative flex items-center rounded-lg ${
                activeChatId === chat.id
                  ? "bg-gray-200 dark:bg-gray-800"
                  : "hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              <button
                type="button"
                onClick={() => handleSelectChat(chat.id)}
                className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm"
              >
                {chat.title}
              </button>

              <div className="relative pr-1">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();

                    setOpenChatMenu((current) =>
                      current === chat.id ? null : chat.id
                    );
                  }}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-300 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                  aria-label={`Options for ${chat.title}`}
                >
                  <MoreHorizontal size={18} />
                </button>

                {openChatMenu === chat.id && (
                  <div
                    onClick={(event) => event.stopPropagation()} 
                    className="absolute right-0 top-9 z-50 w-36 rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <button
                      type="button"
                      onClick={() => {
                        setChatToRename(chat.id);
                        setRenameValue(chat.title);
                        setOpenChatMenu(null);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Rename
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setChatToDelete(chat.id);
                        setOpenChatMenu(null);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-gray-700"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          </div>
        </div>
      </aside>
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900 md:flex">

        {/* New Chat */}
        <button
          onClick={handleNewChat}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-800"
        >
          <Plus size={18} />
          <span>New chat</span>
        </button>

        {/* Recent */}
        <div className="mt-6 flex-1 overflow-y-auto">
          <input
            type="text"
            value={conversationSearch}
            onChange={(e) => setConversationSearch(e.target.value)}
            placeholder="Search chats..."
            className="mb-4 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:placeholder:text-gray-500"
          />

          <p className="mb-2 px-3 text-xs font-semibold uppercase text-gray-500">
            Recent
          </p>

          <div className="space-y-1">
            {filteredConversations.map((chat) => (
              <div
                key={chat.id}
                className={`group relative flex items-center rounded-lg ${
                  activeChatId === chat.id
                    ? "bg-gray-200 dark:bg-gray-800"
                    : "hover:bg-gray-200 dark:hover:bg-gray-800"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectChat(chat.id)}
                  className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm"
                >
                  {chat.title}
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();

                      setOpenChatMenu((current) =>
                        current === chat.id ? null : chat.id
                      );
                    }}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-300 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                    aria-label={`Options for ${chat.title}`}
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {openChatMenu === chat.id && (
                    <div className="absolute right-0 top-9 z-50 w-36 rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      <button
                        type="button"
                        onClick={() => {
                          setChatToRename(chat.id);
                          setRenameValue(chat.title);
                          setOpenChatMenu(null);
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Rename
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setChatToDelete(chat.id);
                          setOpenChatMenu(null);
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-gray-700"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User area */}
        <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <UserButton />

            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                Account
              </p>

              <p className="text-xs text-gray-500">
                Manage account
              </p>
            </div>
          </div>
        </div>

      </aside>

      {/* Main section */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">

          {/* Left */}
          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <h1 className="text-sm font-semibold">
              HiChatAI
            </h1>

          </div>

          {/* Right */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="relative flex h-9 w-16 items-center rounded-full bg-gray-800 p-1 transition-colors dark:bg-gray-700"
            >
              {/* Sliding circle */}
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-200 ${
                  theme === "dark"
                    ? "translate-x-7"
                    : "translate-x-0"
                }`}
              >
                {theme === "dark" ? (
                  <Moon
                    size={16}
                    className="text-gray-800"
                  />
                ) : (
                  <Sun
                    size={16}
                    className="text-gray-800"
                  />
                )}
              </span>

              {/* Moon icon on right */}
              {theme !== "dark" && (
                <Moon
                  size={16}
                  className="absolute right-2 text-white"
                />
              )}

              {/* Sun icon on left */}
              {theme === "dark" && (
                <Sun
                  size={16}
                  className="absolute left-2 text-gray-300"
                />
              )}
            </button>

        </header>

        {/* Messages */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8">
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.length === 0 ? (
            <div className="flex min-h-[60vh] items-center justify-center px-4">
              <div className="w-full max-w-2xl text-center">

                <h2 className="text-3xl font-semibold tracking-tight">
                  Hi, I&apos;m HiChatAI 👋
                </h2>

                <p className="mt-3 text-gray-500 dark:text-gray-400">
                  How can I help you today?
                </p>

                {/* Suggestions */}
                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">

                  <button
                    type="button"
                    onClick={() => setInput("Explain React to me")}
                    className="rounded-xl border border-gray-200 bg-white p-4 text-left text-sm transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
                  >
                    <p className="font-medium">Explain React</p>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">
                      Explain React in simple terms
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInput("Teach me Python from scratch")}
                    className="rounded-xl border border-gray-200 bg-white p-4 text-left text-sm transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
                  >
                    <p className="font-medium">Learn Python</p>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">
                      Start learning Python from scratch
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInput("Help me debug this code")}
                    className="rounded-xl border border-gray-200 bg-white p-4 text-left text-sm transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
                  >
                    <p className="font-medium">Debug my code</p>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">
                      Find and fix a coding problem
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInput("Explain this concept to me")}
                    className="rounded-xl border border-gray-200 bg-white p-4 text-left text-sm transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
                  >
                    <p className="font-medium">Explain a concept</p>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">
                      Break down something difficult
                    </p>
                  </button>

                </div>

              </div>
            </div>
          ) : (
              <>
              {messages.map((message) => {
                const textContent = message.parts
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join("");

                const isUser = message.role === "user";

                async function copyResponse() {
                  await navigator.clipboard.writeText(textContent);
                }

                return (
                  <div
                    key={message.id}
                    className={`group flex w-full ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={
                        isUser
                          ? "max-w-[80%] rounded-2xl bg-black px-4 py-3 text-white dark:bg-white dark:text-black"
                          : "w-full max-w-3xl px-1 py-2 text-gray-900 dark:text-gray-100"
                      }
                    >
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        {message.parts.map((part, index) => {
                          if (part.type !== "text") {
                            return null;
                          }

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
                                    /language-(\w+)/.exec(className || "");

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
                                      className="rounded bg-gray-200 px-1.5 py-0.5 text-sm dark:bg-gray-800"
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
                        })}
                      </div>

                      {!isUser && textContent && (
                        <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={regenerateResponse}
                            disabled={
                              status === "streaming" ||
                              status === "submitted"
                            }
                            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                            title="Regenerate response"
                          >
                            ↻
                          </button>

                          <button
                            type="button"
                            onClick={copyResponse}
                            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                            title="Copy response"
                          >
                            <Copy size={16} />
                          </button>

                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
            

            {/* Auto-scroll marker */}
            <div ref={messagesEndRef} />
          </div>
        </div>
        {chatError && (
          <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            <span>{chatError}</span>

            <button
              type="button"
              onClick={() => {
                setChatError(null);
                regenerateResponse();
              }}
              className="ml-4 font-medium underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-200 px-4 py-4 dark:border-gray-800">
          <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-3xl"
          >
            <div className="rounded-2xl border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">

              <div className="flex items-center px-3 py-2">

                {/* Plus button */}
                <button
                  type="button"
                  className="mr-2 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Add attachment"
                >
                  <Plus size={20} />
                </button>

                {/* Input */}
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Message HiChatAI..."
                  disabled={status === "streaming"}
                  className="flex-1 bg-transparent py-3 text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
                />

                {/* Send / Stop */}
                {status === "submitted" || status === "streaming" ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="ml-2 rounded-full bg-black p-2 text-white hover:bg-gray-800 dark:bg-white dark:text-black"
                    aria-label="Stop generating"
                  >
                    <div className="h-4 w-4 rounded-sm bg-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="ml-2 rounded-full bg-black p-2 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
                    aria-label="Send message"
                  >
                    <Send size={18} />
                  </button>
                )}

              </div>

            </div>

            <p className="mt-3 text-center text-xs text-gray-400">
              HiChatAI can make mistakes. Check important information.
            </p>
          </form>
        </div>
        {chatToDelete && (
          <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
              <h2 className="text-lg font-semibold">
                Delete this chat?
              </h2>

              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This conversation and its messages will be permanently deleted.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setChatToDelete(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const id = chatToDelete;

                    setChatToDelete(null);

                    await handleDeleteChat(id);
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}{chatToRename && (
            <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
                <h2 className="text-lg font-semibold">
                  Rename chat
                </h2>

                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  maxLength={100}
                  autoFocus
                  className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-800"
                />

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setChatToRename(null);
                      setRenameValue("");
                    }}
                    className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (chatToRename) {
                        handleRenameChat(chatToRename);
                      }
                    }}
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
      </section>
    </main>
  );
}