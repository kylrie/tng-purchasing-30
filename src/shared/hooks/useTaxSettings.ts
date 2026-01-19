import { useState, useEffect } from 'react';
import { SettingsService } from '../services/settings.service';
import type { TaxSettings } from '../services/settings.service';

/**
 * Default tax settings used while loading from Firestore
 */
const FALLBACK_TAX_SETTINGS: TaxSettings = {
    defaultVatPercentage: 12,
    defaultEwtPercentage: 2,
    vatOptions: [0, 5, 12],
    ewtOptions: [1, 2, 5, 10, 15],
};

/**
 * React hook for accessing configurable tax settings from Firestore
 * 
 * @example
 * const { settings, loading } = useTaxSettings();
 * const [vatPct, setVatPct] = useState(settings.defaultVatPercentage);
 */
export function useTaxSettings() {
    const [settings, setSettings] = useState<TaxSettings>(FALLBACK_TAX_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const fetchSettings = async () => {
            try {
                const taxSettings = await SettingsService.getTaxSettings();
                if (mounted) {
                    setSettings(taxSettings);
                    setLoading(false);
                }
            } catch (err) {
                console.error('[useTaxSettings] Error loading tax settings:', err);
                if (mounted) {
                    setError('Failed to load tax settings');
                    setLoading(false);
                }
            }
        };

        fetchSettings();

        return () => {
            mounted = false;
        };
    }, []);

    return { settings, loading, error };
}

export default useTaxSettings;
