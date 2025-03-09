/**
 * LeetCode Observer Background Script
 * Manages WebSocket connections, contest states, and message handling
 */

// Connection and state variables
let ws = null;
let isConnected = false;
let connectionAttempts = 0;
let currentRoom = null;
let lastMessages = []; // Store the last 5 messages
const MAX_STORED_MESSAGES = 5;

/**
 * Connect to the WebSocket server with automatic reconnection
 */
function connectToServer() {
  try {
    ws = new WebSocket('ws://localhost:3001');
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
      isConnected = true;
      connectionAttempts = 0;
      
      // Let popup know we're connected
      chrome.runtime.sendMessage({ 
        type: "connection_status", 
        connected: true 
      });
      
      // Resubscribe to room if we were in one
      if (currentRoom) {
        chrome.storage.local.get(['name', 'rollNumber'], (data) => {
          if (data.name && data.rollNumber) {
            ws.send(JSON.stringify({
              type: 'join_room',
              roomCode: currentRoom,
              name: data.name,
              rollNumber: data.rollNumber
            }));
          }
        });
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      isConnected = false;
      
      // Let popup know we're disconnected
      chrome.runtime.sendMessage({ 
        type: "connection_status", 
        connected: false 
      });
      
      // Attempt to reconnect with exponential backoff
      connectionAttempts++;
      const timeout = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
      console.log(`Attempting to reconnect in ${timeout / 1000} seconds...`);
      setTimeout(connectToServer, timeout);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Received message:', message);
      
      try {
        switch (message.type) {
          case 'room_joined':
            handleRoomJoined(message);
            break;
            
          case 'room_error':
            handleRoomError(message);
            break;
            
          case 'contest_started':
            handleContestStarted(message);
            break;
            
          case 'contest_ended':
            handleContestEnded(message);
            break;
            
          case 'room_message':
          case 'contest_message':
            storeAndForwardMessage(message);
            break;
            
          case 'user_joined':
          case 'user_left':
            forwardMessageToPopup(message);
            break;
            
          case 'running_contests':
            forwardMessageToPopup(message);
            break;
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    };
  } catch (error) {
    console.error('Error connecting to server:', error);
    
    // Schedule reconnection
    const timeout = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
    setTimeout(connectToServer, timeout);
  }
}

/**
 * Handle successful room join
 * @param {Object} message - Room joined message
 */
function handleRoomJoined(message) {
  currentRoom = message.roomCode;
  
  // Store room code in local storage
  chrome.storage.local.set({ roomCode: message.roomCode });
  
  // Forward message to popup
  forwardMessageToPopup(message);
  
  // Notify content script if active
  notifyContentScripts(message);
}

/**
 * Handle room join error
 * @param {Object} message - Error message
 */
function handleRoomError(message) {
  console.error('Room error:', message.error);
  
  // Forward error to popup
  chrome.runtime.sendMessage({
    type: "room_status",
    inRoom: false,
    error: message.error
  });
}

/**
 * Handle contest started message
 * @param {Object} message - Contest started message
 */
function handleContestStarted(message) {
  // Store contest in local storage
  chrome.storage.local.set({ activeContest: message.contest });
  
  // Forward message to popup
  forwardMessageToPopup(message);
  
  // Notify content script if active
  notifyContentScripts(message);
}

/**
 * Handle contest ended message
 * @param {Object} message - Contest ended message
 */
function handleContestEnded(message) {
  // Remove contest from local storage
  chrome.storage.local.remove('activeContest');
  
  // Forward message to popup
  forwardMessageToPopup(message);
  
  // Notify content script if active
  notifyContentScripts(message);
}

/**
 * Store message and forward to popup
 * @param {Object} message - Message to store and forward
 */
function storeAndForwardMessage(message) {
  // Add the message to our queue, maintaining only the last MAX_STORED_MESSAGES
  lastMessages.push(message);
  if (lastMessages.length > MAX_STORED_MESSAGES) {
    lastMessages.shift(); // Remove the oldest message
  }
  
  // Forward to popup
  forwardMessageToPopup(message);
}

/**
 * Send message to all popup instances
 * @param {Object} message - Message to forward
 */
function forwardMessageToPopup(message) {
  chrome.runtime.sendMessage(message).catch(error => {
    // Suppressing errors when no popups are open to receive the message
    if (!error.message.includes("Could not establish connection")) {
      console.error('Error forwarding message:', error);
    }
  });
}

/**
 * Notify content scripts about an event
 * @param {Object} message - Message to send to content scripts
 */
function notifyContentScripts(message) {
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      // Only send to potential LeetCode tabs
      if (tab.url && tab.url.includes('leetcode.com')) {
        chrome.tabs.sendMessage(tab.id, message).catch(error => {
          // Ignore expected errors when content script isn't loaded
          if (!error.message.includes("Could not establish connection")) {
            console.error(`Error sending message to tab ${tab.id}:`, error);
          }
        });
      }
    });
  });
}

