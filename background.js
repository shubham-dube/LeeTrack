// WebSocket connection management
let ws = null;
let isConnected = false;
let currentRoom = null;
let activeContest = null;
let reconnectTimeout = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 5000;
let messageQueue = [];

// Connect to the WebSocket server
function connectToServer() {
  try {
    console.log('Connecting to server...');
    ws = new WebSocket('ws://localhost:3001');
    
    ws.onopen = () => {
      console.log('Connected to server!');
      isConnected = true;
      reconnectAttempts = 0;
      clearTimeout(reconnectTimeout);
      
      // Notify popup about connection status
      chrome.runtime.sendMessage({ 
        type: 'connection_status', 
        connected: true 
      });
      
      // If we have room info in storage, rejoin on reconnect
      chrome.storage.local.get(['roomCode', 'name', 'rollNumber'], (data) => {
        if (data.roomCode && data.name && data.rollNumber) {
          joinRoom(data.roomCode, data.name, data.rollNumber);
          
          // Process any queued messages
          if (messageQueue.length > 0) {
            console.log(`Processing ${messageQueue.length} queued messages`);
            messageQueue.forEach(msg => {
              sendMessage(msg.type, msg.data);
            });
            messageQueue = [];
          }
        }
      });
    };
    
    ws.onclose = () => {
      console.log('Disconnected from server');
      isConnected = false;
      
      // Notify popup about connection status
      chrome.runtime.sendMessage({ 
        type: 'connection_status', 
        connected: false 
      });

      // Implement exponential backoff for reconnection
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
        reconnectTimeout = setTimeout(connectToServer, delay);
        reconnectAttempts++;
      } else {
        console.log('Max reconnection attempts reached. Waiting for user action to reconnect.');
        // Will reconnect when user interacts with extension
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Received message:', message);
      
      switch (message.type) {
        case 'room_joined':
          currentRoom = message.roomCode;
          chrome.runtime.sendMessage({ 
            type: 'room_joined', 
            roomCode: message.roomCode 
          });
          break;
          
        case 'room_message':
          // Store messages in local storage for persistence during contest
          chrome.storage.local.get(['roomMessages'], (data) => {
            const messages = data.roomMessages || [];
            
            // Add timestamp if not present
            if (!message.timestamp) {
              message.timestamp = Date.now();
            }
            
            messages.push(message);
            
            // Keep only the last 100 messages to prevent storage issues
            const limitedMessages = messages.slice(-100);
            
            chrome.storage.local.set({ roomMessages: limitedMessages });
            
            // Forward to popup
            chrome.runtime.sendMessage(message);
          });
          break;
          
        case 'contest_started':
          activeContest = message.contest;
          chrome.storage.local.set({ activeContest: message.contest });
          chrome.runtime.sendMessage({ 
            type: 'contest_started', 
            contest: message.contest 
          });
          break;
          
        case 'contest_ended':
          activeContest = null;
          chrome.storage.local.set({ activeContest: null });
          chrome.runtime.sendMessage({ type: 'contest_ended' });
          break;
          
        case 'running_contests':
          chrome.runtime.sendMessage({ 
            type: 'running_contests', 
            contests: message.contests 
          });
          break;
      }
    };
  } catch (error) {
    console.error('Error connecting to server:', error);
    
    // Attempt to reconnect
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
      reconnectTimeout = setTimeout(connectToServer, delay);
      reconnectAttempts++;
    }
  }
}

// Send a message to the WebSocket server
function sendMessage(type, data) {
  if (!ws || !isConnected) {
    console.log('Not connected to server, queueing message');
    messageQueue.push({ type, data });
    
    // Try to reconnect if there are queued messages
    if (messageQueue.length === 1 && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts = 0; // Reset attempts to allow reconnection
      connectToServer();
    }
    return;
  }
  
  try {
    ws.send(JSON.stringify({ type, ...data }));
  } catch (error) {
    console.error('Error sending message:', error);
    messageQueue.push({ type, data });
  }
}

// Join a room
function joinRoom(roomCode, name, rollNumber) {
  currentRoom = roomCode; // Set current room immediately for content script
  sendMessage('join_room', {
    roomCode,
    name,
    rollNumber
  });
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message in background script:', message);
  
  switch (message.type) {
    case 'get_connection_status':
      sendResponse({ connected: isConnected, currentRoom });
      break;

    case 'join_room':
      joinRoom(message.roomCode, message.name, message.rollNumber);
      break;

    case 'contest_ended':
      if (isConnected) {
        sendMessage('contest_ended', { roomCode: currentRoom });
      }
      break;
      
    case 'room_message':
      if (isConnected) {
        // Forward all properties from the message to the server
        const { type, ...data } = message;
        
        // Add current room if not specified
        if (!data.roomCode && currentRoom) {
          data.roomCode = currentRoom;
        }
        
        sendMessage('room_message', data);
      } else {
        // Queue message for when connection is restored
        messageQueue.push({ 
          type: 'room_message', 
          data: message 
        });
        
        // Attempt to reconnect
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts = 0;
          connectToServer();
        }
      }
      break;
      
    case 'get_room_messages':
      chrome.storage.local.get(['roomMessages'], (data) => {
        sendResponse({ messages: data.roomMessages || [] });
      });
      return true; // Required for async sendResponse
  }
});

// Connect to server when extension loads
connectToServer();

// Set up a periodic ping to keep the connection alive
setInterval(() => {
  if (isConnected) {
    try {
      ws.send(JSON.stringify({ type: 'ping' }));
    } catch (error) {
      console.error('Error sending ping:', error);
      
      // Force reconnection on error
      if (ws) {
        ws.close();
      }
    }
  } else if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    // Try to reconnect if we're disconnected and haven't reached max attempts
    connectToServer();
  }
}, 30000); // Send ping every 30 seconds