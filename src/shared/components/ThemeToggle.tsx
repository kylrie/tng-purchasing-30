import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={`
                relative flex items-center p-1 rounded-full w-14 h-7 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500
                ${theme === 'dark' ? 'bg-slate-700' : 'bg-sky-200'}
            `}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
            <span className="sr-only">Toggle Theme</span>

            {/* Thumb */}
            <div
                className={`
                    absolute left-1 top-1 w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center
                    ${theme === 'dark'
                        ? 'translate-x-7 bg-slate-800 text-purple-400'
                        : 'translate-x-0 bg-white text-yellow-500'
                    }
                `}
            >
                {theme === 'dark' ? <Moon size={12} fill="currentColor" /> : <Sun size={12} fill="currentColor" />}
            </div>
        </button>
    );
};
