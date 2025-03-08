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
  
    let timerInterval = null;
    let activeContest = null;
  
    function updateTimerDisplay(duration) {
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      const seconds = duration % 60;
      timerDisplay.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  
    function startContestTimer(duration) {
      clearInterval(timerInterval);
      let timeLeft = duration;
      
      updateTimerDisplay(timeLeft);
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

    // Initialize states
    chrome.storage.local.get(["activeContest", "roomCode", "name", "rollNumber"], (data) => {
      if (data.activeContest) {
        activeContest = data.activeContest;
        startContestTimer(data.activeContest.duration);
        contestStatus.textContent = data.activeContest.name;
      }
      
      if (data.roomCode) {
        roomStatus.textContent = `In room: ${data.roomCode}`;
        roomInput.value = data.roomCode;
      }
      if (data.name) nameInput.value = data.name;
      if (data.rollNumber) rollInput.value = data.rollNumber;
    });
  
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

      chrome.storage.local.set({ roomCode, name, rollNumber });
      chrome.runtime.sendMessage({ 
        type: "join_room", 
        roomCode, 
        name,
        rollNumber
      });
      roomStatus.textContent = `Joining room: ${roomCode}...`;
    });
  
    // Listen for status updates from background script
    chrome.runtime.onMessage.addListener((message) => {
      switch (message.type) {
        case "connection_status":
          updateConnectionStatus(message.connected);
          break;
          
        case "room_status":
          roomStatus.textContent = message.inRoom ? `In room: ${message.roomCode}` : "Not in a room";
          break;
          
        case "contest_update":
          if (message.contest) {
            activeContest = message.contest;
            startContestTimer(message.contest.duration);
            contestStatus.textContent = message.contest.name;
            chrome.storage.local.set({ activeContest: message.contest });
          }
          break;
          
        case "running_contests":
          updateRunningContests(message.contests);
          break;
      }
    });
  });