export type SectionType = 'hero' | 'about' | 'services' | 'contact' | 'footer';

export interface Section {
  id: string;
  type: SectionType;
  props: Record<string, any>;
}

export interface SiteState {
  sections: Section[];
  selectedSectionId: string | null;
}

export type SiteAction =
  | { type: 'ADD_SECTION'; sectionType: SectionType }
  | { type: 'REMOVE_SECTION'; id: string }
  | { type: 'MOVE_SECTION'; fromIndex: number; toIndex: number }
  | { type: 'SELECT_SECTION'; id: string | null }
  | { type: 'UPDATE_SECTION_PROPS'; id: string; props: Record<string, any> };

// Default content for each section type
export const DEFAULT_SECTION_PROPS: Record<SectionType, Record<string, any>> = {
  hero: {
    headline: 'Welcome to SwiftSite',
    subheadline: 'Build your professional website in minutes',
    ctaText: 'Get Started',
    ctaUrl: '#',
    bgColor: '#1a365d',
    textColor: '#ffffff',
    ctaBgColor: '#ed8936',
    imageUrl: '',
  },
  about: {
    headline: 'About Us',
    body: 'We help small businesses build a stunning online presence. Our drag-and-drop builder makes it easy.',
    bgColor: '#ffffff',
    textColor: '#2d3748',
    imageUrl: '',
  },
  services: {
    headline: 'Our Services',
    items: [
      { title: 'Web Design', description: 'Beautiful, responsive designs' },
      { title: 'Development', description: 'Fast, reliable code' },
      { title: 'SEO', description: 'Get found on search engines' },
    ],
    bgColor: '#f7fafc',
    textColor: '#2d3748',
  },
  contact: {
    headline: 'Contact Us',
    email: 'hello@example.com',
    phone: '(555) 123-4567',
    address: '123 Main St, City, State',
    bgColor: '#ffffff',
    textColor: '#2d3748',
    ctaBgColor: '#2b6cb0',
  },
  footer: {
    copyright: `© ${new Date().getFullYear()} SwiftSite. All rights reserved.`,
    bgColor: '#2d3748',
    textColor: '#ffffff',
  },
};

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: 'Hero',
  about: 'About',
  services: 'Services',
  contact: 'Contact',
  footer: 'Footer',
};

let _nextId = 1;
export function generateId(): string {
  return `section-${_nextId++}-${Date.now()}`;
}

export function createDefaultSection(type: SectionType): Section {
  return {
    id: generateId(),
    type,
    props: { ...DEFAULT_SECTION_PROPS[type] },
  };
}