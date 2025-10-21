'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/icons';
import { Button } from '../ui/button';
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
  Search,
  Home,
  TestTubeDiagonal,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useIsMobile } from '@/hooks/use-mobile';
import { AuthDialog } from '../auth-dialog';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSignOut = () => auth.signOut();

  const navItems = [
    { href: '/', label: 'AI Search', icon: Home, auth: false },
    { href: '/ai-crawl', label: 'AI Crawl', icon: Search, auth: false },
    { href: '/abtest', label: 'A/B Testing', icon: TestTubeDiagonal, auth: false },
  ];


  const authSection =
    isClient && (isUserLoading ? (
      <div className="h-10 w-24 bg-muted/50 rounded-md animate-pulse" />
    ) : user ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
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
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Left: Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                <Logo className="h-8 w-8 sm:h-10 sm:w-10" />
                <span className="font-bold text-lg sm:text-xl bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  OrbiSEO
                </span>
              </Link>
            </div>

            {/* Center: Navigation - Desktop */}
            {isClient && !isMobile && (
              <nav className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1 backdrop-blur-sm border border-border/50">
                  {navItems.map((item) =>
                    (!item.auth || (item.auth && user)) && (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:bg-background/80 hover:shadow-sm",
                          pathname === item.href
                            ? "bg-background text-primary shadow-sm border border-border/50"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <item.icon className={cn(
                          "h-4 w-4 transition-colors",
                          pathname === item.href ? "text-primary" : ""
                        )} />
                        {item.label}
                      </Link>
                    )
                  )}
                </div>
              </nav>
            )}

            {/* Right: Auth / Mobile menu */}
            <div className="flex items-center gap-2">
              {isClient && isMobile ? (
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="hover:bg-muted/80">
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">Open navigation menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[280px] sm:w-[350px] p-0">
                    <SheetHeader className="p-6 pb-4 border-b border-border/50">
                      <VisuallyHidden>
                        <SheetTitle>Navigation Menu</SheetTitle>
                      </VisuallyHidden>
                      <Link
                        href="/"
                        className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Logo className="h-8 w-8" />
                        <span className="font-bold text-xl bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                          OrbiSEO
                        </span>
                      </Link>
                    </SheetHeader>

                    {/* Mobile Navigation */}
                    <div className="flex-1 p-6">
                      <nav className="space-y-2">
                        {navItems.map((item) =>
                          (!item.auth || (item.auth && user)) && (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 hover:bg-muted/80",
                                pathname === item.href
                                  ? "bg-primary/10 text-primary border border-primary/20"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              )}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              <item.icon className={cn(
                                "h-5 w-5 transition-colors",
                                pathname === item.href ? "text-primary" : ""
                              )} />
                              {item.label}
                            </Link>
                          )
                        )}
                      </nav>
                    </div>

                    {/* Mobile Auth Section */}
                    <div className="p-6 border-t border-border/50 bg-muted/30">
                      {authSection}
                    </div>
                  </SheetContent>
                </Sheet>
              ) : (
                authSection
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  );
}
