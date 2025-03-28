/**
 * LeetCode Observer Content Script
 * Tracks user interactions on LeetCode pages and sends events to the background script
 */

// Button selectors to track on LeetCode pages
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
let rollNumber = null;
let leetcodeUsername = null;
let contestId = null;
let userState = {
  isOnLeetcodePage: false,
  tabActive: true,
  lastActive: Date.now(),
  activeContest: null
};

// Contest notification element
let contestNotification = null;

// Track URL changes
let currentUrl = window.location.href;

/**
 * Check if the URL has changed and send appropriate events
 */
function checkUrlChange() {
  if (window.location.href !== currentUrl) {
    console.log('URL changed to:', window.location.href);
    currentUrl = window.location.href;
    
    try {
      if(currentUrl.includes('solutions')) {
        sendEvent('Solution Page Visited', 'solutions_visited', 'critical');
      }
      else if(currentUrl.includes("editorial")) {
        sendEvent('Editorial Page Visited', 'editorial_visited', 'critical');
      }
      else if(currentUrl.includes("submissions")) {
        sendEvent('Submissions Page Visited', 'submissions_visited', 'critical');
      }
      else if(currentUrl.includes("description")) {
        sendEvent('Description Page Visited', 'description_visited', 'info');
      }
      else {
        sendEvent('Page Url Changed', 'page_url_changed', 'warning');
      }
    } catch (error) {
      console.error('Error handling URL change:', error);
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

/**
 * Get extension configuration data from storage
 * @returns {Promise<Object>} Promise resolving to stored data
 */
function getExtensionData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['roomCode', 'name', 'rollNumber', 'activeContest'], (data) => {
      if (data.roomCode && data.name) {
        contestId = data.roomCode;
        userName = data.name;
        rollNumber = data.rollNumber;
        
        if (data.activeContest) {
          userState.activeContest = data.activeContest;
          updateContestNotification();
        }
        
        console.log(`Extension data loaded: Contest=${contestId}, User=${userName}, Roll=${rollNumber} RoomId:${contestId}`);
      } else {
        console.log('No contest or user data found in storage');
      }
      resolve(data);
    });
  });
}

/**
 * Creates or updates the contest notification element on the LeetCode page
 */
