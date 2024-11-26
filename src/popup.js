import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Moon, Sun, MessageSquare, Key, Database, Play } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import './styles.css';
import PromptEditor from './components/prompt-editor';
import NotionTab from './components/notion-tab';

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
   - Important takeaways`;

const Popup = () => {
  const [settings, setSettings] = useState({
    notionKey: '',
    notionDb: '',
    anthropicKey: '',
    customPrompt: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          const result = await new Promise((resolve) => {
            chrome.storage.sync.get(
                ['notionKey', 'notionDb', 'anthropicKey', 'customPrompt', 'theme'],
                (data) => resolve(data)
            );
          });

          setSettings(prev => ({
            ...prev,
            ...result
          }));

          if (result.theme) {
            setTheme(result.theme);
            document.documentElement.className = result.theme;
          }
        }
      } catch (err) {
        console.error('Error loading settings:', err);
        setStatus('Error loading settings. Please try refreshing.');
      }
    };

    loadSettings();
  }, []);

  const saveSettings = async (key, value) => {
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.sync.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      setSettings(prev => ({
        ...prev,
        [key]: value
      }));
    } catch (err) {
      console.error('Error saving setting:', err);
      setStatus('Error saving settings. Please try again.');
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.className = newTheme;
    await chrome.storage.sync.set({ theme: newTheme });
  };

  const processVideo = async () => {
    try {
      setIsProcessing(true);
      setStatus('Processing video...');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url?.includes('youtube.com/watch')) {
        throw new Error('Please navigate to a YouTube video first');
      }

      // Set up message listener before sending the request
      chrome.runtime.onMessage.addListener(function messageListener(request) {
        if (request.action === 'updateStatus') {
          setStatus(request.status);
          // Don't remove listener until we're done or error
          if (request.status.includes('Success') || request.status.includes('Error')) {
            chrome.runtime.onMessage.removeListener(messageListener);
            setIsProcessing(false);
          }
        }
      });

      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'processVideo',
          url: tab.url
        }, response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!response || !response.success) {
            reject(new Error(response.error || 'Failed to process video'));
          } else {
            resolve(response);
          }
        });
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to process video');
      }

    } catch (error) {
      console.error('Error processing video:', error);
      setStatus(`Error: ${error.message}`);
      setIsProcessing(false);
    }
  };

  return (
      <div className="w-[400px] min-h-[450px] bg-background text-foreground flex flex-col">
        <div className="app-header">
          <h1 className="app-title">YT2Notion</h1>
          <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="theme-toggle"
          >
            {theme === 'light' ? (
                <Moon className="h-5 w-5"/>
            ) : (
                <Sun className="h-5 w-5"/>
            )}
          </Button>
        </div>

        <Tabs defaultValue="prompt" className="w-full flex-grow flex flex-col">
          <TabsList className="flex justify-center">
            <TabsTrigger value="prompt" className="flex-1 flex items-center justify-center">
              <MessageSquare className="h-4 w-4"/>
            </TabsTrigger>
            <TabsTrigger value="notion" className="flex-1 flex items-center justify-center">
              <Database className="h-4 w-4"/>
            </TabsTrigger>
            <TabsTrigger value="anthropic" className="flex-1 flex items-center justify-center">
              <Key className="h-4 w-4"/>
            </TabsTrigger>
          </TabsList>

          <div className="p-4">
            <TabsContent value="prompt" className="mt-0">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Prompt Customization</h3>
                <p className="text-sm text-muted-foreground">
                  Customize how Claude analyzes your videos:
                </p>
                <PromptEditor
                    placeholder={defaultPrompt}
                    value={settings.customPrompt || ''}
                    onChange={(value) => saveSettings('customPrompt', value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="notion" className="mt-0">
              <NotionTab
                  settings={settings}
                  onSaveSettings={saveSettings}
              />
            </TabsContent>

            <TabsContent value="anthropic" className="mt-0 space-y-4">
              <h3 className="text-lg font-semibold">API Configuration</h3>
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                <li>Go to <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer"
                             className="text-primary hover:underline">console.anthropic.com</a></li>
                <li>Sign up or log in to your account</li>
                <li>Navigate to API Keys</li>
                <li>Create and copy your API key</li>
              </ol>
              <Input
                  type="password"
                  placeholder="Paste your Anthropic API Key"
                  value={settings.anthropicKey}
                  onChange={(e) => saveSettings('anthropicKey', e.target.value)}
              />
            </TabsContent>
          </div>
        </Tabs>

        <div className="p-4 border-t border-border mt-auto">
          <Button
              className="process-button w-full"
              onClick={processVideo}
              disabled={isProcessing}
          >
            <Play className="mr-2 h-4 w-4"/>
            {isProcessing ? 'Processing...' : 'Process Video'}
          </Button>

          {status && (
              <div className="mt-3 p-3 rounded-lg text-sm status-message">
                {status}
              </div>
          )}
        </div>
      </div>
  );
};

// Initialize popup
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
      <React.StrictMode>
        <Popup/>
      </React.StrictMode>
  );
} else {
  console.error('Root element not found');
}
