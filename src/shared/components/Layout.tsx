import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Settings,
    Menu,
    X,
    ClipboardList,
    ShoppingCart,
    Bell,
    Scale,
    Users,
    LogOut,
    ChevronDown
} from 'lucide-react';
import type { User } from '../../features/auth/types';
import type { NotificationItem } from '../types';

interface LayoutProps {
    children: React.ReactNode;
    currentUser: User;
    notifications: NotificationItem[];
    onNotificationClick: (item: NotificationItem) => void;
    onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({
    children,
    currentUser,
    notifications,
    onNotificationClick,
    onLogout
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const isStaging = import.meta.env.MODE === 'staging';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setIsNotifOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const navItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/burf', label: 'BURF Requisitions', icon: ClipboardList },
        { path: '/prf', label: 'PRF Management', icon: ShoppingCart },
        { path: '/liquidation', label: 'Liquidation & Audit', icon: Scale },
        { path: '/suppliers', label: 'Suppliers', icon: Users },
    ];

    const currentPath = location.pathname;

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-slate-800">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100 shadow-xl lg:shadow-none transform transition-transform duration-300 ease-in-out
          lg:static lg:translate-x-0 flex flex-col
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
            >
                <div className="flex items-center justify-between h-20 px-6 border-b border-gray-50 relative overflow-hidden">
                    {isStaging && (
                        <div className="absolute top-0 left-0 w-full bg-yellow-400 text-yellow-900 text-[10px] font-bold text-center py-0.5 z-20">
                            STAGING ENVIRONMENT
                        </div>
                    )}
                    <div className="flex items-center gap-3 pt-2">
                        <div className="w-9 h-9 relative flex-shrink-0">
                            <svg viewBox="0 0 40 40" className="w-full h-full drop-shadow-md" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <linearGradient id="logo_gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#0EA5E9" />
                                        <stop offset="1" stopColor="#3B82F6" />
                                    </linearGradient>
                                </defs>
                                <rect width="40" height="40" rx="10" fill="url(#logo_gradient)" />
                                <path d="M12 13H15L17.5 24H28.5L30.5 15H16.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="19" cy="29" r="2.5" fill="white" />
                                <circle cx="28" cy="29" r="2.5" fill="white" />
                                <path d="M9 18H11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />
                            </svg>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-bold tracking-tight text-slate-900 leading-none">TNG</span>
                            <span className="text-xs font-semibold text-slate-500 tracking-wide">PROCUREMENT</span>
                        </div>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-brand-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
                        return (
                            <button
                                key={item.path}
                                onClick={() => {
                                    navigate(item.path);
                                    setIsSidebarOpen(false);
                                }}
                                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                  ${isActive
                                        ? 'bg-sky-50 text-sky-700 font-semibold'
                                        : 'text-slate-500 hover:bg-gray-50 hover:text-slate-900 font-medium'}
                `}
                            >
                                <item.icon
                                    size={20}
                                    className={`transition-colors ${isActive ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-600'}`}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-50 bg-white">
                    <p className="text-[10px] text-slate-400 text-center">
                        v2.0.0 {isStaging ? '(Staging)' : '(Production)'} Build
                    </p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-gray-50">
                <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-6 lg:px-10 shadow-sm z-10">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <Menu size={24} />
                    </button>

                    <div className="flex-1 px-4 lg:px-0">
                        <h1 className="text-xl font-bold text-slate-800 hidden lg:block">
                            {navItems.find(i => i.path === currentPath)?.label || 'Dashboard'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-4 lg:gap-6">
                        {/* Notification Bell */}
                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-gray-50 rounded-full transition-all relative focus:outline-none focus:ring-2 focus:ring-sky-100"
                            >
                                <Bell size={22} strokeWidth={2} />
                                {notifications.length > 0 && (
                                    <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
                                )}
                            </button>

                            {isNotifOpen && (
                                <div className="absolute right-0 top-full mt-3 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                                        <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                                        {notifications.length > 0 && (
                                            <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-semibold">
                                                {notifications.length} New
                                            </span>
                                        )}
                                    </div>
                                    <div className="max-h-[350px] overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="py-8 px-4 text-center">
                                                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <Bell size={20} className="text-slate-300" />
                                                </div>
                                                <p className="text-sm text-slate-500">No new notifications</p>
                                            </div>
                                        ) : (
                                            <ul className="divide-y divide-gray-50">
                                                {notifications.map((item) => (
                                                    <li
                                                        key={item.id}
                                                        onClick={() => {
                                                            onNotificationClick(item);
                                                            setIsNotifOpen(false);
                                                        }}
                                                        className="p-4 hover:bg-gray-50 cursor-pointer transition-colors group relative"
                                                    >
                                                        <div className="flex gap-3">
                                                            <div className="mt-1 w-2 h-2 rounded-full bg-sky-500 flex-shrink-0"></div>
                                                            <div>
                                                                <p className="text-sm text-slate-800 font-medium leading-relaxed">{item.message}</p>
                                                                <p className="text-xs text-slate-400 mt-1 font-medium">{item.timestamp}</p>
                                                            </div>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <div className="p-3 border-t border-gray-50 text-center bg-gray-50/30">
                                        <button className="text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors">Mark all as read</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="h-8 w-px bg-gray-200 hidden lg:block"></div>

                        {/* User Menu */}
                        <div className="relative" ref={userMenuRef}>
                            <button
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="flex items-center gap-3 p-1 rounded-full hover:bg-gray-50 transition-colors pr-3 focus:outline-none"
                            >
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-100 to-sky-50 border-2 border-white shadow-sm flex items-center justify-center text-sky-600 overflow-hidden">
                                    {currentUser.avatar ? (
                                        <img src={currentUser.avatar} alt="User" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-sm font-bold">{currentUser.name.charAt(0)}</span>
                                    )}
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className="text-sm font-semibold text-slate-800 leading-tight">{currentUser.name}</p>
                                    <p className="text-xs text-slate-500 font-medium capitalize">{currentUser.role.replace(/_/g, ' ').toLowerCase()}</p>
                                </div>
                                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 hidden md:block ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isUserMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-4 border-b border-gray-50 bg-gray-50/50 md:hidden">
                                        <p className="text-sm font-semibold text-slate-800">{currentUser.name}</p>
                                        <p className="text-xs text-slate-500 capitalize">{currentUser.role.replace(/_/g, ' ').toLowerCase()}</p>
                                    </div>
                                    <div className="p-1.5">
                                        <button
                                            onClick={() => {
                                                navigate('/settings');
                                                setIsUserMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-gray-50 hover:text-slate-900 transition-colors"
                                        >
                                            <Settings size={16} />
                                            Account Settings
                                        </button>
                                        <div className="h-px bg-gray-100 my-1 mx-2"></div>
                                        {onLogout && (
                                            <button
                                                onClick={onLogout}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors"
                                            >
                                                <LogOut size={16} />
                                                Sign Out
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 lg:p-10 scroll-smooth">
                    <div className="max-w-7xl mx-auto w-full">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Layout;
