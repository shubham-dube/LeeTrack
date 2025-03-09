document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const timerDisplay = document.getElementById("timerDisplay");
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
  
    let timerInterval = null;
    let activeContest = null;
    let currentRoom = null;
    let userName = null;
  
    function updateTimerDisplay(duration) {
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      const seconds = duration % 60;
      timerDisplay.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  
    function startContestTimer(contest) {
      clearInterval(timerInterval);

      if (!contest.startTime) {
        timerDisplay.textContent = "00:00:00";
        contestStatus.textContent = "Waiting for contest to start...";
        return;
      }

      const now = Date.now();
      const elapsedSeconds = Math.floor((now - contest.startTime) / 1000);
      let timeLeft = Math.max(0, contest.duration - elapsedSeconds);
      
      updateTimerDisplay(timeLeft);

      if (timeLeft <= 0) {
        contestStatus.textContent = "Contest Ended";
        chrome.runtime.sendMessage({ type: "contest_ended" });
        return;
      }

      timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft);
        
        if (timeLeft <= 0) {
          clearInterval(timerInterval);
          contestStatus.textContent = "Contest Ended";
          chrome.runtime.sendMessage({ type: "contest_ended" });
        }
      }, 1000);
    }

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

    function updateRunningContests(contests) {
      contestsList.innerHTML = '';
      if (contests.length === 0) {
        contestsList.innerHTML = '<p class="text-gray-500 text-sm">No contests running currently</p>';
        return;
      }
      contests.forEach(contest => {
        contestsList.appendChild(renderContestItem(contest));
      });
    }

    function updateConnectionStatus(connected) {
      connectionStatus.textContent = connected ? "Connected" : "Disconnected";
      connectionStatus.className = connected 
        ? "px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
        : "px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800";
    }

    function addChatMessage(name, message, type = 'chat_message') {
      const div = document.createElement('div');
      div.className = 'chat-message p-2 rounded-md ' + 
        (type === 'system' ? 'bg-gray-100 text-gray-600 text-sm' : 
         type === 'user_joined' || type === 'user_left' ? 'bg-blue-50 text-blue-600 text-sm' : 
         'bg-white border border-gray-200');
      
      if (type === 'system' || type === 'user_joined' || type === 'user_left') {
        div.textContent = message;
      } else {
        div.innerHTML = `
          <div class="text-sm font-medium text-gray-700">${name}</div>
          <div class="text-gray-600">${message}</div>
        `;
      }
      
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Fetch running contests from the server API
    async function fetchRunningContests() {
      try {
        const response = await fetch('http://localhost:3002/api/running_contests');
        const contests = await response.json();
        updateRunningContests(contests);
      } catch (error) {
        console.error('Error fetching contests:', error);
      }
    }

    // Initialize states
    chrome.storage.local.get(["activeContest", "roomCode", "name", "rollNumber"], (data) => {
      if (data.activeContest) {
        activeContest = data.activeContest;
        startContestTimer(data.activeContest);
        contestStatus.textContent = data.activeContest.name;
      }
      
      if (data.roomCode) {
        currentRoom = data.roomCode;
        roomStatus.textContent = `In room: ${data.roomCode}`;
        roomInput.value = data.roomCode;
        chatSection.classList.remove('hidden');
      }
      if (data.name) {
        userName = data.name;
        nameInput.value = data.name;
      }
      if (data.rollNumber) rollInput.value = data.rollNumber;
    });
  
    // Fetch running contests when the extension is opened
    fetchRunningContests();

    // Initialize connection status
    chrome.runtime.sendMessage({ type: "get_connection_status" }, (response) => {
      if (response && response.connected) {
        updateConnectionStatus(true);
      }
    });
  
    // Join room button
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

    // Send message button
    sendMessageButton.addEventListener("click", () => {
      const message = messageInput.value.trim();
      if (!message || !currentRoom || !userName) return;

      chrome.runtime.sendMessage({
        type: "room_message",
        roomCode: currentRoom,
        name: userName,
        message
      });

      messageInput.value = '';
    });

    // Message input enter key
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessageButton.click();
      }
    });
  
    // Listen for status updates from background script
    chrome.runtime.onMessage.addListener((message) => {
      switch (message.type) {
        case "connection_status":
          updateConnectionStatus(message.connected);
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
          }
          break;
          
        case "contest_update":
          if (message.contest) {
            activeContest = message.contest;
            startContestTimer(message.contest);
            contestStatus.textContent = message.contest.name;
            chrome.storage.local.set({ activeContest: message.contest });
          } else {
            clearInterval(timerInterval);
            timerDisplay.textContent = "00:00:00";
            contestStatus.textContent = "No active contest";
            chrome.storage.local.remove('activeContest');
          }
          break;
          
        case "running_contests":
          updateRunningContests(message.contests);
          break;

        case "chat_message":
          addChatMessage(message.name, message.message);
          break;

        case "user_joined":
        case "user_left":
          addChatMessage(null, message.message, message.type);
          break;
      }
    });
  });