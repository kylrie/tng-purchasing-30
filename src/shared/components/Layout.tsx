// src/shared/components/Layout.tsx
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
    ChevronDown,
    Sparkles
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
        <div className="flex h-screen bg-slate-900 overflow-hidden font-sans text-white relative">
            {/* Animated background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
                <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-2000" />
            </div>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-sm lg:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-800/80 backdrop-blur-xl border-r border-slate-700/50 shadow-2xl transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* Logo/Header */}
                <div className="flex items-center justify-between h-20 px-6 border-b border-slate-700/50 relative overflow-hidden">
                    {/* Top gradient accent */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500" />

                    {isStaging && (
                        <div className="absolute top-1 left-0 w-full bg-yellow-400 text-yellow-900 text-[10px] font-bold text-center py-0.5 z-20">
                            STAGING ENVIRONMENT
                        </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                        {/* Cart icon with gradient */}
                        <div className="relative w-10 h-10">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl blur-md opacity-60" />
                            <div className="relative bg-gradient-to-br from-purple-600 to-cyan-600 w-10 h-10 rounded-xl flex items-center justify-center">
                                <ShoppingCart className="w-6 h-6 text-white" strokeWidth={2.5} />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-bold tracking-tight leading-none bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">ProcureFlow</span>
                            <span className="text-xs font-semibold text-slate-400 tracking-wide flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                PROCUREMENT
                            </span>
                        </div>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-purple-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
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
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive ? 'bg-gradient-to-r from-purple-600/20 to-cyan-600/20 text-white font-semibold border border-purple-500/30' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white font-medium'}`}
                            >
                                <item.icon
                                    size={20}
                                    className={`transition-colors ${isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700/50 bg-slate-800/50">
                    <p className="text-[10px] text-slate-500 text-center">
                        v2.0.0 {isStaging ? '(Staging)' : '(Production)'} Build
                    </p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-transparent">
                {/* Header */}
                <header className="h-20 bg-slate-800/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-6 lg:px-10 shadow-lg z-10">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="lg:hidden p-2 -ml-2 text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors"
                    >
                        <Menu size={24} />
                    </button>

                    <div className="flex-1 px-4 lg:px-0">
                        <h1 className="text-xl font-bold text-white hidden lg:block">
                            {navItems.find(i => i.path === currentPath)?.label || 'Dashboard'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-4 lg:gap-6 text-white">
                        {/* Notification Bell */}
                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                className="p-2.5 text-slate-300 hover:text-purple-400 hover:bg-slate-700/50 rounded-full transition-all relative focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                            >
                                <Bell size={22} strokeWidth={2} />
                                {notifications.length > 0 && (
                                    <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-gradient-to-r from-purple-500 to-cyan-500 border-2 border-slate-800 rounded-full animate-pulse" />
                                )}
                            </button>

                            {isNotifOpen && (
                                <div className="absolute right-0 top-full mt-3 w-80 sm:w-96 bg-slate-800 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-700/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-700/30">
                                        <h3 className="text-sm font-bold text-white">Notifications</h3>
                                        {notifications.length > 0 && (
                                            <span className="text-xs bg-gradient-to-r from-purple-600 to-cyan-600 text-white px-2 py-0.5 rounded-full font-semibold">
                                                {notifications.length} New
                                            </span>
                                        )}
                                    </div>
                                    <div className="max-h-[350px] overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="py-8 px-4 text-center">
                                                <div className="w-12 h-12 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <Bell size={20} className="text-slate-500" />
                                                </div>
                                                <p className="text-sm text-slate-400">No new notifications</p>
                                            </div>
                                        ) : (
                                            <ul className="divide-y divide-slate-700/50">
                                                {notifications.map((item) => (
                                                    <li
                                                        key={item.id}
                                                        onClick={() => {
                                                            onNotificationClick(item);
                                                            setIsNotifOpen(false);
                                                        }}
                                                        className="p-4 hover:bg-slate-700/30 cursor-pointer transition-colors group relative"
                                                    >
                                                        <div className="flex gap-3">
                                                            <div className="mt-1 w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex-shrink-0" />
                                                            <div>
                                                                <p className="text-sm text-white font-medium leading-relaxed">{item.message}</p>
                                                                <p className="text-xs text-slate-400 mt-1 font-medium">{item.timestamp}</p>
                                                            </div>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <div className="p-3 border-t border-slate-700/50 text-center bg-slate-700/20">
                                        <button className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors">Mark all as read</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* User Menu */}
                        <div className="relative" ref={userMenuRef}>
                            <button
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="flex items-center gap-3 p-1 rounded-full hover:bg-slate-700/50 transition-colors pr-3 focus:outline-none"
                            >
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-600 border-2 border-slate-700 shadow-lg flex items-center justify-center text-white overflow-hidden">
                                    {currentUser.avatar ? (
                                        <img src={currentUser.avatar} alt="User" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-sm font-bold">{currentUser.name.charAt(0)}</span>
                                    )}
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className="text-sm font-semibold text-white leading-tight">{currentUser.name}</p>
                                    <p className="text-xs text-slate-300 font-medium capitalize">{currentUser.role.replace(/_/g, ' ').toLowerCase()}</p>
                                </div>
                                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 hidden md:block ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isUserMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-700/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-4 border-b border-slate-700/50 bg-slate-700/30 md:hidden">
                                        <p className="text-sm font-semibold text-white">{currentUser.name}</p>
                                        <p className="text-xs text-slate-300 capitalize">{currentUser.role.replace(/_/g, ' ').toLowerCase()}</p>
                                    </div>
                                    <div className="p-1.5">
                                        <button
                                            onClick={() => {
                                                navigate('/settings');
                                                setIsUserMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 rounded-lg hover:bg-slate-700/50 hover:text-white transition-colors"
                                        >
                                            <Settings size={16} />
                                            Account Settings
                                        </button>
                                        <div className="h-px bg-slate-700/50 my-1 mx-2" />
                                        {onLogout && (
                                            <button
                                                onClick={onLogout}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 rounded-lg hover:bg-red-500/10 hover:text-red-300 transition-colors"
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

                {/* Content Area */}
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
