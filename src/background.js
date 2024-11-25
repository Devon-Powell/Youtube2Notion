// Messaging helper function
function updateStatus(status) {
  chrome.runtime.sendMessage({
    action: 'updateStatus',
    status: status
  }).catch(err => console.error('Error sending status:', err));
}
// Helper function to inject and verify content script
async function injectContentScript(tabId) {
  try {
    // Check if content script is already injected
    const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' }).catch(() => false);
    if (response === 'pong') {
      console.log('Content script already injected');
      return;
    }
    // If not injected, inject it
    console.log('Injecting content script...');
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    // Wait for content script to be ready
    let attempts = 0;
    while (attempts < 5) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        if (response === 'pong') {
          console.log('Content script successfully injected and responding');
          return;
        }
      } catch (e) {
        console.log('Waiting for content script to be ready...');
      }
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Content script failed to respond after injection');
  } catch (error) {
    console.error('Error injecting content script:', error);
    throw new Error('Failed to inject content script');
  }
}

// Function to generate summary using Claude API
async function generateSummary(transcript, apiKey, customPrompt) {
  console.log('Generating summary with Claude...');
  try {
    if (!transcript || !apiKey) {
      throw new Error('Missing transcript or API key');
    }

    // Define default prompt with structured format
    const defaultPrompt = `Create detailed, comprehensive notes from this video transcript. Also provide:
1. A short 1-2 sentence description that captures what this video is about
2. A single concise sentence capturing the key takeaway
Then analyze the content and structure of the video to create an organized set of notes that captures the main ideas, key points, and important details.
Formatting guidelines:
1. Use hierarchical headings:
   - # for main title/topic
   - ## for major sections
   - ### for subsections
2. Use bullet points (-) for listing items
3. Indent sub-points with 2 spaces
4. Include relevant:
   - Key concepts and definitions
   - Examples and statistics
   - Notable quotes
   - Tools or resources mentioned
   - Important takeaways

Provide your response in this exact format:
<shortDescription>Your 1-2 sentence description here</shortDescription>
<keyTakeaway>Your single sentence key takeaway here</keyTakeaway>
<notes>
Your detailed notes here, following the formatting guidelines above
</notes>`;

    const finalPrompt = customPrompt
        ? `${customPrompt}\n\nTranscript: ${transcript}`
        : `${defaultPrompt}\n\nTranscript: ${transcript}`;

    console.log('Making request to Claude API...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: finalPrompt
        }]
      })
    });

    const responseText = await response.text();
    console.log('Received response from Claude API');

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response:', responseText);
      throw new Error('Invalid response from Claude API');
    }

    if (!response.ok) {
      console.error('Claude API error response:', data);
      throw new Error(data.error?.message || 'Unknown error from Claude API');
    }

    if (!data.content || !data.content[0] || !data.content[0].text) {
      console.error('Unexpected response structure:', data);
      throw new Error('Invalid response structure from Claude API');
    }

    const content = data.content[0].text;

    // Only parse structured format if using default prompt
    if (!customPrompt) {
      const shortDescMatch = content.match(/<shortDescription>(.*?)<\/shortDescription>/s);
      const keyTakeawayMatch = content.match(/<keyTakeaway>(.*?)<\/keyTakeaway>/s);
      const notesMatch = content.match(/<notes>(.*?)<\/notes>/s);

      return {
        shortDescription: shortDescMatch ? shortDescMatch[1].trim() : '',
        keyTakeaway: keyTakeawayMatch ? keyTakeawayMatch[1].trim() : '',
        notes: notesMatch ? notesMatch[1].trim() : ''
      };
    }

    // For custom prompts, return the full response as notes
    return {
      notes: content.trim()
    };
  } catch (error) {
    console.error('Error in generateSummary:', error);
    throw new Error(`Claude API error: ${error.message}`);
  }
}

