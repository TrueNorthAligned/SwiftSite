import type { Section } from '../types';

interface SectionRendererProps {
  section: Section;
  isSelected: boolean;
  onClick: () => void;
}

function HeroSection({ props }: { props: Record<string, any> }) {
  return (
    <div
      className="ss-section ss-hero"
      style={{ backgroundColor: props.bgColor, color: props.textColor }}
    >
      <div className="ss-hero-content">
        <h1 className="ss-hero-headline">{props.headline || 'Welcome'}</h1>
        <p className="ss-hero-subheadline">{props.subheadline || ''}</p>
        {props.ctaText && (
          <a
            href={props.ctaUrl || '#'}
            className="ss-hero-cta"
            style={{ backgroundColor: props.ctaBgColor }}
          >
            {props.ctaText}
          </a>
        )}
      </div>
    </div>
  );
}

function AboutSection({ props }: { props: Record<string, any> }) {
  return (
    <div
      className="ss-section ss-about"
      style={{ backgroundColor: props.bgColor, color: props.textColor }}
    >
      <div className="ss-section-inner">
        <h2>{props.headline || 'About Us'}</h2>
        <p>{props.body || ''}</p>
      </div>
    </div>
  );
}

function ServicesSection({ props }: { props: Record<string, any> }) {
  const items = props.items || [];
  return (
    <div
      className="ss-section ss-services"
      style={{ backgroundColor: props.bgColor, color: props.textColor }}
    >
      <div className="ss-section-inner">
        <h2>{props.headline || 'Our Services'}</h2>
        <div className="ss-services-grid">
          {items.map((item: any, idx: number) => (
            <div key={idx} className="ss-service-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContactSection({ props }: { props: Record<string, any> }) {
  return (
    <div
      className="ss-section ss-contact"
      style={{ backgroundColor: props.bgColor, color: props.textColor }}
    >
      <div className="ss-section-inner">
        <h2>{props.headline || 'Contact Us'}</h2>
        <div className="ss-contact-info">
          {props.email && <p>✉️ {props.email}</p>}
          {props.phone && <p>📞 {props.phone}</p>}
          {props.address && <p>📍 {props.address}</p>}
        </div>
      </div>
    </div>
  );
}

function FooterSection({ props }: { props: Record<string, any> }) {
  return (
    <div
      className="ss-section ss-footer"
      style={{ backgroundColor: props.bgColor, color: props.textColor }}
    >
      <p>{props.copyright || '© SwiftSite. All rights reserved.'}</p>
    </div>
  );
}

export default function SectionRenderer({ section, isSelected, onClick }: SectionRendererProps) {
  const renderSection = () => {
    switch (section.type) {
      case 'hero':
        return <HeroSection props={section.props} />;
      case 'about':
        return <AboutSection props={section.props} />;
      case 'services':
        return <ServicesSection props={section.props} />;
      case 'contact':
        return <ContactSection props={section.props} />;
      case 'footer':
        return <FooterSection props={section.props} />;
      default:
        return <div>Unknown section type</div>;
    }
  };

  return (
    <div
      className={`ss-canvas-section ${isSelected ? 'ss-selected' : ''}`}
      onClick={onClick}
    >
      {renderSection()}
    </div>
  );
}