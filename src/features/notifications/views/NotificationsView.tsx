import React, { useState } from 'react';
import { useData } from '../../../shared/context/DataContext';
import { useAuth } from '../../../contexts/useAuth';
import { NotificationsService } from '../../../shared/services/notifications.service';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    Check,
    CheckCheck,
    Trash2,
    ArrowLeft,
    Search,
    Calendar,
    ExternalLink
} from 'lucide-react';

// Reuse icon logic from Bell component
const getNotificationIcon = (type: string) => {
    switch (type) {
        case 'BURF':
            return (
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-blue-400 text-sm font-bold">B</span>
                </div>
            );
        case 'PRF':
            return (
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="text-purple-400 text-sm font-bold">P</span>
                </div>
            );
        case 'LIQUIDATION':
            return (
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-400 text-sm font-bold">L</span>
                </div>
            );
        case 'ALERT':
            return (
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <span className="text-amber-400 text-sm font-bold">!</span>
                </div>
            );
        case 'REMINDER':
            return (
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-orange-400 text-sm font-bold">⏰</span>
                </div>
            );
        case 'AUDIT':
            return (
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <span className="text-cyan-400 text-sm font-bold">A</span>
                </div>
            );
        default:
            return (
                <div className="w-10 h-10 rounded-full bg-slate-500/20 flex items-center justify-center">
                    <span className="text-slate-400 text-sm font-bold">i</span>
                </div>
            );
    }
};

const getPriorityColor = (priority?: string) => {
    switch (priority) {
        case 'URGENT': return 'border-l-red-500';
        case 'HIGH': return 'border-l-orange-500';
        case 'NORMAL': return 'border-l-blue-500';
        case 'LOW': return 'border-l-slate-500';
        default: return 'border-l-slate-600';
    }
};