// Function to create Notion page
async function createNotionPage(title, url, summary, notionKey, databaseId, channelName) {
  try {
    console.log('Creating Notion page...');

    // Helper functions remain the same
    const getIndentLevel = line => {
      const match = line.match(/^[ ]*/);
      return match ? match[0].length : 0;
    };

    const getHeadingLevel = line => {
      const match = line.match(/^#{1,6} /);
      return match ? match[0].trim().length : 0;
    };

    const currentDate = new Date().toISOString().split('T')[0];
    const videoId = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^"&?\/\s]{11})/)?.[1];
    const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : url;

    // Convert markdown content into Notion blocks
    const notes = summary.notes;
    const contentBlocks = notes.split('\n').reduce((blocks, line) => {
      if (!line.trim()) return blocks;

      const indentLevel = getIndentLevel(line);
      const trimmedLine = line.trim();

      // Handle headings
      const headingLevel = getHeadingLevel(trimmedLine);
      if (headingLevel > 0) {
        const headingText = trimmedLine.substring(headingLevel + 1);
        blocks.push({
          object: 'block',
          type: `heading_${Math.min(headingLevel, 3)}`,
          [`heading_${Math.min(headingLevel, 3)}`]: {
            rich_text: [{
              type: 'text',
              text: { content: headingText }
            }]
          }
        });
        return blocks;
      }

      // Handle bullet points
      if (trimmedLine.startsWith('-')) {
        const bulletText = trimmedLine.substring(1).trim();
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{
              type: 'text',
              text: { content: bulletText }
            }]
          }
        });
        return blocks;
      }

      // Regular paragraphs
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            type: 'text',
            text: { content: trimmedLine }
          }]
        }
      });
      return blocks;
    }, []);

    // Prepare initial blocks
    const initialBlocks = [
      {
        object: 'block',
        type: 'embed',
        embed: {
          url: embedUrl
        }
      }
    ];

    // Add structured sections if they exist
    if (summary.shortDescription) {
      initialBlocks.push(
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{
                type: 'text',
                text: { content: 'Description' }
              }]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{
                type: 'text',
                text: { content: summary.shortDescription }
              }]
            }
          }
      );
    }

    if (summary.keyTakeaway) {
      initialBlocks.push(
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{
                type: 'text',
                text: { content: 'Key Takeaway' }
              }]
            }
          },
          {
            object: 'block',
            type: 'callout',
            callout: {
              rich_text: [{ type: 'text', text: { content: summary.keyTakeaway } }],
              color: 'blue_background',
              icon: { emoji: '💡' }
            }
          }
      );
    }

    // Add notes heading
    if (summary.shortDescription || summary.keyTakeaway) {
      initialBlocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{
            type: 'text',
            text: { content: 'Notes' }
          }]
        }
      });
    }

    // Create initial page with first set of blocks
    const initialPageData = {
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [{ text: { content: title } }]
        },
        Channel: {
          rich_text: [{ text: { content: channelName || 'Unknown' } }]
        },
        "Created Date": {
          date: {
            start: currentDate
          }
        },
        Thumbnail: {
          files: [
            {
              type: "external",
              name: "Thumbnail",
              external: {
                url: thumbnailUrl
              }
            }
          ]
        }
      },
      children: initialBlocks
    };

    console.log('Creating initial page...');
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(initialPageData)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Notion API error:', responseData);
      throw new Error(responseData.message || 'Failed to create Notion page');
    }

    // If we have more blocks, append them in chunks
    if (contentBlocks.length > 0) {
      const pageId = responseData.id;
      console.log('Appending content blocks...');

      // Split blocks into chunks of 90 to be safe
      for (let i = 0; i < contentBlocks.length; i += 90) {
        const chunk = contentBlocks.slice(i, i + 90);
        console.log(`Appending blocks ${i + 1} to ${i + chunk.length}`);

        const appendResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${notionKey}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: JSON.stringify({
            children: chunk
          })
        });

        if (!appendResponse.ok) {
          const appendError = await appendResponse.json();
          console.error('Error appending blocks:', appendError);
          throw new Error('Failed to append all content blocks');
        }

        // Add a small delay between requests to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('Notion page created successfully:', responseData.url);
    return responseData;

  } catch (error) {
    console.error('Error creating Notion page:', error);
    throw new Error(`Failed to create Notion page: ${error.message}`);
  }
}

// Main processing function
async function handleVideoProcessing(url) {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No active tab found');
    }
    // Validate URL
    if (!tab.url?.includes('youtube.com/watch')) {
      throw new Error('Please navigate to a YouTube video first');
    }
    // Get all settings including customPrompt
    const settings = await chrome.storage.sync.get(['anthropicKey', 'notionKey', 'notionDb', 'customPrompt']);
    if (!settings.anthropicKey || !settings.notionKey || !settings.notionDb) {
      throw new Error('Please configure all settings first');
    }
    // Ensure content script is injected and ready
    updateStatus('Preparing...');
    await injectContentScript(tab.id);
    updateStatus('Getting video information...');
    const videoInfo = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for video information'));
      }, 15000);
      chrome.tabs.sendMessage(tab.id, { action: 'getVideoInfo' }, response => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error('No response from content script'));
          return;
        }
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response);
      });
    });
    if (!videoInfo.transcript) {
      throw new Error('No transcript available for this video');
    }
    console.log('Video info retrieved:', {
      title: videoInfo.title,
      channel: videoInfo.channel,
      transcriptLength: videoInfo.transcript.length
    });
    updateStatus('Generating summary with Claude...');
    const summary = await generateSummary(
        videoInfo.transcript,
        settings.anthropicKey,
        settings.customPrompt
    );
    updateStatus('Creating Notion page...');
    await createNotionPage(
        videoInfo.title,
        url,
        summary,
        settings.notionKey,
        settings.notionDb,
        videoInfo.channel
    );
    updateStatus('Successfully created Notion page!');
    return {
      success: true,
      message: 'Successfully created Notion page!'
    };
  } catch (error) {
    console.error('Error in handleVideoProcessing:', error);
    updateStatus(`Error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Single message listener for background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processVideo') {
    handleVideoProcessing(request.url)
        .then(result => {
          sendResponse(result);
        })
        .catch(error => {
          sendResponse({
            success: false,
            error: error.message
          });
        });
    return true; // Keep the message channel open
  }
});
