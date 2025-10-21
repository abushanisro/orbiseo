import Link from 'next/link';
import { Logo } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import { Twitter, Linkedin, Github } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between py-6">
          <div className="flex items-center gap-2">
            <Logo className="h-10 w-10" />
            <span className="font-bold text-lg">OrbiSEO</span>
          </div>
          <p className="text-muted-foreground text-sm mt-4 md:mt-0">
            © 2025 OrbiSEO. All rights reserved.
          </p>
          <div className="flex items-center gap-2 mt-4 md:mt-0">
            <a
              href="https://x.com/abushan_ai"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            >
              <Twitter className="h-5 w-5" />
              <span className="sr-only">Twitter</span>
            </a>
            <a
              href="https://www.linkedin.com/in/abushan/"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            >
              <Linkedin className="h-5 w-5" />
              <span className="sr-only">LinkedIn</span>
            </a>
            <a
              href="https://github.com/abushanisro"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            >
              <Github className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
