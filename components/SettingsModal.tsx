"use client";

import { X } from "lucide-react";

type SettingsModalProps = {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  userName: string;
  userEmail: string;
  onClose: () => void;
};

export default function SettingsModal({
  theme,
  setTheme,
  userName,
  userEmail,
  onClose,
}: SettingsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Settings</h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium">Appearance</h3>

          <div className="space-y-2">
            {(["light", "dark", "system"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTheme(option)}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left capitalize ${
                  theme === option
                    ? "border-black dark:border-white"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <span>{option}</span>

                {theme === option && (
                  <span className="text-sm">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium">Account</h3>

            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <p className="font-medium">{userName}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {userEmail}
                </p>
            </div>
        <div className="mt-6">
        <h3 className="mb-3 text-sm font-medium">About</h3>

        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <p className="font-medium">HiChatAI</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Your personal AI assistant.
            </p>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            V1.0.0
            </p>
        </div>
        </div>
          
         </div>
      </div>
    </div>
  );
}