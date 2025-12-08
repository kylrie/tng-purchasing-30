import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    ClipboardList,
    ShoppingCart,
    Scale,
    Users,
    Menu,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    CheckSquare,
    ChevronDown,
    Briefcase,
    GitBranch,
    Wallet,
    Database
} from 'lucide-react';
import type { User } from '../../features/procurement/types';
import { usePermissions } from '../../hooks/usePermissions';

interface LayoutProps {
    children: React.ReactNode;
    currentUser: User;
    onLogout?: () => void;
    pendingApprovalsCount?: number;
}

interface NavItem {
    path?: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    canView: boolean;
    subItems?: NavItem[];
}

const Layout: React.FC<LayoutProps> = ({
    children,
    currentUser,
    onLogout
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { hasPermission } = usePermissions();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

    const navItems: NavItem[] = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard, canView: true },
        {
            label: 'Procurement',
            icon: Briefcase,
            canView: true,
            subItems: [
                { path: '/burf', label: 'BURF Management', icon: ClipboardList, canView: hasPermission('module:view:burf') },
                { path: '/prf', label: 'PRF Management', icon: ShoppingCart, canView: hasPermission('module:view:prf') }
            ]
        },
        {
            label: 'Action Center',
            icon: GitBranch,
            canView: hasPermission('module:view:approvals'),
            subItems: [
                { path: '/procurement-approvals', label: 'Approvals', icon: CheckSquare, canView: hasPermission('module:view:approvals') },
                { path: '/pcf-approvals', label: 'PCF Approvals', icon: Wallet, canView: hasPermission('approval:manager:prf') }
            ]
        },
        {
            label: 'Finance',
            icon: Wallet,
            canView: hasPermission('module:view:finance') || hasPermission('module:view:liquidation'),
            subItems: [
                { path: '/finance', label: 'Finance Dashboard', icon: Scale, canView: hasPermission('module:view:finance') },
                { path: '/liquidation', label: 'Liquidations', icon: Scale, canView: hasPermission('module:view:liquidation') },
                { path: '/pcf', label: 'Petty Cash Fund', icon: Wallet, canView: true }
            ]
        },
        {
            label: 'Master Data',
            icon: Database,
            canView: hasPermission('module:view:suppliers'),
            subItems: [
                { path: '/suppliers', label: 'Suppliers', icon: Users, canView: hasPermission('module:view:suppliers') }
            ]
        },
        {
            label: 'Settings',
            icon: Settings,
            canView: hasPermission('module:view:settings'),
            subItems: [
                { path: '/settings', label: 'System Settings', icon: Settings, canView: hasPermission('module:view:settings') }
            ]
        }
    ];

    const currentPath = location.pathname;

    const toggleMenu = (label: string) => {
        setExpandedMenus(prev =>
            prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
        );
    };

    const isMenuExpanded = (label: string) => expandedMenus.includes(label);

    const isParentActive = (item: NavItem) => {
        if (!item.subItems) return false;
        return item.subItems.some(sub => sub.path && (currentPath === sub.path || (sub.path !== '/' && currentPath.startsWith(sub.path))));
    };

    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden font-sans text-white relative">
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 z-50 ${isCollapsed ? 'lg:w-20 w-72' : 'w-72'} bg-slate-800/50 backdrop-blur-md border-r border-slate-700/50 shadow-2xl transform transition-all duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden lg:flex absolute -right-3 top-20 bg-slate-800 border border-slate-700 rounded-full p-1 text-slate-400 hover:text-white cursor-pointer z-50 shadow-md"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                <div className={`p-6 flex items-center gap-3 border-b border-slate-700/50 ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}`}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/20 flex-shrink-0">
                        <ShoppingCart className="w-6 h-6 text-white" />
                    </div>
                    <div className={`${isCollapsed ? 'lg:hidden' : 'block'} overflow-hidden transition-all duration-300`}>
                        <h1 className="font-bold text-xl tracking-tight text-white whitespace-nowrap">TES</h1>
                        <p className="text-xs text-slate-400 font-medium whitespace-nowrap">TNG ERP System</p>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                    {navItems.filter(item => item.canView).map((item) => {
                        // Check if this item has sub-items (parent menu)
                        if (item.subItems && item.subItems.length > 0) {
                            const visibleSubItems = item.subItems.filter(sub => sub.canView);
                            if (visibleSubItems.length === 0) return null;

                            const isExpanded = isMenuExpanded(item.label);
                            const parentIsActive = isParentActive(item);

                            return (
                                <div key={item.label}>
                                    <button
                                        onClick={() => toggleMenu(item.label)}
                                        className={`w-full flex items-center ${isCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between px-4'} gap-3 py-3 rounded-xl transition-all duration-200 group ${parentIsActive ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-white font-semibold border border-purple-500/50' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white font-medium'} relative`}
                                        title={isCollapsed ? item.label : ''}
                                    >
                                        <div className={`flex items-center gap-3 ${isCollapsed ? 'lg:justify-center' : ''}`}>
                                            <item.icon
                                                size={20}
                                                className={`transition-colors flex-shrink-0 ${parentIsActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                                                strokeWidth={parentIsActive ? 2.5 : 2}
                                            />
                                            <span className={`${isCollapsed ? 'lg:hidden' : 'block'} whitespace-nowrap transition-all duration-300`}>{item.label}</span>
                                        </div>
                                        <ChevronDown
                                            size={16}
                                            className={`${isCollapsed ? 'lg:hidden' : 'block'} transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                        />
                                    </button>

                                    {/* Sub-items */}
                                    <div
                                        className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                                    >
                                        <div className="pl-4 mt-1 space-y-1">
                                            {visibleSubItems.map((subItem) => {
                                                const isActive = subItem.path && (currentPath === subItem.path || (subItem.path !== '/' && currentPath.startsWith(subItem.path)));
                                                return (
                                                    <button
                                                        key={subItem.path}
                                                        onClick={() => {
                                                            if (subItem.path) {
                                                                navigate(subItem.path);
                                                                setIsSidebarOpen(false);
                                                            }
                                                        }}
                                                        className={`w-full flex items-center ${isCollapsed ? 'lg:justify-center lg:px-2' : 'px-4'} gap-3 py-2 rounded-lg transition-all duration-200 group ${isActive ? 'bg-purple-500/30 text-white font-semibold' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white font-medium'}`}
                                                        title={isCollapsed ? subItem.label : ''}
                                                    >
                                                        <div className={`flex items-center gap-3 ${isCollapsed ? 'lg:justify-center' : ''}`}>
                                                            <subItem.icon
                                                                size={18}
                                                                className={`transition-colors flex-shrink-0 ${isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                                                                strokeWidth={isActive ? 2.5 : 2}
                                                            />
                                                            <span className={`${isCollapsed ? 'lg:hidden' : 'block'} text-sm whitespace-nowrap transition-all duration-300`}>{subItem.label}</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // Regular menu item (no sub-items)
                        const isActive = item.path && (currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path)));
                        return (
                            <button
                                key={item.path}
                                onClick={() => {
                                    if (item.path) {
                                        navigate(item.path);
                                        setIsSidebarOpen(false);
                                    }
                                }}
                                className={`w-full flex items-center ${isCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between px-4'} gap-3 py-3 rounded-xl transition-all duration-200 group ${isActive ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-white font-semibold border border-purple-500/50' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white font-medium'} relative`}
                                title={isCollapsed ? item.label : ''}
                            >
                                <div className={`flex items-center gap-3 ${isCollapsed ? 'lg:justify-center' : ''}`}>
                                    <item.icon
                                        size={20}
                                        className={`transition-colors flex-shrink-0 ${isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                                        strokeWidth={isActive ? 2.5 : 2}
                                    />
                                    <span className={`${isCollapsed ? 'lg:hidden' : 'block'} whitespace-nowrap transition-all duration-300`}>{item.label}</span>
                                </div>
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-700/50">
                    <div className={`bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 mb-3 ${isCollapsed ? 'lg:p-2 lg:flex lg:justify-center' : ''}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                {currentUser.name.charAt(0)}
                            </div>
                            <div className={`flex-1 min-w-0 ${isCollapsed ? 'lg:hidden' : 'block'}`}>
                                <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
                                <p className="text-xs text-slate-400 truncate">{currentUser.role.replace(/_/g, ' ')}</p>
                            </div>
                        </div>
                    </div>
                    <div className={`grid ${isCollapsed ? 'lg:grid-cols-1' : 'grid-cols-2'} gap-2`}>
                        <button
                            onClick={() => {
                                navigate('/settings');
                                setIsSidebarOpen(false);
                            }}
                            className="flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-300 hover:text-white transition-colors"
                            title="Account Settings"
                        >
                            <Settings size={18} />
                            <span className={`${isCollapsed ? 'lg:hidden' : 'block'} text-xs font-medium`}>Settings</span>
                        </button>
                        <button
                            onClick={onLogout}
                            className="flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-800 hover:bg-red-900/30 border border-slate-700/50 text-slate-300 hover:text-red-400 transition-colors"
                            title="Sign Out"
                        >
                            <LogOut size={18} />
                            <span className={`${isCollapsed ? 'lg:hidden' : 'block'} text-xs font-medium`}>Logout</span>
                        </button>
                    </div>
                </div>
            </aside >

            <main className="flex-1 flex flex-col overflow-hidden relative transition-all duration-300">
                <div className="absolute top-4 left-4 z-30 lg:hidden">
                    <button onClick={() => setIsSidebarOpen(true)} className="text-slate-400 hover:text-white p-2 bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-slate-700/50">
                        <Menu size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
                    {children}
                </div>
            </main>
        </div >
    );
};

export default Layout;
