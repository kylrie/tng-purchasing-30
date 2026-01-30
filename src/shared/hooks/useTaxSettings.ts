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

    useEffect(() => {
        const unsub = SettingsService.subscribeToTaxSettings((taxSettings) => {
            setSettings(taxSettings);
            setLoading(false);
        });

        return () => unsub();
    }, []);

    return { settings, loading };
}

export default useTaxSettings;
