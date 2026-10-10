const statusEl = document.getElementById("status");
const progressContainer = document.getElementById("progress-container");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const downloadBtn = document.getElementById("downloadBtn");

function setStatus(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className = type;
}

function setProgress(percent) {
  progressContainer.style.display = "block";
  progressBar.style.width = percent + "%";
  progressText.textContent = percent + "%";
}

// Check if on Google Drive
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab || !tab.url || !tab.url.startsWith("https://drive.google.com/")) {
    setStatus("This is not a Google Drive page.", "error");
    downloadBtn.disabled = true;
  }
});

downloadBtn.addEventListener("click", async () => {
  downloadBtn.disabled = true;
  setStatus("Injecting script...", "working");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    setStatus("No active tab found.", "error");
    downloadBtn.disabled = false;
    return;
  }

  // Listen for messages from content script
  const listener = (message, sender, sendResponse) => {
    if (sender.tab?.id !== tab.id) return;

    switch (message.type) {
      case "progress":
        setStatus(`Processing... ${message.percent}%`, "working");
        setProgress(message.percent);
        break;
      case "status":
        setStatus(message.text, "working");
        break;
      case "done":
        setStatus("PDF downloaded successfully!", "success");
        setProgress(100);
        downloadBtn.disabled = false;
        chrome.runtime.onMessage.removeListener(listener);
        break;
      case "error":
        setStatus(message.text, "error");
        downloadBtn.disabled = false;
        chrome.runtime.onMessage.removeListener(listener);
        break;
    }
  };
  chrome.runtime.onMessage.addListener(listener);

  try {
    // First inject jsPDF library
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["lib/jspdf.umd.min.js"],
    });

    // Then inject our content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (err) {
    setStatus("Failed to inject script: " + err.message, "error");
    downloadBtn.disabled = false;
    chrome.runtime.onMessage.removeListener(listener);
  }
});
