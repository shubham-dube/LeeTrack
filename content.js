const buttonsToTrack = ["Run", "Submit", "Debug"];
let timerRunning = false;

function setupWebSocket() {
  chrome.runtime.sendMessage({ type: "sendData", data: { event: "Extension Loaded" } });
}

function trackButtons() {
  buttonsToTrack.forEach(buttonText => {
    document.querySelectorAll("button").forEach(button => {
      if (button.innerText.includes(buttonText)) {
        button.addEventListener("click", () => {
          if (timerRunning) {
            chrome.runtime.sendMessage({
              type: "sendData",
              data: { event: "Button Clicked", button: buttonText, time: new Date().toISOString() }
            });
          }
        });
      }
    });
  });
}

function startObserver() {
  const observer = new MutationObserver(trackButtons);
  observer.observe(document.body, { childList: true, subtree: true });
}

chrome.storage.sync.get(["timerRunning"], data => {
  timerRunning = data.timerRunning || false;
});

chrome.storage.onChanged.addListener(changes => {
  if (changes.timerRunning) {
    timerRunning = changes.timerRunning.newValue;
  }
});

setupWebSocket();
startObserver();