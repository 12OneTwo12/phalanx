import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center">
      <h2 className="mb-2 text-2xl font-bold">Page Not Found</h2>
      <p className="mb-4 text-gray-400">The page you are looking for does not exist.</p>
      <Link href="/" className="text-blue-400 hover:underline">
        Go to Dashboard
      </Link>
    </div>
  );
}
