import React, { useState } from 'react';

import { usePermissionsContext } from '../../../contexts/PermissionsContext';
import PermissionsMatrix from '../components/PermissionsMatrix';
import type { User, Business } from '../../../shared/types';
import type { Permission } from '../../../config/permissions';
import { UserRole, UserStatus } from '../../procurement/types';

// Import Layout Components
import { Building2, Shield, User as UserIcon, Lock, Database, Mail, Briefcase, Check, X, Edit2, Trash2, Plus, Sliders, Search, Loader2 } from 'lucide-react';
import { AuthService } from '../../../shared/services/auth.service';

interface SettingsViewProps {
    currentUser: User;
    businesses: Business[];
    handleAddBusiness: (business: Omit<Business, 'id'>, customId?: string) => void;
    onUpdateBusiness: (id: string, updates: Partial<Business>) => Promise<void>;
    onDeleteBusiness: (id: string) => Promise<void>;
    allUsers: User[];
    setAllUsers: (user: User) => void;
    pendingUsers: User[];
    onApproveUser: (userId: string) => void;
    onRejectUser: (userId: string) => void;
    loadingUserId: string | null;
    uomOptions: string[];
    setUomOptions: (uoms: string[]) => Promise<void>;
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
    uomOptions,
    setUomOptions,
}) => {
    const { updatePermissions, updateRoles } = usePermissionsContext();

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
    const [newBiz, setNewBiz] = useState<Partial<Business>>({ name: '', tin: '', address: '', currency: 'PHP' });
    const [customBizId, setCustomBizId] = useState('');
    const [editingBizId, setEditingBizId] = useState<string | null>(null);

    // User Search
    const [searchQuery, setSearchQuery] = useState('');

    // UOM State
    const [newUOM, setNewUOM] = useState('');
    const [editingUOMIndex, setEditingUOMIndex] = useState<number | null>(null);

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
                    isApprover: newUser.isApprover || false
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
                    await AuthService.createUser(newUser.email, newUserPassword, {
                        name: newUser.name,
                        role: newUser.role,
                        businessId: newUser.businessId,
                        avatar: newUser.avatar
                    });
                    // We also need to update the local list if not using a real-time listener that updates automatically
                    // Assuming App.tsx's useUsers hook listens to Firestore, it should update automatically.
                    // But we might want to manually trigger a refresh or just rely on the listener.
                    alert("User Created Successfully");
                }
                resetUserForm();
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

    const isStaging = window.location.hostname.includes('staging') || window.location.hostname.includes('localhost');

    // Business Handlers
    const handleSaveBusiness = async () => {
        if (!newBiz.name || !newBiz.tin) return;

        if (editingBizId) {
            await onUpdateBusiness(editingBizId, newBiz);
            alert("Business Updated Successfully");
        } else {
            handleAddBusiness(newBiz as Omit<Business, 'id'>, customBizId || undefined);
            alert("Business Created Successfully");
        }
        handleCancelEditBusiness();
    };

    const handleCancelEditBusiness = () => {
        setNewBiz({ name: '', tin: '', address: '', currency: 'PHP' });
        setCustomBizId('');
        setEditingBizId(null);
    };

    const handleEditBusinessClick = (b: Business) => {
        setNewBiz(b);
        setEditingBizId(b.id);
        setCustomBizId(b.id);
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

    const handlePermissionsSave = ({ permissions, roles }: { permissions: Record<UserRole, Permission[]>, roles: UserRole[] }) => {
        updatePermissions(permissions);
        updateRoles(roles);
    };

    // UOM Handlers
    const handleAddOrUpdateUOM = async () => {
        if (!newUOM.trim()) return;

        const trimmedUOM = newUOM.trim().toLowerCase();

        if (editingUOMIndex !== null) {
            // Update existing UOM
            const updatedList = [...uomOptions];
            updatedList[editingUOMIndex] = trimmedUOM;
            await setUomOptions(updatedList);
            alert('UOM Updated Successfully');
        } else {
            // Add new UOM
            if (uomOptions.includes(trimmedUOM)) {
                alert('This UOM already exists!');
                return;
            }
            await setUomOptions([...uomOptions, trimmedUOM]);
            alert('UOM Added Successfully');
        }

        setNewUOM('');
        setEditingUOMIndex(null);
    };

    const handleEditUOM = (index: number) => {
        setNewUOM(uomOptions[index]);
        setEditingUOMIndex(index);
    };

    const handleDeleteUOM = async (index: number) => {
        if (confirm(`Are you sure you want to delete "${uomOptions[index]}"?`)) {
            try {
                await setUomOptions(uomOptions.filter((_: string, i: number) => i !== index));
                alert('UOM Deleted Successfully');
            } catch (error) {
                console.error('Error deleting UOM:', error);
                alert('Failed to delete UOM. Please try again.');
            }
        }
    };

    const handleCancelEditUOM = () => {
        setNewUOM('');
        setEditingUOMIndex(null);
    };

    const cardClass = "bg-slate-800/50 backdrop-blur-xl p-6 rounded-xl shadow-lg border border-slate-700 animate-in fade-in zoom-in-95 duration-200";
    const inputClass = "w-full p-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500";
    const labelClass = "block text-sm font-medium text-slate-300 mb-1";

    // Permission Checking Helper (Local)
    // We assume currentUser role allows access if they are here, but we can double check
    const hasPermission = (permission: string) => {
        // Implement simplified check or rely on Parent routing protection
        if (!permission) return true;
        // In a real implementation, we would check permissions here.
        // For settings view tabs, we might want to check roles.
        if (permission === 'admin:manage:businesses') return currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN;
        if (permission === 'admin:manage:users') return currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN;
        if (permission === 'admin:manage:permissions') return currentUser.role === UserRole.SUPER_ADMIN;
        if (permission === 'admin:view:user_approvals') return currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN;
        if (permission === 'inventory:manage:uom') return currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PURCHASING_OFFICER;

        return true;
    };

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
                {/* Admin Tabs */}
                {
                    (currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN) && (
                        <>
                            <button onClick={() => setActiveTab('business')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'business' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>Business Units</button>
                            <button onClick={() => setActiveTab('users')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'users' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>User Management</button>
                            <button onClick={() => setActiveTab('approvers')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'approvers' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>Approver Config</button>
                            <button onClick={() => setActiveTab('permissions')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'permissions' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>Permissions Matrix</button>
                        </>
                    )
                }
                {
                    (currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PURCHASING_OFFICER) && (
                        <button onClick={() => setActiveTab('inventory')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'inventory' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>Inventory</button>
                    )
                }
            </div >

            {/* Content Area */}
            < div className="min-h-[400px]" >
                {/* Profile, Security, Business, User Management Tabs ... (Existing code kept) */}
                {
                    activeTab === 'profile' && (
                        <div className={cardClass}>
                            <h3 className="font-bold text-lg flex items-center gap-2 text-white mb-6"><UserIcon size={20} className="text-purple-400" /> My Profile</h3>
                            <div className="flex items-start gap-6">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-3xl font-bold text-white shadow-lg border-2 border-slate-700">
                                    {currentUser.name.charAt(0)}
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
                                        <div className="flex items-center gap-2">
                                            <Building2 size={16} className="text-slate-500" />
                                            <div className="flex flex-col gap-1">
                                                {currentUser.businessUnitIds && currentUser.businessUnitIds.length > 0 ? (
                                                    currentUser.businessUnitIds.map(buId => (
                                                        <span key={buId} className="text-slate-200 font-medium">
                                                            {businesses.find(b => b.id === buId)?.name || 'Unknown Business Unit'}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-slate-200 font-medium">
                                                        {businesses.find(b => b.id === currentUser.businessId)?.name || 'N/A'}
                                                    </span>
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
                    activeTab === 'business' && hasPermission('admin:manage:businesses') && (
                        <div className={cardClass}>
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white"><Building2 size={20} className="text-purple-400" /> Business Unit Management</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <input
                                    className={inputClass}
                                    placeholder="Custom ID (Optional, e.g. b1)"
                                    value={customBizId}
                                    onChange={e => setCustomBizId(e.target.value)}
                                    disabled={!!editingBizId} // Disable when editing existing business
                                />
                                <input className={inputClass} placeholder="Business Name" value={newBiz.name} onChange={e => setNewBiz({ ...newBiz, name: e.target.value })} />
                                <input className={inputClass} placeholder="TIN" value={newBiz.tin} onChange={e => setNewBiz({ ...newBiz, tin: e.target.value })} />
                                <input className={inputClass} placeholder="Address" value={newBiz.address} onChange={e => setNewBiz({ ...newBiz, address: e.target.value })} />
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
                                            <div className="font-medium text-slate-200">{b.name}</div>
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
                    activeTab === 'users' && hasPermission('admin:manage:users') && (
                        <div className="space-y-6">
                            {/* Pending Users... */}
                            {hasPermission('admin:view:user_approvals') && pendingUsers.length > 0 && (
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
                                            <div><label className={labelClass}>Role</label><select className={inputClass} value={newUser.role || UserRole.EMPLOYEE} onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}>{Object.values(UserRole).map(role => (<option key={role} value={role}>{role.replace(/_/g, ' ')}</option>))}</select></div>
                                            <div><label className={labelClass}>Primary Business Unit</label><select className={inputClass} value={newUser.businessId || ''} onChange={e => setNewUser({ ...newUser, businessId: e.target.value })}><option value="">Select Primary BU</option>{businesses.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}</select></div>
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
                                        <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs">
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
                                                        <td className="p-3 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => handleEditUserClick(user)} className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit User"><Edit2 size={16} /></button><button className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete User (Not Implemented)"><Trash2 size={16} /></button></div></td>
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
                    activeTab === 'approvers' && hasPermission('admin:manage:users') && (
                        <div className={cardClass}>
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white"><Sliders size={20} className="text-blue-400" /> Approver Configuration</h3>
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
                    )
                }

                {
                    activeTab === 'permissions' && hasPermission('admin:manage:permissions') && (
                        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                            {/* We don't add padding here to let the matrix control its scroll area */}
                            <PermissionsMatrix onSave={handlePermissionsSave} />
                        </div>
                    )
                }

                {
                    activeTab === 'inventory' && hasPermission('inventory:manage:uom') && (
                        <div className={cardClass}>
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white">
                                <Sliders size={20} className="text-green-400" /> Inventory Settings
                            </h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Manage Units of Measurement (UOM) used throughout the procurement system.
                            </p>

                            {/* Add/Edit UOM Form */}
                            <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-700 mb-6">
                                <h4 className="text-sm font-bold text-slate-300 mb-3">
                                    {editingUOMIndex !== null ? 'Edit UOM' : 'Add New UOM'}
                                </h4>
                                <div className="flex flex-col md:flex-row gap-3">
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="e.g., dozen, liter, meter"
                                        value={newUOM}
                                        onChange={(e) => setNewUOM(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddOrUpdateUOM()}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleAddOrUpdateUOM}
                                            disabled={!newUOM.trim()}
                                            className={`flex-1 md:flex-none px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap
                                            ${editingUOMIndex !== null ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}
                                            disabled:opacity-50 disabled:cursor-not-allowed
                                        `}
                                        >
                                            {editingUOMIndex !== null ? (
                                                <><Check size={16} /> Update</>
                                            ) : (
                                                <><Plus size={16} /> Add UOM</>
                                            )}
                                        </button>
                                        {editingUOMIndex !== null && (
                                            <button
                                                onClick={handleCancelEditUOM}
                                                className="flex-1 md:flex-none bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 font-medium transition-colors flex items-center justify-center gap-2"
                                            >
                                                <X size={16} /> Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* UOM List */}
                            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                                <h4 className="text-sm font-bold text-slate-400 uppercase mb-3">
                                    Available Units ({uomOptions.length})
                                </h4>
                                {uomOptions.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        No UOMs available. Add one above.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {uomOptions.map((uom, index) => (
                                            <div
                                                key={index}
                                                className="p-3 border border-slate-700 rounded-lg bg-slate-900/30 text-sm flex justify-between items-center hover:bg-slate-800/50 transition-colors group"
                                            >
                                                <div className="font-medium text-slate-200 font-mono">{uom}</div>
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEditUOM(index)}
                                                        className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                        title="Edit UOM"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUOM(index)}
                                                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Delete UOM"
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
                    )
                }
            </div >
        </div >
    );
};
