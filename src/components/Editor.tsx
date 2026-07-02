import { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { AuthProvider, useAuth, authHeaders } from '../auth/AuthContext';
import { SiteProvider, useSite } from '../store';
import { generateSiteHtml } from '../publish';
import SectionPicker from './SectionPicker';
import Canvas from './Canvas';
import PropertyEditor from './PropertyEditor';
import PreviewModal from './PreviewModal';
import AuthForm from './AuthForm';
import PricingPage from './PricingPage';

function EditorToolbar() {
  const { state } = useSite();
  const { user, token, loading } = useAuth();
  const [showPreview, setShowPreview] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  // Fetch subscription on mount
  useEffect(() => {
    if (user && token) {
      fetch('/api/subscription', { headers: authHeaders(token) })
        .then(r => r.json())
        .then(data => setSubscription(data))
        .catch(() => setSubscription({ tier: 'free' }));
    } else {
      setSubscription(null);
    }
  }, [user, token]);

  const handlePublish = async () => {
    if (state.sections.length === 0) {
      setPublishStatus('Add at least one section before publishing');
      setTimeout(() => setPublishStatus(null), 3000);
      return;
    }

    if (!user) {
      setShowAuth(true);
      setPublishStatus('Please log in to publish');
      setTimeout(() => setPublishStatus(null), 3000);
      return;
    }

    setIsPublishing(true);
    setPublishStatus(null);

    try {
      const html = generateSiteHtml(state.sections);
      const siteName = prompt('Name your site:', 'My SwiftSite') || 'Untitled Site';
      const resp = await fetch('/api/publish', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ html, name: siteName }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Publish failed');
      }

      const data = await resp.json();
      setPublishStatus(`Published "${siteName}"!`);
      setTimeout(() => setPublishStatus(null), 4000);
    } catch (err: any) {
      setPublishStatus(err.message || 'Publish failed');
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

          {user && subscription?.tier !== 'free' && subscription?.tier !== undefined && (
            <span className="toolbar-tier-badge">{subscription.tier}</span>
          )}

          {user && subscription?.tier === 'free' && (
            <button className="toolbar-btn toolbar-btn-upgrade" onClick={() => setShowPricing(true)}>
              ⭐ Upgrade
            </button>
          )}

          {loading ? (
            <span className="toolbar-badge">Loading...</span>
          ) : user ? (
            <div className="auth-status-compact" onClick={() => setShowAuth(!showAuth)} title={user.email}>
              <span className="auth-user-avatar-sm">{user.email[0].toUpperCase()}</span>
            </div>
          ) : (
            <button className="toolbar-btn toolbar-btn-auth" onClick={() => setShowAuth(!showAuth)}>
              Log In
            </button>
          )}
          <span className="toolbar-badge">Beta</span>

          {showAuth && (
            <div className="auth-dropdown">
              <AuthForm onSuccess={() => setShowAuth(false)} />
            </div>
          )}
        </div>
      </header>

      {showPreview && (
        <PreviewModal
          sections={state.sections}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showPricing && (
        <div className="pricing-overlay">
          <PricingPage onClose={() => setShowPricing(false)} />
        </div>
      )}
    </>
  );
}

function EditorLayout() {
  return (
    <DndProvider backend={HTML5Backend}>
      <AuthProvider>
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
      </AuthProvider>
    </DndProvider>
  );
}

export default function Editor() {
  return <EditorLayout />;
}