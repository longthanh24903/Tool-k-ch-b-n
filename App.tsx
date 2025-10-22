import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Chapter,
  ScriptConfig,
  AnalysisResult,
  DialogueAnalysisResult,
  SrtCompanionItem,
  ImagePromptConfig,
} from "./types";
import {
  generateOutline,
  generateInitialChapter,
  generateNextChapter,
  rewriteChapter,
  analyzeScriptForSEO,
  analyzeDialogue,
  generateImagePromptsForScript,
  generateIdeaSuggestion,
  generateCharacterSuggestion,
} from "./services/geminiService";
import { GENRES, WRITING_STYLES, RATINGS } from "./constants";
import {
  WriteIcon,
  ContinueIcon,
  ExportIcon,
  LogoIcon,
  RewriteIcon,
  DeleteIcon,
  ChevronUpIcon,
  SparklesIcon,
  CopyIcon,
  CloseIcon,
  RefreshIcon,
  DialogueIcon,
  KeyIcon,
  SpinnerIcon,
} from "./components/icons";

interface ConfigPanelProps {
  config: ScriptConfig;
  setConfig: React.Dispatch<React.SetStateAction<ScriptConfig>>;
  onSubmit: () => void;
  isLoading: boolean;
  hasScript: boolean;
  outline: string | null;
  apiKeys: string[];
  setApiKeys: React.Dispatch<React.SetStateAction<string[]>>;
  currentApiKeyIndex: number;
  setCurrentApiKeyIndex: React.Dispatch<React.SetStateAction<number>>;
  autoSwitchKey: boolean;
  setAutoSwitchKey: React.Dispatch<React.SetStateAction<boolean>>;
  onSuggestIdea: () => void;
  onSuggestCharacters: () => void;
  isSuggestingIdea: boolean;
  isSuggestingCharacters: boolean;
  suggestionError: string | null;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({
  config,
  setConfig,
  onSubmit,
  isLoading,
  hasScript,
  outline,
  apiKeys,
  setApiKeys,
  currentApiKeyIndex,
  setCurrentApiKeyIndex,
  autoSwitchKey,
  setAutoSwitchKey,
  onSuggestIdea,
  onSuggestCharacters,
  isSuggestingIdea,
  isSuggestingCharacters,
  suggestionError,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState("");

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const { checked } = e.target as HTMLInputElement;
      setConfig((prev) => ({ ...prev, [name]: checked }));
    } else {
      setConfig((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as "vi" | "en";
    setConfig((prev) => ({
      ...prev,
      language: newLang,
      genre: GENRES[newLang][0],
      style: WRITING_STYLES[newLang][0],
    }));
  };

  const handleAddApiKey = () => {
    const newKey = apiKeyInput.trim();
    if (newKey && !apiKeys.includes(newKey)) {
      const newKeys = [...apiKeys, newKey];
      setApiKeys(newKeys);
      // If it's the first key added, select it automatically
      if (newKeys.length === 1) {
        setCurrentApiKeyIndex(0);
      }
      setApiKeyInput("");
      console.log("✅ Added new API key, total keys:", newKeys.length);

      // Force immediate save
      try {
        localStorage.setItem("apiKeys", JSON.stringify(newKeys));
        console.log("💾 Immediately saved API keys to localStorage");

        // Auto-backup to sessionStorage as well
        try {
          sessionStorage.setItem("apiKeys_backup", JSON.stringify(newKeys));
          console.log("💾 Auto-backup to sessionStorage");
        } catch (e) {
          console.warn("⚠️ Failed to backup to sessionStorage:", e);
        }
      } catch (e) {
        console.error("❌ Failed to immediately save API keys:", e);
      }
    } else if (apiKeys.includes(newKey)) {
      console.warn("⚠️ API key already exists");
    } else {
      console.warn("⚠️ Invalid API key");
    }
  };

  const handleDeleteApiKey = (indexToDelete: number) => {
    const newKeys = apiKeys.filter((_, index) => index !== indexToDelete);
    setApiKeys(newKeys);

    // Reset current index to 0 if no keys left, otherwise adjust index
    if (newKeys.length === 0) {
      setCurrentApiKeyIndex(0);
      // Clear from localStorage when no keys left
      try {
        localStorage.removeItem("apiKeys");
        localStorage.removeItem("currentApiKeyIndex");
        sessionStorage.removeItem("apiKeys_backup");
        console.log("🗑️ Cleared all storage when no keys left");
      } catch (e) {
        console.error("❌ Failed to clear storage:", e);
      }
    } else if (currentApiKeyIndex >= indexToDelete) {
      setCurrentApiKeyIndex(Math.max(0, currentApiKeyIndex - 1));
    }

    console.log("🗑️ Deleted API key at index:", indexToDelete);
    console.log("📊 Remaining API keys:", newKeys.length);
  };

  const getButtonText = () => {
    if (isLoading) {
      return !outline ? "Đang tạo dàn ý..." : "Đang viết...";
    }
    if (!outline) {
      return "Tạo Dàn ý";
    }
    if (outline && !hasScript) {
      return "Bắt đầu Viết Kịch bản";
    }
    return "Bắt đầu Kịch bản Mới";
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return "****";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  // Export API keys to file
  const handleExportApiKeys = () => {
    if (apiKeys.length === 0) {
      console.log("❌ Không có API key nào để export!");
      return;
    }

    const exportData = {
      apiKeys: apiKeys,
      currentApiKeyIndex: currentApiKeyIndex,
      autoSwitchKey: autoSwitchKey,
      exportDate: new Date().toISOString(),
      version: "1.0",
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `api-keys-backup-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("💾 Exported API keys backup");
  };

  // Import API keys from file
  const handleImportApiKeys = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const importData = JSON.parse(content);

          // Validate import data
          if (!importData.apiKeys || !Array.isArray(importData.apiKeys)) {
            throw new Error("Invalid backup file format");
          }

          setApiKeys(importData.apiKeys);
          if (importData.currentApiKeyIndex !== undefined) {
            setCurrentApiKeyIndex(importData.currentApiKeyIndex);
          }
          if (importData.autoSwitchKey !== undefined) {
            setAutoSwitchKey(importData.autoSwitchKey);
          }

          console.log("📥 Imported API keys:", importData.apiKeys.length);
        } catch (error) {
          console.error("❌ Import failed:", error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Show backup info
  const handleShowBackupInfo = () => {
    const localStorageKeys = localStorage.getItem("apiKeys");
    const sessionStorageKeys = sessionStorage.getItem("apiKeys_backup");

    console.log("📊 BACKUP INFORMATION:");
    console.log(`Current API Keys: ${apiKeys.length}`);
    console.log(
      `localStorage: ${
        localStorageKeys ? JSON.parse(localStorageKeys).length : 0
      } keys`
    );
    console.log(
      `sessionStorage backup: ${
        sessionStorageKeys ? JSON.parse(sessionStorageKeys).length : 0
      } keys`
    );

    if (apiKeys.length > 0) {
      console.log("💡 RECOMMENDATIONS:");
      console.log("• Export backup file regularly");
      console.log("• Keep backup files safe");
      console.log("• Test restore process");
    }

    console.log("🔄 AUTO-BACKUP:");
    console.log("• localStorage: Main storage");
    console.log("• sessionStorage: Emergency backup");
    console.log("• File export: Manual backup");
  };

  // Clear all API keys
  const handleClearAllApiKeys = () => {
    setApiKeys([]);
    setCurrentApiKeyIndex(0);

    // Also clear from localStorage and sessionStorage
    try {
      localStorage.removeItem("apiKeys");
      localStorage.removeItem("currentApiKeyIndex");
      sessionStorage.removeItem("apiKeys_backup");
      console.log("🗑️ Cleared all API keys from memory and storage");
    } catch (e) {
      console.error("❌ Failed to clear from storage:", e);
    }
  };

  return (
    <div className="p-6 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl shadow-lg h-auto flex flex-col">
      <h2 className="text-2xl font-bold mb-6 text-indigo-400 font-sans">
        Cấu hình Kịch bản
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-5 flex-grow flex flex-col"
      >
        {suggestionError && (
          <div
            className="bg-red-900/50 border border-red-700 text-red-300 px-3 py-2 text-sm rounded-lg font-sans"
            role="alert"
          >
            {suggestionError}
          </div>
        )}
        <div>
          <label
            htmlFor="language"
            className="block text-sm font-medium text-gray-400"
          >
            Ngôn ngữ Kịch bản
          </label>
          <select
            name="language"
            id="language"
            value={config.language}
            onChange={handleLanguageChange}
            className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-400"
          >
            Tên Kịch bản
          </label>
          <motion.input
            type="text"
            name="title"
            id="title"
            value={config.title}
            onChange={handleChange}
            className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
            placeholder="ví dụ: Ánh Sao Cuối Cùng"
            whileFocus={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          />
        </div>
        <div>
          <label
            htmlFor="genre"
            className="block text-sm font-medium text-gray-400"
          >
            Thể loại
          </label>
          <select
            name="genre"
            id="genre"
            value={config.genre}
            onChange={handleChange}
            className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
          >
            {GENRES[config.language].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="style"
            className="block text-sm font-medium text-gray-400"
          >
            Phong cách Viết
          </label>
          <select
            name="style"
            id="style"
            value={config.style}
            onChange={handleChange}
            className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
          >
            {WRITING_STYLES[config.language].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <label
            htmlFor="idea"
            className="block text-sm font-medium text-gray-400"
          >
            Ý tưởng / Cảnh mở đầu
          </label>
          <motion.textarea
            name="idea"
            id="idea"
            rows={5}
            value={config.idea}
            onChange={handleChange}
            className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
            placeholder="Một phi hành gia cô độc tỉnh dậy trên một con tàu vũ trụ bị bỏ hoang..."
            whileFocus={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          ></motion.textarea>
          <button
            type="button"
            onClick={onSuggestIdea}
            disabled={isSuggestingIdea || !config.genre}
            className="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs bg-indigo-600/80 hover:bg-indigo-600 text-white font-semibold px-2 py-1 rounded-md transition-all disabled:bg-indigo-500/50 disabled:cursor-not-allowed"
          >
            {isSuggestingIdea ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <SpinnerIcon className="h-4 w-4" />
              </motion.div>
            ) : (
              <SparklesIcon className="h-4 w-4" />
            )}
            AI Gợi ý
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="wordCount"
              className="block text-sm font-medium text-gray-400"
            >
              Số từ mỗi phần
            </label>
            <input
              type="number"
              name="wordCount"
              id="wordCount"
              value={config.wordCount}
              onChange={handleChange}
              className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
              placeholder="300"
              min="50"
            />
          </div>
          <div>
            <label
              htmlFor="totalChapters"
              className="block text-sm font-medium text-gray-400"
            >
              Tổng số phần
            </label>
            <input
              type="number"
              name="totalChapters"
              id="totalChapters"
              value={config.totalChapters}
              onChange={handleChange}
              className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
              placeholder="5"
              min="1"
            />
          </div>
        </div>

        <details
          className="bg-gray-900/50 rounded-lg p-3 transition-all border border-gray-700"
          open
        >
          <summary className="cursor-pointer font-medium text-gray-300 hover:text-white list-none flex justify-between items-center">
            Cài đặt Nâng cao
            <ChevronUpIcon className="transform transition-transform duration-300 open:rotate-180 w-6" />
          </summary>
          <div className="mt-4 space-y-5 border-t border-gray-700 pt-4">
            <div className="space-y-3 p-3 bg-gray-900 rounded-lg border border-gray-700">
              <h4 className="font-semibold text-gray-300 flex items-center gap-2">
                <KeyIcon /> Quản lý API Key
              </h4>
              <div className="flex gap-2">
                <motion.input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="flex-grow bg-gray-800 border-gray-600 rounded-md shadow-sm text-gray-100 py-2 px-3 text-sm"
                  placeholder="Nhập API Key của bạn..."
                  whileFocus={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                />
                <motion.button
                  type="button"
                  onClick={handleAddApiKey}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 text-sm rounded"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  Thêm
                </motion.button>
              </div>
              <div className="flex gap-2 mt-2">
                <motion.button
                  type="button"
                  onClick={handleExportApiKeys}
                  disabled={apiKeys.length === 0}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 text-sm rounded flex items-center justify-center gap-1"
                  title="Export API keys để backup"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  💾 Export
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleImportApiKeys}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 text-sm rounded flex items-center justify-center gap-1"
                  title="Import API keys từ file backup"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  📥 Import
                </motion.button>
              </div>
              <div className="flex gap-2 mt-1">
                <motion.button
                  type="button"
                  onClick={handleShowBackupInfo}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-3 text-sm rounded flex items-center justify-center gap-1"
                  title="Xem thông tin backup"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  📊 Backup Info
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleClearAllApiKeys}
                  disabled={apiKeys.length === 0}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 text-sm rounded flex items-center justify-center gap-1"
                  title="Xóa tất cả API keys"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  🗑️ Clear All
                </motion.button>
              </div>
              {apiKeys.length > 0 && (
                <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                  {apiKeys.map((key, index) => (
                    <motion.div
                      key={index}
                      className="flex items-center justify-between bg-gray-800/50 p-2 rounded"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <span className="text-sm font-mono text-gray-400">
                        {maskApiKey(key)}
                      </span>
                      <div className="flex items-center gap-2">
                        <motion.button
                          type="button"
                          onClick={() => setCurrentApiKeyIndex(index)}
                          disabled={index === currentApiKeyIndex}
                          className="text-xs px-2 py-1 rounded disabled:bg-teal-500 disabled:text-white bg-gray-600 hover:bg-gray-500 text-gray-200"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 17,
                          }}
                        >
                          {index === currentApiKeyIndex
                            ? "Đang dùng"
                            : "Sử dụng"}
                        </motion.button>
                        <motion.button
                          type="button"
                          onClick={() => handleDeleteApiKey(index)}
                          className="text-gray-400 hover:text-red-400 p-1"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 17,
                          }}
                        >
                          <DeleteIcon className="h-4 w-4" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <label
                  htmlFor="autoSwitchKey"
                  className="text-sm font-medium text-gray-300"
                >
                  Tự động chuyển key khi lỗi
                </label>
                <label
                  htmlFor="autoSwitchKey"
                  className="relative inline-flex items-center cursor-pointer"
                >
                  <input
                    type="checkbox"
                    name="autoSwitchKey"
                    id="autoSwitchKey"
                    checked={autoSwitchKey}
                    onChange={(e) => setAutoSwitchKey(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
            <div className="relative">
              <label
                htmlFor="characterDescriptions"
                className="block text-sm font-medium text-gray-400"
              >
                Mô tả Nhân vật (để nhất quán)
              </label>
              <textarea
                name="characterDescriptions"
                id="characterDescriptions"
                rows={4}
                value={config.characterDescriptions}
                onChange={handleChange}
                className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
                placeholder="KHAI: Chàng trai trẻ, tóc đen, mặc áo khoác da.&#10;MORGRA: Nữ pháp sư già, tóc trắng, mắt tím."
              ></textarea>
              <button
                type="button"
                onClick={onSuggestCharacters}
                disabled={isSuggestingCharacters || !config.idea}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs bg-indigo-600/80 hover:bg-indigo-600 text-white font-semibold px-2 py-1 rounded-md transition-all disabled:bg-indigo-500/50 disabled:cursor-not-allowed"
              >
                {isSuggestingCharacters ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <SpinnerIcon className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <SparklesIcon className="h-4 w-4" />
                )}
                AI Gợi ý
              </button>
            </div>
            <div>
              <label
                htmlFor="aiModel"
                className="block text-sm font-medium text-gray-400"
              >
                Model AI
              </label>
              <select
                name="aiModel"
                id="aiModel"
                value={config.aiModel}
                onChange={handleChange}
                className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
              >
                <option value="auto">Tự động (Cân bằng)</option>
                <option value="flash">Flash (Nhanh, hiệu quả)</option>
                <option value="pro">Pro (Chất lượng cao nhất)</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="rating"
                className="block text-sm font-medium text-gray-400"
              >
                Đối tượng & Nhãn
              </label>
              <select
                name="rating"
                id="rating"
                value={config.rating}
                onChange={handleChange}
                className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
              >
                {RATINGS[config.language].map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between bg-gray-900 p-3 rounded-lg">
              <label
                htmlFor="enableSfx"
                className="text-sm font-medium text-gray-300"
              >
                Bật SFX ElevenLabs
              </label>
              <label
                htmlFor="enableSfx"
                className="relative inline-flex items-center cursor-pointer"
              >
                <input
                  type="checkbox"
                  name="enableSfx"
                  id="enableSfx"
                  checked={config.enableSfx}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            {config.enableSfx && (
              <div>
                <label
                  htmlFor="sfxIntensity"
                  className="block text-sm font-medium text-gray-400"
                >
                  Mức độ hiệu ứng
                </label>
                <select
                  name="sfxIntensity"
                  id="sfxIntensity"
                  value={config.sfxIntensity}
                  onChange={handleChange}
                  className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
                >
                  <option value="light">Nhẹ</option>
                  <option value="natural">Tự nhiên</option>
                  <option value="strong">Mạnh</option>
                </select>
              </div>
            )}
          </div>
        </details>

        <div className="flex-grow"></div>

        <motion.button
          type="submit"
          disabled={isLoading || apiKeys.length === 0}
          className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-lg text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:bg-indigo-500/50 disabled:cursor-not-allowed transition-all duration-300 mt-auto"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <WriteIcon />
          {apiKeys.length === 0 ? "Vui lòng thêm API Key" : getButtonText()}
        </motion.button>
      </form>
    </div>
  );
};

interface ScriptDisplayProps {
  script: Chapter[];
  outline: string | null;
  streamingOutline: string | null;
  isLoading: boolean;
  error: string | null;
  config: ScriptConfig;
  onRewrite: (index: number) => void;
  onDelete: (index: number) => void;
  onOutlineChange: (newOutline: string) => void;
}

const sfxTooltips: Record<string, string> = {
  pause:
    "Pauses the narration for a specified duration in seconds. E.g., [pause=1.5]",
  laughs: "Generates a laughing sound.",
  sighs: "Generates a sighing sound.",
  crying: "Generates a crying sound.",
  whispers: "The following text is delivered in a whispered tone.",
  shouts: "The following text is delivered in a shouted tone.",
  gunshot: "Generates the sound of a gunshot.",
  explosion: "Generates the sound of an explosion.",
  breath: "Generates a breath sound.",
  exhales: "Generates an exhaling sound.",
  chuckles: "Generates a chuckling sound.",
  gasps: "Generates a gasping sound.",
};

const getSfxTooltip = (tagContent: string): string => {
  const key = tagContent.split("=")[0].trim();
  return sfxTooltips[key] || `Custom SFX tag: [${tagContent}]`;
};

const simpleMarkdownToHtml = (markdown: string): string => {
  if (!markdown) return "";

  const paragraphs = markdown.trim().split(/\n\s*\n/);

  const htmlParagraphs = paragraphs.map((p) => {
    if (!p) return "";

    let escapedP = p
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    escapedP = escapedP.replace(/\[(.*?)\]/g, (match, tagContent) => {
      const tooltip = getSfxTooltip(tagContent);
      const safeTooltip = tooltip.replace(/"/g, "&quot;");
      return `<span class="sfx-tag" title="${safeTooltip}">${match}</span>`;
    });

    escapedP = escapedP.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    escapedP = escapedP.replace(/\*(.*?)\*/g, "<em>$1</em>");

    escapedP = escapedP.replace(/\n/g, "<br />");

    return `<p>${escapedP}</p>`;
  });

  return htmlParagraphs.join("");
};

const parseOutline = (
  outlineText: string | null
): Array<{ num: number; summary: string; raw: string }> => {
  if (!outlineText) return [];
  const chapters = outlineText
    .split(/\n(?=(?:Phần|Chapter)\s+\d+:)/)
    .filter(Boolean);
  return chapters
    .map((ch) => {
      const match = ch.match(/(?:Phần|Chapter)\s+(\d+):\s*([\s\S]*)/);
      if (match) {
        return {
          num: parseInt(match[1], 10),
          summary: match[2].trim(),
          raw: ch,
        };
      }
      return null;
    })
    .filter(
      (item): item is { num: number; summary: string; raw: string } =>
        item !== null
    );
};

const ScriptDisplay: React.FC<ScriptDisplayProps> = ({
  script,
  outline,
  streamingOutline,
  isLoading,
  error,
  config,
  onRewrite,
  onDelete,
  onOutlineChange,
}) => {
  const endOfScriptRef = useRef<HTMLDivElement>(null);
  const [parsedOutline, setParsedOutline] = useState(parseOutline(outline));

  useEffect(() => {
    setParsedOutline(parseOutline(outline));
  }, [outline]);

  useEffect(() => {
    setTimeout(() => {
      endOfScriptRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [script]);

  const handleChapterOutlineChange = (index: number, newSummary: string) => {
    const newParsedOutline = [...parsedOutline];
    newParsedOutline[index].summary = newSummary;

    const prefix = config.language === "vi" ? "Phần" : "Chapter";
    newParsedOutline[
      index
    ].raw = `${prefix} ${newParsedOutline[index].num}: ${newSummary}`;

    setParsedOutline(newParsedOutline);
    onOutlineChange(newParsedOutline.map((p) => p.raw).join("\n"));
  };

  const handleScrollToChapter = (chapterIndex: number) => {
    document
      .getElementById(`chapter-${chapterIndex}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading && !outline) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-400">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-400 mb-4"></div>
        <h3 className="text-xl font-semibold font-sans">Đang tạo dàn ý...</h3>
        <p className="font-sans">
          AI đang phác thảo cấu trúc câu chuyện của bạn. Việc này nhanh thôi.
        </p>
        {streamingOutline && (
          <pre className="mt-4 text-left text-xs bg-gray-900/50 p-3 rounded-lg w-full max-w-lg max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
            {streamingOutline}
          </pre>
        )}
      </div>
    );
  }

  if (!outline && script.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center p-8 text-gray-400">
        <div>
          <h3 className="text-2xl font-bold font-sans">
            Chào mừng đến với AI Script Writer Pro
          </h3>
          <p className="mt-2 max-w-md mx-auto font-sans">
            Hãy cấu hình câu chuyện của bạn, sau đó nhấp vào "Tạo Dàn ý" để AI
            xây dựng sườn truyện cho bạn.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 font-serif">
      {outline && (
        <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 p-6 rounded-xl shadow-lg animate-fade-in">
          <h3 className="font-sans text-2xl font-bold text-teal-300 mb-2">
            Dàn ý Tương tác
          </h3>
          <p className="block text-sm text-gray-400 font-sans mb-4">
            Bạn có thể chỉnh sửa, thu gọn, và điều hướng từ dàn ý. AI sẽ bám sát
            phiên bản mới nhất khi viết.
          </p>
          <div className="space-y-3">
            {parsedOutline.map((item, index) => (
              <details
                key={item.num}
                className="bg-gray-900/50 p-3 rounded-md border border-gray-600 group"
                open
              >
                <summary
                  className="font-sans font-semibold text-indigo-300 cursor-pointer list-none flex justify-between items-center"
                  onClick={(e) => {
                    e.preventDefault();
                    (e.currentTarget.parentElement as HTMLDetailsElement).open =
                      !(e.currentTarget.parentElement as HTMLDetailsElement)
                        .open;
                    if (script.length > index) handleScrollToChapter(index);
                  }}
                >
                  {config.language === "vi" ? "Phần" : "Chapter"} {item.num}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRewrite(index);
                      }}
                      disabled={isLoading || index >= script.length}
                      className="text-xs flex items-center gap-1 text-gray-300 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Viết lại chương tương ứng"
                    >
                      <RewriteIcon className="h-4 w-4" /> Viết lại
                    </button>
                  </div>
                </summary>
                <textarea
                  value={item.summary}
                  onChange={(e) =>
                    handleChapterOutlineChange(index, e.target.value)
                  }
                  className="w-full mt-2 bg-transparent text-gray-400 text-sm font-sans resize-none focus:outline-none"
                  rows={2}
                />
              </details>
            ))}
          </div>
        </div>
      )}

      {isLoading && script.length === 0 && outline && (
        <div className="flex flex-col items-center justify-center text-center p-8 text-gray-400">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mb-4"></div>
          <h3 className="text-xl font-semibold font-sans">
            Đang viết chương đầu tiên...
          </h3>
          <p className="font-sans">
            AI đang thổi hồn vào dàn ý của bạn. Việc này có thể mất một chút
            thời gian.
          </p>
        </div>
      )}

      {script.map((chapter, index) => (
        <div
          key={index}
          id={`chapter-${index}`}
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-xl shadow-lg animate-fade-in scroll-mt-8"
        >
          <h3 className="font-serif text-3xl font-bold text-indigo-300 mb-4 flex items-start justify-between">
            <span className="flex-grow pr-4">{chapter.title}</span>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              <span className="text-xl font-medium text-gray-400 whitespace-nowrap">
                {config.language === "vi" ? "Phần" : "Chapter"} {index + 1}/
                {config.totalChapters}
              </span>
              <button
                onClick={() => onRewrite(index)}
                disabled={isLoading}
                className="p-2 rounded-full text-gray-400 hover:text-indigo-400 hover:bg-gray-700/50 disabled:text-gray-600 disabled:cursor-not-allowed transition-all"
                title="Viết lại"
              >
                <RewriteIcon />
              </button>
              <button
                onClick={() => onDelete(index)}
                disabled={isLoading}
                className="p-2 rounded-full text-gray-400 hover:text-red-400 hover:bg-gray-700/50 disabled:text-gray-600 disabled:cursor-not-allowed transition-all"
                title="Xoá"
              >
                <DeleteIcon />
              </button>
            </div>
          </h3>
          <div
            className="prose prose-invert max-w-none text-gray-200 leading-relaxed text-lg"
            dangerouslySetInnerHTML={{
              __html: simpleMarkdownToHtml(chapter.content),
            }}
          />
          {isLoading && index === script.length - 1 && (
            <span className="blinking-cursor"></span>
          )}
          <div className="mt-6 border-t border-slate-700 pt-4 text-sm text-gray-400 grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
            <div>
              <strong className="font-semibold text-gray-300 block mb-1">
                Cảm xúc chính:
              </strong>
              <span>{chapter.mainEmotion}</span>
            </div>
            <div>
              <strong className="font-semibold text-gray-300 block mb-1">
                Sự kiện trọng tâm:
              </strong>
              <span>{chapter.keyEvent}</span>
            </div>
            <div>
              <strong className="font-semibold text-gray-300 block mb-1">
                Câu kết mở:
              </strong>
              <em className="italic">{chapter.endingHook}</em>
            </div>
          </div>
        </div>
      ))}
      {isLoading && script.length > 0 && (
        <div className="flex justify-center items-center p-6 text-gray-400 font-sans">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400 mr-3"></div>
          <span>AI đang viết...</span>
        </div>
      )}
      {error && (
        <div
          className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg font-sans"
          role="alert"
        >
          <strong className="font-bold">Đã xảy ra lỗi: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      <div ref={endOfScriptRef} />
    </div>
  );
};

type ExportFormat = "txt" | "json" | "srt" | "fountain" | "image-prompts-json";

interface ActionButtonsProps {
  onContinue: () => void;
  onExport: (format: ExportFormat) => void;
  onAnalyze: () => void;
  onAnalyzeDialogue: () => void;
  isLoading: boolean;
  isExporting: boolean;
  hasScript: boolean;
  hasOutline: boolean;
  isComplete: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onContinue,
  onExport,
  onAnalyze,
  onAnalyzeDialogue,
  isLoading,
  isExporting,
  hasScript,
  hasOutline,
  isComplete,
}) => {
  const [isExportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!hasOutline) return null;

  return (
    <div className="flex-shrink-0 p-4 bg-gray-900/50 backdrop-blur-sm border-t border-gray-700 flex items-center justify-center gap-4 flex-wrap">
      <button
        onClick={onContinue}
        disabled={isLoading || isComplete || !hasScript}
        className="flex items-center justify-center py-2.5 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:bg-gray-500/50 disabled:cursor-not-allowed transition-colors"
      >
        <ContinueIcon />
        {isComplete ? "Kịch bản Hoàn tất" : "Viết tiếp"}
      </button>
      <div className="flex items-center gap-2">
        <button
          onClick={onAnalyze}
          disabled={isLoading || isExporting || !hasScript}
          className="flex items-center justify-center py-2.5 px-4 border border-transparent rounded-l-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-teal-500 disabled:bg-gray-500/50 disabled:cursor-not-allowed transition-colors"
        >
          <SparklesIcon />
          Phân tích SEO
        </button>
        <button
          onClick={onAnalyzeDialogue}
          disabled={isLoading || isExporting || !hasScript}
          className="flex items-center justify-center py-2.5 px-4 border border-transparent rounded-r-md shadow-sm text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 disabled:bg-gray-500/50 disabled:cursor-not-allowed transition-colors"
        >
          <DialogueIcon />
          Phân tích Thoại
        </button>
      </div>
      <div className="relative" ref={exportMenuRef}>
        <button
          onClick={() => setExportMenuOpen((prev) => !prev)}
          disabled={isLoading || isExporting || !hasScript}
          className="flex items-center justify-center py-2.5 px-6 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-200 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-500 disabled:bg-gray-600/50 disabled:cursor-not-allowed transition-colors"
        >
          <ExportIcon />
          {isExporting ? "Đang xuất..." : "Xuất File"}
          <ChevronUpIcon />
        </button>
        {isExportMenuOpen && (
          <div className="absolute bottom-full mb-2 w-full bg-gray-700 border border-gray-600 rounded-md shadow-lg z-10">
            <button
              onClick={() => {
                onExport("txt");
                setExportMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 rounded-t-md"
            >
              Xuất file .txt
            </button>
            <button
              onClick={() => {
                onExport("json");
                setExportMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600"
            >
              Xuất file .json
            </button>
            <button
              onClick={() => {
                onExport("srt");
                setExportMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600"
            >
              Xuất file .srt
            </button>
            <button
              onClick={() => {
                onExport("fountain");
                setExportMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600"
            >
              Xuất file .fountain
            </button>
            <button
              onClick={() => {
                onExport("image-prompts-json");
                setExportMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 rounded-b-md"
            >
              Xuất Image Prompts (.json)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface SubtitleChunk {
  id: number;
  text: string;
  startTime: number; // ms
  endTime: number; // ms
}

interface SrtGenerationOutput {
  srtContent: string;
  chunks: SubtitleChunk[];
}

const generateSrtContent = (
  chapters: Chapter[],
  lang: "vi" | "en"
): SrtGenerationOutput => {
  let srtContent = "";
  const chunks: SubtitleChunk[] = [];
  let counter = 1;
  let currentTime = 1000; // Bắt đầu từ 1 giây
  const WORDS_PER_SECOND = 2.5;
  const MIN_DURATION = 3000; // 3 giây
  const MAX_DURATION = 7000; // 7 giây
  const PAUSE_BETWEEN_LINES = 400; // ms
  const PAUSE_BETWEEN_CHAPTERS = 2000; // ms
  const MAX_LINE_LENGTH = 45;

  const formatTimestamp = (ms: number): string => {
    const pad = (num: number, size = 2) => ("000" + num).slice(size * -1);
    const hours = Math.floor(ms / 3600000);
    ms %= 3600000;
    const minutes = Math.floor(ms / 60000);
    ms %= 60000;
    const seconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(
      milliseconds,
      3
    )}`;
  };

  chapters.forEach((chapter, index) => {
    // Thêm tiêu đề chương
    const chapterTitleText = lang === "vi" ? "Chương" : "Chapter";
    const chapterTitle = `${chapterTitleText} ${index + 1}: ${chapter.title}`;
    const titleStartTime = currentTime;
    const titleEndTime = titleStartTime + 3000; // 3 giây cho tiêu đề

    srtContent += `${counter}\n`;
    srtContent += `${formatTimestamp(titleStartTime)} --> ${formatTimestamp(
      titleEndTime
    )}\n`;
    srtContent += `${chapterTitle}\n\n`;

    chunks.push({
      id: counter,
      text: chapterTitle,
      startTime: titleStartTime,
      endTime: titleEndTime,
    });

    counter++;
    currentTime = titleEndTime + PAUSE_BETWEEN_LINES;

    // Xử lý nội dung chương, giữ lại SFX
    const content = chapter.content.trim();
    const tokens = content
      .split(/(\[.*?\])/g)
      .filter(Boolean)
      .flatMap((part) => {
        if (part.startsWith("[") && part.endsWith("]")) {
          return [part.trim()];
        }
        return part.trim().split(/\s+/).filter(Boolean);
      });

    while (tokens.length > 0) {
      const lines: string[] = [];

      for (let i = 0; i < 2 && tokens.length > 0; i++) {
        let currentLine = "";
        while (tokens.length > 0) {
          const nextToken = tokens[0];
          const testLine = currentLine
            ? `${currentLine} ${nextToken}`
            : nextToken;
          if (testLine.length <= MAX_LINE_LENGTH) {
            currentLine = testLine;
            tokens.shift();
          } else {
            break;
          }
        }
        if (currentLine) {
          lines.push(currentLine);
        }
      }

      const subtitleText = lines.join("\n");
      if (!subtitleText.trim()) continue;

      const textOnlyForDuration = subtitleText.replace(/\[.*?\]/g, " ");
      const wordCount = textOnlyForDuration.split(/\s+/).filter(Boolean).length;

      let duration;
      if (wordCount > 0) {
        duration = Math.max(
          MIN_DURATION,
          (wordCount / WORDS_PER_SECOND) * 1000
        );
        duration = Math.min(duration, MAX_DURATION);
      } else {
        duration = 2000;
      }

      const startTime = currentTime;
      const endTime = startTime + duration;

      srtContent += `${counter}\n`;
      srtContent += `${formatTimestamp(startTime)} --> ${formatTimestamp(
        endTime
      )}\n`;
      srtContent += `${subtitleText}\n\n`;

      chunks.push({
        id: counter,
        text: subtitleText,
        startTime: startTime,
        endTime: endTime,
      });

      counter++;
      currentTime = endTime + PAUSE_BETWEEN_LINES;
    }

    currentTime += PAUSE_BETWEEN_CHAPTERS;
  });

  return { srtContent, chunks };
};

interface StructuredScriptItem {
  chapter: number;
  speaker: string;
  text: string;
  sfx: string;
  emotion: string;
  duration: number;
}

const generateStructuredJson = (
  chapters: Chapter[]
): StructuredScriptItem[] => {
  const structuredScript: StructuredScriptItem[] = [];
  const WORDS_PER_SECOND = 2.5;
  const MAX_CHUNK_DURATION = 20; // seconds

  chapters.forEach((chapter, index) => {
    const chapterNumber = index + 1;
    const emotion = chapter.emotionTag || chapter.mainEmotion; // Ưu tiên thẻ tiếng Anh

    // 1. Chuẩn hóa các thẻ trong toàn bộ nội dung chương
    let processedContent = chapter.content
      .replace(/\[sound:/g, "[sfx:")
      .replace(/\[pause=([\d.]+)\]/g, "[pause:$1s]");

    // 2. Tách thành các khối logic (đoạn văn hoặc lời thoại của một nhân vật)
    const contentBlocks = processedContent
      .split("\n")
      .filter((line) => line.trim() !== "");

    for (const block of contentBlocks) {
      let speaker = "Narrator";
      let textBlock = block.trim();

      // 3. Xác định người nói
      const speakerMatch = textBlock.match(/^([A-ZÀ-Ỹ][A-ZÀ-Ỹ0-9\s]+):\s*(.*)/);
      if (speakerMatch) {
        speaker = speakerMatch[1].trim();
        textBlock = speakerMatch[2].trim();
      }
      if (!textBlock) continue;

      // 4. Chia khối văn bản thành các câu để xử lý các đoạn dài
      const sentences = textBlock.match(/[^.!?]+[.!?]*\s*/g) || [textBlock];
      let currentChunkText = "";

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const tempChunk = currentChunkText
          ? `${currentChunkText} ${sentence}`.trim()
          : sentence;
        const wordCount = tempChunk.split(/\s+/).filter(Boolean).length;
        const estimatedDuration = wordCount / WORDS_PER_SECOND;

        if (estimatedDuration > MAX_CHUNK_DURATION && currentChunkText) {
          // Hoàn thành và đẩy khối hiện tại vào mảng
          const finalizedWordCount = currentChunkText
            .split(/\s+/)
            .filter(Boolean).length;
          const sfxTags = currentChunkText.match(/\[sfx:.*?\]/g) || [];

          structuredScript.push({
            chapter: chapterNumber,
            speaker: speaker,
            text: currentChunkText,
            sfx: sfxTags.join(" ").trim(),
            emotion: emotion,
            duration: parseFloat(
              Math.max(1.0, finalizedWordCount / WORDS_PER_SECOND).toFixed(2)
            ),
          });

          // Bắt đầu khối mới với câu hiện tại
          currentChunkText = sentence.trim();
        } else {
          // Thêm câu vào khối hiện tại
          currentChunkText = tempChunk;
        }
      }

      // 5. Đẩy khối cuối cùng còn lại vào mảng
      if (currentChunkText) {
        const finalizedWordCount = currentChunkText
          .split(/\s+/)
          .filter(Boolean).length;
        const sfxTags = currentChunkText.match(/\[sfx:.*?\]/g) || [];
        let duration = parseFloat(
          Math.max(1.0, finalizedWordCount / WORDS_PER_SECOND).toFixed(2)
        );

        if (finalizedWordCount === 0 && sfxTags.length > 0) {
          duration = 1.5; // Thời lượng mặc định cho dòng chỉ có SFX
        }

        structuredScript.push({
          chapter: chapterNumber,
          speaker: speaker,
          text: currentChunkText,
          sfx: sfxTags.join(" ").trim(),
          emotion: emotion,
          duration: duration,
        });
      }
    }
  });

  return structuredScript;
};

const AnalysisResultModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  result: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  streamingText: string | null;
  config: ScriptConfig;
}> = ({ isOpen, onClose, result, isLoading, error, streamingText, config }) => {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const handleCopy = (textToCopy: string, key: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedStates((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const handleExportJson = () => {
    if (!result) return;
    const safeTitle =
      config.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "script";
    const filename = `${safeTitle}_analysis.json`;
    const jsonString = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonString], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <header className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-indigo-400 font-sans">
                Kết quả Phân tích SEO
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <CloseIcon />
              </button>
            </header>
            <div className="p-6 overflow-y-auto space-y-6">
              {isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-400">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mb-4"></div>
                  <h3 className="text-lg font-semibold font-sans">
                    Đang phân tích kịch bản...
                  </h3>
                  <p className="font-sans text-sm">
                    AI đang đọc và tối ưu hóa cho bạn. Vui lòng đợi.
                  </p>
                  {streamingText && (
                    <pre className="mt-4 text-left text-xs bg-gray-900/50 p-3 rounded-lg w-full max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                      {streamingText}
                    </pre>
                  )}
                </div>
              )}
              {error && (
                <div
                  className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg font-sans"
                  role="alert"
                >
                  <strong className="font-bold">Lỗi phân tích: </strong>
                  <span className="block sm:inline">{error}</span>
                </div>
              )}
              {result && !isLoading && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-200 mb-2 font-sans flex items-center justify-between">
                      Tiêu đề Gợi ý
                      <button
                        onClick={() =>
                          handleCopy(result.titles.join("\n"), "titles")
                        }
                        className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition-colors"
                      >
                        <CopyIcon />{" "}
                        {copiedStates["titles"] ? "Đã chép" : "Chép tất cả"}
                      </button>
                    </h3>
                    <ul className="space-y-2 bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                      {result.titles.map((title, i) => (
                        <li
                          key={i}
                          className="text-gray-300 font-serif text-sm"
                        >
                          {title}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-200 mb-2 font-sans flex items-center justify-between">
                      Mô tả
                      <button
                        onClick={() => handleCopy(result.description, "desc")}
                        className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition-colors"
                      >
                        <CopyIcon /> {copiedStates["desc"] ? "Đã chép" : "Chép"}
                      </button>
                    </h3>
                    <p className="bg-gray-900/50 p-3 rounded-lg border border-gray-700 text-gray-300 font-serif text-sm whitespace-pre-wrap">
                      {result.description}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-200 mb-2 font-sans flex items-center justify-between">
                      Hashtags
                      <button
                        onClick={() =>
                          handleCopy(
                            result.hashtags.map((h) => `#${h}`).join(" "),
                            "tags"
                          )
                        }
                        className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition-colors"
                      >
                        <CopyIcon /> {copiedStates["tags"] ? "Đã chép" : "Chép"}
                      </button>
                    </h3>
                    <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700 flex flex-wrap gap-2">
                      {result.hashtags.map((tag, i) => (
                        <span
                          key={i}
                          className="bg-teal-900/70 text-teal-200 text-xs font-medium px-2.5 py-1 rounded-full"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            {result && !isLoading && (
              <footer className="p-4 bg-gray-900/50 border-t border-gray-700 flex justify-end">
                <button
                  onClick={handleExportJson}
                  className="flex items-center justify-center py-2 px-4 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-200 bg-gray-700 hover:bg-gray-600"
                >
                  <ExportIcon />
                  Xuất JSON
                </button>
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const DialogueAnalysisModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  result: DialogueAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  streamingText: string | null;
}> = ({ isOpen, onClose, result, isLoading, error, streamingText }) => {
  const barColors = [
    "bg-indigo-500",
    "bg-teal-500",
    "bg-sky-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-emerald-500",
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <header className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-cyan-400 font-sans">
                Phân tích Thoại
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <CloseIcon />
              </button>
            </header>
            <div className="p-6 overflow-y-auto space-y-6">
              {isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-400">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4"></div>
                  <h3 className="text-lg font-semibold font-sans">
                    Đang phân tích thoại...
                  </h3>
                  <p className="font-sans text-sm">
                    AI đang đọc kịch bản và thống kê lời thoại. Vui lòng đợi.
                  </p>
                  {streamingText && (
                    <pre className="mt-4 text-left text-xs bg-gray-900/50 p-3 rounded-lg w-full max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                      {streamingText}
                    </pre>
                  )}
                </div>
              )}
              {error && (
                <div
                  className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg font-sans"
                  role="alert"
                >
                  <strong className="font-bold">Lỗi phân tích: </strong>
                  <span className="block sm:inline">{error}</span>
                </div>
              )}
              {result && !isLoading && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-200 mb-3 font-sans">
                      Phân bổ Lời thoại
                    </h3>
                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-3">
                      {result.characters
                        .sort((a, b) => b.percentage - a.percentage)
                        .map((char, index) => (
                          <div
                            key={char.name}
                            className="flex items-center gap-4 text-sm"
                          >
                            <span
                              className="font-semibold text-gray-300 w-32 truncate"
                              title={char.name}
                            >
                              {char.name}
                            </span>
                            <div className="w-full bg-gray-700 rounded-full h-5">
                              <div
                                className={`${
                                  barColors[index % barColors.length]
                                } h-5 rounded-full text-xs font-medium text-white text-center p-0.5 leading-none`}
                                style={{ width: `${char.percentage}%` }}
                                title={`${char.wordCount} words`}
                              >
                                {char.percentage >= 10
                                  ? `${char.percentage.toFixed(1)}%`
                                  : ""}
                              </div>
                            </div>
                            <span className="font-mono text-gray-400 w-20 text-right">
                              {char.percentage.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-200 mb-3 font-sans">
                      Thống kê & Giọng nói Nhân vật
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {result.characters.map((char, index) => (
                        <div
                          key={char.name}
                          className="bg-gray-900/50 p-4 rounded-lg border border-gray-700"
                        >
                          <div className="flex justify-between items-baseline">
                            <h4 className={`font-bold text-lg text-gray-100`}>
                              {char.name}
                            </h4>
                            <p className="text-sm text-gray-400">
                              {char.wordCount} words
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 mb-3">
                            5 TỪ SỬ DỤNG NHIỀU NHẤT
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {char.frequentWords.map((word) => (
                              <span
                                key={word}
                                className="bg-gray-700 text-gray-300 text-xs font-mono px-2 py-1 rounded"
                              >
                                {word}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ImagePromptConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: ImagePromptConfig) => void;
  isLoading: boolean;
  initialCharacterDesc: string;
}

const IMAGE_STYLES = [
  "Cinematic, hyperrealistic",
  "Anime, vibrant, detailed",
  "Fantasy art, painterly, epic",
  "Horror, dark, gritty, atmospheric",
  "Sci-fi, futuristic, sleek",
  "Pixel art, retro",
  "Watercolor, soft, expressive",
];

const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"];

const ImagePromptConfigModal: React.FC<ImagePromptConfigModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  initialCharacterDesc,
}) => {
  const [config, setConfig] = useState<ImagePromptConfig>({
    style: IMAGE_STYLES[0],
    artisticInfluence: "",
    aspectRatio: ASPECT_RATIOS[0],
    characterDescriptions: initialCharacterDesc,
  });

  useEffect(() => {
    if (isOpen) {
      setConfig((prev) => ({
        ...prev,
        characterDescriptions: initialCharacterDesc,
      }));
    }
  }, [isOpen, initialCharacterDesc]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(config);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <header className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-indigo-400 font-sans">
                Cấu hình Image Prompts
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <CloseIcon />
              </button>
            </header>
            <form
              onSubmit={handleSubmit}
              className="p-6 overflow-y-auto space-y-5"
            >
              <div>
                <label
                  htmlFor="style"
                  className="block text-sm font-medium text-gray-400"
                >
                  Phong cách Ảnh
                </label>
                <select
                  name="style"
                  id="style"
                  value={config.style}
                  onChange={handleChange}
                  className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
                >
                  {IMAGE_STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="artisticInfluence"
                  className="block text-sm font-medium text-gray-400"
                >
                  Ảnh hưởng nghệ thuật (tùy chọn)
                </label>
                <input
                  type="text"
                  name="artisticInfluence"
                  id="artisticInfluence"
                  value={config.artisticInfluence}
                  onChange={handleChange}
                  className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
                  placeholder="ví dụ: by studio ghibli, by greg rutkowski"
                />
              </div>
              <div>
                <label
                  htmlFor="aspectRatio"
                  className="block text-sm font-medium text-gray-400"
                >
                  Tỉ lệ Khung hình
                </label>
                <select
                  name="aspectRatio"
                  id="aspectRatio"
                  value={config.aspectRatio}
                  onChange={handleChange}
                  className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
                >
                  {ASPECT_RATIOS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="characterDescriptions"
                  className="block text-sm font-medium text-gray-400"
                >
                  Mô tả nhân vật (để đồng bộ)
                </label>
                <textarea
                  name="characterDescriptions"
                  id="characterDescriptions"
                  rows={4}
                  value={config.characterDescriptions}
                  onChange={handleChange}
                  className="mt-1 block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 py-2.5 px-3"
                  placeholder="KHAI: A young man, 20s, short black hair, wearing a worn-out leather jacket.&#10;MORGRA: An ancient sorceress, long white hair, glowing purple eyes."
                ></textarea>
              </div>
            </form>
            <footer className="p-4 bg-gray-900/50 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={onClose}
                type="button"
                className="py-2 px-4 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-200 bg-gray-700 hover:bg-gray-600"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-500/50 disabled:cursor-not-allowed"
              >
                <SparklesIcon />
                {isLoading ? "Đang tạo..." : "Tạo Prompts"}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ImagePromptsDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompts: string[] | null;
  isLoading: boolean;
  error: string | null;
}

const ImagePromptsDisplayModal: React.FC<ImagePromptsDisplayModalProps> = ({
  isOpen,
  onClose,
  prompts,
  isLoading,
  error,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyAll = () => {
    if (!prompts) return;
    const textToCopy = prompts.join("\n\n");
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <header className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-indigo-400 font-sans">
                Image Prompts đã tạo
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <CloseIcon />
              </button>
            </header>
            <div className="p-6 overflow-y-auto">
              {isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-400">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mb-4"></div>
                  <h3 className="text-lg font-semibold font-sans">
                    Đang tạo prompts...
                  </h3>
                  <p className="font-sans text-sm">
                    AI đang phân tích kịch bản của bạn. Vui lòng đợi.
                  </p>
                </div>
              )}
              {error && (
                <div
                  className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg font-sans"
                  role="alert"
                >
                  <strong className="font-bold">Lỗi tạo prompt: </strong>
                  <span className="block sm:inline">{error}</span>
                </div>
              )}
              {prompts && !isLoading && (
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  {prompts.map((prompt, i) => (
                    <p
                      key={i}
                      className="text-gray-300 font-serif text-sm mb-4 last:mb-0"
                    >
                      {prompt}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <footer className="p-4 bg-gray-900/50 border-t border-gray-700 flex justify-end">
              <button
                onClick={handleCopyAll}
                disabled={!prompts || prompts.length === 0 || isLoading}
                className="flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-500/50 disabled:cursor-not-allowed"
              >
                <CopyIcon />
                <span className="ml-2">
                  {copied ? "Đã chép!" : "Chép tất cả"}
                </span>
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const getInitialConfig = (): ScriptConfig => ({
  title: "",
  genre: GENRES.vi[0],
  idea: "",
  wordCount: "300",
  style: WRITING_STYLES.vi[0],
  language: "vi",
  totalChapters: "5",
  enableSfx: false,
  sfxIntensity: "natural",
  rating: "pg13",
  characterDescriptions: "",
  aiModel: "auto",
});

interface ScriptNavigatorProps {
  script: Chapter[];
  config: ScriptConfig;
}

const ScriptNavigator: React.FC<ScriptNavigatorProps> = ({
  script,
  config,
}) => {
  if (script.length < 2) return null;
  return (
    <div className="absolute top-4 -right-4 h-full hidden xl:block">
      <div className="sticky top-8 w-48 pl-8">
        <h4 className="font-sans text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Điều hướng
        </h4>
        <ul className="space-y-2 border-l border-gray-700">
          {script.map((chapter, index) => (
            <li key={index}>
              <a
                href={`#chapter-${index}`}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(`chapter-${index}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="block text-gray-400 hover:text-indigo-300 text-sm font-medium transition-colors -ml-px pl-4 border-l-2 border-transparent hover:border-indigo-400"
              >
                {config.language === "vi" ? "P." : "Ch."} {index + 1}:{" "}
                {chapter.title.length > 20
                  ? chapter.title.substring(0, 18) + "..."
                  : chapter.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [config, setConfig] = useState<ScriptConfig>(getInitialConfig());
  const [script, setScript] = useState<Chapter[]>([]);
  const [outline, setOutline] = useState<string | null>(null);
  const [streamingOutline, setStreamingOutline] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [currentApiKeyIndex, setCurrentApiKeyIndex] = useState(0);
  const [autoSwitchKey, setAutoSwitchKey] = useState(true);

  const [isSuggestingIdea, setIsSuggestingIdea] = useState(false);
  const [isSuggestingCharacters, setIsSuggestingCharacters] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const [isAnalysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [streamingAnalysisText, setStreamingAnalysisText] = useState<
    string | null
  >(null);

  const [isDialogueAnalysisModalOpen, setDialogueAnalysisModalOpen] =
    useState(false);
  const [dialogueAnalysisResult, setDialogueAnalysisResult] =
    useState<DialogueAnalysisResult | null>(null);
  const [isAnalyzingDialogue, setIsAnalyzingDialogue] = useState(false);
  const [dialogueAnalysisError, setDialogueAnalysisError] = useState<
    string | null
  >(null);
  const [streamingDialogueAnalysis, setStreamingDialogueAnalysis] = useState<
    string | null
  >(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImagePromptModalOpen, setIsImagePromptModalOpen] = useState(false);
  const [isPromptsDisplayModalOpen, setIsPromptsDisplayModalOpen] =
    useState(false);
  const [generatedImagePrompts, setGeneratedImagePrompts] = useState<
    string[] | null
  >(null);
  const [imagePromptError, setImagePromptError] = useState<string | null>(null);

  // Debug function to check localStorage
  const debugLocalStorage = () => {
    console.log("🔍 === LOCALSTORAGE DEBUG ===");
    console.log("📊 Current state:", {
      apiKeys,
      currentApiKeyIndex,
      autoSwitchKey,
      keysCount: apiKeys.length,
    });

    console.log("💾 localStorage contents:");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        console.log(`  ${key}:`, value);
      }
    }

    console.log("🔍 Specific checks:");
    console.log("  apiKeys:", localStorage.getItem("apiKeys"));
    console.log(
      "  currentApiKeyIndex:",
      localStorage.getItem("currentApiKeyIndex")
    );
    console.log("  autoSwitchKey:", localStorage.getItem("autoSwitchKey"));
    console.log("=== END DEBUG ===");

    // Log debug info to console
    const savedKeys = localStorage.getItem("apiKeys");
    const keysCount = savedKeys ? JSON.parse(savedKeys).length : 0;
    console.log("🔍 Debug Info:");
    console.log(`- Current API Keys: ${apiKeys.length}`);
    console.log(`- Saved API Keys: ${keysCount}`);
    console.log(`- Current Index: ${currentApiKeyIndex}`);
    console.log(`- Auto Switch: ${autoSwitchKey}`);
  };

  // Test localStorage functionality
  const testLocalStorage = () => {
    try {
      const testKey = "test_key_" + Date.now();
      const testValue = "test_value_" + Math.random();

      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      if (retrieved === testValue) {
        console.log("✅ localStorage test PASSED");
        return true;
      } else {
        console.error("❌ localStorage test FAILED - value mismatch");
        return false;
      }
    } catch (e) {
      console.error("❌ localStorage test FAILED - error:", e);
      return false;
    }
  };

  // Load API keys from localStorage on mount
  useEffect(() => {
    console.log("🔍 App mounted, loading from localStorage...");

    // Test localStorage first
    if (!testLocalStorage()) {
      console.error("❌ localStorage is not working properly!");
      return;
    }

    try {
      // Check if localStorage is available
      if (typeof Storage === "undefined") {
        console.error("❌ localStorage is not supported");
        return;
      }

      const savedKeys = localStorage.getItem("apiKeys");
      const savedIndex = localStorage.getItem("currentApiKeyIndex");
      const savedAutoSwitch = localStorage.getItem("autoSwitchKey");

      console.log("📦 Raw localStorage data:", {
        savedKeys,
        savedIndex,
        savedAutoSwitch,
        keysLength: savedKeys ? savedKeys.length : 0,
      });

      if (savedKeys) {
        try {
          const parsedKeys = JSON.parse(savedKeys);
          console.log("✅ Successfully parsed API keys:", parsedKeys);
          if (Array.isArray(parsedKeys) && parsedKeys.length > 0) {
            setApiKeys(parsedKeys);
            console.log("🎯 Set API keys state:", parsedKeys);
          } else {
            console.warn("⚠️ Parsed keys is not a valid array or empty");
          }
        } catch (parseError) {
          console.error("❌ Failed to parse API keys:", parseError);
        }
      } else {
        console.log("ℹ️ No saved API keys found");

        // Try to restore from sessionStorage backup
        try {
          const backupKeys = sessionStorage.getItem("apiKeys_backup");
          if (backupKeys) {
            const parsedBackup = JSON.parse(backupKeys);
            if (Array.isArray(parsedBackup) && parsedBackup.length > 0) {
              console.log("🔄 Found sessionStorage backup, restoring...");
              setApiKeys(parsedBackup);
              // Save to localStorage
              localStorage.setItem("apiKeys", backupKeys);
              console.log("✅ Restored from sessionStorage backup");
            }
          }
        } catch (e) {
          console.warn("⚠️ Failed to restore from sessionStorage backup:", e);
        }
      }

      if (savedIndex) {
        try {
          const parsedIndex = parseInt(savedIndex, 10);
          console.log("✅ Successfully parsed current index:", parsedIndex);
          if (!isNaN(parsedIndex) && parsedIndex >= 0) {
            setCurrentApiKeyIndex(parsedIndex);
            console.log("🎯 Set current API key index:", parsedIndex);
          }
        } catch (parseError) {
          console.error("❌ Failed to parse current index:", parseError);
        }
      }

      if (savedAutoSwitch) {
        try {
          const parsedAutoSwitch = JSON.parse(savedAutoSwitch);
          console.log("✅ Successfully parsed auto switch:", parsedAutoSwitch);
          setAutoSwitchKey(parsedAutoSwitch);
          console.log("🎯 Set auto switch:", parsedAutoSwitch);
        } catch (parseError) {
          console.error("❌ Failed to parse auto switch:", parseError);
        }
      }
    } catch (e) {
      console.error("❌ Critical error loading from localStorage:", e);
    }

    // Debug localStorage after loading
    setTimeout(() => {
      debugLocalStorage();
    }, 1000);
  }, []);

  // Save API keys to localStorage on change
  useEffect(() => {
    console.log("💾 Saving to localStorage triggered...");

    try {
      // Check if localStorage is available
      if (typeof Storage === "undefined") {
        console.error("❌ localStorage is not supported");
        return;
      }

      console.log("📝 Data to save:", {
        apiKeys,
        currentApiKeyIndex,
        autoSwitchKey,
        keysCount: apiKeys.length,
      });

      // Only save if we have data to save
      if (apiKeys.length > 0) {
        localStorage.setItem("apiKeys", JSON.stringify(apiKeys));
        console.log("✅ Saved API keys:", apiKeys);
      } else {
        console.log("ℹ️ No API keys to save, skipping...");
      }

      localStorage.setItem(
        "currentApiKeyIndex",
        JSON.stringify(currentApiKeyIndex)
      );
      console.log("✅ Saved current API key index:", currentApiKeyIndex);

      localStorage.setItem("autoSwitchKey", JSON.stringify(autoSwitchKey));
      console.log("✅ Saved auto switch setting:", autoSwitchKey);

      // Verify the save
      const verifyKeys = localStorage.getItem("apiKeys");
      console.log(
        "🔍 Verification - saved keys:",
        verifyKeys ? JSON.parse(verifyKeys) : null
      );
    } catch (e) {
      console.error("❌ Failed to save to localStorage:", e);
    }
  }, [apiKeys, currentApiKeyIndex, autoSwitchKey]);

  const isScriptComplete = script.length >= parseInt(config.totalChapters, 10);

  const getPlaceholderChapter = (): Chapter => ({
    title: config.language === "vi" ? "Đang tạo..." : "Generating...",
    content: "",
    mainEmotion: "...",
    emotionTag: "...",
    keyEvent: "...",
    endingHook: "...",
  });

  const callApiWithAutoSwitch = async <T,>(
    apiCall: (apiKey: string) => Promise<T>
  ): Promise<T> => {
    if (apiKeys.length === 0) {
      throw new Error(
        "Không có API Key nào được cung cấp. Vui lòng thêm một key trong Cài đặt Nâng cao."
      );
    }

    let triedKeysCount = 0;
    let internalIndex = currentApiKeyIndex;

    while (triedKeysCount < apiKeys.length) {
      const currentKey = apiKeys[internalIndex];
      try {
        const result = await apiCall(currentKey);
        // On success, update the main index if it was changed
        if (internalIndex !== currentApiKeyIndex) {
          setCurrentApiKeyIndex(internalIndex);
        }
        return result;
      } catch (e: any) {
        console.warn(`API key at index ${internalIndex} failed.`, e.message);
        triedKeysCount++;
        if (autoSwitchKey && triedKeysCount < apiKeys.length) {
          internalIndex = (internalIndex + 1) % apiKeys.length;
          const errorMsg =
            config.language === "vi"
              ? `Key lỗi, đang tự động thử key tiếp theo... (${triedKeysCount}/${apiKeys.length})`
              : `Key failed, auto-switching to next key... (${triedKeysCount}/${apiKeys.length})`;
          setError(errorMsg); // Use main error state for this
        } else {
          const finalError = new Error(
            `Tất cả ${apiKeys.length} API key đều lỗi. Lỗi cuối cùng: ${e.message}`
          );
          throw finalError;
        }
      }
    }
    throw new Error("Không thể thực hiện yêu cầu API.");
  };

  const handleSuggestIdea = useCallback(async () => {
    if (!config.genre) {
      setSuggestionError(
        config.language === "vi"
          ? "Vui lòng chọn một thể loại trước."
          : "Please select a genre first."
      );
      return;
    }
    setIsSuggestingIdea(true);
    setSuggestionError(null);
    setError(null);
    try {
      const ideas = await callApiWithAutoSwitch((apiKey) =>
        generateIdeaSuggestion(apiKey, config)
      );
      if (ideas && ideas.length > 0) {
        const randomIdea = ideas[Math.floor(Math.random() * ideas.length)];
        setConfig((prev) => ({ ...prev, idea: randomIdea }));
      }
    } catch (e: any) {
      setSuggestionError(
        e.message ||
          (config.language === "vi"
            ? "Lỗi khi gợi ý ý tưởng."
            : "Failed to suggest an idea.")
      );
    } finally {
      setIsSuggestingIdea(false);
    }
  }, [
    config.language,
    config.genre,
    apiKeys,
    autoSwitchKey,
    currentApiKeyIndex,
  ]);

  const handleSuggestCharacters = useCallback(async () => {
    if (!config.idea) {
      setSuggestionError(
        config.language === "vi"
          ? "Vui lòng nhập ý tưởng trước."
          : "Please enter an idea first."
      );
      return;
    }
    setIsSuggestingCharacters(true);
    setSuggestionError(null);
    setError(null);
    try {
      const descriptions = await callApiWithAutoSwitch((apiKey) =>
        generateCharacterSuggestion(apiKey, config)
      );
      setConfig((prev) => ({ ...prev, characterDescriptions: descriptions }));
    } catch (e: any) {
      setSuggestionError(
        e.message ||
          (config.language === "vi"
            ? "Lỗi khi gợi ý nhân vật."
            : "Failed to suggest characters.")
      );
    } finally {
      setIsSuggestingCharacters(false);
    }
  }, [
    config.language,
    config.idea,
    apiKeys,
    autoSwitchKey,
    currentApiKeyIndex,
  ]);

  const handleGenerateOutline = useCallback(async () => {
    if (!config.idea.trim() || !config.title.trim()) {
      setError("Vui lòng cung cấp tên kịch bản và ý tưởng ban đầu.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuggestionError(null);
    setScript([]);
    setOutline(null);
    setStreamingOutline("");

    try {
      const onStream = (text: string) => {
        setStreamingOutline(text); // Default to raw text
        try {
          const parsed = JSON.parse(
            text
              .trim()
              .replace(/^```json/, "")
              .replace(/```$/, "")
          );
          if (parsed && Array.isArray(parsed.chapters)) {
            const prefix = config.language === "vi" ? "Phần" : "Chapter";
            const streamingOutlineText = parsed.chapters
              .map(
                (c: any) =>
                  `${prefix} ${c.chapter || "..."}: ${c.summary || "..."}`
              )
              .join("\n");
            setStreamingOutline(streamingOutlineText);
          }
        } catch (e) {
          // It's normal for partial JSON to fail parsing, so we just show the raw text.
        }
      };
      const generatedOutline = await callApiWithAutoSwitch((apiKey) =>
        generateOutline(apiKey, config, onStream)
      );
      setOutline(generatedOutline);
    } catch (e: any) {
      setError(e.message || "Đã xảy ra lỗi khi tạo dàn ý.");
    } finally {
      setIsLoading(false);
      setStreamingOutline(null);
    }
  }, [config, apiKeys, autoSwitchKey, currentApiKeyIndex]);

  const handleGenerateFirstChapter = useCallback(async () => {
    if (!outline) return;

    setIsLoading(true);
    setError(null);
    setSuggestionError(null);
    const placeholder = getPlaceholderChapter();
    setScript([placeholder]);

    try {
      const onStream = (text: string) => {
        let partialData: Partial<Chapter> = {};
        try {
          const parsed = JSON.parse(
            text
              .trim()
              .replace(/^```json/, "")
              .replace(/```$/, "")
          );
          partialData = parsed;
        } catch (e) {
          /* ignore */
        }

        setScript([
          {
            ...placeholder,
            ...partialData,
            content: partialData.content || text,
          },
        ]);
      };

      const firstChapter = await callApiWithAutoSwitch((apiKey) =>
        generateInitialChapter(apiKey, config, outline, onStream)
      );
      setScript([firstChapter]);
    } catch (e: any) {
      setError(e.message || "Đã xảy ra lỗi không mong muốn.");
      setScript([]);
    } finally {
      setIsLoading(false);
    }
  }, [config, outline, apiKeys, autoSwitchKey, currentApiKeyIndex]);

  const handleSubmit = () => {
    if (!outline) {
      handleGenerateOutline();
    } else if (script.length === 0) {
      handleGenerateFirstChapter();
    } else {
      if (
        window.confirm(
          "Bắt đầu kịch bản mới sẽ xoá toàn bộ dàn ý và nội dung hiện tại. Bạn có chắc chắn?"
        )
      ) {
        setOutline(null);
        setScript([]);
        handleGenerateOutline();
      }
    }
  };

  const handleContinue = useCallback(async () => {
    if (!outline || script.length === 0 || isScriptComplete) return;
    setIsLoading(true);
    setError(null);
    setSuggestionError(null);

    const placeholder = getPlaceholderChapter();
    const currentIndex = script.length;
    setScript((prev) => [...prev, placeholder]);

    try {
      const onStream = (text: string) => {
        let partialData: Partial<Chapter> = {};
        try {
          const parsed = JSON.parse(
            text
              .trim()
              .replace(/^```json/, "")
              .replace(/```$/, "")
          );
          partialData = parsed;
        } catch (e) {
          /* ignore */
        }

        setScript((prev) => {
          const updatedScript = [...prev];
          updatedScript[currentIndex] = {
            ...prev[currentIndex],
            ...partialData,
            content: partialData.content || text,
          };
          return updatedScript;
        });
      };

      const nextChapter = await callApiWithAutoSwitch((apiKey) =>
        generateNextChapter(apiKey, config, script, outline, onStream)
      );
      setScript((prev) => {
        const updatedScript = [...prev];
        updatedScript[currentIndex] = nextChapter;
        return updatedScript;
      });
    } catch (e: any) {
      setError(
        e.message || "Đã xảy ra lỗi không mong muốn khi viết tiếp kịch bản."
      );
      setScript((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [
    config,
    script,
    isScriptComplete,
    outline,
    apiKeys,
    autoSwitchKey,
    currentApiKeyIndex,
  ]);

  const handleRewriteChapter = useCallback(
    async (indexToRewrite: number) => {
      if (!outline) return;

      setIsLoading(true);
      setError(null);
      setSuggestionError(null);
      const originalChapter = script[indexToRewrite];
      const placeholder = getPlaceholderChapter();

      setScript((prev) =>
        prev.map((c, i) =>
          i === indexToRewrite ? { ...placeholder, title: c.title } : c
        )
      );

      try {
        const onStream = (text: string) => {
          let partialData: Partial<Chapter> = {};
          try {
            const parsed = JSON.parse(
              text
                .trim()
                .replace(/^```json/, "")
                .replace(/```$/, "")
            );
            partialData = parsed;
          } catch (e) {
            /* ignore */
          }

          setScript((prev) => {
            const updatedScript = [...prev];
            updatedScript[indexToRewrite] = {
              ...prev[indexToRewrite],
              ...partialData,
              content: partialData.content || text,
            };
            return updatedScript;
          });
        };

        const rewrittenChapter = await callApiWithAutoSwitch((apiKey) =>
          rewriteChapter(
            apiKey,
            config,
            script,
            indexToRewrite,
            outline,
            onStream
          )
        );
        setScript((prev) =>
          prev.map((chapter, i) =>
            i === indexToRewrite ? rewrittenChapter : chapter
          )
        );
      } catch (e: any) {
        setError(
          e.message || "Đã xảy ra lỗi không mong muốn khi viết lại chương."
        );
        setScript((prev) =>
          prev.map((c, i) => (i === indexToRewrite ? originalChapter : c))
        );
      } finally {
        setIsLoading(false);
      }
    },
    [config, script, outline, apiKeys, autoSwitchKey, currentApiKeyIndex]
  );

  const handleDeleteChapter = useCallback((indexToDelete: number) => {
    if (
      window.confirm(
        "Bạn có chắc chắn muốn xoá chương này không? Hành động này không thể hoàn tác."
      )
    ) {
      setScript((prev) => prev.filter((_, i) => i !== indexToDelete));
    }
  }, []);

  const handleGenerateImagePrompts = useCallback(
    async (imageConfig: ImagePromptConfig) => {
      setIsExporting(true);
      setImagePromptError(null);
      setGeneratedImagePrompts(null);
      setIsImagePromptModalOpen(false);
      setIsPromptsDisplayModalOpen(true);

      try {
        const { chunks } = generateSrtContent(script, config.language);
        const promptPayload = chunks.map((chunk) => ({
          id: chunk.id,
          text: chunk.text,
        }));
        const PAYLOAD_CHUNK_SIZE = 25;
        const payloadChunks = [];
        for (let i = 0; i < promptPayload.length; i += PAYLOAD_CHUNK_SIZE) {
          payloadChunks.push(promptPayload.slice(i, i + PAYLOAD_CHUNK_SIZE));
        }

        const imagePromptResults = await Promise.all(
          payloadChunks.map((chunk) =>
            callApiWithAutoSwitch((apiKey) =>
              generateImagePromptsForScript(apiKey, config, chunk, imageConfig)
            )
          )
        );
        const imagePrompts = imagePromptResults.flat();

        const promptStrings = imagePrompts
          .sort((a, b) => a.id - b.id)
          .map((p) => p.prompt);
        setGeneratedImagePrompts(promptStrings);
      } catch (e: any) {
        const errorMessage =
          config.language === "vi"
            ? `Lỗi khi tạo Image Prompts: ${e.message}`
            : `Error generating Image Prompts: ${e.message}`;
        setImagePromptError(errorMessage);
      } finally {
        setIsExporting(false);
      }
    },
    [config, script, apiKeys, autoSwitchKey, currentApiKeyIndex]
  );

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (script.length === 0) return;

      const safeTitle =
        config.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "script";
      let blob: Blob;
      let filename: string;

      switch (format) {
        case "txt": {
          let fullContent = `Tên Kịch bản: ${config.title}\nThể loại: ${config.genre}\nPhong cách Viết: ${config.style}\nTổng số phần: ${config.totalChapters}\n\n`;
          if (outline) {
            fullContent += `DÀN Ý:\n----------------------------------------\n${outline}\n----------------------------------------\n\n`;
          }
          const body = script
            .map(
              (chapter, i) =>
                `## ${config.language === "vi" ? "Chương" : "Chapter"} ${
                  i + 1
                }: ${chapter.title}\n\n${chapter.content}\n\n`
            )
            .join("----------------------------------------\n\n");
          blob = new Blob([fullContent + body], {
            type: "text/plain;charset=utf-8",
          });
          filename = `${safeTitle}.txt`;
          break;
        }
        case "json": {
          const structuredData = generateStructuredJson(script);
          const jsonString = JSON.stringify(structuredData, null, 2);
          blob = new Blob([jsonString], {
            type: "application/json;charset=utf-8",
          });
          filename = `${safeTitle}.json`;
          break;
        }
        case "srt": {
          const { srtContent } = generateSrtContent(script, config.language);
          blob = new Blob([srtContent], {
            type: "application/x-subrip;charset=utf-8",
          });
          filename = `${safeTitle}.srt`;
          break;
        }
        case "fountain": {
          let fountainContent = `Title: ${config.title}\n\n`;
          script.forEach((chapter, i) => {
            fountainContent += `\n.CHAPTER ${
              i + 1
            }: ${chapter.title.toUpperCase()}\n\n`;
            const paragraphs = chapter.content
              .split("\n")
              .filter((p) => p.trim() !== "");
            paragraphs.forEach((p) => {
              fountainContent += `${p}\n\n`;
            });
          });
          blob = new Blob([fountainContent], {
            type: "text/plain;charset=utf-8",
          });
          filename = `${safeTitle}.fountain`;
          break;
        }
        case "image-prompts-json": {
          setGeneratedImagePrompts(null);
          setImagePromptError(null);
          setIsImagePromptModalOpen(true);
          return;
        }
        default:
          return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [config, script, outline]
  );

  const handleAnalyzeScript = useCallback(async () => {
    setAnalysisModalOpen(true);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setStreamingAnalysisText("");
    try {
      const onStream = (text: string) => {
        setStreamingAnalysisText(text);
      };
      const result = await callApiWithAutoSwitch((apiKey) =>
        analyzeScriptForSEO(apiKey, config, script, onStream)
      );
      setAnalysisResult(result);
    } catch (e: any) {
      setAnalysisError(
        e.message || "Đã có lỗi xảy ra trong quá trình phân tích."
      );
    } finally {
      setIsAnalyzing(false);
      setStreamingAnalysisText(null);
    }
  }, [config, script, apiKeys, autoSwitchKey, currentApiKeyIndex]);

  const handleAnalyzeDialogue = useCallback(async () => {
    setDialogueAnalysisModalOpen(true);
    setIsAnalyzingDialogue(true);
    setDialogueAnalysisError(null);
    setDialogueAnalysisResult(null);
    setStreamingDialogueAnalysis("");
    try {
      const onStream = (text: string) => {
        setStreamingDialogueAnalysis(text);
      };
      const result = await callApiWithAutoSwitch((apiKey) =>
        analyzeDialogue(apiKey, config, script, onStream)
      );
      setDialogueAnalysisResult(result);
    } catch (e: any) {
      setDialogueAnalysisError(
        e.message || "Đã có lỗi xảy ra trong quá trình phân tích thoại."
      );
    } finally {
      setIsAnalyzingDialogue(false);
      setStreamingDialogueAnalysis(null);
    }
  }, [config, script, apiKeys, autoSwitchKey, currentApiKeyIndex]);

  const handleRefresh = () => {
    if (
      window.confirm(
        "Bạn có chắc chắn muốn làm mới và xoá toàn bộ kịch bản hiện tại không?"
      )
    ) {
      setConfig(getInitialConfig());
      setScript([]);
      setOutline(null);
      setError(null);
      setAnalysisModalOpen(false);
      setAnalysisResult(null);
      setAnalysisError(null);
      setIsLoading(false);
      setIsAnalyzing(false);
      setDialogueAnalysisModalOpen(false);
      setDialogueAnalysisResult(null);
      setDialogueAnalysisError(null);
      setIsAnalyzingDialogue(false);
    }
  };

  // Force clear all localStorage (for debugging)
  const handleForceClearStorage = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      setApiKeys([]);
      setCurrentApiKeyIndex(0);
      console.log("🗑️ Force cleared all storage and memory");
    } catch (e) {
      console.error("❌ Failed to force clear storage:", e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex-shrink-0 bg-gray-900/70 backdrop-blur-sm border-b border-gray-700 p-4 shadow-lg">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-center relative gap-3">
          <LogoIcon />
          <h1 className="text-2xl font-bold text-white tracking-wide">
            AI Script Writer Pro
          </h1>
          <div className="absolute right-0 flex items-center gap-2">
            <motion.button
              onClick={debugLocalStorage}
              className="p-2 rounded-full text-gray-400 hover:text-yellow-400 hover:bg-gray-700/50 transition-colors"
              title="Debug localStorage"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              🔍
            </motion.button>
            <motion.button
              onClick={handleForceClearStorage}
              className="p-2 rounded-full text-gray-400 hover:text-red-400 hover:bg-gray-700/50 transition-colors"
              title="Force clear all storage"
              whileHover={{ scale: 1.1, rotate: -5 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              🗑️
            </motion.button>
            <motion.button
              onClick={handleRefresh}
              className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
              title="Làm mới Tool"
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <RefreshIcon />
            </motion.button>
          </div>
        </div>
      </header>
      <main className="flex-grow grid grid-cols-1 lg:grid-cols-[450px_1fr] gap-6 p-6 mx-auto w-full xl:max-w-7xl">
        <aside className="lg:sticky lg:top-6 self-start">
          <div className="lg:max-h-[calc(100vh-6rem)] overflow-y-auto config-scrollbar">
            <ConfigPanel
              config={config}
              setConfig={setConfig}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              hasScript={script.length > 0}
              outline={outline}
              apiKeys={apiKeys}
              setApiKeys={setApiKeys}
              currentApiKeyIndex={currentApiKeyIndex}
              setCurrentApiKeyIndex={setCurrentApiKeyIndex}
              autoSwitchKey={autoSwitchKey}
              setAutoSwitchKey={setAutoSwitchKey}
              onSuggestIdea={handleSuggestIdea}
              onSuggestCharacters={handleSuggestCharacters}
              isSuggestingIdea={isSuggestingIdea}
              isSuggestingCharacters={isSuggestingCharacters}
              suggestionError={suggestionError}
            />
          </div>
        </aside>

        <section className="lg:col-span-1 bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-xl shadow-inner flex flex-col overflow-hidden">
          <div className="flex-grow overflow-y-auto relative">
            <ScriptNavigator script={script} config={config} />
            <ScriptDisplay
              script={script}
              outline={outline}
              streamingOutline={streamingOutline}
              isLoading={isLoading}
              error={error}
              config={config}
              onRewrite={handleRewriteChapter}
              onDelete={handleDeleteChapter}
              onOutlineChange={setOutline}
            />
          </div>
          <ActionButtons
            onContinue={handleContinue}
            onExport={handleExport}
            onAnalyze={handleAnalyzeScript}
            onAnalyzeDialogue={handleAnalyzeDialogue}
            isLoading={isLoading}
            isExporting={isExporting}
            hasScript={script.length > 0}
            hasOutline={!!outline}
            isComplete={isScriptComplete}
          />
        </section>
      </main>
      <AnalysisResultModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setAnalysisModalOpen(false)}
        result={analysisResult}
        isLoading={isAnalyzing}
        error={analysisError}
        streamingText={streamingAnalysisText}
        config={config}
      />
      <DialogueAnalysisModal
        isOpen={isDialogueAnalysisModalOpen}
        onClose={() => setDialogueAnalysisModalOpen(false)}
        result={dialogueAnalysisResult}
        isLoading={isAnalyzingDialogue}
        error={dialogueAnalysisError}
        streamingText={streamingDialogueAnalysis}
      />
      <ImagePromptConfigModal
        isOpen={isImagePromptModalOpen}
        onClose={() => setIsImagePromptModalOpen(false)}
        onSubmit={handleGenerateImagePrompts}
        isLoading={isExporting}
        initialCharacterDesc={config.characterDescriptions}
      />
      <ImagePromptsDisplayModal
        isOpen={isPromptsDisplayModalOpen}
        onClose={() => setIsPromptsDisplayModalOpen(false)}
        prompts={generatedImagePrompts}
        isLoading={isExporting}
        error={imagePromptError}
      />
    </div>
  );
};

export default App;
