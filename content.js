const buttonSelectors = [
    'button[data-e2e-locator="console-run-button"]',
    'button[data-e2e-locator="console-submit-button"]',
    'div[id="solutions_tab"]',
    'div[id="editorial_tab"]',
  ];

  window.onload = () => {
    setTimeout(() => {

        buttonSelectors.map(selector => {
          const button = document.querySelector(selector);
          if (button) {
            button.addEventListener('click', () => {
              sendEvent(`Clicked: ${selector}`);
              console.log(`Clicked: ${selector}`);
            }
            );
          }
        }
      );
      
      const belowSections = document.querySelectorAll('div[class="text-sd-foreground flex items-center gap-2"]');
      belowSections.forEach(section => {
        section.addEventListener('click', () => {
          sendEvent(`Clicked: ${section}`);
          console.log(`Clicked: ${section}`);
        });
      });

    }, 1200);
  }
  
//   document.querySelectorAll(selector).forEach(button => {
//       button.addEventListener("click", () => {
//         sendEvent(`Clicked: ${selector}`);
//       });
//       console.log(`Tracking added: ${selector}`);
//   });
  
  function sendEvent(eventType) {
    chrome.runtime.sendMessage({
      type: "log_event",
      data: {
        event: eventType,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }
    });
    console.log(`Event sent: ${eventType}`);
  }
  
//   function trackButtons() {
//     buttonSelectors.forEach(selector => {
//       document.querySelectorAll(selector).forEach(button => {
//         if (!button.dataset.tracked) {
//           button.dataset.tracked = "true";
//           button.addEventListener("click", () => {
//             sendEvent(`Clicked: ${selector}`);
//           });
//           console.log(`Tracking added: ${selector}`);
//         }
//       });
//     });
//   }
  
//   // Run tracking once for existing buttons
//   trackButtons();
  
//   // Observe DOM changes to track new buttons
//   const observer = new MutationObserver(() => {
//     trackButtons();
//   });
  
//   observer.observe(document.body, { childList: true, subtree: true });
  