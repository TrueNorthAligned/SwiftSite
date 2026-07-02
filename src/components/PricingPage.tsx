import { useState, useEffect } from 'react';
import { useAuth, authHeaders } from '../auth/AuthContext';

interface Tier {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  maxPages: number;
  features: string[];
}

const TIER_ICONS: Record<string, string> = {
  free: '🆓',
  starter: '🚀',
  business: '💼',
  pro: '⭐',
};

export default function PricingPage({ onClose }: { onClose?: () => void }) {
  const { user, token } = useAuth();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/pricing')
      .then(r => r.json())
      .then(data => setTiers(data))
      .catch(() => {});

    if (user) {
      fetch('/api/subscription', { headers: authHeaders(token) })
        .then(r => r.json())
        .then(data => setSubscription(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user, token]);

  const handleUpgrade = async (tierId: string) => {
    setCheckoutLoading(tierId);
    setError(null);

    try {
      // Fetch pricing to get the payment link
      const pricingRes = await fetch('/api/pricing');
      const tiers: Tier[] = await pricingRes.json();
      const tier = tiers.find(t => t.id === tierId);
      if (!tier?.paymentLink) throw new Error('No payment link');

      // Store intent in sessionStorage before redirecting
      if (user && token) {
        sessionStorage.setItem('swiftsite-upgrade-tier', tierId);
        sessionStorage.setItem('swiftsite-upgrade-user', user.userId);

        // Prefill user email and return URL
        const url = new URL(tier.paymentLink);
        url.searchParams.set('prefilled_email', user.email);
        window.location.href = url.toString();
      } else {
        window.location.href = tier.paymentLink;
      }
    } catch (e) {
      console.error('Upgrade error:', e);
      setError('Failed to start upgrade. Please try again.');
      setCheckoutLoading(null);
    }
  };

  const freeTier: Tier = {
    id: 'free',
    name: 'Free',
    price: 0,
    priceLabel: '$0/mo',
    maxPages: 3,
    features: ['3 pages', 'SwiftSite subdomain', 'Watermark'],
  };

  const allTiers = [freeTier, ...tiers];
  const currentTier = subscription?.tier || 'free';

  return (
    <div className="pricing-page">
      <div className="pricing-header">
        {onClose && (
          <button className="pricing-close" onClick={onClose}>✕</button>
        )}
        <h1>Choose Your Plan</h1>
        <p>Pick the perfect plan for your business. Upgrade anytime.</p>
      </div>

      <div className="pricing-grid">
        {allTiers.map((tier) => {
          const isCurrent = currentTier === tier.id;
          const isFree = tier.id === 'free';

          return (
            <div key={tier.id} className={`pricing-card ${isCurrent ? 'pricing-current' : ''} ${tier.id === 'business' ? 'pricing-featured' : ''}`}>
              {tier.id === 'business' && <div className="pricing-badge">Most Popular</div>}

              <div className="pricing-card-header">
                <span className="pricing-icon">{TIER_ICONS[tier.id] || '📄'}</span>
                <h2>{tier.name}</h2>
                <div className="pricing-price">
                  <span className="pricing-amount">{tier.priceLabel}</span>
                </div>
              </div>

              <ul className="pricing-features">
                <li className="pricing-feature">
                  <span className="pricing-feature-check">✓</span>
                  Up to {tier.maxPages} pages
                </li>
                {tier.features.map((f, i) => (
                  <li key={i} className="pricing-feature">
                    <span className="pricing-feature-check">✓</span>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </li>
                ))}
                {isFree && (
                  <>
                    <li className="pricing-feature">
                      <span className="pricing-feature-check">✓</span>
                      Basic analytics
                    </li>
                    <li className="pricing-feature pricing-feature-disabled">
                      <span className="pricing-feature-check">—</span>
                      Custom domain
                    </li>
                    <li className="pricing-feature pricing-feature-disabled">
                      <span className="pricing-feature-check">—</span>
                      E-commerce
                    </li>
                  </>
                )}
              </ul>

              <div className="pricing-card-footer">
                {isCurrent ? (
                  <button className="pricing-btn pricing-btn-current" disabled>
                    {isFree ? 'Current Plan' : 'Active'}
                  </button>
                ) : isFree ? (
                  <button className="pricing-btn pricing-btn-outline" disabled>
                    Free
                  </button>
                ) : (
                  <button
                    className="pricing-btn pricing-btn-primary"
                    onClick={() => handleUpgrade(tier.id)}
                    disabled={checkoutLoading === tier.id}
                  >
                    {checkoutLoading === tier.id ? 'Processing...' : `Upgrade to ${tier.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && <div className="pricing-error">{error}</div>}
    </div>
  );
}