const NotificationsView: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { notifications, loadingNotifications } = useData();
    const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Filter existing notifications
    const visibleNotifications = notifications
        .filter(n => {
            // Basic User Filter
            const dismissedBy = (n as any).dismissedBy || [];
            if (dismissedBy.includes(currentUser?.id)) return false;

            // Status Filter
            if (filter === 'UNREAD' && n.read) return false;
            if (filter === 'READ' && !n.read) return false;

            // Type Filter
            if (typeFilter !== 'ALL' && n.type !== typeFilter) return false;

            // Search Filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    n.message.toLowerCase().includes(query) ||
                    (n.requisitionId && n.requisitionId.toLowerCase().includes(query))
                );
            }

            return true;
        });

    const handleMarkRead = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        try {
            await NotificationsService.markAsRead(id);
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const handleMarkAllRead = async () => {
        if (!currentUser) return;
        if (!window.confirm('Mark all visible notifications as read?')) return;

        try {
            // This marks ALL for the user, not just filtered ones
            await NotificationsService.markAllAsReadForRole(currentUser.id);
            await NotificationsService.markAllAsReadForRole(currentUser.role);
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const handleDismiss = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!window.confirm('Remove this notification? This cannot be undone.')) return;
        try {
            await NotificationsService.deleteNotification(id);
        } catch (error) {
            console.error('Failed to dismiss:', error);
        }
    };

    const handleClearAll = async () => {
        if (!visibleNotifications.length) return;
        if (!window.confirm(`Delete all ${visibleNotifications.length} visible notifications? This cannot be undone.`)) return;

        try {
            // Only delete visible ones for safety
            await Promise.all(visibleNotifications.map(n => NotificationsService.deleteNotification(n.id)));
        } catch (error) {
            console.error('Failed to clear notifications:', error);
        }
    };

    const handleNavigate = (url?: string) => {
        if (url) navigate(url);
    };

    if (loadingNotifications) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-slate-400 hover:text-white mb-2 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        Back
                    </button>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Bell className="text-cyan-400" size={32} />
                        Notifications History
                    </h1>
                    <p className="text-slate-400 mt-1">
                        View and manage your alerts and updates
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleMarkAllRead}
                        disabled={!visibleNotifications.some(n => !n.read)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CheckCheck size={18} />
                        Mark all read
                    </button>
                    <button
                        onClick={handleClearAll}
                        disabled={visibleNotifications.length === 0}
                        className="px-4 py-2 bg-slate-800 hover:bg-red-900/20 text-slate-300 hover:text-red-400 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-red-500/30"
                    >
                        <Trash2 size={18} />
                        Clear visible
                    </button>
                </div>
            </div>

            {/* Filters Toolbar */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-700/50">
                        <button
                            onClick={() => setFilter('ALL')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'ALL'
                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('UNREAD')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'UNREAD'
                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            Unread
                        </button>
                        <button
                            onClick={() => setFilter('READ')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'READ'
                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            Read
                        </button>
                    </div>

                    <div className="h-8 w-px bg-slate-700 mx-2 hidden md:block"></div>

                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="bg-slate-900/50 border border-slate-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 min-w-[120px]"
                    >
                        <option value="ALL">All Types</option>
                        <option value="BURF">BURF</option>
                        <option value="PRF">PRF</option>
                        <option value="LIQUIDATION">Liquidation</option>
                        <option value="ALERT">Alerts</option>
                        <option value="REMINDER">Reminders</option>
                        <option value="AUDIT">Audit</option>
                    </select>
                </div>

                <div className="relative w-full md:w-64">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Search className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        className="bg-slate-900/50 border border-slate-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 p-2"
                        placeholder="Search notifications..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Notification List */}
            <div className="space-y-3">
                {visibleNotifications.length === 0 ? (
                    <div className="text-center py-20 bg-slate-800/20 rounded-xl border border-slate-800 border-dashed">
                        <Bell size={48} className="mx-auto text-slate-600 mb-4" />
                        <h3 className="text-lg font-medium text-slate-300">No notifications found</h3>
                        <p className="text-slate-500 mt-1">
                            {filter !== 'ALL' || typeFilter !== 'ALL' || searchQuery
                                ? 'Try adjusting your filters'
                                : "You're all caught up!"}
                        </p>
                    </div>
                ) : (
                    visibleNotifications.map((notification) => {
                        const priorityColor = getPriorityColor((notification as any).priority);
                        const actionUrl = (notification as any).actionUrl;

                        return (
                            <div
                                key={notification.id}
                                onClick={() => {
                                    if (!notification.read) handleMarkRead(notification.id);
                                    if (actionUrl) handleNavigate(actionUrl);
                                }}
                                className={`group relative flex items-start gap-4 p-4 rounded-xl border-l-4 ${priorityColor} ${notification.read
                                    ? 'bg-slate-800/40 border-slate-700/30'
                                    : 'bg-slate-800 border-slate-700 shadow-md shadow-black/20 hover:bg-slate-750'
                                    } transition-all duration-200 cursor-pointer hover:translate-x-1`}
                            >
                                <div className="flex-shrink-0 mt-1">
                                    {getNotificationIcon(notification.type)}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h4 className={`text-sm font-medium ${notification.read ? 'text-slate-300' : 'text-white'}`}>
                                                {notification.type}
                                                {(notification as any).subType && <span className="text-slate-500 mx-2">• {(notification as any).subType}</span>}
                                            </h4>
                                            <p className={`mt-1 text-base ${notification.read ? 'text-slate-400' : 'text-slate-200'}`}>
                                                {notification.message}
                                            </p>
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                            <span className="text-xs text-slate-500 flex items-center gap-1 whitespace-nowrap">
                                                <Calendar size={12} />
                                                {notification.timestamp}
                                            </span>
                                            {/* Priority Badge */}
                                            {(notification as any).priority && (notification as any).priority !== 'NORMAL' && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${(notification as any).priority === 'URGENT'
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : 'bg-orange-500/20 text-orange-400'
                                                    }`}>
                                                    {(notification as any).priority}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Metadata preview if available */}
                                    {(notification as any).metadata && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {Object.entries((notification as any).metadata).map(([key, value]) => {
                                                if (key === 'requisitionNumber' || key === 'amount') return null; // Skip redundant info
                                                return (
                                                    <span key={key} className="text-xs bg-slate-900/50 text-slate-400 px-2 py-1 rounded border border-slate-700/50">
                                                        <span className="opacity-50 mr-1 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                                        {String(value)}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Hover Actions */}
                                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 p-1 rounded-lg backdrop-blur-sm border border-slate-700/50 shadow-lg">
                                    {!notification.read && (
                                        <button
                                            onClick={(e) => handleMarkRead(notification.id, e)}
                                            className="p-1.5 rounded hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 transition-colors"
                                            title="Mark as read"
                                        >
                                            <Check size={16} />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => handleDismiss(notification.id, e)}
                                        className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    {actionUrl && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleNavigate(actionUrl);
                                            }}
                                            className="p-1.5 rounded hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 transition-colors"
                                            title="Open Link"
                                        >
                                            <ExternalLink size={16} />
                                        </button>
                                    )}
                                </div>

                                {/* Unread Indicator Dot */}
                                {!notification.read && (
                                    <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)] animate-pulse group-hover:opacity-0 transition-opacity" />
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default NotificationsView;
