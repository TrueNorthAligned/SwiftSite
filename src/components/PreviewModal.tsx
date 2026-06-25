import type { Section } from '../types';
import { generateSiteHtml } from '../publish';

interface PreviewModalProps {
  sections: Section[];
  onClose: () => void;
}

export default function PreviewModal({ sections, onClose }: PreviewModalProps) {
  const html = generateSiteHtml(sections);

  const handleOpenNewTab = () => {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
    }
  };

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-modal-header">
          <h2>Site Preview</h2>
          <div className="preview-actions">
            <button className="preview-btn preview-btn-secondary" onClick={handleOpenNewTab}>
              Open in New Tab
            </button>
            <button className="preview-btn preview-btn-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>
        <div className="preview-modal-body">
          <iframe
            title="Site Preview"
            srcDoc={html}
            className="preview-iframe"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  );
}