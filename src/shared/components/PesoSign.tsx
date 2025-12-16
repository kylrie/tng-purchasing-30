import React from 'react';

interface PesoSignProps {
    size?: number;
    className?: string;
}

/**
 * Philippine Peso sign icon component
 * Styled to match Lucide React icons
 */
const PesoSign: React.FC<PesoSignProps> = ({ size = 24, className = '' }) => {
    return (
        <span
            className={`inline-flex items-center justify-center font-bold ${className}`}
            style={{
                width: size,
                height: size,
                fontSize: size * 0.75,
                lineHeight: 1
            }}
        >
            ₱
        </span>
    );
};

export default PesoSign;
