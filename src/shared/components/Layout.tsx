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
    Database,
    FileSpreadsheet,
    ListChecks,
    Activity,
    Warehouse,
    BarChart3,
    TrendingUp,
    TrendingDown,
    CreditCard,
    Receipt,
    ChefHat
} from 'lucide-react';
import type { User } from '../../features/procurement/types';
import { usePermissions } from '../../hooks/usePermissions';
import { UserRole } from '../../shared/types/firebase.types';

interface LayoutProps {
    children: React.ReactNode;
    currentUser: User;
    onLogout?: () => void;
    pendingApprovalsCount?: number;
}

// ============================================================
// RECURSIVE NAV ITEM INTERFACE - Supports unlimited nesting
// ============================================================

interface NavItem {
    path?: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    canView: boolean;
    children?: NavItem[]; // Renamed from subItems for clarity
}

// ============================================================
// SIDEBAR ITEM COMPONENT - Recursive rendering
// ============================================================

interface SidebarItemProps {
    item: NavItem;
    level: number;
    currentPath: string;
    expandedMenus: string[];
    toggleMenu: (label: string) => void;
    isCollapsed: boolean;
    onNavigate: (path: string) => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
    item,
    level,
    currentPath,
    expandedMenus,
    toggleMenu,
    isCollapsed,
    onNavigate
}) => {
    const hasChildren = item.children && item.children.length > 0;
    const visibleChildren = hasChildren ? item.children!.filter(child => child.canView) : [];
    const hasVisibleChildren = visibleChildren.length > 0;

    // Check if this item or any of its descendants is active
    const isActiveRecursive = (navItem: NavItem): boolean => {
        if (navItem.path) {
            if (currentPath === navItem.path) return true;
            if (navItem.path !== '/' && currentPath.startsWith(navItem.path)) return true;
        }
        if (navItem.children) {
            return navItem.children.some(child => isActiveRecursive(child));
        }
        return false;
    };

    const isActive = item.path && (currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path)));
    const hasActiveChild = hasVisibleChildren && visibleChildren.some(child => isActiveRecursive(child));
    const isExpanded = expandedMenus.includes(item.label);

    // Indentation based on level
    const paddingLeft = level === 0 ? 'pl-4' : level === 1 ? 'pl-8' : level === 2 ? 'pl-12' : 'pl-16';
    const iconSize = level === 0 ? 20 : level === 1 ? 18 : 16;
    const textSize = level === 0 ? 'text-sm' : level === 1 ? 'text-sm' : 'text-xs';
    const pyClass = level === 0 ? 'py-3' : level === 1 ? 'py-2.5' : 'py-2';

    // If this is a group with children
    if (hasVisibleChildren) {
        return (
            <div>
                <button
                    onClick={() => toggleMenu(item.label)}
                    className={`w-full flex items-center ${isCollapsed && level === 0 ? 'lg:justify-center lg:px-2' : `justify-between pr-4 ${paddingLeft}`} gap-3 ${pyClass} rounded-xl transition-all duration-200 group ${hasActiveChild ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-white font-semibold border border-purple-500/50' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white font-medium'} relative`}
                    title={isCollapsed ? item.label : ''}
                >
                    <div className={`flex items-center gap-3 ${isCollapsed && level === 0 ? 'lg:justify-center' : ''}`}>
                        <item.icon
                            size={iconSize}
                            className={`transition-colors flex-shrink-0 ${hasActiveChild ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                            strokeWidth={hasActiveChild ? 2.5 : 2}
                        />
                        <span className={`${isCollapsed && level === 0 ? 'lg:hidden' : 'block'} ${textSize} whitespace-nowrap transition-all duration-300`}>
                            {item.label}
                        </span>
                    </div>
                    <ChevronDown
                        size={14}
                        className={`${isCollapsed && level === 0 ? 'lg:hidden' : 'block'} transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                </button>

                {/* Children */}
                <div
                    className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                    <div className="mt-1 space-y-1">
                        {visibleChildren.map((child) => (
                            <SidebarItem
                                key={child.path || child.label}
                                item={child}
                                level={level + 1}
                                currentPath={currentPath}
                                expandedMenus={expandedMenus}
                                toggleMenu={toggleMenu}
                                isCollapsed={isCollapsed}
                                onNavigate={onNavigate}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Leaf item (no children) - navigable
    return (
        <button
            onClick={() => item.path && onNavigate(item.path)}
            className={`w-full flex items-center ${isCollapsed && level === 0 ? 'lg:justify-center lg:px-2' : `${paddingLeft} pr-4`} gap-3 ${pyClass} rounded-xl transition-all duration-200 group ${isActive ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-white font-semibold border border-purple-500/50' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white font-medium'} relative`}
            title={isCollapsed ? item.label : ''}
        >
            <div className={`flex items-center gap-3 ${isCollapsed && level === 0 ? 'lg:justify-center' : ''}`}>
                <item.icon
                    size={iconSize}
                    className={`transition-colors flex-shrink-0 ${isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                    strokeWidth={isActive ? 2.5 : 2}
                />
                <span className={`${isCollapsed && level === 0 ? 'lg:hidden' : 'block'} ${textSize} whitespace-nowrap transition-all duration-300`}>
                    {item.label}
                </span>
            </div>
        </button>
    );
};

// ============================================================
// MAIN LAYOUT COMPONENT
// ============================================================

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

    // ============================================================
    // NAVIGATION CONFIGURATION - Supports 3 levels
    // ============================================================

    const navItems: NavItem[] = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard, canView: true },
        {
            label: 'Procurement',
            icon: Briefcase,
            canView: true,
            children: [
                { path: '/burf', label: 'BURF Management', icon: ClipboardList, canView: hasPermission('module:view:burf') },
                { path: '/prf', label: 'PRF Management', icon: ShoppingCart, canView: hasPermission('module:view:prf') },
                { path: '/prf-tracker', label: 'PRF Tracker', icon: ListChecks, canView: hasPermission('module:view:prf_tracker') }
            ]
        },
        {
            label: 'Action Center',
            icon: GitBranch,
            canView: hasPermission('module:view:approvals'),
            children: [
                { path: '/procurement-approvals', label: 'Approvals', icon: CheckSquare, canView: hasPermission('module:view:approvals') },
                { path: '/pcf-approvals', label: 'PCF Approvals', icon: Wallet, canView: hasPermission('pcf:approve') }
            ]
        },
        // ============================================================
        // FINANCE MODULE - 3 Level Hierarchy
        // ============================================================
        {
            label: 'Finance',
            icon: Wallet,
            canView: hasPermission('module:view:finance') || hasPermission('module:view:liquidation'),
            children: [
                // Overview - Generic Finance Dashboard (placeholder)
                { path: '/finance/overview', label: 'Overview', icon: LayoutDashboard, canView: hasPermission('module:view:finance') },
                // Income sub-group (Level 2 with Level 3 children)
                {
                    label: 'Income',
                    icon: TrendingUp,
                    canView: hasPermission('module:view:finance'),
                    children: [
                        { path: '/finance/income/sales', label: 'Sales', icon: Receipt, canView: hasPermission('module:view:finance') },
                        { path: '/finance/income/invoices', label: 'Invoices', icon: FileSpreadsheet, canView: hasPermission('module:view:finance') }
                    ]
                },
                // Expenses sub-group (Level 2 with Level 3 children)
                {
                    label: 'Expenses',
                    icon: TrendingDown,
                    canView: hasPermission('module:view:finance') || hasPermission('module:view:liquidation'),
                    children: [
                        // BR Flow - This is the existing FinanceView with Fund Release/Check Prep
                        { path: '/finance/expenses/br-flow', label: 'BR Flow', icon: Scale, canView: hasPermission('module:view:finance') },
                        { path: '/liquidation', label: 'Liquidations', icon: CreditCard, canView: hasPermission('module:view:liquidation') },
                        { path: '/pcf', label: 'Petty Cash Fund', icon: Wallet, canView: hasPermission('module:view:pcf') }
                    ]
                }
            ]
        },
        {
            label: 'Inventory',
            icon: Warehouse,
            canView: true,
            children: [
                { path: '/inventory', label: 'Stock Take', icon: Warehouse, canView: true },
                { path: '/inventory/reports', label: 'Reports', icon: BarChart3, canView: true },
                { path: '/menu', label: 'Menu Engineering', icon: ChefHat, canView: true }
            ]
        },
        {
            label: 'Master Data',
            icon: Database,
            canView: hasPermission('module:view:suppliers') || hasPermission('module:view:coa'),
            children: [
                { path: '/suppliers', label: 'Suppliers', icon: Users, canView: hasPermission('module:view:suppliers') },
                { path: '/chart-of-accounts', label: 'Chart of Accounts', icon: FileSpreadsheet, canView: hasPermission('module:view:coa') }
            ]
        },
        {
            label: 'Settings',
            icon: Settings,
            canView: hasPermission('module:view:settings') || currentUser.role === UserRole.SUPER_ADMIN,
            children: [
                { path: '/settings', label: 'System Settings', icon: Settings, canView: hasPermission('module:view:settings') },
                { path: '/activity-log', label: 'Activity Log', icon: Activity, canView: currentUser.role === UserRole.SUPER_ADMIN }
            ]
        }
    ];

    const currentPath = location.pathname;

    const toggleMenu = (label: string) => {
        setExpandedMenus(prev =>
            prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
        );
    };

    const handleNavigate = (path: string) => {
        navigate(path);
        setIsSidebarOpen(false);
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

                {/* Navigation - Using recursive SidebarItem */}
                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                    {navItems.filter(item => item.canView).map((item) => (
                        <SidebarItem
                            key={item.path || item.label}
                            item={item}
                            level={0}
                            currentPath={currentPath}
                            expandedMenus={expandedMenus}
                            toggleMenu={toggleMenu}
                            isCollapsed={isCollapsed}
                            onNavigate={handleNavigate}
                        />
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-700/50">
                    <div className={`bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 mb-3 ${isCollapsed ? 'lg:p-2 lg:flex lg:justify-center' : ''}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
                                {currentUser.avatar ? (
                                    <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                                ) : (
                                    currentUser.name.charAt(0)
                                )}
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
            </aside>

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
        </div>
    );
};

export default Layout;
