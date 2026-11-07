chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Interview Copilot Extension installed.");
});

/**
 * Forward suggestion payloads to the active Meet/Zoom tab content script.
 * Expected message shape from popup / Next.js bridge:
 *   { action: "PUSH_SUGGESTION_TO_TAB", suggestions: string }
 */
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action !== "PUSH_SUGGESTION_TO_TAB") {
    return false;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (!tabId) {
      sendResponse({ status: "no-active-tab" });
      return;
    }

    chrome.tabs.sendMessage(
      tabId,
      {
        action: "UPDATE_AI_SUGGESTIONS",
        suggestions: request.suggestions,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            status: "error",
            error: chrome.runtime.lastError.message,
          });
          return;
        }
        sendResponse(response || { status: "forwarded" });
      },
    );
  });

  // Keep the message channel open for the async sendResponse
  return true;
});
