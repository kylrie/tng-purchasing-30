import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, CheckCheck, ExternalLink, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../../contexts/useAuth';
import { NotificationsService } from '../services/notifications.service';
import type { NotificationItem } from '../types';

// ============================================================
// NOTIFICATION ICON MAPPING
// ============================================================

const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
        case 'BURF':
            return (
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-blue-400 text-xs font-bold">B</span>
                </div>
            );
        case 'PRF':
            return (
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="text-purple-400 text-xs font-bold">P</span>
                </div>
            );
        case 'LIQUIDATION':
            return (
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-400 text-xs font-bold">L</span>
                </div>
            );
        case 'ALERT':
            return (
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <span className="text-amber-400 text-xs font-bold">!</span>
                </div>
            );
        case 'REMINDER':
            return (
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-orange-400 text-xs font-bold">⏰</span>
                </div>
            );
        case 'AUDIT':
            return (
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <span className="text-cyan-400 text-xs font-bold">A</span>
                </div>
            );
        default:
            return (
                <div className="w-8 h-8 rounded-full bg-slate-500/20 flex items-center justify-center">
                    <span className="text-slate-400 text-xs font-bold">i</span>
                </div>
            );
    }
};

const getPriorityColor = (priority?: string) => {
    switch (priority) {
        case 'URGENT':
            return 'border-l-red-500';
        case 'HIGH':
            return 'border-l-orange-500';
        case 'NORMAL':
            return 'border-l-blue-500';
        case 'LOW':
            return 'border-l-slate-500';
        default:
            return 'border-l-slate-600';
    }
};

// ============================================================
// NOTIFICATION ITEM COMPONENT
// ============================================================

interface NotificationCardProps {
    notification: NotificationItem;
    onMarkRead: (id: string) => void;
    onNavigate: (url: string) => void;
    onDismiss: (id: string) => void;
}

const NotificationCard: React.FC<NotificationCardProps> = ({
    notification,
    onMarkRead,
    onNavigate,
    onDismiss,
}) => {
    const priorityColor = getPriorityColor((notification as any).priority);
    const actionUrl = (notification as any).actionUrl;

    return (
        <div
            className={`group relative p-3 rounded-lg border-l-4 ${priorityColor} ${notification.read
                ? 'bg-slate-800/30 border-slate-700/30'
                : 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-700/50'
                } transition-all duration-200 cursor-pointer`}
            onClick={() => {
                if (!notification.read) {
                    onMarkRead(notification.id);
                }
                if (actionUrl) {
                    onNavigate(actionUrl);
                }
            }}
        >
            <div className="flex items-start gap-3">
                {getNotificationIcon(notification.type)}
                <div className="flex-1 min-w-0">
                    <p className={`text-sm ${notification.read ? 'text-slate-400' : 'text-white'} line-clamp-2`}>
                        {notification.message}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{notification.timestamp}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.read && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onMarkRead(notification.id);
                            }}
                            className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-white"
                            title="Mark as read"
                        >
                            <Check size={14} />
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDismiss(notification.id);
                        }}
                        className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-white"
                        title="Dismiss"
                    >
                        <X size={14} />
                    </button>
                    {actionUrl && (
                        <ChevronRight size={14} className="text-slate-500" />
                    )}
                </div>
            </div>
            {!notification.read && (
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            )}
        </div>
    );
};

// ============================================================
// NOTIFICATION BELL COMPONENT
// ============================================================

const NotificationBell: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { notifications, loadingNotifications } = useData();
    const [isOpen, setIsOpen] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);

    // Filter out dismissed notifications for current user
    const visibleNotifications = notifications.filter(n => {
        const dismissedBy = (n as any).dismissedBy || [];
        return !dismissedBy.includes(currentUser?.id);
    });

    const unreadCount = visibleNotifications.filter(n => !n.read).length;

    // Close drawer when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleMarkRead = async (id: string) => {
        try {
            await NotificationsService.markAsRead(id);
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const handleMarkAllRead = async () => {
        if (!currentUser) return;
        try {
            // Mark all by user ID and role
            await NotificationsService.markAllAsReadForRole(currentUser.id);
            await NotificationsService.markAllAsReadForRole(currentUser.role);
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        }
    };

    const handleNavigate = (url: string) => {
        setIsOpen(false);
        navigate(url);
    };

    const handleDismiss = async (id: string) => {
        try {
            await NotificationsService.deleteNotification(id);
        } catch (error) {
            console.error('Failed to dismiss notification:', error);
        }
    };

    return (
        <div className="relative" ref={drawerRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 transition-all duration-200 group"
                title="Notifications"
            >
                <Bell
                    size={20}
                    className={`text-slate-400 group-hover:text-white transition-colors ${unreadCount > 0 ? 'animate-pulse' : ''}`}
                />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold flex items-center justify-center shadow-lg shadow-red-500/30">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Drawer - Flex Container */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 h-[70vh] bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50 flex flex-col origin-top-right animate-in fade-in zoom-in-95 duration-200">

                    {/* Header - Fixed Height */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-700/50 shrink-0">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Bell size={18} className="text-cyan-400" />
                            Notifications
                            {unreadCount > 0 && (
                                <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">
                                    {unreadCount} new
                                </span>
                            )}
                        </h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                            >
                                <CheckCheck size={14} />
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notification List - Scrollable Flex Item */}
                    <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2 custom-scrollbar">
                        {loadingNotifications ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : visibleNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-8">
                                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                                    <Bell size={24} className="opacity-50" />
                                </div>
                                <p className="text-sm font-medium text-slate-300">No notifications</p>
                                <p className="text-xs text-slate-500 mt-1">You're all caught up!</p>
                            </div>
                        ) : (
                            visibleNotifications.slice(0, 20).map((notification) => (
                                <NotificationCard
                                    key={notification.id}
                                    notification={notification}
                                    onMarkRead={handleMarkRead}
                                    onNavigate={handleNavigate}
                                    onDismiss={handleDismiss}
                                />
                            ))
                        )}
                    </div>

                    {/* Footer - Fixed Height */}
                    <div className="p-3 border-t border-slate-700/50 bg-slate-800/50 backdrop-blur-md shrink-0">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                navigate('/notifications');
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-sm font-medium transition-all group"
                        >
                            View full history
                            <ExternalLink size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
