import React from 'react';

/**
 * Feature Flag Component
 * FIX M4 & M5: Replaces "Not Implemented" alerts with proper feature gating
 * 
 * Usage:
 * <FeatureFlag feature="notifications" fallback={<ComingSoonBadge />}>
 *   <NotificationsPanel />
 * </FeatureFlag>
 */

interface FeatureFlagProps {
    /** Feature key to check */
    feature: string;
    /** Content to render when feature is enabled */
    children: React.ReactNode;
    /** Content to render when feature is disabled (defaults to null) */
    fallback?: React.ReactNode;
    /** If true, shows "Coming Soon" badge when disabled */
    showComingSoon?: boolean;
}

/**
 * Feature flags configuration
 * Set to true to enable a feature
 */
const FEATURE_FLAGS: Record<string, boolean> = {
    // Core features - enabled
    requisitions: true,
    users: true,
    businesses: true,
    suppliers: true,
    permissions: true,

    // Features in development - disabled
    notifications: false,
    emailIntegration: false,
    advancedReports: false,
    bulkImport: false,
    apiIntegration: false,
    auditLogs: false,
};

/**
 * Check if a feature is enabled
 */
export const isFeatureEnabled = (feature: string): boolean => {
    // In development, can enable all features via env var
    if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_ALL_FEATURES === 'true') {
        return true;
    }
    return FEATURE_FLAGS[feature] ?? false;
};

/**
 * Coming Soon Badge Component
 */
export const ComingSoonBadge: React.FC<{ label?: string }> = ({ label = 'Coming Soon' }) => (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        {label}
    </span>
);

/**
 * Disabled Button with Coming Soon tooltip
 */
export const ComingSoonButton: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className = '' }) => (
    <button
        disabled
        className={`opacity-50 cursor-not-allowed relative group ${className}`}
        title="This feature is coming soon"
    >
        {children}
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 
                     text-white text-xs rounded opacity-0 group-hover:opacity-100 
                     transition-opacity whitespace-nowrap pointer-events-none">
            Coming Soon
        </span>
    </button>
);

/**
 * Main Feature Flag Component
 */
export const FeatureFlag: React.FC<FeatureFlagProps> = ({
    feature,
    children,
    fallback = null,
    showComingSoon = false,
}) => {
    if (isFeatureEnabled(feature)) {
        return <>{children}</>;
    }

    if (showComingSoon) {
        return <ComingSoonBadge />;
    }

    return <>{fallback}</>;
};

/**
 * Higher-Order Component for feature-gated components
 * 
 * @example
 * const NotificationsPanel = withFeatureFlag('notifications', () => <div>...</div>);
 */
export function withFeatureFlag<P extends object>(
    feature: string,
    Component: React.ComponentType<P>,
    FallbackComponent?: React.ComponentType<P>
): React.FC<P> {
    return (props: P) => {
        if (isFeatureEnabled(feature)) {
            return <Component {...props} />;
        }
        if (FallbackComponent) {
            return <FallbackComponent {...props} />;
        }
        return null;
    };
}

export default FeatureFlag;