function updateContestNotification() {
  try {
    // Remove existing notification if it exists
    if (contestNotification) {
      contestNotification.remove();
    }
    
    // Only create notification if there's an active contest
    if (!userState.activeContest) return;
    
    // Create notification element
    contestNotification = document.createElement('div');
    contestNotification.className = 'fixed bottom-2 right-20 z-50 bg-white border border-green-400 text-black px-4 py-2 rounded-md shadow-md';
    contestNotification.innerHTML = `
      <div class="flex items-center">
        <span>You are in ${userState.activeContest.name || 'Unknown'}</span>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(contestNotification);
    
    // Make it disappear after 10 seconds
    setTimeout(() => {
      if (contestNotification) {
        contestNotification.style.opacity = '0';
        contestNotification.style.transition = 'opacity 1s';
        
        // Remove after transition
        setTimeout(() => {
          if (contestNotification) {
            contestNotification.remove();
            contestNotification = null;
          }
        }, 1000);
      }
    }, 10000);
  } catch (error) {
    console.error('Error updating contest notification:', error);
  }
}

/**
 * Extract LeetCode username from page source
 * @returns {string|null} - Extracted username or null if not found
 */
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

/**
 * Check if user is on LeetCode
 * @returns {boolean} - Whether user is on LeetCode
 */
function checkLeetCodePage() {
  userState.isOnLeetcodePage = window.location.href.includes('leetcode.com');
  return userState.isOnLeetcodePage;
}

/**
 * Send event to background script
 * @param {string} eventType - Type of event
 * @param {string} category - Event category
 * @param {string} status - Event status
 */
function sendEvent(eventType, category = 'user_action', status = 'info') {
  try {
    if (!chrome.runtime) {
      console.error('Extension context is invalid.');
      return;
    }

    // Get latest contest data in case it changed
    getExtensionData().then((data) => {
      const currentRollNumber = data.rollNumber || "Unknown Roll";
      
      // Make sure we have the latest LeetCode username
      if (!leetcodeUsername) {
        extractLeetCodeUsername();
      }
      
      chrome.runtime.sendMessage({
        type: "contest_message",
        name: userName || "Unknown User",
        roomCode: contestId || "Unknown Contest",
        rollNumber: currentRollNumber,
        message: eventType,
        category: category,
        status: status,
        leetcodeUsername: leetcodeUsername || "Unknown LeetCode User",
        url: window.location.href,
        timestamp: Date.now()
      });
      console.log(`Event sent: ${category} - ${eventType} (Roll: ${currentRollNumber}, LeetCode: ${leetcodeUsername || "Unknown"})`);
    });
  } catch (error) {
    console.error('Error sending event:', error);
  }
}

/**
 * Add event listeners to tracked elements
 */
function setupButtonTracking() {
  try {
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
                sendEvent(`Clicked: ${element.textContent || item.description}`, 'button_click', 'info');
              });
              console.log(`Tracking added: ${item.description || item.selector}`);
            }
          });
        }
      });
    });
  } catch (error) {
    console.error('Error setting up button tracking:', error);
  }
}

/**
 * Initialize tracking system
 */
async function initializeTracking() {
  try {
    await getExtensionData();
    checkLeetCodePage();

    if (userState.isOnLeetcodePage) {
      extractLeetCodeUsername();
      sendEvent('User opened LeetCode page', 'page_visit');
      
      // Display contest notification if in a contest
      updateContestNotification();
      
      // Set up presence monitoring
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          userState.tabActive = false;
          sendEvent('User left LeetCode tab (switched tab or minimized window)', 'presence', 'critical');
        } else {
          userState.tabActive = true;
          userState.lastActive = Date.now();
          sendEvent('User returned to LeetCode tab', 'presence', 'info');
        }
      });

      // Track page closure
      window.addEventListener('beforeunload', () => {
        sendEvent('User closed LeetCode page', 'presence', 'warning');
      });

      // Set up button tracking
      setupButtonTracking();

      // Re-check for new elements periodically
      setInterval(setupButtonTracking, 5000);
    }
  } catch (error) {
    console.error('Error initializing tracking:', error);
  }
}

/**
 * Add new button selector to track
 * @param {string} category - Category name
 * @param {string} selector - CSS selector
 * @param {string} description - Button description
 */
function addButtonSelector(category, selector, description) {
  try {
    if (!buttonSelectors[category]) {
      buttonSelectors[category] = [];
    }
    buttonSelectors[category].push({ selector, description });
    setupButtonTracking();
  } catch (error) {
    console.error('Error adding button selector:', error);
  } 
}

/**
 * Check if the current question is already solved
 */
const checkSolvedQuestionPresence = () => {
  try {
    const element = document.querySelector('div[class="text-body flex flex-none items-center gap-1 py-1.5 text-text-secondary dark:text-text-secondary"]');
    if (element) {
      console.log('Question is Solved!');
      sendEvent('Question Already Solved', 'solved_question', 'info');
      clearInterval(intervalId);
    }
  } catch (error) {
    console.error('Error checking solved question:', error);
  }
};

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
  try {
    if (message.type === 'contest_started' || message.type === 'room_joined') {
      // Update contest info
      if (message.contest) {
        userState.activeContest = message.contest;
        updateContestNotification();
      }
    }
  } catch (error) {
    console.error('Error handling message in content script:', error);
  }
});

// Periodically refresh extension data and check for solved questions
setInterval(getExtensionData, 30000);
const intervalId = setInterval(checkSolvedQuestionPresence, 10000);

// Start tracking when DOM is fully loaded
window.addEventListener('load', () => {
  setTimeout(initializeTracking, 1000);
});