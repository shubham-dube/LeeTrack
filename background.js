let socket = new WebSocket("ws://localhost:3000");
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "sendData") {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message.data));
    }
  }
});