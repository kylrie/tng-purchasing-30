import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface BusinessUnitContextType {
    selectedBusinessUnit: string;
    setSelectedBusinessUnit: (id: string) => void;
}

const BusinessUnitContext = createContext<BusinessUnitContextType | undefined>(undefined);

export const BusinessUnitProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('all');
    return (
        <BusinessUnitContext.Provider value={{ selectedBusinessUnit, setSelectedBusinessUnit }}>
            {children}
        </BusinessUnitContext.Provider>
    );
};

export const useBusinessUnit = () => {
    const context = useContext(BusinessUnitContext);
    if (context === undefined) {
        throw new Error('useBusinessUnit must be used within a BusinessUnitProvider');
    }
    return context;
};
