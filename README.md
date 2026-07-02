# SwiftSite

**Build your business website. No code. No designers. In hours.**

SwiftSite is a dead-simple drag-and-drop website builder for small-to-medium businesses. Pick a professional template, customize your colors and content, and publish — all without writing a single line of code.

## Features

- 🎨 **Drag & Drop Builder** — Add, move, and customize sections with zero technical skills
- 📱 **Mobile-Optimized** — Every site looks stunning on any device, automatically
- 🔍 **SEO-Optimized** — Built-in best practices so your site ranks from day one
- ⚡ **Lightning Fast** — Blazing-fast load times keep visitors engaged
- 🖼️ **Beautiful Templates** — Industry-specific templates for restaurants, law firms, salons, and more
- 🔒 **SSL & Hosting Included** — Free SSL, reliable hosting, custom domains on paid plans

## Tech Stack

- **Frontend:** Vite + React + TypeScript
- **Drag & Drop:** React DnD
- **Styling:** CSS with custom properties (brand-themed)
- **State:** React Context + useReducer

## Getting Started

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

## Pricing

| Plan | Price | Highlights |
|------|-------|-----------|
| **Starter** | $19/mo | 1 website, 5 pages, mobile-optimized, SwiftSite subdomain |
| **Business** | $49/mo | Unlimited pages, custom domain, advanced analytics, no branding |
| **Pro** | $99/mo | Up to 5 sites, e-commerce, booking system, AI content gen |

## Project Structure

```
src/
├── types.ts                # Type definitions & default content
├── store.tsx               # State management (Context + useReducer)
├── components/
│   ├── Editor.tsx          # Main 3-panel layout
│   ├── SectionPicker.tsx   # Draggable section sidebar
│   ├── Canvas.tsx          # Drop zone canvas
│   ├── SectionRenderer.tsx # Section rendering by type
│   └── PropertyEditor.tsx  # Text & color property panel
├── App.tsx
├── main.tsx
└── index.css
```

## License

MIT