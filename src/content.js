// content.js
console.log('Content script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);

  if (request.action === 'ping') {
    console.log('Received ping, sending pong');
    sendResponse('pong');
    return true;
  }

  if (request.action === 'getVideoInfo') {
    getVideoInfo()
      .then(sendResponse)
      .catch(error => {
        console.error('Error getting video info:', error);
        sendResponse({ error: error.message });
      });
    return true;
  }
});

async function getVideoInfo() {
  try {
    // Get video title
    const titleElement = await waitForElement([
      'h1.ytd-video-primary-info-renderer',
      'h1.title',
      '#title h1',
      'yt-formatted-string.ytd-video-primary-info-renderer'
    ]);

    if (!titleElement) {
      throw new Error('Could not find video title');
    }

    // Get channel name with better handling
    const channelElement = await waitForElement([
      '#channel-name a', // Primary selector for channel link
      '#channel-name span', // Backup selector for channel name span
      'ytd-channel-name yt-formatted-string a', // Alternative selector
      '#owner-name a' // Fallback selector
    ]);

    // Clean up channel name by removing duplicates and extra whitespace
    let channelName = 'Unknown Channel';
    if (channelElement) {
      channelName = channelElement.textContent
        .trim()
        .split(/\s+/) // Split on whitespace
        .filter((item, index, arr) => arr.indexOf(item) === index) // Remove duplicates
        .join(' '); // Join back with single spaces
    }

    // Try to get transcript
    const transcript = await getTranscript();

    return {
      title: titleElement.textContent.trim(),
      channel: channelName,
      transcript: transcript
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Rest of the content script remains the same

async function getTranscript() {
  // First try to find the transcript button
  let transcriptButton = await findTranscriptButton();
  if (!transcriptButton) {
    throw new Error('No transcript available for this video');
  }

  // Click the button and wait for transcript to load
  transcriptButton.click();
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Try to get transcript text
  const transcriptText = await extractTranscriptText();
  if (!transcriptText) {
    throw new Error('Failed to extract transcript text');
  }

  return transcriptText;
}

async function findTranscriptButton() {
  console.log('Looking for transcript button...');

  // First check if transcript button is directly available
  const directButton = await waitForElement([
    'button[aria-label="Show transcript"]',
    'button[aria-label="Open transcript"]'
  ]);

  if (directButton) {
    console.log('Found direct transcript button');
    return directButton;
  }

  // If not found, try opening the three dots menu
  console.log('Trying three dots menu...');
  const moreButton = await waitForElement([
    'button.ytp-button[aria-label="More actions"]',
    'button.ytp-settings-button',
    'ytd-menu-renderer button#button'
  ]);

  if (moreButton) {
    moreButton.click();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Look for transcript option in menu
    const menuItems = document.querySelectorAll('tp-yt-paper-item, .ytp-menuitem');
    for (const item of menuItems) {
      if (item.textContent.toLowerCase().includes('transcript')) {
        console.log('Found transcript option in menu');
        return item;
      }
    }
  }

  // Try the engagement panel button
  const engagementButton = document.querySelector('button[aria-label*="transcript" i]');
  if (engagementButton) {
    console.log('Found engagement panel transcript button');
    return engagementButton;
  }

  return null;
}

async function extractTranscriptText() {
  // Try different selectors for transcript segments
  const selectors = [
    'div.segment-text',
    'ytd-transcript-segment-renderer',
    'div.ytd-transcript-segment-renderer',
    'div.cue-group',
    'div.ytd-transcript-body-renderer'
  ];

  for (const selector of selectors) {
    const elements = await waitForElements(selector, 2000);
    if (elements && elements.length > 0) {
      console.log(`Found transcript elements using selector: ${selector}`);
      return Array.from(elements)
        .map(elem => elem.textContent.trim())
        .filter(text => text.length > 0)
        .join(' ');
    }
  }

  return null;
}

// Helper function to wait for an element matching any of the given selectors
async function waitForElement(selectors, timeout = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    for (const selector of Array.isArray(selectors) ? selectors : [selectors]) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return null;
}

// Helper function to wait for elements
async function waitForElements(selector, timeout = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      return elements;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return null;
}

// Optional: Add a MutationObserver to handle dynamic content
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      // Check if transcript elements were added
      const transcriptElements = document.querySelectorAll('div.segment-text');
      if (transcriptElements.length > 0) {
        console.log('Transcript elements detected');
      }
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
