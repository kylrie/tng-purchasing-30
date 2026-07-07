import React, { useState, useEffect } from 'react';
import { HARDCODED_UOMS } from '../../../shared/constants/uom.constants';

import { usePermissionsContext } from '../../../contexts/PermissionsContext';
import PermissionsMatrix from '../components/PermissionsMatrix';
import type { User, Business } from '../../../shared/types';
import type { Permission } from '../../../config/permissions';
import { UserRole, UserStatus, SystemRole } from '../../procurement/types';
import { useRoleOptions } from '../../../hooks/useRoleOptions';
import { usePermissions } from '../../../hooks/usePermissions';

// Import Layout Components
import { Building2, Shield, User as UserIcon, Lock, Database, Mail, Briefcase, Check, X, Edit2, Trash2, Plus, Sliders, Search, Loader2, Calendar, UserX, UserCheck } from 'lucide-react';
import { AuthService } from '../../../shared/services/auth.service';
import { SettingsService, type PCFSettings, type ApproverAssignments, type FoodCostSettings } from '../../../shared/services/settings.service';
import ExpenseSharingSettings from '../components/ExpenseSharingSettings';
import TaxSettingsPanel from '../components/TaxSettingsPanel';
import CashierSettingsPanel from '../components/CashierSettingsPanel';

