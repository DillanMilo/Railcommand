'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  const allItems: BreadcrumbItem[] = [
    { label: 'RailCommand', href: '/dashboard' },
    ...items,
  ];

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm min-w-0">
      {allItems.map((item, index) => {
        const isLast = index === allItems.length - 1;
        // On mobile, show only the last two items
        const isMobileHidden = index < allItems.length - 2;

        return (
          <span
            key={index}
            className={cn(
              'flex items-center gap-1 min-w-0',
              isMobileHidden && 'hidden md:flex'
            )}
          >
            {index > 0 && (
              <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
            )}
            {isLast || !item.href ? (
              <span className="text-foreground font-medium truncate">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
