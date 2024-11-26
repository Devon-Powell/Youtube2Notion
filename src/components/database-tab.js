import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Loader2 } from 'lucide-react';

const DatabaseTab = ({ settings, onSaveSettings }) => {
    const [pageUrl, setPageUrl] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [status, setStatus] = useState('');

    async function createDatabase(token, pageUrl) {
        try {
            console.log('Creating new inline database...');

            // Extract page ID from URL
            const pageIdMatch = pageUrl.match(/([a-zA-Z0-9]{32})/);
            if (!pageIdMatch) {
                throw new Error('Invalid Notion page URL. Please check the URL and try again.');
            }
            const pageId = pageIdMatch[1];

            // Create inline database by adding it as a child block
            const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                },
                body: JSON.stringify({
                    children: [{
                        object: 'block',
                        type: 'child_database',
                        child_database: {
                            title: 'YouTube Notes',
                        },
                        properties: {
                            Name: {
                                title: {}
                            },
                            Channel: {
                                rich_text: {}
                            },
                            'Created Date': {
                                date: {}
                            },
                            Thumbnail: {
                                files: {}
                            }
                        }
                    }]
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to create database');
            }

            // Get the database ID from the created block
            const databaseId = data.results[0].id;

            // Update the database view to gallery
            await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                },
                body: JSON.stringify({
                    title: [{
                        type: 'text',
                        text: { content: 'YouTube Notes' }
                    }],
                    cover: null,
                    icon: {
                        type: 'emoji',
                        emoji: '📺'
                    }
                })
            });

            return {
                databaseId,
                created: true
            };

        } catch (error) {
            console.error('Error creating Notion database:', error);
            throw new Error(`Failed to create database: ${error.message}`);
        }
    }

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
