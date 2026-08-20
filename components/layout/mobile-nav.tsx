"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";

import { BookCta } from "@/components/book-cta";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navItems } from "@/lib/navigation";

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className="md:hidden"
            aria-label="Open menu"
          />
        }
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile">
          <ul className="flex flex-col gap-4 px-4 py-2">
            {navItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.hash}
                  className="text-base font-medium text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4">
          <BookCta className="w-full" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
