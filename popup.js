document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("toggleTimer");
  
    chrome.storage.local.get("timerRunning", (data) => {
      const isRunning = data.timerRunning || false;
      button.textContent = isRunning ? "Stop Timer" : "Start Timer";
    });
  
    button.addEventListener("click", () => {
      chrome.storage.local.get("timerRunning", (data) => {
        const newState = !data.timerRunning;
        chrome.storage.local.set({ timerRunning: newState });
        
        chrome.runtime.sendMessage({ type: "toggle_timer", state: newState });
        button.textContent = newState ? "Stop Timer" : "Start Timer";
      });
    });
  });