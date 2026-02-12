'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/channel', label: 'Channel', icon: '💬' },
  { href: '/goals', label: 'Goals', icon: '🎯' },
  { href: '/tickets', label: 'Tickets', icon: '🎫' },
  { href: '/agents', label: 'Agents', icon: '🤖' },
  { href: '/heartbeat', label: 'Heartbeat', icon: '💓' },
  { href: '/activity', label: 'Activity', icon: '📜' },
  { href: '/conventions', label: 'Conventions', icon: '📐' },
  { href: '/work-logs', label: 'Work Logs', icon: '📋' },
  { href: '/decisions', label: 'Decisions', icon: '⚖️' },
  { href: '/knowledge', label: 'Knowledge', icon: '📚' },
  { href: '/debates', label: 'Debates', icon: '🗣️' },
  { href: '/meetings', label: 'Meetings', icon: '📅' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r border-gray-800 bg-gray-900">
      <div className="p-4">
        <h1 className="text-xl font-bold tracking-tight">⚔️ Phalanx</h1>
      </div>
      <nav aria-label="Main navigation" className="flex-1 space-y-1 px-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-800 p-4 text-xs text-gray-500">
        Phalanx v0.1.0
      </div>
    </aside>
  );
}
