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
    ChefHat,
    Package,
    Factory,
    ShoppingBag,
    Boxes,
    Truck,
    Monitor,
    PiggyBank,
    ShieldCheck,
    ClipboardCheck,
    Search,
    Landmark,
    Store
} from 'lucide-react';
import type { User } from '../../features/procurement/types';
import { usePermissions } from '../../hooks/usePermissions';
import { UserRole } from '../../shared/types/firebase.types';
import { ThemeToggle } from './ThemeToggle';
import NotificationBell from './NotificationBell';

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
    newTab?: boolean;
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
                    className={`w-full flex items-center ${isCollapsed && level === 0 ? 'lg:justify-center lg:px-2' : `justify-between pr-4 ${paddingLeft}`} gap-3 ${pyClass} rounded-xl transition-all duration-200 group ${hasActiveChild ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-purple-700 dark:text-white font-semibold border border-purple-200 dark:border-purple-500/50 shadow-sm dark:shadow-none' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white font-medium'} relative`}
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
    if (item.newTab && item.path) {
        return (
            <a
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full flex items-center ${isCollapsed && level === 0 ? 'lg:justify-center lg:px-2' : `${paddingLeft} pr-4`} gap-3 ${pyClass} rounded-xl transition-all duration-200 group ${isActive ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-purple-700 dark:text-white font-semibold border border-purple-200 dark:border-purple-500/50 shadow-sm dark:shadow-none' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white font-medium'} relative`}
                title={isCollapsed ? item.label : ''}
            >
                <div className={`flex items-center gap-3 ${isCollapsed && level === 0 ? 'lg:justify-center' : ''}`}>
                    <item.icon
                        size={iconSize}
                        className={`transition-colors flex-shrink-0 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'}`}
                        strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span className={`${isCollapsed && level === 0 ? 'lg:hidden' : 'block'} ${textSize} whitespace-nowrap transition-all duration-300`}>
                        {item.label}
                    </span>
                </div>
            </a>
        );
    }

    return (
        <button
            onClick={() => item.path && onNavigate(item.path)}
            className={`w-full flex items-center ${isCollapsed && level === 0 ? 'lg:justify-center lg:px-2' : `${paddingLeft} pr-4`} gap-3 ${pyClass} rounded-xl transition-all duration-200 group ${isActive ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-purple-700 dark:text-white font-semibold border border-purple-200 dark:border-purple-500/50 shadow-sm dark:shadow-none' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white font-medium'} relative`}
            title={isCollapsed ? item.label : ''}
        >
            <div className={`flex items-center gap-3 ${isCollapsed && level === 0 ? 'lg:justify-center' : ''}`}>
                <item.icon
                    size={iconSize}
                    className={`transition-colors flex-shrink-0 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'}`}
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
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent) => {
        // Optimization: Only run expensive smooth animation calculations on desktop
        if (window.innerWidth < 1024) return;

        const { clientX, clientY } = e;
        const moveX = (clientX - window.innerWidth / 2) / 30;
        const moveY = (clientY - window.innerHeight / 2) / 30;
        setMousePos({ x: moveX, y: moveY });
    };

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
                { path: '/procurement/liquidation', label: 'My Liquidation', icon: Receipt, canView: hasPermission('liquidation:file:own') },
                { path: '/prf-tracker', label: 'PRF Tracker', icon: ListChecks, canView: hasPermission('module:view:prf_tracker') }
            ]
        },
        {
            label: 'Action Center',
            icon: GitBranch,
            canView: hasPermission('module:view:approvals') || hasPermission('pcf:approve'),
            children: [
                { path: '/procurement-approvals', label: 'Approvals', icon: CheckSquare, canView: hasPermission('module:view:approvals') },
                { path: '/pcf-approvals', label: 'PCF Approvals', icon: Wallet, canView: hasPermission('pcf:approve') }
            ]
        },
        // ============================================================
        // AUDIT TEAM MODULE - For Auditors
        // ============================================================
        {
            label: 'Audit Team',
            icon: ShieldCheck,
            canView: hasPermission('pcf:audit_review') || hasPermission('liquidation:audit'),
            children: [
                // Income Audit sub-group (placeholder for future)
                {
                    label: 'Income Audit',
                    icon: Search,
                    canView: hasPermission('liquidation:audit'), // TODO: add dedicated income audit permission
                    children: [
                        // Placeholder - Coming soon
                    ]
                },
                // Expense Audit sub-group
                {
                    label: 'Expense Audit',
                    icon: ClipboardCheck,
                    canView: hasPermission('pcf:audit_review') || hasPermission('liquidation:audit'),
                    children: [
                        { path: '/pcf-audit-review', label: 'PCF Audit Review', icon: Wallet, canView: hasPermission('pcf:audit_review') },
                        { path: '/liquidation', label: 'Liquidation Audit', icon: CreditCard, canView: hasPermission('liquidation:audit') }
                    ]
                }
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
                    canView: hasPermission('module:view:finance') || hasPermission('module:view:pcf'),
                    children: [
                        // BR Flow - This is the existing FinanceView with Fund Release/Check Prep
                        { path: '/finance/expenses/br-flow', label: 'BR Flow', icon: Scale, canView: hasPermission('module:view:finance') },
                        { path: '/pcf', label: 'Petty Cash Fund', icon: Wallet, canView: hasPermission('module:view:pcf') }
                    ]
                },
                // Bank Reconciliation
                { path: '/finance/bank-recon', label: 'Bank Recon', icon: Landmark, canView: hasPermission('module:view:bank_recon') }
            ]
        },
        {
            label: 'Inventory',
            icon: Warehouse,
            canView: hasPermission('module:view:inventory'),
            children: [
                { path: '/inventory', label: 'Dashboard', icon: LayoutDashboard, canView: hasPermission('module:view:inventory') },
                {
                    label: 'Stock Management',
                    icon: Boxes,
                    canView: hasPermission('inventory:view:items'),
                    children: [
                        { path: '/inventory/items', label: 'All Items', icon: Package, canView: hasPermission('inventory:view:items') },
                        { path: '/inventory/stock-take', label: 'Stock Take', icon: Warehouse, canView: hasPermission('inventory:view:items') }
                    ]
                },
                { path: '/inventory/fixed-assets', label: 'Fixed Assets', icon: Monitor, canView: hasPermission('inventory:manage:assets') },
                { path: '/inventory/receiving', label: 'Receiving', icon: Truck, canView: hasPermission('inventory:manage:items') },
                {
                    label: 'Menu Engineering',
                    icon: ChefHat,
                    canView: hasPermission('inventory:manage:items'),
                    children: [
                        { path: '/menu/finished-goods', label: 'Finished Goods', icon: ShoppingBag, canView: hasPermission('inventory:manage:items') },
                        { path: '/menu/production-recipes', label: 'Production Recipes', icon: Factory, canView: hasPermission('inventory:manage:items') }
                    ]
                },
                {
                    label: 'Reports',
                    icon: BarChart3,
                    canView: hasPermission('inventory:view:reports'),
                    children: [
                        { path: '/inventory/variance', label: 'Variance Report', icon: BarChart3, canView: hasPermission('inventory:view:reports') }
                    ]
                }
            ]
        },
        {
            path: '/pos',
            label: 'Point of Sale',
            icon: Store,
            canView: true,
            newTab: true
        },
        {
            label: 'Master Data',
            icon: Database,
            canView: hasPermission('module:view:suppliers') || hasPermission('module:view:coa') || hasPermission('budget:manage'),
            children: [
                { path: '/suppliers', label: 'Suppliers', icon: Users, canView: hasPermission('module:view:suppliers') },
                { path: '/chart-of-accounts', label: 'Chart of Accounts', icon: FileSpreadsheet, canView: hasPermission('module:view:coa') },
                { path: '/budgets', label: 'Budget Configuration', icon: PiggyBank, canView: hasPermission('budget:manage') }
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
        <div
            className="flex h-screen bg-transparent text-slate-900 dark:text-white overflow-hidden font-sans relative"
            onMouseMove={handleMouseMove}
        >
            {/* Cinematic Background Layer - DESKTOP ONLY (Performance Optimization) */}
            <div className="hidden lg:block fixed inset-0 z-0 pointer-events-none overflow-hidden transition-opacity duration-700">
                {/* DARK MODE: Deep Background Asset */}
                <div
                    className="absolute inset-[-10%] transition-transform duration-[1.5s] ease-[cubic-bezier(0.22,1,0.36,1)] saturate-[1.5] brightness-[0.4] blur-[2px] opacity-0 dark:opacity-100"
                    style={{
                        backgroundImage: 'url("/login-bg.png")',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        transform: `translate3d(${mousePos.x * 0.2}px, ${mousePos.y * 0.2}px, 0) scale(1.1)`
                    }}
                />

                {/* LIGHT MODE: Ultra-Premium Ethereal Glass Background */}
                <div className="absolute inset-0 opacity-100 dark:opacity-0 transition-opacity duration-700">
                    {/* Base Warmth */}
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 via-white to-cyan-50/80" />

                    {/* Mesh Gradient 1: Soft Violet (Moving) */}
                    <div
                        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-200/40 rounded-full blur-[120px] animate-pulse-slow mix-blend-multiply"
                        style={{ transform: `translate3d(${mousePos.x * 0.3}px, ${mousePos.y * 0.3}px, 0)` }}
                    />

                    {/* Mesh Gradient 2: Bright Blue (Moving) */}
                    <div
                        className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-200/40 rounded-full blur-[120px] animate-pulse-slow delay-700 mix-blend-multiply"
                        style={{ transform: `translate3d(${mousePos.x * -0.2}px, ${mousePos.y * -0.2}px, 0)` }}
                    />

                    {/* Mesh Gradient 3: Fresh Cyan (Center) */}
                    <div
                        className="absolute top-[40%] left-[40%] w-[30%] h-[30%] bg-cyan-200/30 rounded-full blur-[100px] animate-pulse-slow delay-1000 mix-blend-multiply"
                        style={{ transform: `translate3d(${mousePos.x * 0.1}px, ${mousePos.y * 0.1}px, 0)` }}
                    />

                    {/* Texture: Subtle Noise Overlay (Removes bandings, adds realism) */}
                    <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
                    />

                    {/* Mouse Spotlight (Subtle highlight following cursor) */}
                    <div
                        className="absolute w-[600px] h-[600px] bg-white/40 rounded-full blur-[80px] pointer-events-none mix-blend-soft-light transition-transform duration-75"
                        style={{
                            left: '50%',
                            top: '50%',
                            transform: `translate(${mousePos.x * 30 - 300}px, ${mousePos.y * 30 - 300}px)`
                        }}
                    />
                </div>

                {/* NOTE: Previous shared blobs removed in favor of the new bespoke light/dark implementations */}

                {/* DARK MODE: Deep Blobs (Re-added here since shared block was removed) */}
                <div
                    className="absolute top-[20%] left-[30%] w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse-slow bg-purple-600/10 opacity-0 dark:opacity-100 transition-opacity duration-700"
                    style={{ transform: `translate3d(${mousePos.x * 0.5}px, ${mousePos.y * 0.5}px, 0)` }}
                ></div>
                <div
                    className="absolute bottom-[10%] right-[20%] w-[600px] h-[600px] rounded-full blur-[130px] animate-pulse-slow delay-1000 bg-cyan-600/10 opacity-0 dark:opacity-100 transition-opacity duration-700"
                    style={{ transform: `translate3d(${mousePos.x * -0.3}px, ${mousePos.y * -0.3}px, 0)` }}
                ></div>

                {/* Cinematic Vignette (Dark Mode Only) */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#020202] via-transparent to-[#020202] opacity-0 dark:opacity-80 transition-opacity duration-700"></div>
            </div>

            {/* Static Mobile Background - LIGHTWEIGHT (Performance) */}
            <div className="lg:hidden fixed inset-0 z-0 pointer-events-none bg-slate-50 dark:bg-slate-950">
                {/* Simple static gradient for mobile dark mode */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-[#1a1033] opacity-0 dark:opacity-100" />
                {/* Simple static gradient for mobile light mode */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-cyan-50 opacity-100 dark:opacity-0" />
            </div>

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 z-50 ${isCollapsed ? 'lg:w-20 w-72' : 'w-72'} 
                bg-white/80 dark:bg-slate-900/60 
                backdrop-blur-3xl dark:backdrop-blur-xl 
                border-r border-indigo-50/50 dark:border-slate-700/50 
                shadow-[0_0_40px_-10px_rgba(139,92,246,0.1)] dark:shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)]
                transform transition-all duration-500 cubic-bezier(0.22, 1, 0.36, 1) 
                lg:static lg:translate-x-0 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden lg:flex absolute -right-3 top-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-white cursor-pointer z-50 shadow-md"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                <div className={`p-6 flex items-center gap-3 border-b border-slate-200 dark:border-slate-700/50 ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}`}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/20 flex-shrink-0">
                        <ShoppingCart className="w-6 h-6 text-white" />
                    </div>
                    <div className={`${isCollapsed ? 'lg:hidden' : 'block'} overflow-hidden transition-all duration-300`}>
                        <h1 className="font-bold text-xl tracking-tight text-slate-900 dark:text-white whitespace-nowrap">TES</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">Thenextperience ERP System</p>
                    </div>
                </div>

                {/* Navigation - Using recursive SidebarItem */}
                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
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

                <div className="p-4 border-t border-slate-200 dark:border-slate-700/50">
                    <div className={`bg-slate-100 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 mb-3 ${isCollapsed ? 'lg:p-2 lg:flex lg:justify-center' : ''}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden text-white">
                                {currentUser.avatar ? (
                                    <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                                ) : (
                                    currentUser.name.charAt(0)
                                )}
                            </div>
                            <div className={`flex-1 min-w-0 ${isCollapsed ? 'lg:hidden' : 'block'}`}>
                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{currentUser.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentUser.role.replace(/_/g, ' ')}</p>
                            </div>
                        </div>
                    </div>
                    <div className={`grid ${isCollapsed ? 'lg:grid-cols-1' : 'grid-cols-2'} gap-2`}>
                        <button
                            onClick={() => {
                                navigate('/settings');
                                setIsSidebarOpen(false);
                            }}
                            className="flex items-center justify-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-300 hover:text-purple-600 dark:hover:text-white transition-colors shadow-sm dark:shadow-none"
                            title="Account Settings"
                        >
                            <Settings size={18} />
                            <span className={`${isCollapsed ? 'lg:hidden' : 'block'} text-xs font-medium`}>Settings</span>
                        </button>
                        <button
                            onClick={onLogout}
                            className="flex items-center justify-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/30 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-colors shadow-sm dark:shadow-none"
                            title="Sign Out"
                        >
                            <LogOut size={18} />
                            <span className={`${isCollapsed ? 'lg:hidden' : 'block'} text-xs font-medium`}>Logout</span>
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden relative transition-all duration-300 z-10">
                {/* Light Mode Static Gradient - Removed in favor of dynamic background layer */}

                {/* Top Header Bar with Mobile Menu & Notification Bell */}
                <div className="flex items-center justify-between p-4 lg:pr-6">
                    <div className="lg:hidden">
                        <button onClick={() => setIsSidebarOpen(true)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 dark:border-slate-700/50">
                            <Menu size={24} />
                        </button>
                    </div>
                    <div className="flex-1" />
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <NotificationBell />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