/**
 * Handle messages from popup or content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message in background:', message);
  
  try {
    switch (message.type) {
      case "get_connection_status":
        // Send connection status and active contest if available
        chrome.storage.local.get(['activeContest'], (data) => {
          sendResponse({ 
            connected: isConnected,
            activeContest: data.activeContest
          });
        });
        return true; // Keep the messaging channel open for the async response
        
      case "join_room":
        // User is joining a room
        if (!isConnected) {
          sendResponse({ 
            success: false, 
            error: "Not connected to server" 
          });
          return;
        }
        
        // Send join room request to server
        ws.send(JSON.stringify({
          type: 'join_room',
          roomCode: message.roomCode,
          name: message.name,
          rollNumber: message.rollNumber
        }));
        
        // Store user info in local storage
        chrome.storage.local.set({
          roomCode: message.roomCode,
          name: message.name,
          rollNumber: message.rollNumber
        });
        
        sendResponse({ success: true });
        break;
        
      case "room_message":
      case "contest_message":
        // User is sending a message
        if (!isConnected || !currentRoom) {
          sendResponse({ 
            success: false, 
            error: "Not connected or not in a room" 
          });
          return;
        }
        
        // Send message to server
        ws.send(JSON.stringify({
          type: message.type, // Use the original message type
          roomCode: message.roomCode,
          name: message.name,
          message: message.message,
          rollNumber: message.rollNumber,
          url: message.url,
          category: message.category || 'chat_message',
          leetcodeUsername: message.leetcodeUsername
        }));
        
        sendResponse({ success: true });
        break;
        
      case "get_room_messages":
        // User is requesting recent messages
        sendResponse({ 
          messages: lastMessages,
          count: lastMessages.length
        });
        break;
        
      case "leave_room":
        // User is leaving a room
        if (currentRoom) {
          // Clear room info
          currentRoom = null;
          chrome.storage.local.remove(['roomCode', 'activeContest']);
          
          // Notify server if connected
          if (isConnected) {
            ws.send(JSON.stringify({
              type: 'leave_room',
              roomCode: message.roomCode
            }));
          }
          
          // Notify popup
          chrome.runtime.sendMessage({
            type: "room_status",
            inRoom: false
          });
        }
        
        sendResponse({ success: true });
        break;
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
});

// Start connection when extension is loaded
connectToServer();

// Fetch running contests periodically
function fetchRunningContests() {
  try {
    fetch('http://localhost:3002/api/running_contests')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Error fetching contests: ${response.status}`);
        }
        return response.json();
      })
      .then(contests => {
        chrome.runtime.sendMessage({
          type: "running_contests",
          contests: contests
        }).catch(error => {
          // Suppressing errors when no popups are open to receive the message
          if (!error.message.includes("Could not establish connection")) {
            console.error('Error sending contests to popup:', error);
          }
        });
      })
      .catch(error => {
        console.error('Error fetching running contests:', error);
      });
  } catch (error) {
    console.error('Error in fetchRunningContests:', error);
  }
}

// Fetch running contests every 10 seconds
setInterval(fetchRunningContests, 10000);

// Add event listener for browser startup
chrome.runtime.onStartup.addListener(() => {
  connectToServer();
});

// Add event listener for extension install or update
chrome.runtime.onInstalled.addListener(() => {
  connectToServer();
});