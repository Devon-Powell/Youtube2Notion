import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Loader2 } from 'lucide-react';

const DatabaseTab = ({ settings, onSaveSettings }) => {
    const [pageUrl, setPageUrl] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [status, setStatus] = useState('');

    const createDatabase = async () => {
        if (!pageUrl) {
            setStatus('Please enter a Notion page URL');
            return;
        }

        if (!settings.notionKey) {
            setStatus('Please configure your Notion API key first');
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

            // Save the database ID
            await onSaveSettings('notionDb', response.databaseId);

            setStatus('Successfully created YouTube Notes database!');
            setPageUrl(''); // Clear the URL input

        } catch (error) {
            setStatus(`Error: ${error.message}`);
            console.error('Database creation error:', error);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-4">
                {settings.notionDb ? (
                    <div className="flex items-center space-x-2 text-sm">
                        <span className="flex h-2 w-2 rounded-full bg-green-500"/>
                        <span>Database connected</span>
                    </div>
                ) : (
                    <div className="rounded-lg border border-border bg-card p-4">
                        <h3 className="font-medium">Database Setup</h3>
                        <p className="text-sm text-muted-foreground mt-2">
                            Enter the URL of the Notion page where you'd like to create your YouTube Notes database.
                        </p>
                    </div>
                )}

                <div className="space-y-4">
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

            {status && (
                <div className={`text-sm p-3 rounded-lg ${
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

export default DatabaseTab;
