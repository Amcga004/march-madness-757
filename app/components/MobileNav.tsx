'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileNav() {
  const path = usePathname();

  const tabs = [
    { href: '/', label: 'Home' },
    { href: '/scores', label: 'Scores' },
    { href: '/bracket', label: 'Bracket' },
    { href: '/league', label: 'League' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 flex justify-around py-2 z-50">
      {tabs.map(tab => (
        <Link key={tab.href} href={tab.href}>
          <div className={`text-xs ${path === tab.href ? 'text-white' : 'text-gray-500'}`}>
            {tab.label}
          </div>
        </Link>
      ))}
    </div>
  );
}