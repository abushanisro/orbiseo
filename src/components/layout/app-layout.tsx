'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/icons';
import { Button, buttonVariants } from '../ui/button';
import { useAuth, useUser } from '@/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  LogOut,
  Menu,
  User as UserIcon,
  History,
  Search,
  Home,
  TestTubeDiagonal,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { AuthDialog } from '../auth-dialog';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false);
  
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);


  const handleSignOut = () => {
    auth.signOut();
  };

  const navItems = [
      { href: '/', label: 'AI Search', icon: Home, auth: false},
      { href: '/ai-crawl', label: 'AI Crawl', icon: Search, auth: false },
      { href: '/abtest', label: 'A/B Testing', icon: TestTubeDiagonal, auth: false },
      { href: '/history', label: 'History', icon: History, auth: true },
  ];

  const navLinks = (
    <>
      {navItems.map((item) => (
        (!item.auth || (item.auth && user)) && (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "transition-colors text-foreground/80 hover:text-primary flex items-center gap-2",
              pathname === item.href && "text-primary"
            )}
            onClick={() => setMobileMenuOpen(false)}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      ))}
    </>
  );

  const authSection = isClient && (isUserLoading ? (
    <div className="h-10 w-24 bg-muted/50 rounded-md animate-pulse" />
  ) : user ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-full"
        >
          <Avatar className="h-10 w-10 border-2 border-transparent hover:border-primary transition-colors">
            <AvatarImage src={user.photoURL ?? undefined} />
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              {user.email?.[0].toUpperCase() ?? '?'}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none truncate">
              {user.displayName || user.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        onClick={() => {
          setAuthDialogOpen(true);
          setMobileMenuOpen(false);
        }}
      >
        Login
      </Button>
      <Button
        onClick={() => {
          setAuthDialogOpen(true);
          setMobileMenuOpen(false);
        }}
      >
        Sign Up
      </Button>
    </div>
  ));

  return (
    <>
      <header data-component="AppLayout" className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center">
          <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center space-x-2">
              <Logo className="h-10 w-10" />
              <span className="font-bold text-lg hidden sm:inline-block">
                  OrbiSEO
              </span>
              </Link>
          </div>
          
          <div className="flex flex-1 items-center justify-center">
              {isClient && !isMobile && (
                  <nav className="flex items-center gap-6 text-sm font-medium">
                      {navLinks}
                  </nav>
              )}
          </div>

          {isClient && isMobile ? (
            <div className="flex flex-1 items-center justify-end">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[80vw]">
                  <SheetHeader>
                    <Link
                      href="/"
                      className="mb-8 flex items-center space-x-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Logo className="h-8 w-8" />
                      <span className="font-bold text-lg">
                        Semantichrefs
                      </span>
                    </Link>
                  </SheetHeader>
                  <div className="p-4">
                    <nav className="flex flex-col gap-4 text-lg">
                      {navLinks}
                    </nav>
                  </div>
                  <div className="absolute bottom-4 right-4 left-4 p-4 border-t border-border">
                    {authSection}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          ) : (
              <div className="flex items-center justify-end space-x-4">
                {authSection}
              </div>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  );
}