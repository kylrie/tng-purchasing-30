import React, { useState } from 'react';
import { Building2, Shield, User as UserIcon, Lock, Save, Edit2, X, Database } from 'lucide-react';
import type { Business } from '../../../shared/types';
import type { User } from '../../auth/types';
import { UserRole } from '../../auth/types';

interface SettingsViewProps {
    currentUser: User;
    businesses: Business[];
    handleAddBusiness: (name: string, currency: string, address: string, tin: string) => void;
    allUsers: User[];
    setAllUsers: React.Dispatch<React.SetStateAction<User[]>>;
    onSaveUser?: (user: User) => void;
}

const ROLE_PERMISSION_MAP: Record<UserRole, number> = {
    [UserRole.SUPER_ADMIN]: 1,
    [UserRole.ADMIN]: 2,
    [UserRole.FINANCE]: 3,
    [UserRole.PURCHASING_OFFICER]: 4,
    [UserRole.CIC]: 5,
    [UserRole.MANAGER]: 6,
    [UserRole.EMPLOYEE]: 7,
    [UserRole.AUDITOR]: 8 // Added AUDITOR as it is in UserRole enum
};

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, businesses, handleAddBusiness, allUsers, setAllUsers, onSaveUser }) => {
    const [newBiz, setNewBiz] = useState({ name: '', tin: '', address: '' });

    // User Management State
    const [newUser, setNewUser] = useState<Partial<User>>({
        name: '',
        email: '',
        role: UserRole.EMPLOYEE,
        businessId: businesses[0]?.id || '',
        permissionLevel: ROLE_PERMISSION_MAP[UserRole.EMPLOYEE]
    });
    const [editingUserId, setEditingUserId] = useState<string | null>(null);

    // Update permission level when role changes
    const handleRoleChange = (role: UserRole) => {
        setNewUser(prev => ({
            ...prev,
            role: role,
            permissionLevel: ROLE_PERMISSION_MAP[role]
        }));
    };

    // Password state
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });

    // Profile Edit State
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editProfileData, setEditProfileData] = useState({
        name: currentUser.name,
        email: currentUser.email,
        department: currentUser.department || ''
    });

    const isStaging = import.meta.env.MODE === 'staging';

    const handleCreateOrUpdateUser = () => {
        if (newUser.name && newUser.email && newUser.role && newUser.businessId) {
            const userToSave: User = {
                id: editingUserId || `u${Date.now()}`,
                avatar: newUser.avatar || '',
                department: newUser.department || 'General',
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                businessId: newUser.businessId,
                permissionLevel: newUser.permissionLevel || ROLE_PERMISSION_MAP[newUser.role!]
            };

            if (onSaveUser) {
                onSaveUser(userToSave);
            } else {
                // Fallback for local update if no handler provided
                setAllUsers(prev => {
                    if (editingUserId) return prev.map(u => u.id === editingUserId ? userToSave : u);
                    return [...prev, userToSave];
                });
            }

            alert(editingUserId ? "User Updated" : "User Created");
            resetUserForm();
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
            permissionLevel: ROLE_PERMISSION_MAP[UserRole.EMPLOYEE]
        });
        setEditingUserId(null);
    };

    const handleChangePassword = () => {
        if (passwordData.new !== passwordData.confirm) {
            alert("New passwords do not match!");
            return;
        }
        if (!passwordData.current || !passwordData.new) {
            alert("Please fill in all fields");
            return;
        }
        // Simulator logic
        alert("Password updated successfully!");
        setPasswordData({ current: '', new: '', confirm: '' });
    };

    const handleSaveProfile = () => {
        const updatedUser = {
            ...currentUser,
            name: editProfileData.name,
            email: editProfileData.email,
            department: editProfileData.department
        };

        // If we have onSaveUser, use it to persist profile changes too
        if (onSaveUser) {
            onSaveUser(updatedUser);
        } else {
            setAllUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
        }

        alert("Profile updated!");
        setIsEditingProfile(false);
    };

    const toggleEditMode = () => {
        if (isEditingProfile) {
            // Cancel
            setEditProfileData({
                name: currentUser.name,
                email: currentUser.email,
                department: currentUser.department || ''
            });
        }
        setIsEditingProfile(!isEditingProfile);
    };

    return (
        <div className="space-y-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
                {isStaging && (
                    <div className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold border border-yellow-200 flex items-center gap-1">
                        <Database size={12} /> STAGING DATABASE
                    </div>
                )}
            </div>

            {/* My Profile Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><UserIcon size={20} /> My Profile</h3>
                    <button
                        onClick={toggleEditMode}
                        className={`text-sm px-3 py-1 rounded-lg border flex items-center gap-2 transition-colors ${isEditingProfile ? 'bg-slate-100 text-slate-600 border-slate-300' : 'bg-white text-brand-600 border-brand-200 hover:bg-brand-50'}`}
                    >
                        {isEditingProfile ? <><X size={14} /> Cancel</> : <><Edit2 size={14} /> Edit Profile</>}
                    </button>
                </div>

                <div className="flex items-start gap-6">
                    <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden flex-shrink-0">
                        {currentUser.avatar ? (
                            <img src={currentUser.avatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400"><UserIcon size={32} /></div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 flex-1">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Full Name</label>
                            {isEditingProfile ? (
                                <input
                                    className="w-full p-2 border border-slate-300 rounded text-sm"
                                    value={editProfileData.name}
                                    onChange={e => setEditProfileData({ ...editProfileData, name: e.target.value })}
                                />
                            ) : (
                                <div className="text-sm font-medium text-slate-900 p-2 bg-slate-50 rounded border border-slate-200">{currentUser.name}</div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Email Address</label>
                            {isEditingProfile ? (
                                <input
                                    className="w-full p-2 border border-slate-300 rounded text-sm"
                                    value={editProfileData.email}
                                    onChange={e => setEditProfileData({ ...editProfileData, email: e.target.value })}
                                />
                            ) : (
                                <div className="text-sm font-medium text-slate-900 p-2 bg-slate-50 rounded border border-slate-200">{currentUser.email}</div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                            <div className="text-sm font-medium text-slate-900 p-2 bg-slate-50 rounded border border-slate-200 capitalize cursor-not-allowed opacity-70" title="Role cannot be changed here">
                                {currentUser.role.replace('_', ' ')} <Lock size={12} className="inline ml-1 text-slate-400" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
                            {isEditingProfile ? (
                                <input
                                    className="w-full p-2 border border-slate-300 rounded text-sm"
                                    value={editProfileData.department}
                                    onChange={e => setEditProfileData({ ...editProfileData, department: e.target.value })}
                                />
                            ) : (
                                <div className="text-sm font-medium text-slate-900 p-2 bg-slate-50 rounded border border-slate-200">{currentUser.department || 'N/A'}</div>
                            )}
                        </div>
                    </div>
                </div>
                {isEditingProfile && (
                    <div className="mt-6 flex justify-end border-t pt-4">
                        <button onClick={handleSaveProfile} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2 shadow-sm">
                            <Save size={16} /> Save Changes
                        </button>
                    </div>
                )}
            </div>

            {/* Change Password Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><Lock size={20} /> Security</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Current Password</label>
                        <input type="password" className="w-full p-2 border border-slate-300 rounded text-sm" value={passwordData.current} onChange={e => setPasswordData({ ...passwordData, current: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">New Password</label>
                        <input type="password" className="w-full p-2 border border-slate-300 rounded text-sm" value={passwordData.new} onChange={e => setPasswordData({ ...passwordData, new: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Confirm Password</label>
                        <input type="password" className="w-full p-2 border border-slate-300 rounded text-sm" value={passwordData.confirm} onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })} />
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <button onClick={handleChangePassword} className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800 flex items-center gap-2">
                        <Save size={16} /> Update Password
                    </button>
                </div>
            </div>

            {/* Business Unit Management */}
            {currentUser.role === UserRole.SUPER_ADMIN && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><Building2 size={20} /> Business Unit Management</h3>
                    <div className="grid grid-cols-1 gap-4 mb-4">
                        <input className="border p-2 rounded" placeholder="Business Name" value={newBiz.name} onChange={e => setNewBiz({ ...newBiz, name: e.target.value })} />
                        <input className="border p-2 rounded" placeholder="TIN" value={newBiz.tin} onChange={e => setNewBiz({ ...newBiz, tin: e.target.value })} />
                        <input className="border p-2 rounded" placeholder="Address" value={newBiz.address} onChange={e => setNewBiz({ ...newBiz, address: e.target.value })} />
                        <button onClick={() => { handleAddBusiness(newBiz.name, 'PHP', newBiz.address, newBiz.tin); setNewBiz({ name: '', tin: '', address: '' }); }} className="bg-brand-600 text-white py-2 rounded w-32">Add Business</button>
                    </div>
                    <div className="space-y-2">
                        {businesses.map(b => <div key={b.id} className="p-2 border rounded bg-slate-50 text-sm flex justify-between"><span>{b.name}</span><span className="text-slate-400">{b.tin}</span></div>)}
                    </div>
                </div>
            )}

            {/* User Management (Super Admin Only) */}
            {currentUser.role === UserRole.SUPER_ADMIN && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-red-900"><Shield size={20} /> User Management</h3>

                    {/* Create/Edit Form */}
                    <div className="grid grid-cols-12 gap-4 mb-8 items-end border-b border-slate-200 pb-6">
                        <div className="col-span-12 font-medium text-sm text-slate-700 mb-2">{editingUserId ? 'Edit User' : 'Create New User'}</div>
                        <div className="col-span-3">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                            <input className="w-full border p-2 rounded text-sm" placeholder="Name" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                        </div>
                        <div className="col-span-3">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                            <input className="w-full border p-2 rounded text-sm" placeholder="Email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                            <select className="w-full border p-2 rounded text-sm" value={newUser.role} onChange={e => handleRoleChange(e.target.value as UserRole)}>
                                {Object.values(UserRole).map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Business Unit</label>
                            <select className="w-full border p-2 rounded text-sm" value={newUser.businessId} onChange={e => setNewUser({ ...newUser, businessId: e.target.value })}>
                                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Permission Lvl</label>
                            <input
                                type="text"
                                className="w-full border p-2 rounded text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
                                value={newUser.permissionLevel}
                                disabled
                                readOnly
                            />
                        </div>
                        <div className="col-span-12 flex justify-end gap-2">
                            {editingUserId && <button onClick={resetUserForm} className="text-slate-500 text-sm px-4 hover:underline">Cancel</button>}
                            <button onClick={handleCreateOrUpdateUser} className="bg-slate-900 text-white py-2 px-6 rounded text-sm hover:bg-slate-800">
                                {editingUserId ? 'Update User' : 'Create User'}
                            </button>
                        </div>
                    </div>

                    {/* User List Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-4 py-2">Name</th>
                                    <th className="px-4 py-2">Email</th>
                                    <th className="px-4 py-2">Role</th>
                                    <th className="px-4 py-2">Lvl</th>
                                    <th className="px-4 py-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {allUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 font-medium text-slate-900">{user.name}</td>
                                        <td className="px-4 py-2 text-slate-500">{user.email}</td>
                                        <td className="px-4 py-2 capitalize">{user.role.replace('_', ' ').toLowerCase()}</td>
                                        <td className="px-4 py-2">{user.permissionLevel || ROLE_PERMISSION_MAP[user.role]}</td>
                                        <td className="px-4 py-2 text-right">
                                            <button onClick={() => handleEditUserClick(user)} className="text-blue-600 hover:text-blue-800 font-medium text-xs">
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Fallback message for non-admins if both sections are hidden */}
            {currentUser.role !== UserRole.SUPER_ADMIN && (
                <div className="bg-slate-50 p-8 rounded-xl border border-slate-200 text-center text-slate-500">
                    <Shield size={48} className="mx-auto mb-4 text-slate-300" />
                    <p>You do not have permission to view administrative settings.</p>
                </div>
            )}
        </div>
    );
};
