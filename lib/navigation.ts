export type NavItem = {
  id: string;
  label: string;
  hash: string;
  href: string;
};

export const navItems: NavItem[] = [
  { id: "home", label: "Home", hash: "/#home", href: "/" },
  { id: "about", label: "About Us", hash: "/#about", href: "/about" },
  { id: "services", label: "Services", hash: "/#services", href: "/services" },
  { id: "reviews", label: "Reviews", hash: "/#reviews", href: "/reviews" },
  { id: "faqs", label: "FAQs", hash: "/#faqs", href: "/faqs" },
  { id: "contact", label: "Contact Us", hash: "/#contact", href: "/contact" },
];

export const bookLabel = "Book a Free Consultation";
