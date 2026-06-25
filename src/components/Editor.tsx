import { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { SiteProvider, useSite } from '../store';
import { generateSiteHtml } from '../publish';
import SectionPicker from './SectionPicker';
import Canvas from './Canvas';
import PropertyEditor from './PropertyEditor';
import PreviewModal from './PreviewModal';

function EditorToolbar() {
  const { state } = useSite();
  const [showPreview, setShowPreview] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    if (state.sections.length === 0) {
      setPublishStatus('Add at least one section before publishing');
      setTimeout(() => setPublishStatus(null), 3000);
      return;
    }

    setIsPublishing(true);
    setPublishStatus(null);

    try {
      const html = generateSiteHtml(state.sections);
      const resp = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html }),
      });

      if (!resp.ok) throw new Error('Publish failed');

      const data = await resp.json();
      setPublishStatus(`Published! ID: ${data.id}`);
      setTimeout(() => setPublishStatus(null), 4000);
    } catch (err) {
      setPublishStatus('Publish failed — is the server running?');
      console.error(err);
      setTimeout(() => setPublishStatus(null), 4000);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <>
      <header className="editor-toolbar">
        <div className="toolbar-brand">
          <img src="/logo-icon.svg" alt="SwiftSite" className="toolbar-logo-img" />
          <h1>SwiftSite <span className="toolbar-tagline">Builder</span></h1>
        </div>
        <div className="toolbar-actions">
          {publishStatus && (
            <span className={`toolbar-status-msg ${publishStatus.includes('Published') ? 'success' : 'error'}`}>
              {publishStatus}
            </span>
          )}
          <button
            className="toolbar-btn toolbar-btn-preview"
            onClick={() => setShowPreview(true)}
            disabled={state.sections.length === 0}
          >
            👁 Preview
          </button>
          <button
            className="toolbar-btn toolbar-btn-publish"
            onClick={handlePublish}
            disabled={isPublishing || state.sections.length === 0}
          >
            {isPublishing ? 'Publishing...' : '📦 Publish'}
          </button>
          <div className="toolbar-status">
            <span className="toolbar-status-dot"></span>
            <span>{state.sections.length} sections</span>
          </div>
          <span className="toolbar-badge">Beta</span>
        </div>
      </header>

      {showPreview && (
        <PreviewModal
          sections={state.sections}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}

function EditorLayout() {
  return (
    <DndProvider backend={HTML5Backend}>
      <SiteProvider>
        <div className="editor-layout">
          <EditorToolbar />

          <div className="editor-body">
            <aside className="editor-sidebar editor-sidebar-left">
              <SectionPicker />
            </aside>

            <main className="editor-main">
              <Canvas />
            </main>

            <aside className="editor-sidebar editor-sidebar-right">
              <PropertyEditor />
            </aside>
          </div>
        </div>
      </SiteProvider>
    </DndProvider>
  );
}

export default function Editor() {
  return <EditorLayout />;
}