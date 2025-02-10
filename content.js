const buttonSelectors = [
    'button[data-cy="submit-code"]',
    'button[data-cy="run-code"]',
    'button[data-cy="debug-code"]'
  ];
  
  function sendEvent(eventType) {
    chrome.runtime.sendMessage({
      type: "log_event",
      data: {
        event: eventType,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }
    });
  }
  
  function observeButtons() {
    const observer = new MutationObserver(() => {
      buttonSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(button => {
          if (!button.dataset.tracked) {
            button.dataset.tracked = "true";
            button.addEventListener("click", () => sendEvent(selector));
          }
        });
      });
    });
  
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  observeButtons();
  