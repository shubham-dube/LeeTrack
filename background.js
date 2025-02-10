let socket = null;
let isTimerRunning = false;

function connectWebSocket() {
  socket = new WebSocket("ws://localhost:3000");

  socket.onopen = () => console.log("WebSocket Connected!");
  socket.onclose = () => setTimeout(connectWebSocket, 3000);
  socket.onerror = (error) => console.error("WebSocket Error:", error);
}

connectWebSocket();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "log_event" && isTimerRunning && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message.data));
  }
  
  if (message.type === "toggle_timer") {
    isTimerRunning = message.state;
  }
});
