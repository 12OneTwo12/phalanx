import Link from 'next/link';

interface StatCard {
  label: string;
  href: string;
  icon: string;
  description: string;
}

const STAT_CARDS: StatCard[] = [
  { label: 'Goals', href: '/goals', icon: '🎯', description: 'Manage long-term objectives' },
  { label: 'Tickets', href: '/tickets', icon: '🎫', description: 'Kanban board & ticket pipeline' },
  { label: 'Agents', href: '/agents', icon: '🤖', description: 'Agent status & soul configuration' },
  { label: 'Heartbeat', href: '/heartbeat', icon: '💓', description: 'Reports & proposals' },
  { label: 'Channel', href: '/channel', icon: '💬', description: 'Direct communication with Team Lead' },
  { label: 'Activity', href: '/activity', icon: '📜', description: 'Real-time activity log' },
  { label: 'Conventions', href: '/conventions', icon: '📐', description: 'Team coding conventions' },
];

export default function DashboardPage() {
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Dashboard</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STAT_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-gray-800 bg-gray-900 p-6 transition-colors hover:border-gray-700"
          >
            <div className="mb-2 text-3xl">{card.icon}</div>
            <h3 className="text-lg font-semibold">{card.label}</h3>
            <p className="text-sm text-gray-400">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
