document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const contestStatus = document.getElementById("contestStatus");
    const contestsList = document.getElementById("contestsList");
    const roomInput = document.getElementById("roomCode");
    const nameInput = document.getElementById("name");
    const rollInput = document.getElementById("rollNumber");
    const joinRoomButton = document.getElementById("joinRoom");
    const connectionStatus = document.getElementById("connectionStatus");
    const roomStatus = document.getElementById("roomStatus");
    const chatSection = document.getElementById("chatSection");
    const chatMessages = document.getElementById("chatMessages");
    const messageInput = document.getElementById("messageInput");
    const sendMessageButton = document.getElementById("sendMessage");
    const refreshChatButton = document.getElementById("refreshChat");
  
    let activeContest = null;
    let currentRoom = null;
    let userName = null;
  
    /**
     * Renders a contest item in the UI
     * @param {Object} contest - Contest data
     * @returns {HTMLElement} - Rendered contest item
     */
    function renderContestItem(contest) {
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-md';
      div.innerHTML = `
        <div class="flex-1">
          <h5 class="font-medium text-gray-900">${contest.name}</h5>
          <p class="text-sm text-gray-600">Room: ${contest.roomCode}</p>
          <p class="text-sm text-gray-500">Participants: ${contest.participants.length}</p>
        </div>
        <button class="join-contest-btn px-4 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm" 
                data-room="${contest.roomCode}">
          Join
        </button>
      `;
      
      div.querySelector('.join-contest-btn').addEventListener('click', () => {
        roomInput.value = contest.roomCode;
        document.getElementById('joinForm').scrollIntoView({ behavior: 'smooth' });
      });
      
      return div;
    }

    /**
     * Updates the list of running contests
     * @param {Array} contests - List of contest objects
     */
    function updateRunningContests(contests) {
      contestsList.innerHTML = '';
      if (!contests || contests.length === 0) {
        contestsList.innerHTML = '<p class="text-gray-500 text-sm">No contests running currently</p>';
        return;
      }
      contests.forEach(contest => {
        contestsList.appendChild(renderContestItem(contest));
      });
    }

    /**
     * Updates the connection status in the UI
     * @param {boolean} connected - Connection status
     */
    function updateConnectionStatus(connected) {
      connectionStatus.textContent = connected ? "Connected" : "Disconnected";
      connectionStatus.className = connected 
        ? "px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
        : "px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800";
    }

    /**
     * Adds a chat message to the UI
     * @param {string} name - Sender name
     * @param {string} message - Message content
     * @param {string} type - Message type
     */
    function addChatMessage(name, message, type = 'chat_message') {
      if (!message) return;
      
      const div = document.createElement('div');
      div.className = 'chat-message p-2 rounded-md ' + 
        (type === 'system' ? 'bg-gray-100 text-gray-600 text-sm' : 
         type === 'user_joined' || type === 'user_left' ? 'bg-blue-50 text-blue-600 text-sm' : 
         'bg-white border border-gray-200');
      
      if (type === 'system' || type === 'user_joined' || type === 'user_left') {
        div.textContent = message;
      } else {
        let displayName = name || 'Unknown';
        let messageText = message;
        
        try {
          // Handle case where message might be a stringified object
          if (typeof message === 'string' && message.startsWith('{') && message.endsWith('}')) {
            const msgObj = JSON.parse(message);
            if (msgObj.message) {
              messageText = msgObj.message;
            }
          }
        } catch (e) {
          console.error('Error parsing message:', e);
          // Continue with original message if parsing fails
        }
        
        div.innerHTML = `
          <div class="text-sm font-medium text-gray-700">${displayName}</div>
          <div class="text-gray-600">${messageText}</div>
        `;
      }
      
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * Fetches and displays recent messages
     */
    function fetchRecentMessages() {
      chrome.runtime.sendMessage({ type: "get_room_messages" }, (response) => {
        if (response && response.messages && response.messages.length > 0) {
          // Clear existing messages first
          chatMessages.innerHTML = '';
          
          // Display the messages in order (oldest first)
          const sortedMessages = [...response.messages].reverse();
          sortedMessages.forEach(msg => {
            if (msg.name && msg.message) {
              addChatMessage(msg.name, msg.message, msg.type);
            }
          });
          
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      });
    }

    /**
     * Fetches running contests from the server API
     */
    async function fetchRunningContests() {
      try {
        const response = await fetch('http://localhost:3002/api/running_contests');
        if (!response.ok) {
          throw new Error(`Error fetching contests: ${response.status}`);
        }
        const contests = await response.json();
        updateRunningContests(contests);
      } catch (error) {
        console.error('Error fetching contests:', error);
        contestsList.innerHTML = '<p class="text-gray-500 text-sm">Error fetching contests</p>';
      }
    }

    // Initialize states from storage
    chrome.storage.local.get(["activeContest", "roomCode", "name", "rollNumber"], (data) => {
      if (data.activeContest) {
        activeContest = data.activeContest;
        contestStatus.textContent = `${data.activeContest.name}`;
      }
      
      if (data.roomCode) {
        currentRoom = data.roomCode;
        roomStatus.textContent = `In room: ${data.roomCode}`;
        roomInput.value = data.roomCode;
        chatSection.classList.remove('hidden');
        
        // Fetch recent messages if already in a room
        fetchRecentMessages();
      }
      
      if (data.name) {
        userName = data.name;
        nameInput.value = data.name;
      }
      
      if (data.rollNumber) {
        rollInput.value = data.rollNumber;
      }
    });
  
    // Fetch running contests when the extension is opened
    fetchRunningContests();

    // Initialize connection status
    chrome.runtime.sendMessage({ type: "get_connection_status" }, (response) => {
      if (response) {
        updateConnectionStatus(response.connected);
        
        // Update active contest if present
        if (response.activeContest) {
          activeContest = response.activeContest;
          contestStatus.textContent = `${response.activeContest.name}`;
        }
      }
    });
  
    // Join room button handler
    joinRoomButton.addEventListener("click", () => {
      const roomCode = roomInput.value.trim();
      const name = nameInput.value.trim();
      const rollNumber = rollInput.value.trim();
      
      if (!roomCode || !name || !rollNumber) {
        alert("Please fill in all fields");
        return;
      }

      userName = name;
      currentRoom = roomCode;
      chrome.storage.local.set({ roomCode, name, rollNumber });
      chrome.runtime.sendMessage({ 
        type: "join_room", 
        roomCode, 
        name,
        rollNumber
      });
      roomStatus.textContent = `Joining room: ${roomCode}...`;
      chatSection.classList.remove('hidden');
      chatMessages.innerHTML = '';
      addChatMessage('System', 'Joining room...', 'system');
    });

    // Send message button handler
    sendMessageButton.addEventListener("click", () => {
      sendChatMessage();
    });

    // Message input enter key handler
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
    
    // Refresh chat button handler
    refreshChatButton.addEventListener("click", () => {
      fetchRecentMessages();
    });
    
    /**
     * Sends a chat message
     */
    function sendChatMessage() {
      const message = messageInput.value.trim();
      if (!message || !currentRoom || !userName) return;

      chrome.storage.local.get(['rollNumber'], (data) => {
        const rollNumber = data.rollNumber || 'Unknown Roll';
        
        chrome.runtime.sendMessage({
          type: "room_message",
          roomCode: currentRoom,
          name: userName,
          message: message,
          rollNumber: rollNumber,
          category: 'chat_message'
        });

        messageInput.value = '';
      });
    }
  
    // Listen for status updates from background script
    chrome.runtime.onMessage.addListener((message) => {
      console.log('Received message in popup:', message);
      
      try {
        switch (message.type) {
          case "connection_status":
            updateConnectionStatus(message.connected);
            break;
            
          case "room_joined":
            roomStatus.textContent = `In room: ${message.roomCode}`;
            currentRoom = message.roomCode;
            chatSection.classList.remove('hidden');
            
            if (message.contest) {
              activeContest = message.contest;
              contestStatus.textContent = `${message.contest.name}`;
              contestStatus.classList.add('bg-green-100');
              contestStatus.classList.add('border');
              contestStatus.classList.add('border-green-300');
              
              // Store in local storage
              chrome.storage.local.set({ activeContest: message.contest });
            }
            
            addChatMessage('System', `Successfully joined contest: ${message.roomCode}`, 'system');
            
            // Refresh messages after joining
            fetchRecentMessages();
            break;
            
          case "room_status":
            if (message.inRoom) {
              roomStatus.textContent = `In room: ${message.roomCode}`;
              currentRoom = message.roomCode;
              chatSection.classList.remove('hidden');
            } else {
              roomStatus.textContent = message.error || "Not in a room";
              currentRoom = null;
              chatSection.classList.add('hidden');
              contestStatus.textContent = "No active contest";
            }
            break;
            
          case "contest_started":
            activeContest = message.contest;
            contestStatus.textContent = `${message.contest.name}`;
            contestStatus.classList.add('bg-green-100');
            contestStatus.classList.add('border');
            contestStatus.classList.add('border-green-300');
            chrome.storage.local.set({ activeContest: message.contest });
            addChatMessage('System', `Contest "${message.contest.name}" has started!`, 'system');
            break;
            
          case "contest_ended":
            activeContest = null;
            contestStatus.textContent = "No active contest";
            chrome.storage.local.remove('activeContest');
            addChatMessage('System', 'Contest has ended', 'system');
            break;
            
          case "running_contests":
            updateRunningContests(message.contests);
            break;

          case "room_message":
          case "contest_message":
          case "chat_message":
          case "system_message":
            addChatMessage(message.name, message.message, message.type);
            break;
            
          case "user_joined":
            addChatMessage('System', `${message.name} joined the contest`, 'user_joined');
            break;
            
          case "user_left":
            addChatMessage('System', `${message.name} left the contest`, 'user_left');
            break;
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });
    
    // Auto-refresh messages every 5 seconds if in a room
    setInterval(() => {
      if (currentRoom) {
        fetchRecentMessages();
      }
    }, 5000);
  });