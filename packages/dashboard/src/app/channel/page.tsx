'use client';

import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher, apiPost } from '@/lib/api-client';
import { useEventStream } from '@/hooks/use-event-stream';
import type { ChannelMessage } from '@/app/api/channel/route';

export default function ChannelPage() {
  const { data: messages, mutate: refreshMessages } = useSWR<ChannelMessage[]>('/api/channel', fetcher);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-refresh on new messages
  useEventStream({
    filterPrefix: 'channel:',
    onEvent: () => {
      void refreshMessages();
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setSending(true);
    setInput('');
    try {
      await apiPost('/channel', { content: text, role: 'user' });
      // SSE events will trigger refreshMessages automatically,
      // but also refresh manually to ensure immediate display
      await refreshMessages();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <h2 className="mb-4 text-2xl font-bold">Direct Channel</h2>
      <p className="mb-3 text-sm text-gray-500">
        Communicate directly with the Team Lead agent.
      </p>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-lg border border-gray-800 bg-gray-900 p-4"
      >
        {!messages?.length ? (
          <p className="py-8 text-center text-gray-600">No messages yet. Start a conversation.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <span className="mt-1 block text-xs opacity-60">
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Type a message..."
          disabled={sending}
          className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {sending ? 'Thinking...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
