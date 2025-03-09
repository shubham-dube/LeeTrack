const buttonSelectors = {
  // Core LeetCode functionality buttons
  coreActions: [
    { selector: 'button[data-e2e-locator="console-run-button"]', description: 'Run Code Button' },
    { selector: 'button[data-e2e-locator="console-submit-button"]', description: 'Submit Solution Button' }
  ],
  // Secondary UI elements
  secondaryElements: [ 
    { selector: 'div[class="text-sd-foreground flex items-center gap-2"]', description: 'Secondary UI Element' },
    { selector: 'div[class="relative inline-flex items-center justify-center text-caption px-2 py-1 gap-1 rounded-full bg-fill-secondary cursor-pointer transition-colors hover:bg-fill-primary hover:text-text-primary text-sd-secondary-foreground hover:opacity-80"]', description: 'Secondary UI Element' }
  ]
};

// User state tracking
let userName = null;
let leetcodeUsername = null;
let roomCode = null;
let userState = {
  isOnLeetcodePage: false,
  tabActive: true,
  lastActive: Date.now()
};

let currentUrl = window.location.href;

function checkUrlChange() {
  if (window.location.href !== currentUrl) {
    console.log('URL changed to:', window.location.href);
    currentUrl = window.location.href;
    if(currentUrl.includes('solutions')){
      sendEvent('Solution Page Visited', 'solutions_visited')
    }
    else if(currentUrl.includes("editorial")){
      sendEvent('Editorial Page Visited', 'editorial_visited')
    }
    else if(currentUrl.includes("submissions")){
      sendEvent('Submissions Page Visited', 'submissions_visited')
    }
    else if(currentUrl.includes("description")){
      sendEvent('Description Page Visited', 'description_visited')
    }
    else {
      sendEvent('Page Url Changed', 'page_url_changed')
    }
  }
}

// Listen for popstate events
window.addEventListener('popstate', () => {
  console.log('Popstate event detected');
  checkUrlChange();
});

// Regularly check the URL
setInterval(checkUrlChange, 1000);

// Get extension configuration data from storage
function getExtensionData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['roomCode', 'name', 'rollNumber'], (data) => {
      if (data.roomCode && data.name) {
        roomCode = data.roomCode;
        userName = data.name;
        console.log(`Extension data loaded: Room=${roomCode}, User=${userName}`);
      } else {
        console.log('No room or user data found in storage');
      }
      resolve(data);
    });
  });
}

// Extract LeetCode username from page source
function extractLeetCodeUsername() {
  try {
    const htmlContent = document.documentElement.innerHTML;
    const regex = /"username":"(.*?)"/;
    const match = htmlContent.match(regex);
    if (match && match[1]) {
      leetcodeUsername = match[1];
      console.log(`LeetCode username detected: ${leetcodeUsername}`);
      return leetcodeUsername;
    }
  } catch (error) {
    console.error('Error extracting LeetCode username:', error);
  }
  return null;
}

// Check if user is on LeetCode
function checkLeetCodePage() {
  userState.isOnLeetcodePage = window.location.href.includes('leetcode.com');
  return userState.isOnLeetcodePage;
}

// Send event to background script
function sendEvent(eventType, category = 'user_action') {
  try {
    if (!chrome.runtime) {
      console.error('Extension context is invalid.');
      return;
    }

    // Get latest room code in case it changed
    getExtensionData().then(() => {
      chrome.runtime.sendMessage({
        type: "room_message",
        name: userName || "Unknown User",
        roomCode: roomCode || "Unknown Room",
        message: eventType,
        category: category,
        leetcodeUsername: leetcodeUsername,
        url: window.location.href,
        timestamp: Date.now()
      });
      console.log(`Event sent: ${category} - ${eventType}`);
    });
  } catch (error) {
    console.error('Error sending event:', error);
  }
}

// Add event listeners to tracked elements
function setupButtonTracking() {
  // Process all button categories
  Object.keys(buttonSelectors).forEach(category => {
    buttonSelectors[category].forEach(item => {
      const elements = document.querySelectorAll(item.selector);
      if (elements.length > 0) {
        elements.forEach(element => {
          // Skip already tracked elements
          if (!element.dataset.tracked) {
            element.dataset.tracked = "true";
            element.addEventListener('click', () => {
              sendEvent(`Clicked: ${element.textContent || element.description}`, 'button_click');
            });
            console.log(`Tracking added: ${item.description || item.selector}`);
          }
        });
      }
    });
  });
}

// Initialize tracking system
async function initializeTracking() {
  await getExtensionData();
  checkLeetCodePage();

  if (userState.isOnLeetcodePage) {
    extractLeetCodeUsername();
    sendEvent('User opened LeetCode page', 'page_visit');
    // Set up presence monitoring
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        userState.tabActive = false;
        sendEvent('User left LeetCode tab (switched tab or minimized window)', 'presence');
      } else {
        userState.tabActive = true;
        userState.lastActive = Date.now();
        sendEvent('User returned to LeetCode tab', 'presence');
      }
    });

    // Track page closure
    window.addEventListener('beforeunload', () => {
      sendEvent('User closed LeetCode page', 'presence');
    });

    // Set up button tracking
    setupButtonTracking();

    // Re-check for new elements periodically
    setInterval(setupButtonTracking, 5000);
  }
}

// Start tracking when DOM is fully loaded
window.addEventListener('load', () => {
  setTimeout(initializeTracking, 1000);
});


function addButtonSelector(category, selector, description) {
  if (!buttonSelectors[category]) {
    buttonSelectors[category] = [];
  }
  buttonSelectors[category].push({ selector, description });
  setupButtonTracking(); 
}

const checkSolvedQuestionPresence = () => {
  const element = document.querySelector('div[class="text-body flex flex-none items-center gap-1 py-1.5 text-text-secondary dark:text-text-secondary"]'); // Use dot for class selectors
  if (element) {
    console.log('Question is Solved !!!');
    sendEvent('Question Already Solved', 'solved_question');
    clearInterval(intervalId);
  }
};

setInterval(getExtensionData, 30000);
const intervalId = setInterval(checkSolvedQuestionPresence, 1000);