interface SettingsViewProps {
    currentUser: User;
    businesses: Business[];
    handleAddBusiness: (business: Omit<Business, 'id'>) => void;
    onUpdateBusiness: (id: string, updates: Partial<Business>) => Promise<void>;
    onDeleteBusiness: (id: string) => Promise<void>;
    allUsers: User[];
    setAllUsers: (user: User) => void;
    pendingUsers: User[];
    onApproveUser: (userId: string) => void;
    onRejectUser: (userId: string) => void;
    loadingUserId: string | null;
    uomOptions: string[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({
    currentUser,
    businesses,
    handleAddBusiness,
    onUpdateBusiness,
    onDeleteBusiness,
    allUsers,
    setAllUsers: updateUser,
    pendingUsers,
    onApproveUser,
    onRejectUser,
    loadingUserId,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
    uomOptions: _uomOptions,
}) => {
    const { savePermissionsAndRoles } = usePermissionsContext();
    const { hasPermission } = usePermissions();
    const { roleOptions, isLoading: rolesLoading, defaultRole } = useRoleOptions();

    // State Definitions
    const [activeTab, setActiveTab] = useState('profile');
    const [newUser, setNewUser] = useState<Partial<User>>({
        name: '',
        email: '',
        role: UserRole.EMPLOYEE,
        businessId: businesses[0]?.id || '',
        businessUnitIds: [],
        isApprover: false,
        status: UserStatus.ACTIVE
    });
    const [newUserPassword, setNewUserPassword] = useState('');
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

    // Business State
    const [newBiz, setNewBiz] = useState<Partial<Business>>({ name: '', tin: '', address: '', currency: 'PHP', hasTableManagement: false });
    const [editingBizId, setEditingBizId] = useState<string | null>(null);

    // User Search
    const [searchQuery, setSearchQuery] = useState('');

    // UOM State – removed (UOMs are now hardcoded, no user edits allowed)

    // PCF Settings State
    const [pcfSettings, setPcfSettings] = useState<PCFSettings>({ deadlineDay: 5 });
    const [pcfDeadlineDay, setPcfDeadlineDay] = useState(5);
    const [savingPcfSettings, setSavingPcfSettings] = useState(false);

    // Workflow Approver Assignments State
    const [approverAssignments, setApproverAssignments] = useState<ApproverAssignments>({});
    const [savingApproverAssignments, setSavingApproverAssignments] = useState(false);

    // Food Cost Settings State
    const [foodCostSettings, setFoodCostSettings] = useState<FoodCostSettings>({
        excellent: 25, good: 30, warning: 35, danger: 40
    });
    const [foodCostForm, setFoodCostForm] = useState({ excellent: 25, good: 30, warning: 35, danger: 40 });
    const [savingFoodCost, setSavingFoodCost] = useState(false);

    // Storage Areas State
    const [storageAreas, setStorageAreas] = useState<string[]>([]);
    const [newStorageArea, setNewStorageArea] = useState('');
    const [editingStorageAreaIndex, setEditingStorageAreaIndex] = useState<number | null>(null);

    // Admin role check helper
    const isAdmin = currentUser.role === SystemRole.SUPER_ADMIN || currentUser.role === SystemRole.ADMIN;
    const isStaging = typeof window !== 'undefined' && (window.location.hostname.includes('staging') || window.location.hostname.includes('localhost'));

    // Load Settings (Real-time Subscriptions)
    useEffect(() => {
        if (!isAdmin) return;

        // Subscribe to PCF Settings
        const unsubPcf = SettingsService.subscribeToPcfSettings((settings) => {
            setPcfSettings(settings);
            setPcfDeadlineDay(settings.deadlineDay);
        });

        // Subscribe to Approver Assignments
        const unsubApprovers = SettingsService.subscribeToApproverAssignments(setApproverAssignments);

        // Subscribe to Food Cost Settings
        const unsubFoodCost = SettingsService.subscribeToFoodCostSettings((settings) => {
            setFoodCostSettings(settings);
            setFoodCostForm({
                excellent: settings.excellent,
                good: settings.good,
                warning: settings.warning,
                danger: settings.danger
            });
        });

        // Subscribe to Storage Areas
        const unsubStorage = SettingsService.subscribeToStorageAreas((settings) => {
            setStorageAreas(settings.areas);
        });

        return () => {
            unsubPcf();
            unsubApprovers();
            unsubFoodCost();
            unsubStorage();
        };
    }, [isAdmin]);

    // User Handlers
    const handleCreateOrUpdateUser = async () => {
        if (newUser.name && newUser.email && newUser.role && newUser.businessId) {
            setIsCreatingUser(true);
            try {
                const userToSave: User = {
                    id: editingUserId || '', // ID will be set by AuthService for new users
                    avatar: newUser.avatar || '',
                    department: newUser.department || 'General',
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                    businessId: newUser.businessId,
                    businessUnitIds: newUser.businessUnitIds || [],
                    status: newUser.status || UserStatus.ACTIVE,
                    isApprover: newUser.isApprover || false,
                    pcfCeiling: newUser.pcfCeiling || 0,
                    permissions: newUser.permissions || [], // Per-user permission overrides
                };

                if (editingUserId) {
                    updateUser(userToSave);
                    alert("User Updated Successfully");
                } else {
                    if (!newUserPassword) {
                        alert("Password is required for new users.");
                        setIsCreatingUser(false);
                        return;
                    }
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { id, ...createData } = userToSave;
                    await AuthService.createUser(newUser.email, newUserPassword, createData as any);
                    // We also need to update the local list if not using a real-time listener that updates automatically
                    // Assuming App.tsx's useUsers hook listens to Firestore, it should update automatically.
                    // But we might want to manually trigger a refresh or just rely on the listener.
                    alert("User Created Successfully");
                }
                resetUserForm();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                console.error("Error saving user:", error);
                alert(`Failed to save user: ${error.message}`);
            } finally {
                setIsCreatingUser(false);
            }
        }
    };

    const handleEditUserClick = (user: User) => {
        setNewUser(user);
        setEditingUserId(user.id);
    };

    const handleToggleUserStatus = async (user: User) => {
        const newStatus = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
        const action = newStatus === UserStatus.INACTIVE ? 'Deactivate' : 'Activate';
        if (confirm(`Are you sure you want to ${action.toLowerCase()} user "${user.name}"?`)) {
            try {
                updateUser({ ...user, status: newStatus });
                alert(`User ${newStatus === UserStatus.INACTIVE ? 'deactivated' : 'activated'} successfully.`);
            } catch (error) {
                console.error(`Error updating user status:`, error);
                alert('Failed to update user status.');
            }
        }
    };

    const resetUserForm = () => {
        setNewUser({
            name: '',
            email: '',
            role: UserRole.EMPLOYEE,
            businessId: businesses[0]?.id || '',
            businessUnitIds: [],
            isApprover: false,
            status: UserStatus.ACTIVE
        });
        setNewUserPassword('');
        setEditingUserId(null);
    };

    // Business Handlers
    const handleSaveBusiness = async () => {
        if (!newBiz.name || !newBiz.tin) return;

        if (editingBizId) {
            await onUpdateBusiness(editingBizId, newBiz);
            alert("Business Updated Successfully");
        } else {
            handleAddBusiness(newBiz as Omit<Business, 'id'>);
            alert("Business Created Successfully");
        }
        handleCancelEditBusiness();
    };

    const handleCancelEditBusiness = () => {
        setNewBiz({ name: '', tin: '', address: '', currency: 'PHP', hasTableManagement: false });
        setEditingBizId(null);
    };

    const handleEditBusinessClick = (b: Business) => {
        setNewBiz(b);
        setEditingBizId(b.id);
    };

    const handleDeleteBusiness = async (id: string) => {
        if (confirm("Are you sure you want to delete this business unit?")) {
            await onDeleteBusiness(id);
        }
    };


    const toggleApproverStatus = (user: User) => {
        updateUser({ ...user, isApprover: !user.isApprover });
    };

    const handleChangePassword = () => {
        if (passwords.new !== passwords.confirm) {
            alert("New passwords do not match.");
            return;
        }
        alert("Password change functionality not implemented in demo.");
        setPasswords({ current: '', new: '', confirm: '' });
    };

    // Helper to toggle a business ID in the multi-select array
    const toggleBusinessUnit = (bizId: string) => {
        const currentIds = newUser.businessUnitIds || [];
        if (currentIds.includes(bizId)) {
            setNewUser({ ...newUser, businessUnitIds: currentIds.filter(id => id !== bizId) });
        } else {
            setNewUser({ ...newUser, businessUnitIds: [...currentIds, bizId] });
        }
    };

    const handlePermissionsSave = async ({ permissions, roles, deletedRoles }: { permissions: Record<UserRole, Permission[]>, roles: UserRole[], deletedRoles?: string[] }): Promise<void> => {
        // Use atomic save to prevent race conditions where separate updatePermissions
        // and updateRoles calls could cause roles added by other admins to be lost.
        await savePermissionsAndRoles(permissions, roles, deletedRoles);
    };

    // Handler for saving workflow approver assignments
    const handleSaveApproverAssignments = async () => {
        setSavingApproverAssignments(true);
        try {
            await SettingsService.updateApproverAssignments(
                approverAssignments,
                currentUser.id,
                currentUser.name
            );
            alert('Workflow assignments saved successfully!');
        } catch (error) {
            console.error('Error saving approver assignments:', error);
            alert('Failed to save workflow assignments. Please try again.');
        } finally {
            setSavingApproverAssignments(false);
        }
    };

    // Helper to update single-user assignments (GM, CFO)
    const updateSingleApprover = (role: 'gm' | 'cfo', userId: string) => {
        const user = allUsers.find(u => u.id === userId);
        setApproverAssignments(prev => ({
            ...prev,
            [`${role}Uid`]: userId || undefined,
            [`${role}Name`]: user?.name || undefined,
        }));
    };

    // Helper to add a Finance Head with BU assignments
    const addFinanceHead = (userId: string, businessUnitIds: string[]) => {
        const user = allUsers.find(u => u.id === userId);
        if (!user || businessUnitIds.length === 0) return;

        setApproverAssignments(prev => ({
            ...prev,
            financeHeads: [
                ...(prev.financeHeads || []).filter(fh => fh.userId !== userId),
                { userId, userName: user.name, businessUnitIds }
            ]
        }));
    };

    // Helper to remove a Finance Head
    const removeFinanceHead = (userId: string) => {
        setApproverAssignments(prev => ({
            ...prev,
            financeHeads: (prev.financeHeads || []).filter(fh => fh.userId !== userId)
        }));
    };

    // Helper to add a BOD approver
    const addBodApprover = (userId: string) => {
        const user = allUsers.find(u => u.id === userId);
        if (!user) return;

        setApproverAssignments(prev => ({
            ...prev,
            bodApprovers: [
                ...(prev.bodApprovers || []).filter(bod => bod.userId !== userId),
                { userId, userName: user.name }
            ]
        }));
    };

    // Helper to remove a BOD approver
    const removeBodApprover = (userId: string) => {
        setApproverAssignments(prev => ({
            ...prev,
            bodApprovers: (prev.bodApprovers || []).filter(bod => bod.userId !== userId)
        }));
    };

    // State for new Finance Head form
    const [newFinanceHeadUserId, setNewFinanceHeadUserId] = React.useState('');
    const [newFinanceHeadBUs, setNewFinanceHeadBUs] = React.useState<string[]>([]);

    // State for new BOD form  
    const [newBodUserId, setNewBodUserId] = React.useState('');

    // UI Handlers for Workflow Assignments
    const handleAddFinanceHead = () => {
        if (newFinanceHeadUserId && newFinanceHeadBUs.length > 0) {
            addFinanceHead(newFinanceHeadUserId, newFinanceHeadBUs);
            setNewFinanceHeadUserId('');
            setNewFinanceHeadBUs([]);
        }
    };

    const toggleFinanceHeadBU = (bizId: string) => {
        setNewFinanceHeadBUs(prev =>
            prev.includes(bizId)
                ? prev.filter(id => id !== bizId)
                : [...prev, bizId]
        );
    };

    const handleAddBodApprover = () => {
        if (newBodUserId) {
            addBodApprover(newBodUserId);
            setNewBodUserId('');
        }
    };

    // Storage Area Handlers
    const handleAddOrUpdateStorageArea = async () => {
        if (!newStorageArea.trim()) return;

        const trimmedArea = newStorageArea.trim();

        if (editingStorageAreaIndex !== null) {
            // Update existing
            const updatedList = [...storageAreas];
            updatedList[editingStorageAreaIndex] = trimmedArea;
            await SettingsService.updateStorageAreas(updatedList, currentUser.id, currentUser.name);
            setStorageAreas(updatedList);
            alert('Storage Area Updated Successfully');
        } else {
            // Add new
            if (storageAreas.includes(trimmedArea)) {
                alert('This storage area already exists!');
                return;
            }
            const updatedList = [...storageAreas, trimmedArea];
            await SettingsService.updateStorageAreas(updatedList, currentUser.id, currentUser.name);
            setStorageAreas(updatedList);
            alert('Storage Area Added Successfully');
        }

        setNewStorageArea('');
        setEditingStorageAreaIndex(null);
    };

    const handleEditStorageArea = (index: number) => {
        setNewStorageArea(storageAreas[index]);
        setEditingStorageAreaIndex(index);
    };

    const handleDeleteStorageArea = async (index: number) => {
        if (confirm(`Are you sure you want to delete "${storageAreas[index]}"?`)) {
            try {
                const updatedList = storageAreas.filter((_: string, i: number) => i !== index);
                await SettingsService.updateStorageAreas(updatedList, currentUser.id, currentUser.name);
                setStorageAreas(updatedList);
                alert('Storage Area Deleted Successfully');
            } catch (error) {
                console.error('Error deleting storage area:', error);
                alert('Failed to delete storage area. Please try again.');
            }
        }
    };

    const handleCancelEditStorageArea = () => {
        setNewStorageArea('');
        setEditingStorageAreaIndex(null);
    };

    const cardClass = "bg-slate-800/50 backdrop-blur-xl p-6 rounded-xl shadow-lg border border-slate-700 animate-in fade-in zoom-in-95 duration-200";
    const inputClass = "w-full p-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500";
    const labelClass = "block text-sm font-medium text-slate-300 mb-1";

    return (
        <div className="space-y-6 max-w-7xl animate-in fade-in slide-in-from-bottom-4 pb-10 text-white" >
            {/* Header ... (same as before) */}
            < div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4" >
                <div>
                    <h1 className="text-2xl font-bold text-white">System Settings</h1>
                    <p className="text-slate-400 text-sm">Manage your account and system preferences.</p>
                </div>
                {isStaging && (
                    <div className="px-3 py-1 bg-yellow-900/30 text-yellow-200 rounded-full text-xs font-bold border border-yellow-500/30 flex items-center gap-1 self-start md:self-auto">
                        <Database size={12} /> STAGING DATABASE
                    </div>
                )}
            </div >

            {/* Navigation Tabs */}
            < div className="flex border-b border-slate-700 space-x-4 overflow-x-auto" >
                <button onClick={() => setActiveTab('profile')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'profile' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>My Profile</button>
                <button onClick={() => setActiveTab('security')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'security' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>Security</button>
                <button onClick={() => setActiveTab('pos')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'pos' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>POS Cashier</button>
                {/* Admin Tabs - Uses SystemRole checks (hardcoded for type safety) */}
                {isAdmin && (
                    <>
                        <button onClick={() => setActiveTab('business')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'business' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>Business Units</button>
                        <button onClick={() => setActiveTab('users')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'users' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>User Management</button>
                        <button onClick={() => setActiveTab('approvers')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'approvers' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>Approver Config</button>
                        <button onClick={() => setActiveTab('permissions')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'permissions' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>Permissions Matrix</button>
                        <button onClick={() => setActiveTab('pcf')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'pcf' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>PCF Settings</button>
                        <button onClick={() => setActiveTab('expense-sharing')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'expense-sharing' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>Expense Allocation</button>
                        <button onClick={() => setActiveTab('tax-settings')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'tax-settings' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>Tax Settings</button>
                    </>
                )}
                {/* Inventory Tab - Uses permission check (supports dynamic roles) */}
                {hasPermission('inventory:uom:edit') && (
                    <button onClick={() => setActiveTab('inventory')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'inventory' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>Inventory</button>
                )}
            </div >

            {/* Content Area */}
            < div className="min-h-[400px]" >
                {/* Profile, Security, Business, User Management Tabs ... (Existing code kept) */}
                {
                    activeTab === 'profile' && (
                        <div className={cardClass}>
                            <h3 className="font-bold text-lg flex items-center gap-2 text-white mb-6"><UserIcon size={20} className="text-purple-400" /> My Profile</h3>
                            <div className="flex items-start gap-6">
                                {/* Profile Picture - Clickable for upload */}
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-3xl font-bold text-white shadow-lg border-2 border-slate-700 overflow-hidden">
                                        {currentUser.avatar ? (
                                            <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                                        ) : (
                                            currentUser.name.charAt(0)
                                        )}
                                    </div>
                                    {/* Upload overlay */}
                                    <label
                                        htmlFor="profile-upload"
                                        className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    >
                                        <span className="text-xs text-white text-center">Change<br />Photo</span>
                                    </label>
                                    <input
                                        id="profile-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                // For now, show a message - real upload would require storage setup
                                                alert('Profile picture upload requires Firebase Storage configuration. Please contact your administrator.');
                                            }
                                        }}
                                    />
                                </div>
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Full Name</label>
                                        <div className="text-white font-medium text-lg">{currentUser.name}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Role</label>
                                        <div className="flex items-center gap-2">
                                            <Briefcase size={16} className="text-slate-500" />
                                            <span className="text-slate-200 font-medium">{currentUser.role.replace(/_/g, ' ')}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Email Address</label>
                                        <div className="flex items-center gap-2">
                                            <Mail size={16} className="text-slate-500" />
                                            <span className="text-slate-200 font-medium">{currentUser.email}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Business Unit</label>
                                        <div className="flex items-start gap-2">
                                            <Building2 size={16} className="text-slate-500 mt-0.5" />
                                            <div className="flex flex-col gap-1">
                                                {/* Primary Business Unit - Always shown with badge */}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-200 font-medium">
                                                        {businesses.find(b => b.id === currentUser.businessId)?.name || 'N/A'}
                                                    </span>
                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-purple-600/20 text-purple-300 rounded border border-purple-500/30">
                                                        Primary
                                                    </span>
                                                </div>
                                                {/* Additional Business Units - listed below */}
                                                {currentUser.businessUnitIds && currentUser.businessUnitIds.filter(id => id !== currentUser.businessId).length > 0 && (
                                                    <>
                                                        {currentUser.businessUnitIds
                                                            .filter(buId => buId !== currentUser.businessId) // Exclude primary
                                                            .map(buId => (
                                                                <span key={buId} className="text-slate-400 text-sm">
                                                                    {businesses.find(b => b.id === buId)?.name || 'Unknown'}
                                                                </span>
                                                            ))}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    activeTab === 'security' && (
                        <div className={cardClass}>
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white"><Lock size={20} className="text-purple-400" /> Security</h3>
                            <div className="max-w-md space-y-4">
                                <div>
                                    <label className={labelClass}>Current Password</label>
                                    <input
                                        type="password"
                                        className={inputClass}
                                        value={passwords.current}
                                        onChange={e => setPasswords({ ...passwords, current: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>New Password</label>
                                    <input
                                        type="password"
                                        className={inputClass}
                                        value={passwords.new}
                                        onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Confirm New Password</label>
                                    <input
                                        type="password"
                                        className={inputClass}
                                        value={passwords.confirm}
                                        onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                                    />
                                </div>
                                <button
                                    onClick={handleChangePassword}
                                    disabled={!passwords.current || !passwords.new || !passwords.confirm}
                                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                                >
                                    Update Password
                                </button>
                            </div>
                        </div>
                    )
                }

                {
                    activeTab === 'pos' && (
                        <CashierSettingsPanel
                            allUsers={allUsers}
                            onUpdateUser={updateUser}
                            businesses={businesses}
                        />
                    )
                }

                {
                    activeTab === 'business' && hasPermission('admin:business:edit') && (
                        <div className={cardClass}>
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white"><Building2 size={20} className="text-purple-400" /> Business Unit Management</h3>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                                <input className={inputClass} placeholder="Business Name" value={newBiz.name} onChange={e => setNewBiz({ ...newBiz, name: e.target.value })} />
                                <input className={inputClass} placeholder="TIN" value={newBiz.tin} onChange={e => setNewBiz({ ...newBiz, tin: e.target.value })} />
                                <input className={inputClass} placeholder="Address" value={newBiz.address} onChange={e => setNewBiz({ ...newBiz, address: e.target.value })} />
                                <div className="flex items-center gap-2 px-2">
                                    <input 
                                        type="checkbox" 
                                        id="hasTableManagement" 
                                        checked={newBiz.hasTableManagement || false} 
                                        onChange={e => setNewBiz({ ...newBiz, hasTableManagement: e.target.checked })} 
                                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
                                    />
                                    <label htmlFor="hasTableManagement" className="text-sm font-medium text-slate-300">Table Management</label>
                                </div>
                                <button
                                    onClick={handleSaveBusiness}
                                    className={`py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2
                                    ${editingBizId ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}
                                `}
                                >
                                    {editingBizId ? <><Check size={16} /> Update</> : <><Plus size={16} /> Add Business</>}
                                </button>
                                {editingBizId && (
                                    <button onClick={handleCancelEditBusiness} className="bg-slate-700 text-white py-2 rounded-lg hover:bg-slate-600 font-medium transition-colors flex items-center justify-center">
                                        <X size={16} /> Cancel
                                    </button>
                                )}
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                                {businesses.map(b => (
                                    <div key={b.id} className="p-3 border border-slate-700 rounded-lg bg-slate-900/30 text-sm flex justify-between items-center hover:bg-slate-800/50 transition-colors group">
                                        <div>
                                            <div className="font-medium text-slate-200">{b.name} {b.hasTableManagement && <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full ml-2">Tables Enabled</span>}</div>
                                            <div className="text-slate-500 font-mono text-xs">{b.tin}</div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEditBusinessClick(b)}
                                                className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                title="Edit Business"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteBusiness(b.id)}
                                                className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Delete Business"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                }

                {
                    activeTab === 'users' && hasPermission('admin:user:edit') && (
                        <div className="space-y-6">
                            {/* Pending Users... */}
                            {hasPermission('admin:user:view:pending') && pendingUsers.length > 0 && (
                                <div className={`${cardClass} border-orange-500/30`}>
                                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white">
                                        <Shield size={20} className="text-orange-400" /> Pending User Approvals
                                        <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingUsers.length}</span>
                                    </h3>
                                    {/* ... Pending users list */}
                                    <div className="space-y-4">
                                        {pendingUsers.map((user) => (
                                            <div key={user.id} className="bg-slate-900/30 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                {/* ... User details */}
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-300 border-2 border-slate-600">
                                                        {user.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-white">{user.name}</h3>
                                                        <p className="text-sm text-slate-400">{user.email}</p>
                                                        <p className="text-sm text-slate-500 mt-1">
                                                            Requested Role: <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400">{user.role}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 self-end sm:self-center">
                                                    <button onClick={() => onApproveUser(user.id)} disabled={!!loadingUserId} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"><Check className="w-4 h-4" /> {loadingUserId === user.id ? '...' : 'Approve'}</button>
                                                    <button onClick={() => onRejectUser(user.id)} disabled={!!loadingUserId} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"><X className="w-4 h-4" /> {loadingUserId === user.id ? '...' : 'Reject'}</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className={cardClass}>
                                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white"><Shield size={20} className="text-red-400" /> User & Role Management</h3>
                                <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-700 mb-6">
                                    <h4 className="text-sm font-bold text-slate-300 mb-3">{editingUserId ? 'Edit User' : 'Create New User'}</h4>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div><label className={labelClass}>Full Name</label><input type="text" className={inputClass} value={newUser.name || ''} onChange={e => setNewUser({ ...newUser, name: e.target.value })} /></div>
                                            <div><label className={labelClass}>Email Address</label><input type="email" className={inputClass} value={newUser.email || ''} onChange={e => setNewUser({ ...newUser, email: e.target.value })} /></div>
                                            <div><label className={labelClass}>Role</label><select className={inputClass} value={newUser.role || defaultRole} onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })} disabled={rolesLoading}>{rolesLoading ? (<option>Loading roles...</option>) : roleOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}{opt.isSystem ? ' (System)' : ''}</option>))}</select></div>
                                            <div><label className={labelClass}>Primary Business Unit</label><select className={inputClass} value={newUser.businessId || ''} onChange={e => setNewUser({ ...newUser, businessId: e.target.value })}><option value="">Select Primary BU</option>{businesses.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}</select></div>
                                            <div>
                                                <label className={labelClass}>PCF Ceiling (₱)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="100"
                                                    className={inputClass}
                                                    value={newUser.pcfCeiling || ''}
                                                    onChange={e => setNewUser({ ...newUser, pcfCeiling: parseFloat(e.target.value) || 0 })}
                                                    placeholder="e.g., 10000"
                                                />
                                                <p className="text-xs text-slate-500 mt-1">Petty Cash Fund limit for this user. Leave 0 or empty to disable PCF.</p>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className={labelClass}>User-Level Permissions</label>
                                                <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-3">
                                                    <label className="flex items-center gap-3 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={(newUser.permissions || []).includes('finance:pcf:view:history')}
                                                            onChange={(e) => {
                                                                const currentPerms = newUser.permissions || [];
                                                                if (e.target.checked) {
                                                                    setNewUser({ ...newUser, permissions: [...currentPerms, 'finance:pcf:view:history'] });
                                                                } else {
                                                                    setNewUser({ ...newUser, permissions: currentPerms.filter(p => p !== 'finance:pcf:view:history') });
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-600 focus:ring-purple-500"
                                                        />
                                                        <div>
                                                            <span className="text-sm text-white font-medium">View All PCF History</span>
                                                            <p className="text-xs text-slate-500">Allow this user to see all PCF liquidation history (not just their own).</p>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                            {!editingUserId && (
                                                <div className="md:col-span-2">
                                                    <label className={labelClass}>Password</label>
                                                    <input
                                                        type="password"
                                                        className={inputClass}
                                                        value={newUserPassword}
                                                        onChange={e => setNewUserPassword(e.target.value)}
                                                        placeholder="Set initial password"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Multi-select Business Units */}
                                        <div className="space-y-2">
                                            <label className={labelClass}>Accessible Business Units (Multi-select)</label>
                                            <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-2 h-32 overflow-y-auto custom-scrollbar">
                                                {businesses.map(b => {
                                                    const isSelected = (newUser.businessUnitIds || []).includes(b.id);
                                                    return (
                                                        <div
                                                            key={b.id}
                                                            onClick={() => toggleBusinessUnit(b.id)}
                                                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-purple-600/30 text-purple-200' : 'hover:bg-slate-800 text-slate-400'}`}
                                                        >
                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-500'}`}>
                                                                {isSelected && <Check size={12} className="text-white" />}
                                                            </div>
                                                            <span className="text-sm">{b.name}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-xs text-slate-500">Select additional business units this user can access.</p>
                                        </div>

                                        <div className="lg:col-span-2 flex gap-2 justify-end mt-2">
                                            <button
                                                onClick={handleCreateOrUpdateUser}
                                                disabled={!newUser.name || !newUser.email || !newUser.businessId || (!editingUserId && !newUserPassword) || isCreatingUser}
                                                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {isCreatingUser ? (
                                                    <><Loader2 size={16} className="animate-spin" /> Processing...</>
                                                ) : (
                                                    editingUserId ? <><Check size={16} /> Update User</> : <><Plus size={16} /> Create User</>
                                                )}
                                            </button>
                                            {editingUserId && (<button onClick={resetUserForm} className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2"><X size={16} /> Cancel</button>)}
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-4 relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search size={18} className="text-slate-500" />
                                    </div>
                                    <input
                                        type="text"
                                        className={`${inputClass} pl-10`}
                                        placeholder="Search users by name or email..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                <div className="overflow-x-auto border border-slate-700 rounded-lg">
                                    <table className="w-full text-left text-sm text-slate-300">
                                        <thead className="bg-slate-900/80 text-slate-400 uppercase text-xs sticky top-0 z-20 backdrop-blur-sm">
                                            <tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Business Units</th><th className="p-3 text-right">Actions</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            {allUsers.filter(user =>
                                                user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                user.email.toLowerCase().includes(searchQuery.toLowerCase())
                                            ).map(user => {
                                                const primaryBiz = businesses.find(b => b.id === user.businessId)?.name || 'N/A';
                                                const otherBizCount = (user.businessUnitIds?.length || 0);
                                                const otherBizText = otherBizCount > 0 ? ` + ${otherBizCount} others` : '';

                                                return (
                                                    <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                                                        <td className="p-3"><div className="font-medium text-white">{user.name}</div><div className="text-xs text-slate-500">{user.email}</div></td>
                                                        <td className="p-3"><span className="bg-slate-700 text-white text-xs px-2 py-1 rounded-full">{user.role.replace(/_/g, ' ')}</span></td>
                                                        <td className="p-3 text-slate-400" title={user.businessUnitIds?.map(id => businesses.find(b => b.id === id)?.name).join(', ')}>
                                                            {primaryBiz} <span className="text-xs text-slate-500">{otherBizText}</span>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button onClick={() => handleEditUserClick(user)} className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit User">
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button onClick={() => handleToggleUserStatus(user)} className={`p-1.5 rounded-lg transition-colors ${user.status === UserStatus.INACTIVE ? 'text-green-400 hover:bg-green-500/10' : 'text-orange-400 hover:bg-orange-500/10'}`} title={user.status === UserStatus.INACTIVE ? 'Reactivate User' : 'Deactivate User'}>
                                                                    {user.status === UserStatus.INACTIVE ? <UserCheck size={16} /> : <UserX size={16} />}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* New Approvers Configuration Tab */}
                {
                    activeTab === 'approvers' && hasPermission('admin:user:edit') && (
                        <div className="space-y-6">
                            {/* Workflow Role Assignments Section */}
                            <div className={cardClass}>
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-white">
                                    <Shield size={20} className="text-purple-400" /> Workflow Role Assignments
                                </h3>
                                <p className="text-slate-400 text-sm mb-6">
                                    Assign specific users to key workflow approval roles. These users will be the designated approvers for their respective stages in the 7-step PRF approval process.
                                </p>

                                <div className="space-y-6 mb-6">
                                    {/* 1. Finance Head (BU Specific) - Step 3 */}
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <label className={labelClass}>Finance Head (BU Specific)</label>
                                                <p className="text-xs text-slate-500">Approves Step 3: Budget Review</p>
                                            </div>
                                        </div>

                                        {/* Current Assignments */}
                                        <div className="space-y-2 mb-4">
                                            {approverAssignments.financeHeads?.map((fh, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-slate-700/50 p-2 rounded text-sm text-slate-300">
                                                    <div>
                                                        <span className="font-bold text-white mr-2">{fh.userName}</span>
                                                        <span className="text-xs text-slate-400">
                                                            Handles: {fh.businessUnitIds.map(bid => businesses.find(b => b.id === bid)?.name || bid).join(', ')}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => removeFinanceHead(fh.userId)}
                                                        className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-slate-600 transition-colors"
                                                        title="Remove Assignment"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                            {(!approverAssignments.financeHeads || approverAssignments.financeHeads.length === 0) && (
                                                <div className="text-xs text-slate-500 italic p-2">No Finance Heads assigned yet.</div>
                                            )}
                                        </div>

                                        {/* Add Form */}
                                        <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                                            <div className="flex flex-col gap-3">
                                                <select
                                                    className={inputClass}
                                                    value={newFinanceHeadUserId}
                                                    onChange={e => setNewFinanceHeadUserId(e.target.value)}
                                                >
                                                    <option value="">-- Select User to Assign --</option>
                                                    {allUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                                                </select>

                                                <div className="text-xs text-slate-400 font-medium px-1">Select Business Units:</div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                                                    {businesses.map(b => (
                                                        <label key={b.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={newFinanceHeadBUs.includes(b.id)}
                                                                onChange={() => toggleFinanceHeadBU(b.id)}
                                                                className="rounded border-slate-600 bg-slate-700 focus:ring-purple-500 w-3.5 h-3.5"
                                                            />
                                                            {b.name}
                                                        </label>
                                                    ))}
                                                </div>

                                                <button
                                                    onClick={handleAddFinanceHead}
                                                    disabled={!newFinanceHeadUserId || newFinanceHeadBUs.length === 0}
                                                    className="self-end bg-purple-600 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1.5 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                                                >
                                                    <Plus size={14} /> Add Assignment
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Single Approvers Row (GM & CFO) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* General Manager */}
                                        <div>
                                            <label className={labelClass}>General Manager</label>
                                            <select
                                                className={inputClass}
                                                value={approverAssignments.gmUid || ''}
                                                onChange={(e) => updateSingleApprover('gm', e.target.value)}
                                            >
                                                <option value="">-- Select General Manager --</option>
                                                {allUsers.map(user => (
                                                    <option key={user.id} value={user.id}>
                                                        {user.name} ({user.role.replace(/_/g, ' ')})
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-slate-500 mt-1">Approves Step 2 (if ≥₱50k) and Step 4: Final Budget</p>
                                        </div>

                                        {/* CFO Approver (Renamed from BOD Approver) */}
                                        <div>
                                            <label className={labelClass}>CFO Approver</label>
                                            <select
                                                className={inputClass}
                                                value={approverAssignments.cfoUid || ''}
                                                onChange={(e) => updateSingleApprover('cfo', e.target.value)}
                                            >
                                                <option value="">-- Select CFO --</option>
                                                {allUsers.map(user => (
                                                    <option key={user.id} value={user.id}>
                                                        {user.name} ({user.role.replace(/_/g, ' ')})
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-slate-500 mt-1">Approves Step 5: CFO Approval</p>
                                        </div>
                                    </div>

                                    {/* 3. BOD Approvers (Multiple) - Step 6 */}
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <label className={labelClass}>BOD Approvers (Multiple)</label>
                                                <p className="text-xs text-slate-500">Approves Step 6: Board Approval</p>
                                            </div>
                                        </div>

                                        {/* Current BOD Approvers */}
                                        <div className="space-y-2 mb-4">
                                            {approverAssignments.bodApprovers?.map((bod, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-slate-700/50 p-2 rounded text-sm text-slate-300 max-w-md">
                                                    <span className="font-bold text-white ml-1">{bod.userName}</span>
                                                    <button
                                                        onClick={() => removeBodApprover(bod.userId)}
                                                        className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-slate-600 transition-colors"
                                                        title="Remove Approver"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                            {(!approverAssignments.bodApprovers || approverAssignments.bodApprovers.length === 0) && (
                                                <div className="text-xs text-slate-500 italic p-2">No BOD Approvers assigned yet.</div>
                                            )}
                                        </div>

                                        {/* Add BOD Form */}
                                        <div className="flex gap-2 max-w-md">
                                            <select
                                                className={inputClass}
                                                value={newBodUserId}
                                                onChange={e => setNewBodUserId(e.target.value)}
                                            >
                                                <option value="">-- Select User to Add --</option>
                                                {allUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                                            </select>
                                            <button
                                                onClick={handleAddBodApprover}
                                                disabled={!newBodUserId}
                                                className="bg-purple-600 text-white px-3 py-1 rounded text-xs flex items-center gap-1 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap font-medium"
                                            >
                                                <Plus size={14} /> Add User
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        onClick={handleSaveApproverAssignments}
                                        disabled={savingApproverAssignments}
                                        className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {savingApproverAssignments ? (
                                            <><Loader2 size={16} className="animate-spin" /> Saving...</>
                                        ) : (
                                            <><Check size={16} /> Save Assignments</>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Existing Direct PRF Approvers Table */}
                            <div className={cardClass}>
                                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white"><Sliders size={20} className="text-blue-400" /> Direct PRF Approvers</h3>
                                <p className="text-slate-400 text-sm mb-6">
                                    Designate users who are authorized to approve Direct PRFs. Only users selected here will appear in the approver dropdown when creating/editing a PRF.
                                </p>

                                <div className="overflow-x-auto border border-slate-700 rounded-lg max-h-[600px] overflow-y-auto">
                                    <table className="w-full text-left text-sm text-slate-300">
                                        <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs sticky top-0 z-10 backdrop-blur-md">
                                            <tr>
                                                <th className="p-3">User</th>
                                                <th className="p-3">Role</th>
                                                <th className="p-3">Business Unit</th>
                                                <th className="p-3 text-center">Is Approver</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            {allUsers.map(user => (
                                                <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                                                    <td className="p-3">
                                                        <div className="font-medium text-white">{user.name}</div>
                                                        <div className="text-xs text-slate-500">{user.email}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="bg-slate-700 text-white text-xs px-2 py-1 rounded-full">{user.role.replace(/_/g, ' ')}</span>
                                                    </td>
                                                    <td className="p-3 text-slate-400">
                                                        {businesses.find(b => b.id === user.businessId)?.name || 'N/A'}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                                            <input
                                                                type="checkbox"
                                                                name={`toggle-${user.id}`}
                                                                id={`toggle-${user.id}`}
                                                                className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                                                checked={!!user.isApprover}
                                                                onChange={() => toggleApproverStatus(user)}
                                                                style={{
                                                                    right: user.isApprover ? '0' : 'auto',
                                                                    left: user.isApprover ? 'auto' : '0',
                                                                    borderColor: user.isApprover ? '#9333ea' : '#4b5563'
                                                                }}
                                                            />
                                                            <label
                                                                htmlFor={`toggle-${user.id}`}
                                                                className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${user.isApprover ? 'bg-purple-600' : 'bg-slate-600'}`}
                                                            ></label>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    hasPermission('admin:permission:edit') && (
                        <div className={`bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700 overflow-hidden ${activeTab === 'permissions' ? 'block animate-in fade-in zoom-in-95 duration-200' : 'hidden'}`}>
                            {/* We don't add padding here to let the matrix control its scroll area */}
                            <PermissionsMatrix onSave={handlePermissionsSave} />
                        </div>
                    )
                }

                {
                    activeTab === 'inventory' && hasPermission('inventory:uom:edit') && (
                        <div className={cardClass}>
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white">
                                <Sliders size={20} className="text-green-400" /> Inventory Settings
                            </h3>

                            {/* UOM – read-only, system-managed */}
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Units of Measurement</h4>
                                    <span className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                        <Lock size={10} /> System-Managed
                                    </span>
                                </div>
                                <p className="text-slate-400 text-sm mb-4">
                                    These units are built into the system and cannot be changed. They are used across procurement, inventory, recipes, and costing.
                                </p>

                                {(['Count', 'Packaging', 'Weight', 'Volume'] as const).map(category => {
                                    const group = HARDCODED_UOMS.filter(u => u.category === category);
                                    return (
                                        <div key={category} className="mb-4">
                                            <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">{category}</h5>
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                                {group.map(uom => (
                                                    <div
                                                        key={uom.code}
                                                        className="p-3 border border-slate-700 rounded-lg bg-slate-900/30 flex items-center gap-3"
                                                    >
                                                        <span className="font-mono font-bold text-green-400 text-sm min-w-[3rem]">{uom.code}</span>
                                                        <span className="text-slate-300 text-sm">{uom.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Divider */}
                            <div className="border-t border-slate-700 my-8"></div>

                            {/* Food Cost Thresholds Section */}
                            <div>
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-white">
                                    <Database size={20} className="text-amber-400" /> Food Cost Thresholds
                                </h3>
                                <p className="text-slate-400 text-sm mb-6">
                                    Configure food cost percentage thresholds for Menu Engineering. These values determine the color-coded profit badges on menu items.
                                </p>

                                <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-700 mb-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                        {/* Excellent Threshold */}
                                        <div>
                                            <label className="block text-xs font-semibold text-emerald-400 uppercase mb-1">
                                                🟢 Excellent (Max %)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="1"
                                                className={inputClass}
                                                value={foodCostForm.excellent}
                                                onChange={(e) => setFoodCostForm({ ...foodCostForm, excellent: parseInt(e.target.value) || 0 })}
                                            />
                                            <p className="text-xs text-slate-500 mt-1">≤ {foodCostForm.excellent}% food cost</p>
                                        </div>

                                        {/* Good Threshold */}
                                        <div>
                                            <label className="block text-xs font-semibold text-green-400 uppercase mb-1">
                                                🟢 Good (Max %)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="1"
                                                className={inputClass}
                                                value={foodCostForm.good}
                                                onChange={(e) => setFoodCostForm({ ...foodCostForm, good: parseInt(e.target.value) || 0 })}
                                            />
                                            <p className="text-xs text-slate-500 mt-1">≤ {foodCostForm.good}% food cost</p>
                                        </div>

                                        {/* Warning Threshold */}
                                        <div>
                                            <label className="block text-xs font-semibold text-amber-400 uppercase mb-1">
                                                🟡 Warning (Max %)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="1"
                                                className={inputClass}
                                                value={foodCostForm.warning}
                                                onChange={(e) => setFoodCostForm({ ...foodCostForm, warning: parseInt(e.target.value) || 0 })}
                                            />
                                            <p className="text-xs text-slate-500 mt-1">≤ {foodCostForm.warning}% food cost</p>
                                        </div>

                                        {/* Danger Threshold */}
                                        <div>
                                            <label className="block text-xs font-semibold text-red-400 uppercase mb-1">
                                                🔴 Danger (Above %)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="1"
                                                className={inputClass}
                                                value={foodCostForm.danger}
                                                onChange={(e) => setFoodCostForm({ ...foodCostForm, danger: parseInt(e.target.value) || 0 })}
                                            />
                                            <p className="text-xs text-slate-500 mt-1">&gt; {foodCostForm.warning}% food cost</p>
                                        </div>
                                    </div>

                                    {/* Save Button */}
                                    <div className="flex items-center gap-4 mt-4">
                                        <button
                                            onClick={async () => {
                                                setSavingFoodCost(true);
                                                try {
                                                    await SettingsService.updateFoodCostSettings(
                                                        foodCostForm,
                                                        currentUser.id,
                                                        currentUser.name
                                                    );
                                                    setFoodCostSettings({ ...foodCostSettings, ...foodCostForm });
                                                    alert('Food cost thresholds saved successfully!');
                                                } catch (error) {
                                                    console.error('Error saving food cost settings:', error);
                                                    alert('Failed to save settings. Please try again.');
                                                } finally {
                                                    setSavingFoodCost(false);
                                                }
                                            }}
                                            disabled={savingFoodCost || (
                                                foodCostForm.excellent === foodCostSettings.excellent &&
                                                foodCostForm.good === foodCostSettings.good &&
                                                foodCostForm.warning === foodCostSettings.warning &&
                                                foodCostForm.danger === foodCostSettings.danger
                                            )}
                                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                                        >
                                            {savingFoodCost ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Check size={16} />
                                                    Save Changes
                                                </>
                                            )}
                                        </button>
                                        {(foodCostForm.excellent !== foodCostSettings.excellent ||
                                            foodCostForm.good !== foodCostSettings.good ||
                                            foodCostForm.warning !== foodCostSettings.warning ||
                                            foodCostForm.danger !== foodCostSettings.danger) && (
                                                <span className="text-yellow-400 text-xs">Unsaved changes</span>
                                            )}
                                    </div>
                                </div>

                                {/* Info Box */}
                                <div className="p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                                    <h4 className="text-sm font-semibold text-blue-300 mb-2">How it works</h4>
                                    <ul className="text-xs text-blue-200/70 space-y-1">
                                        <li>• <strong>Excellent</strong>: Food cost ≤ {foodCostForm.excellent}% → Bright green badge</li>
                                        <li>• <strong>Good</strong>: Food cost {foodCostForm.excellent + 1}-{foodCostForm.good}% → Green badge</li>
                                        <li>• <strong>Warning</strong>: Food cost {foodCostForm.good + 1}-{foodCostForm.warning}% → Amber badge</li>
                                        <li>• <strong>Danger</strong>: Food cost &gt; {foodCostForm.warning}% → Red badge (needs attention)</li>
                                    </ul>
                                </div>

                                {/* Last Updated Info */}
                                {foodCostSettings.lastUpdated && (
                                    <div className="text-xs text-slate-500 mt-4">
                                        Last updated: {new Date(foodCostSettings.lastUpdated).toLocaleString()}
                                        {foodCostSettings.updatedByName && ` by ${foodCostSettings.updatedByName}`}
                                    </div>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="border-t border-slate-700 my-8"></div>

                            {/* Storage Areas Section */}
                            <div>
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-white">
                                    <Database size={20} className="text-teal-400" /> Storage Areas
                                </h3>
                                <p className="text-slate-400 text-sm mb-6">
                                    Manage storage locations used for inventory stock takes.
                                </p>

                                {/* Add/Edit Storage Area Form */}
                                <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-700 mb-6">
                                    <h4 className="text-sm font-bold text-slate-300 mb-3">
                                        {editingStorageAreaIndex !== null ? 'Edit Storage Area' : 'Add New Storage Area'}
                                    </h4>
                                    <div className="flex flex-col md:flex-row gap-3">
                                        <input
                                            type="text"
                                            className={inputClass}
                                            placeholder="e.g., Walk-in Freezer, Prep Station"
                                            value={newStorageArea}
                                            onChange={(e) => setNewStorageArea(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddOrUpdateStorageArea()}
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleAddOrUpdateStorageArea}
                                                disabled={!newStorageArea.trim()}
                                                className={`flex-1 md:flex-none px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap
                                                ${editingStorageAreaIndex !== null ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white'}
                                                disabled:opacity-50 disabled:cursor-not-allowed
                                            `}
                                            >
                                                {editingStorageAreaIndex !== null ? (
                                                    <><Check size={16} /> Update</>
                                                ) : (
                                                    <><Plus size={16} /> Add Area</>
                                                )}
                                            </button>
                                            {editingStorageAreaIndex !== null && (
                                                <button
                                                    onClick={handleCancelEditStorageArea}
                                                    className="flex-1 md:flex-none bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 font-medium transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <X size={16} /> Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Storage Areas List */}
                                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                                    <h4 className="text-sm font-bold text-slate-400 uppercase mb-3">
                                        Available Storage Areas ({storageAreas.length})
                                    </h4>
                                    {storageAreas.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500">
                                            No storage areas available. Add one above.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {storageAreas.map((area, index) => (
                                                <div
                                                    key={index}
                                                    className="p-3 border border-slate-700 rounded-lg bg-slate-900/30 text-sm flex justify-between items-center hover:bg-slate-800/50 transition-colors group"
                                                >
                                                    <div className="font-medium text-slate-200">{area}</div>
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleEditStorageArea(index)}
                                                            className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                            title="Edit Storage Area"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteStorageArea(index)}
                                                            className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            title="Delete Storage Area"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* PCF Settings Tab */}
                {
                    activeTab === 'pcf' && isAdmin && (
                        <div className={cardClass}>
                            <h3 className="font-bold text-lg flex items-center gap-2 text-white mb-6">
                                <Calendar size={20} className="text-purple-400" />
                                PCF Liquidation Settings
                            </h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Configure the monthly deadline for PCF liquidation submissions. Submissions after this day will be marked as "Late".
                            </p>

                            <div className="max-w-md space-y-6">
                                {/* Deadline Day Selector */}
                                <div>
                                    <label className={labelClass}>Liquidation Deadline (Day of Month)</label>
                                    <div className="flex items-center gap-4">
                                        <select
                                            value={pcfDeadlineDay}
                                            onChange={(e) => setPcfDeadlineDay(parseInt(e.target.value))}
                                            className={inputClass + " max-w-[120px]"}
                                        >
                                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                                <option key={day} value={day}>
                                                    Day {day}
                                                </option>
                                            ))}
                                        </select>
                                        <span className="text-slate-400 text-sm">of every month</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Current setting: Day <strong className="text-purple-400">{pcfSettings.deadlineDay}</strong>
                                    </p>
                                </div>

                                {/* Save Button */}
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={async () => {
                                            setSavingPcfSettings(true);
                                            try {
                                                await SettingsService.updatePcfSettings(
                                                    { deadlineDay: pcfDeadlineDay },
                                                    currentUser.id,
                                                    currentUser.name
                                                );
                                                setPcfSettings({ ...pcfSettings, deadlineDay: pcfDeadlineDay });
                                                alert('PCF settings saved successfully!');
                                            } catch (error) {
                                                console.error('Error saving PCF settings:', error);
                                                alert('Failed to save settings. Please try again.');
                                            } finally {
                                                setSavingPcfSettings(false);
                                            }
                                        }}
                                        disabled={savingPcfSettings || pcfDeadlineDay === pcfSettings.deadlineDay}
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                                    >
                                        {savingPcfSettings ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Check size={16} />
                                                Save Changes
                                            </>
                                        )}
                                    </button>
                                    {pcfDeadlineDay !== pcfSettings.deadlineDay && (
                                        <span className="text-yellow-400 text-xs">Unsaved changes</span>
                                    )}
                                </div>

                                {/* Info Box */}
                                <div className="p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg mt-6">
                                    <h4 className="text-sm font-semibold text-blue-300 mb-2">How it works</h4>
                                    <ul className="text-xs text-blue-200/70 space-y-1">
                                        <li>• Liquidations submitted <strong>on or before</strong> Day {pcfDeadlineDay} are on time.</li>
                                        <li>• Liquidations submitted <strong>after</strong> Day {pcfDeadlineDay} are marked as <span className="text-red-400 font-semibold">LATE</span>.</li>
                                        <li>• Late submissions show how many days past the deadline they were filed.</li>
                                        <li>• This setting applies to all PCF Custodians.</li>
                                    </ul>
                                </div>

                                {/* Last Updated Info */}
                                {pcfSettings.lastUpdated && (
                                    <div className="text-xs text-slate-500 mt-4">
                                        Last updated: {new Date(pcfSettings.lastUpdated).toLocaleString()}
                                        {pcfSettings.updatedByName && ` by ${pcfSettings.updatedByName}`}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }

                {/* Expense Sharing Tab */}
                {
                    activeTab === 'expense-sharing' && isAdmin && (
                        <div className={cardClass}>
                            <ExpenseSharingSettings />
                        </div>
                    )
                }

                {/* Tax Settings Tab */}
                {
                    activeTab === 'tax-settings' && isAdmin && (
                        <div className={cardClass}>
                            <TaxSettingsPanel
                                currentUserId={currentUser.id}
                                currentUserName={currentUser.name}
                            />
                        </div>
                    )
                }

            </div >
        </div >
    );
};
