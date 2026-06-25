import type { Section } from './types';

/**
 * Generates a complete standalone HTML page from the editor's sections.
 * All CSS is inlined so the page can be served standalone.
 */
export function generateSiteHtml(sections: Section[], siteTitle: string = 'My SwiftSite'): string {
  const sectionHtml = sections.map(generateSectionHtml).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(siteTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A; -webkit-font-smoothing: antialiased; }
    .ss-section { width: 100%; }
    .ss-section-inner { max-width: 800px; margin: 0 auto; padding: 60px 24px; }
    .ss-hero { padding: 100px 24px; text-align: center; }
    .ss-hero-content { max-width: 700px; margin: 0 auto; }
    .ss-hero-headline { font-size: 42px; font-weight: 800; margin-bottom: 16px; line-height: 1.15; letter-spacing: -0.5px; }
    .ss-hero-subheadline { font-size: 18px; margin-bottom: 32px; opacity: 0.9; line-height: 1.6; }
    .ss-hero-cta { display: inline-block; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 16px; text-decoration: none; color: white; }
    .ss-about h2, .ss-services h2, .ss-contact h2 { font-size: 32px; font-weight: 700; margin-bottom: 20px; letter-spacing: -0.3px; }
    .ss-about p { font-size: 16px; line-height: 1.7; color: #64748B; }
    .ss-services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; margin-top: 24px; }
    .ss-service-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 24px; }
    .ss-service-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .ss-service-card p { font-size: 14px; line-height: 1.6; color: #64748B; }
    .ss-contact-info { display: flex; flex-direction: column; gap: 12px; font-size: 16px; line-height: 1.6; }
    .ss-footer { padding: 32px 24px; text-align: center; }
    .ss-footer p { font-size: 14px; opacity: 0.85; }
  </style>
</head>
<body>
${sectionHtml}
</body>
</html>`;
}

function generateSectionHtml(section: Section): string {
  const p = section.props;

  switch (section.type) {
    case 'hero':
      return `<div class="ss-section ss-hero" style="background-color:${escapeHtml(p.bgColor || '#1a365d')}; color:${escapeHtml(p.textColor || '#ffffff')}">
        <div class="ss-hero-content">
          <h1 class="ss-hero-headline">${escapeHtml(p.headline || 'Welcome')}</h1>
          ${p.subheadline ? `<p class="ss-hero-subheadline">${escapeHtml(p.subheadline)}</p>` : ''}
          ${p.ctaText ? `<a href="${escapeHtml(p.ctaUrl || '#')}" class="ss-hero-cta" style="background-color:${escapeHtml(p.ctaBgColor || '#2563EB')}">${escapeHtml(p.ctaText)}</a>` : ''}
        </div>
      </div>`;

    case 'about':
      return `<div class="ss-section ss-about" style="background-color:${escapeHtml(p.bgColor || '#ffffff')}; color:${escapeHtml(p.textColor || '#2d3748')}">
        <div class="ss-section-inner">
          <h2>${escapeHtml(p.headline || 'About Us')}</h2>
          <p>${escapeHtml(p.body || '')}</p>
        </div>
      </div>`;

    case 'services': {
      const items = p.items || [];
      const cards = items.map((item: any, i: number) =>
        `<div class="ss-service-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></div>`
      ).join('\n          ');
      return `<div class="ss-section ss-services" style="background-color:${escapeHtml(p.bgColor || '#f7fafc')}; color:${escapeHtml(p.textColor || '#2d3748')}">
        <div class="ss-section-inner">
          <h2>${escapeHtml(p.headline || 'Our Services')}</h2>
          <div class="ss-services-grid">${cards}</div>
        </div>
      </div>`;
    }

    case 'contact':
      return `<div class="ss-section ss-contact" style="background-color:${escapeHtml(p.bgColor || '#ffffff')}; color:${escapeHtml(p.textColor || '#2d3748')}">
        <div class="ss-section-inner">
          <h2>${escapeHtml(p.headline || 'Contact Us')}</h2>
          <div class="ss-contact-info">
            ${p.email ? `<p>✉️ ${escapeHtml(p.email)}</p>` : ''}
            ${p.phone ? `<p>📞 ${escapeHtml(p.phone)}</p>` : ''}
            ${p.address ? `<p>📍 ${escapeHtml(p.address)}</p>` : ''}
          </div>
        </div>
      </div>`;

    case 'footer':
      return `<div class="ss-section ss-footer" style="background-color:${escapeHtml(p.bgColor || '#2d3748')}; color:${escapeHtml(p.textColor || '#ffffff')}">
        <p>${escapeHtml(p.copyright || '© SwiftSite. All rights reserved.')}</p>
      </div>`;

    default:
      return '';
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}