
import { io } from 'socket.io-client';

let socket = null;
let isConnected = false;
let currentRoom = null;
let activeContest = null;

// Connect to the Socket.io server
function connectToServer() {
  try {
    console.log('Connecting to server...');
    socket = io('https://d5n417dq-3000.inc1.devtunnels.ms');
    
    socket.on('connect', () => {
      console.log('Connected to server!');
      isConnected = true;
      
      // Notify popup about connection status
      chrome.runtime.sendMessage({ 
        type: 'connection_status', 
        connected: true 
      });
      
      // If we have room info in storage, rejoin on reconnect
      chrome.storage.local.get(['roomCode', 'name', 'rollNumber'], (data) => {
        if (data.roomCode && data.name && data.rollNumber) {
          joinRoom(data.roomCode, data.name, data.rollNumber);
        }
      });
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      isConnected = false;
      currentRoom = null;
      activeContest = null;
      
      // Notify popup about connection status
      chrome.runtime.sendMessage({ 
        type: 'connection_status', 
        connected: false 
      });
    });

    // Handle running contests updates
    socket.on('running_contests', (contests) => {
      chrome.runtime.sendMessage({
        type: 'running_contests',
        contests
      });
    });

    // Handle contest updates
    socket.on('contest_update', (contest) => {
      activeContest = contest;
      chrome.runtime.sendMessage({
        type: 'contest_update',
        contest
      });
    });

    // Handle contest end
    socket.on('contest_ended', () => {
      activeContest = null;
      chrome.storage.local.remove('activeContest');
      chrome.runtime.sendMessage({
        type: 'contest_update',
        contest: null
      });
    });

    // Handle room join success
    socket.on('room_joined', (data) => {
      currentRoom = data.roomCode;
      chrome.runtime.sendMessage({
        type: 'room_status',
        inRoom: true,
        roomCode: data.roomCode
      });

      // If there's an active contest in the room
      if (data.contest) {
        activeContest = data.contest;
        chrome.runtime.sendMessage({
          type: 'contest_update',
          contest: data.contest
        });
      }
    });

    // Handle room join error
    socket.on('room_error', (error) => {
      console.error('Room error:', error);
      chrome.runtime.sendMessage({
        type: 'room_status',
        inRoom: false,
        error: error
      });
    });

  } catch (error) {
    console.error('Error connecting to server:', error);
  }
}

// Join a room
function joinRoom(roomCode, name, rollNumber) {
  if (!socket || !isConnected) {
    console.error('Not connected to server');
    return;
  }

  socket.emit('join_room', {
    roomCode,
    name,
    rollNumber
  });
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'get_connection_status':
      sendResponse({ connected: isConnected });
      break;

    case 'join_room':
      joinRoom(message.roomCode, message.name, message.rollNumber);
      break;

    case 'contest_ended':
      if (socket && isConnected && currentRoom) {
        socket.emit('contest_ended', { roomCode: currentRoom });
      }
      break;
  }
});

// Connect to server when extension loads
connectToServer();