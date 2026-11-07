// Host element + Shadow DOM so meeting page CSS cannot restyle the HUD
const shadowHost = document.createElement("div");
shadowHost.id = "ai-copilot-shadow-host";
shadowHost.style.position = "fixed";
shadowHost.style.top = "20px";
shadowHost.style.right = "20px";
shadowHost.style.zIndex = "999999";
document.documentElement.appendChild(shadowHost);

const shadowRoot = shadowHost.attachShadow({ mode: "open" });

shadowRoot.innerHTML = `
  <style>
    .copilot-card {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: rgba(2, 6, 23, 0.88);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(45, 212, 191, 0.28);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      border-radius: 16px;
      color: #f8fafc;
      width: 340px;
      padding: 16px;
      box-sizing: border-box;
      transition: opacity 0.2s ease;
    }
    .copilot-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 8px;
    }
    .copilot-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #2dd4bf;
    }
    .copilot-controls {
      display: flex;
      gap: 6px;
    }
    .btn-icon {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 14px;
      padding: 0;
    }
    .btn-icon:hover {
      color: #fff;
    }
    .copilot-content {
      font-size: 13px;
      line-height: 1.5;
      color: #e2e8f0;
      max-height: 220px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    .copilot-placeholder {
      color: #64748b;
      font-style: italic;
    }
  </style>

  <div class="copilot-card" id="copilotCard">
    <div class="copilot-header">
      <span class="copilot-title">AI Copilot HUD</span>
      <div class="copilot-controls">
        <button class="btn-icon" id="toggleOpacity" title="Toggle opacity">◐</button>
        <button class="btn-icon" id="minimizeBtn" title="Minimize">−</button>
      </div>
    </div>
    <div class="copilot-content" id="copilotText">
      <span class="copilot-placeholder">Listening for interview questions… AI talking points will stream here.</span>
    </div>
  </div>
`;

const card = shadowRoot.getElementById("copilotCard");
const textContainer = shadowRoot.getElementById("copilotText");
const toggleOpacityBtn = shadowRoot.getElementById("toggleOpacity");
const minimizeBtn = shadowRoot.getElementById("minimizeBtn");

let isTransparent = false;
toggleOpacityBtn?.addEventListener("click", () => {
  isTransparent = !isTransparent;
  if (card) card.style.opacity = isTransparent ? "0.2" : "1";
});

let isMinimized = false;
minimizeBtn?.addEventListener("click", () => {
  isMinimized = !isMinimized;
  if (textContainer) {
    textContainer.style.display = isMinimized ? "none" : "block";
  }
  if (minimizeBtn) {
    minimizeBtn.textContent = isMinimized ? "+" : "−";
  }
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action === "UPDATE_AI_SUGGESTIONS" && textContainer) {
    textContainer.textContent = String(request.suggestions || "");
    sendResponse({ status: "success" });
    return true;
  }
  return false;
});
