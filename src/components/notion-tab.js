import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Loader2 } from 'lucide-react';

const NotionTab = ({ settings, onSaveSettings }) => {
  const [pageUrl, setPageUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState('');

  const createDatabase = async () => {
    if (!pageUrl) {
      setStatus('Please enter a Notion page URL');
      return;
    }

    if (!settings.notionKey) {
      setStatus('Please add your Notion Integration Token first');
      return;
    }

    try {
      setIsCreating(true);
      setStatus('Creating database...');

      const response = await chrome.runtime.sendMessage({
        action: 'createNotionDatabase',
        notionKey: settings.notionKey,
        pageUrl: pageUrl
      });

      if (response.error) {
        throw new Error(response.error);
      }

      await onSaveSettings('notionDb', response.databaseId);
      setStatus('Successfully created YouTube Notes database!');
      setPageUrl('');

    } catch (error) {
      setStatus(`Error: ${error.message}`);
      console.error('Database creation error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-6">
            {/* Integration Setup Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Integration Setup</h3>
              <p className="text-sm text-muted-foreground">
                Create an integration at{' '}
                <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer"
                   className="text-primary hover:underline">notion.so/my-integrations</a>
                {' '}and copy the token.
              </p>
              <Input
                  type="password"
                  placeholder="Paste your Notion Integration Token"
                  value={settings.notionKey || ''}
                  onChange={(e) => onSaveSettings('notionKey', e.target.value)}
              />
            </div>

            {/* Database Setup Section */}
            <div className="pt-4 border-t border-border space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Database Setup</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter the URL of any Notion page where you'd like to create your YouTube Notes database.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex space-x-2">
                  <Input
                      type="text"
                      value={pageUrl}
                      onChange={(e) => setPageUrl(e.target.value)}
                      placeholder="Paste Notion page URL"
                      className="flex-1"
                  />
                  <Button
                      onClick={createDatabase}
                      disabled={isCreating || !pageUrl || !settings.notionKey}
                      className="whitespace-nowrap"
                      title={!settings.notionKey ? "Add Integration Token first" : ""}
                  >
                    {isCreating ? (
                        <>
                          <span className="mr-2">Creating...</span>
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </>
                    ) : (
                        'Create Database'
                    )}
                  </Button>
                </div>

                <Input
                    type="text"
                    value={settings.notionDb || ''}
                    onChange={(e) => onSaveSettings('notionDb', e.target.value)}
                    placeholder="Database ID"
                    className="font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {status && (
            <div className={`mt-4 text-sm p-3 rounded-lg ${
                status.startsWith('Error')
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground'
            }`}>
              {status}
            </div>
        )}
      </div>
  );
};

export default NotionTab;
