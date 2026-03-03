'use client';

import { Sun, Moon, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme, type ThemeMode } from '@/components/providers/ThemeProvider';

const OPTIONS: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'auto', label: 'Auto', Icon: Clock },
];

export default function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-rc-steel"
          aria-label="Toggle theme"
          suppressHydrationWarning
        >
          {/* Render both icons; CSS hides the wrong one based on the html.dark class.
              This avoids hydration mismatch since both icons are in the DOM. */}
          <Sun className="size-5 dark:hidden" />
          <Moon className="size-5 hidden dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map(({ value, label, Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setMode(value)}
            className={mode === value ? 'bg-accent' : ''}
          >
            <Icon className="size-4" />
            {label}
            {value === 'auto' && (
              <span className="ml-auto text-xs text-muted-foreground">
                7 pm – 6 am
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
