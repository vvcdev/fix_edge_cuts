// Content script to monitor keyboard input on all pages

// Keep track of what's being typed
let inputBuffer = '';
const MAX_BUFFER_SIZE = 20; // Maximum number of characters to store in the buffer

// Listen for keypress events
document.addEventListener('keydown', function(event) {
  // Clear buffer on special keys
  if (event.key === 'Escape' || event.key === 'Enter') {
    inputBuffer = '';
    return;
  }
  
  // Ignore function keys, etc.
  if (event.key.length !== 1 && event.key !== '@' && event.key !== 'Backspace') {
    return;
  }
  
  // Handle backspace
  if (event.key === 'Backspace') {
    inputBuffer = inputBuffer.slice(0, -1);
    return;
  }
  
  // Add the key to the buffer
  inputBuffer += event.key;
  
  // Trim buffer if it gets too long
  if (inputBuffer.length > MAX_BUFFER_SIZE) {
    inputBuffer = inputBuffer.slice(-MAX_BUFFER_SIZE);
  }
  
  // Check if the buffer contains '@'
  const atIndex = inputBuffer.lastIndexOf('@');
  if (atIndex !== -1) {
    const possibleShortcut = inputBuffer.slice(atIndex);
    
    // If it's a potential shortcut (has something after the @), check with background script
    if (possibleShortcut.length > 1) {
      chrome.runtime.sendMessage(
        {
          action: "checkShortcut", 
          text: possibleShortcut.slice(1) // Remove the @ symbol
        },
        response => {
          if (response && response.success) {
            // If it was a valid shortcut, clear the buffer
            inputBuffer = '';
          }
        }
      );
    }
  }
});

// Monitor URL changes within the page (for SPAs)
const observer = new MutationObserver(function(mutations) {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    chrome.runtime.sendMessage({
      action: "checkUrl",
      url: location.href
    });
  }
});

let lastUrl = location.href;
observer.observe(document, {subtree: true, childList: true});

// Initially check the URL when the page loads
chrome.runtime.sendMessage({
  action: "checkUrl",
  url: location.href
});
