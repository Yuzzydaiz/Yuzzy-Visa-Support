type TeamSlot = {
  name: string;
  role: string;
  initials: string;
  placeholder: boolean;
  photo?: string;
};

export const copy = {
  brand: {
    name: "Yuzzy Visa Support",
    tagline: "Building profiles that get approved.",
    wordmark: "Yuzzy",
    subline: "VISA SUPPORT",
  },
  meta: {
    title: "Yuzzy Visa Support",
    description:
      "We help researchers, engineers, physicians, and executives strengthen their academic impact, professional recognition, and global visibility, so your EB1A, O1, or NIW petition is strong before you ever file.",
  },
  hero: {
    eyebrow: "EB1A · O1 · NIW Profile Building",
    headline: "Yuzzy Visa Support",
    kicker: "Build the profile USCIS wants to approve",
    subheadline:
      "We help researchers, engineers, physicians, and executives strengthen their academic impact, professional recognition, and global visibility, so your EB1A, O1, or NIW petition is strong before you ever file.",
    cta: "Book a Free Consultation",
    imageBadge: "USCIS-aligned evidence, not legal advice.",
    stats: [
      { label: "Visa Categories", value: "3" },
      { label: "Profiles Built", placeholder: "[NEEDS INPUT]" },
      { label: "Countries", placeholder: "[NEEDS INPUT]" },
    ],
  },
  trustChips: [
    "EB1A",
    "O1",
    "NIW",
    "researchers",
    "engineers",
    "physicians",
    "executives",
  ],
  services: {
    id: "services",
    heading: "How We Help You Build a Stronger Profile",
    intro:
      "Every service is aimed at one outcome: a profile that meets USCIS evidentiary standards for extraordinary ability and national interest categories.",
    cta: "Book a Free Assessment",
    ctaLead: "Not sure which visa category fits you?",
    featuredLabel: "Start here",
    items: [
      {
        title: "Research Publication Support",
        body: "Guidance on writing, positioning, and publishing research that builds your record as a recognized expert in your field.",
        icon: "pen" as const,
      },
      {
        title: "Citation Growth Strategy",
        body: "Support in growing your Google Scholar citation profile through legitimate visibility and outreach strategies.",
        icon: "chart" as const,
      },
      {
        title: "Peer Review Opportunities",
        body: "We help professionals connect with legitimate peer review opportunities at publishers and organizations such as Springer, Elsevier, and IEEE, based on their existing subject matter expertise.",
        icon: "search" as const,
      },
      {
        title: "Professional Membership Guidance",
        body: "We help you prepare strong applications for professional recognition, including IEEE Senior and Fellow grades, ACM, IET, and BCS memberships, based on your qualifications and achievements.",
        icon: "badge" as const,
      },
      {
        title: "Media Coverage Support",
        body: "Guidance on securing legitimate media coverage and press mentions that reflect your professional impact.",
        icon: "megaphone" as const,
      },
      {
        title: "USCIS Ready Documentation",
        body: "Support preparing Letters of Recommendation, expert opinion letters, and evidence documentation aligned with EB1A, O1, and NIW criteria.",
        icon: "folder" as const,
      },
    ],
  },
  process: {
    heading: "How we work",
    steps: [
      {
        n: "01",
        title: "Assess",
        body: "Review your background, target category, and current evidence.",
      },
      {
        n: "02",
        title: "Build",
        body: "Strengthen publications, citations, memberships, and visibility you can stand behind.",
      },
      {
        n: "03",
        title: "File ready",
        body: "Help assemble USCIS aligned documents for an attorney.",
      },
    ],
  },
  about: {
    heading: "About Yuzzy Visa Support",
    paragraphs: [
      "Yuzzy Visa Support helps researchers, engineers, physicians, and executives strategically build strong EB1A, O1, and NIW profiles for U.S. immigration.",
      "We focus on strengthening academic impact, professional recognition, and global visibility, so our clients meet key USCIS criteria before submitting their petition.",
      "Our approach centers on genuine, well documented achievement. We do not just assist with applications, we help you build a profile that reflects real recognition in your field.",
    ],
    founderHeading: "Meet Yuzzy",
    founderBioPlaceholder:
      "[NEEDS INPUT: a short first person bio. Something like \"I'm Yuzzy, an academic research consultant and immigration profile specialist.\"]",
    founderPhoto: undefined as string | undefined,
  },
  team: {
    heading: "Meet the team",
    slots: [
      { name: "Yuzzy", role: "Founder", initials: "Y", placeholder: false },
      {
        name: "[NEEDS INPUT: teammate name]",
        role: "[NEEDS INPUT: role]",
        initials: "?",
        placeholder: true,
      },
      {
        name: "[NEEDS INPUT: teammate name]",
        role: "[NEEDS INPUT: role]",
        initials: "?",
        placeholder: true,
      },
      {
        name: "[NEEDS INPUT: teammate name]",
        role: "[NEEDS INPUT: role]",
        initials: "?",
        placeholder: true,
      },
    ] as TeamSlot[],
  },
  reviews: {
    heading: "What Our Clients Say",
    trustLine: "Trusted by professionals in tech, research, and healthcare",
    caseTypes: [
      "Software Engineer, EB1A",
      "Data Scientist, O1",
      "Researcher, NIW",
      "Physician, NIW",
    ],
  },
  faqs: {
    heading: "Frequently Asked Questions",
    items: [
      {
        q: "What is Yuzzy Visa Support?",
        a: "We help researchers, engineers, physicians, and executives build strong, well documented profiles for EB1A, O1, and NIW immigration petitions through research support, professional recognition guidance, and USCIS ready documentation.",
        placeholder: false,
      },
      {
        q: "Do you provide legal advice?",
        a: "No. Yuzzy Visa Support provides research and profile building support only. We are not a law firm and do not offer legal advice or representation before USCIS. We recommend working with a licensed immigration attorney for legal guidance.",
        placeholder: false,
      },
      {
        q: "Can you guarantee I'll get a fellowship or senior membership?",
        a: "No one can guarantee a professional organization's decision. We help you prepare the strongest possible application based on your real qualifications and achievements. The final decision always rests with the organization.",
        placeholder: false,
      },
      {
        q: "How long does the profile building process take?",
        a: "[NEEDS INPUT: real estimate, e.g. typically X to Y months depending on your starting profile and target visa category]",
        placeholder: true,
      },
      {
        q: "What visa categories do you support?",
        a: "We currently support profile building for EB1A, O1, and EB2 NIW petitions.",
        placeholder: false,
      },
      {
        q: "How do I get started?",
        a: "Book a free consultation using the link below, and we'll walk through your background and the best path forward.",
        placeholder: false,
      },
    ],
  },
  contact: {
    heading: "Get in Touch",
    body: "Have questions about your profile or which visa category fits you? Reach out and we'll get back to you.",
    emailPlaceholder: "[NEEDS INPUT: publishable email]",
    phonePlaceholder: "[NEEDS INPUT: publishable phone]",
    email: undefined as string | undefined,
    phone: undefined as string | undefined,
    visaOptions: [
      { value: "EB1A", label: "EB1A" },
      { value: "O1", label: "O1" },
      { value: "EB2_NIW", label: "EB2 NIW" },
    ],
    success: "Thanks. We received your message and will get back to you.",
    error: "Something went wrong. Please try again, or book a consultation instead.",
  },
  subscribe: {
    heading: "Stay Informed",
    body: "Get updates on USCIS policy changes, EB1A and O1 approval trends, and tips for building a stronger immigration profile.",
    disclaimer:
      "Yuzzy Visa Support provides informational and educational content only and does not offer legal advice. By subscribing, you agree to receive occasional emails from us.",
    success: "You are on the list. Watch for occasional updates from us.",
    error: "Something went wrong. Please try again with a valid email.",
  },
  footer: {
    quickLinks: "Quick links",
    contactHeading: "Contact",
    ctaHeading: "Get started",
    ctaLead:
      "Book a free consultation and we'll walk through your background.",
    linkedin: undefined as string | undefined,
    linkedinPlaceholder: "[NEEDS INPUT]",
    disclaimer:
      "Yuzzy Visa Support provides informational and educational services only. We are not attorneys and do not offer legal advice or representation before U.S. immigration authorities. For legal guidance, consult a licensed immigration attorney. We do not guarantee the accuracy of the information provided or the outcome of any petition or application.",
  },
} as const;
