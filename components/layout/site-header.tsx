import Image from "next/image";
import Link from "next/link";

import { BookCta } from "@/components/book-cta";
import { MobileNav } from "@/components/layout/mobile-nav";
import { copy } from "@/lib/copy";
import { navItems } from "@/lib/navigation";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:h-20 md:px-8">
        <Link href="/#home" className="flex min-w-0 items-center gap-2">
          <Image
            src="/brand/yuzzy-logo.png"
            alt={copy.brand.name}
            width={160}
            height={72}
            className="h-12 w-auto md:h-14"
            priority
          />
        </Link>
        <nav className="hidden md:block" aria-label="Primary">
          <ul className="flex items-center gap-6">
            {navItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.hash}
                  className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <BookCta className="shrink-0" />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
