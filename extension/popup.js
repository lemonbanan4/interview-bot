const suggestionEl = document.getElementById("suggestion");
const statusEl = document.getElementById("status");
const pushBtn = document.getElementById("pushBtn");
const openAppBtn = document.getElementById("openAppBtn");

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

pushBtn?.addEventListener("click", () => {
  const suggestions = suggestionEl?.value?.trim() || "";
  if (!suggestions) {
    setStatus("Add talking points first.");
    return;
  }

  chrome.runtime.sendMessage(
    {
      action: "PUSH_SUGGESTION_TO_TAB",
      suggestions,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        setStatus(chrome.runtime.lastError.message);
        return;
      }
      setStatus(response?.status === "success" || response?.status === "forwarded"
        ? "Pushed to active tab."
        : response?.error || response?.status || "Done.");
    },
  );
});

openAppBtn?.addEventListener("click", () => {
  chrome.tabs.create({ url: "http://localhost:3000/session" });
});
