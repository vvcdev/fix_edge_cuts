// Store shortcuts in memory
let shortcuts = [];
let defaultKeyword = "";

// Load shortcuts from the configuration file
fetch(chrome.runtime.getURL('shortcuts.json'))
  .then(response => response.json())
  .then(data => {
    shortcuts = data.shortcuts;
    defaultKeyword = shortcuts.length > 0 ? shortcuts[0].shortcut.slice(1) : "vvc"; // Remove @ symbol
    setupListeners();
  })
  .catch(error => {
    console.error('Failed to load shortcuts:', error);
  });

function setupListeners() {
  // Handle omnibox input
  chrome.omnibox.onInputEntered.addListener(function(text) {
    handleShortcut(text);
  });

  // Handle suggestions in the omnibox
  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    const suggestions = shortcuts.map(shortcut => {
      const shortcutWithoutAt = shortcut.shortcut.slice(1); // Remove @ symbol
      return {
        content: shortcutWithoutAt,
        description: `Go to: ${shortcut.url} (${shortcut.shortcut})`
      };
    });
    
    // Filter suggestions based on input
    const filteredSuggestions = text 
      ? suggestions.filter(s => s.content.includes(text))
      : suggestions;
      
    suggest(filteredSuggestions);
  });

  // Monitor all navigation attempts
  chrome.webNavigation.onBeforeNavigate.addListener(function(details) {
    checkAndRedirect(details.url, details.tabId);
  });
  
  // Additional listeners to ensure we catch all navigation events
  chrome.webNavigation.onCommitted.addListener(function(details) {
    checkAndRedirect(details.url, details.tabId);
  });
  
  // Monitor address bar changes even when not navigating
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.url) {
      checkAndRedirect(changeInfo.url, tabId);
    }
  });
  
  // Monitor all web requests
  chrome.webRequest && chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
      const result = checkAndRedirectWithReturn(details.url);
      if (result.redirect) {
        return {redirectUrl: result.url};
      }
      return {};
    },
    {urls: ["<all_urls>"]},
    ["blocking"]
  );
}

// Function to handle shortcut text and navigate accordingly
function handleShortcut(text) {
  let targetUrl = null;
  
  // First, check for exact matches (with or without @)
  for (const shortcut of shortcuts) {
    const shortcutText = shortcut.shortcut.slice(1);
    if (text === shortcutText || `@${text}` === shortcut.shortcut) {
      targetUrl = shortcut.url;
      break;
    }
  }
  
  // If no exact match, check if text starts with any shortcut
  if (!targetUrl) {
    for (const shortcut of shortcuts) {
      const shortcutText = shortcut.shortcut.slice(1);
      if (text.startsWith(shortcutText)) {
        targetUrl = shortcut.url;
        break;
      }
    }
  }
  
  // If we found a matching shortcut, navigate to its URL
  if (targetUrl) {
    chrome.tabs.update({ url: targetUrl });
    return true;
  } else {
    // Default to the first shortcut's URL if no match
    const defaultShortcut = shortcuts.find(s => s.shortcut.slice(1) === defaultKeyword);
    if (defaultShortcut) {
      chrome.tabs.update({ url: defaultShortcut.url });
      return true;
    }
  }
  return false;
}

// Check URL for shortcuts and redirect if found
function checkAndRedirect(url, tabId) {
  if (!url) return false;
  
  const decodedUrl = decodeURIComponent(url.toLowerCase());
  
  // Check if the URL contains any of our shortcuts
  for (const shortcut of shortcuts) {
    if (decodedUrl.includes(shortcut.shortcut)) {
      chrome.tabs.update(tabId, { url: shortcut.url });
      return true;
    }
  }
  
  return false;
}

// Version that returns the redirect info instead of performing it
function checkAndRedirectWithReturn(url) {
  if (!url) return {redirect: false};
  
  const decodedUrl = decodeURIComponent(url.toLowerCase());
  
  // Check if the URL contains any of our shortcuts
  for (const shortcut of shortcuts) {
    if (decodedUrl.includes(shortcut.shortcut)) {
      return {redirect: true, url: shortcut.url};
    }
  }
  
  return {redirect: false};
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkShortcut") {
    const result = handleShortcut(message.text);
    sendResponse({success: result});
    return true;
  }
});
