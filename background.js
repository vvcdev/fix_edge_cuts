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
  // Handle omnibox input - this is the address bar with the @ keyword
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

  // Monitor address bar navigation attempts specifically
  chrome.webNavigation.onBeforeNavigate.addListener(function(details) {
    // Only check the main frame navigations (address bar)
    if (details.frameId === 0) {
      checkAndRedirect(details.url, details.tabId);
    }
  });
  
  // Monitor URL changes in the address bar
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.url) {
      checkAddressBarShortcut(changeInfo.url, tabId);
    }
  });
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

// Check if the URL was entered in the address bar with a shortcut
function checkAddressBarShortcut(url, tabId) {
  // Check if this looks like a search or direct shortcut entry
  // This helps identify address bar inputs rather than links clicked within pages
  if (!url) return false;
  
  const urlObj = new URL(url);
  
  // Check for search engine URLs with our shortcut in the query
  const isSearch = (
    (urlObj.hostname.includes('google.com') && urlObj.pathname.includes('/search')) ||
    (urlObj.hostname.includes('bing.com') && urlObj.pathname.includes('/search')) ||
    urlObj.hostname.includes('duckduckgo.com')
  );
  
  if (isSearch) {
    const query = urlObj.searchParams.get('q') || '';
    
    // Check if the search query contains any of our shortcuts
    for (const shortcut of shortcuts) {
      if (query.toLowerCase().includes(shortcut.shortcut)) {
        chrome.tabs.update(tabId, { url: shortcut.url });
        return true;
      }
    }
  }
  
  // Check for direct entry of shortcuts in the address bar
  // (This might look like a navigation to "@vvc" as hostname)
  const decodedUrl = decodeURIComponent(url.toLowerCase());
  for (const shortcut of shortcuts) {
    // Check if it's a direct entry (address starts with the shortcut)
    // Or if it's part of the path/search parameters
    if (decodedUrl.includes(shortcut.shortcut)) {
      chrome.tabs.update(tabId, { url: shortcut.url });
      return true;
    }
  }
  
  return false;
}

// Check URL for shortcuts and redirect if found
function checkAndRedirect(url, tabId) {
  return checkAddressBarShortcut(url, tabId);
}
