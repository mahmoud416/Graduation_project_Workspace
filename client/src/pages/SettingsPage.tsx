import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/useTheme';
import type { Theme } from '../contexts/ThemeContextDefinition';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

type SettingsTab = 'general' | 'profile' | 'notifications' | 'billing' | 'integrations';

const USER_UPDATE_EVENT = 'workspace:user-update';

const formatRoleLabel = (value: string | null) => {
    if (!value) return 'Member';
    return value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const SettingsPage = () => {
    const location = useLocation();
    const requestedTab = (location.state as { tab?: SettingsTab } | null)?.tab;
    const [activeTab, setActiveTab] = useState<SettingsTab>(requestedTab ?? 'general');
    const { theme, setTheme } = useTheme();
    const readProfileFromStorage = () => {
        if (typeof window === 'undefined') {
            return { fullName: '', email: '', phone: '' };
        }
        return {
            fullName: localStorage.getItem('fullName') ?? '',
            email: localStorage.getItem('email') ?? '',
            phone: localStorage.getItem('phone') ?? ''
        };
    };
    const getRoleFromStorage = () => (typeof window !== 'undefined' ? localStorage.getItem('role') : null);
    const [profileForm, setProfileForm] = useState(readProfileFromStorage);
    const [roleValue, setRoleValue] = useState<string | null>(getRoleFromStorage);
    const [profileMessage, setProfileMessage] = useState<string | null>(null);
    const [savingProfile, setSavingProfile] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isPasswordEditing, setIsPasswordEditing] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [savingPassword, setSavingPassword] = useState(false);

    useEffect(() => {
        if (requestedTab && requestedTab !== activeTab) {
            setActiveTab(requestedTab);
        }
    }, [requestedTab, activeTab]);

    useEffect(() => {
        const syncProfile = () => {
            setProfileForm(readProfileFromStorage());
            setRoleValue(getRoleFromStorage());
        };
        window.addEventListener('storage', syncProfile);
        window.addEventListener(USER_UPDATE_EVENT, syncProfile);
        return () => {
            window.removeEventListener('storage', syncProfile);
            window.removeEventListener(USER_UPDATE_EVENT, syncProfile);
        };
    }, []);

    const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
    };

    const handleProfileChange = (field: keyof typeof profileForm) => (event: ChangeEvent<HTMLInputElement>) => {
        const { value } = event.target;
        setProfileForm((prev) => ({ ...prev, [field]: value }));
        setProfileMessage(null);
    };

    const handleProfileSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (typeof window === 'undefined') return;
        setSavingProfile(true);
        Object.entries(profileForm).forEach(([key, value]) => {
            localStorage.setItem(key, value);
        });
        window.dispatchEvent(new Event(USER_UPDATE_EVENT));
        setProfileMessage('Profile updated successfully');
        setSavingProfile(false);
        setIsEditing(false);
        setTimeout(() => setProfileMessage(null), 4000);
    };

    const handleProfileReset = () => {
        setProfileForm(readProfileFromStorage());
        setProfileMessage(null);
        setIsEditing(false);
    };

    const profileInitials = useMemo(() => {
        if (!profileForm.fullName.trim()) return 'W';
        return profileForm.fullName
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((segment) => segment[0]?.toUpperCase() ?? '')
            .join('');
    }, [profileForm.fullName]);

    const roleLabel = useMemo(() => formatRoleLabel(roleValue), [roleValue]);

    const resetPasswordForm = () => {
        setNewPassword('');
        setConfirmPassword('');
        setSavingPassword(false);
    };

    const handleTogglePasswordEditor = () => {
        if (isPasswordEditing) {
            resetPasswordForm();
            setPasswordStatus(null);
        }
        setIsPasswordEditing((prev) => !prev);
    };

    const handlePasswordSave = async () => {
        if (!isPasswordEditing) return;
        setPasswordStatus(null);

        if (newPassword.trim().length < 3) {
            setPasswordStatus({ type: 'error', message: 'Password must be at least 3 characters.' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordStatus({ type: 'error', message: 'Passwords do not match.' });
            return;
        }

        const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
        if (!userId) {
            setPasswordStatus({ type: 'error', message: 'Missing user information. Please sign in again.' });
            return;
        }

        try {
            setSavingPassword(true);
            const response = await fetch(`${API_BASE}/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, new_password: newPassword })
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || 'Failed to update password');
            }

            setPasswordStatus({ type: 'success', message: 'Password updated successfully.' });
            resetPasswordForm();
            setIsPasswordEditing(false);
        } catch (error: any) {
            setPasswordStatus({ type: 'error', message: error.message || 'Failed to update password.' });
        } finally {
            setSavingPassword(false);
        }
    };

    // Sidebar navigation
    const settingsTabs = [
        { id: 'general' as const, label: 'General', icon: '⚙️' },
        { id: 'profile' as const, label: 'Profile', icon: '👤' },
        { id: 'notifications' as const, label: 'Notifications', icon: '🔔' },
        { id: 'billing' as const, label: 'Billing', icon: '💳' },
        { id: 'integrations' as const, label: 'Integrations', icon: '🔗' },
    ];

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors duration-200">
            <Sidebar />

            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Settings" />

                <main className="page-main p-8 relative">

                    <div className="flex gap-8">
                        {/* Settings Sidebar */}
                        <div className="w-64 flex-shrink-0">
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 transition-colors">
                                <div className="mb-4">
                                    <h2 className="text-sm font-bold text-text-dark dark:text-gray-100 mb-1">Workspace Settings</h2>
                                    <p className="text-xs text-text-gray dark:text-gray-400">Manage your team's preferences</p>
                                </div>
                                <nav className="space-y-1">
                                    {settingsTabs.map((tab) => (
                                        <button
                                            type="button"
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === tab.id
                                                ? 'bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 font-medium'
                                                : 'text-text-gray dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            <span>{tab.icon}</span>
                                            {tab.label}
                                        </button>
                                    ))}
                                </nav>
                            </div>
                        </div>

                        {/* Settings Content */}
                        <div className="flex-1">
                            {activeTab === 'general' && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 transition-colors">
                                    <div className="mb-8">
                                        <h1 className="text-2xl font-bold text-text-dark dark:text-white mb-2">General Settings</h1>
                                        <p className="text-sm text-text-gray dark:text-gray-400">Configure your workspace basics, localization, and appearance</p>
                                    </div>

                                    {/* Workspace Details */}
                                    <div className="mb-8">
                                        <h2 className="text-base font-bold text-text-dark dark:text-gray-200 mb-4">Workspace Details</h2>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-text-dark dark:text-gray-300 mb-2">Workspace Name</label>
                                                <input
                                                    type="text"
                                                    defaultValue="Acme Marketing Group"
                                                    className="w-full h-10 px-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-text-dark dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-text-dark dark:text-gray-300 mb-2">Workspace URL</label>
                                                <div className="flex items-center gap-0">
                                                    <span className="h-10 px-3 bg-gray-100 dark:bg-gray-700 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg flex items-center text-sm text-text-gray dark:text-gray-300">
                                                        promanage.com/
                                                    </span>
                                                    <input
                                                        type="text"
                                                        defaultValue="acme-marketing"
                                                        className="flex-1 h-10 px-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-r-lg text-sm text-text-dark dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Localization */}
                                    <div className="mb-8">
                                        <h2 className="text-base font-bold text-text-dark dark:text-gray-200 mb-4">Localization</h2>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-text-dark dark:text-gray-300 mb-2">Timezone</label>
                                                <select className="w-full h-10 px-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-text-dark dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                                                    <option>(GMT-08:00) Pacific Time (US & Canada)</option>
                                                    <option>(GMT-05:00) Eastern Time (US & Canada)</option>
                                                    <option>(GMT+00:00) London</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-text-dark dark:text-gray-300 mb-2">Date Format</label>
                                                <select className="w-full h-10 px-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-text-dark dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                                                    <option>MM/DD/YYYY</option>
                                                    <option>DD/MM/YYYY</option>
                                                    <option>YYYY-MM-DD</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Appearance */}
                                    <div className="mb-8">
                                        <h2 className="text-base font-bold text-text-dark dark:text-gray-200 mb-2">Appearance</h2>
                                        <p className="text-sm text-text-gray dark:text-gray-400 mb-4">Customize how the interface looks on your device.</p>

                                        <div className="grid grid-cols-3 gap-4">
                                            <button
                                                onClick={() => handleThemeChange('light')}
                                                className={`relative p-4 border-2 rounded-xl transition-all ${theme === 'light'
                                                    ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-center mb-3">
                                                    <div className="w-12 h-12 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center">
                                                        <svg className="w-6 h-6 text-yellow-500" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                {theme === 'light' && (
                                                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                                        <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div className="text-center">
                                                    <div className="text-sm font-semibold text-text-dark dark:text-gray-200">Light Mode</div>
                                                    <div className="text-xs text-text-gray dark:text-gray-400 mt-0.5">High contrast, light background</div>
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => handleThemeChange('dark')}
                                                className={`relative p-4 border-2 rounded-xl transition-all ${theme === 'dark'
                                                    ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-center mb-3">
                                                    <div className="w-12 h-12 bg-gray-900 border-2 border-gray-700 rounded-full flex items-center justify-center">
                                                        <svg className="w-6 h-6 text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                {theme === 'dark' && (
                                                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                                        <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div className="text-center">
                                                    <div className="text-sm font-semibold text-text-dark dark:text-gray-200">Dark Mode</div>
                                                    <div className="text-xs text-text-gray dark:text-gray-400 mt-0.5">Easier on eyes in dark space</div>
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => handleThemeChange('system')}
                                                className={`relative p-4 border-2 rounded-xl transition-all ${theme === 'system'
                                                    ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-center mb-3">
                                                    <div className="w-12 h-12 bg-gradient-to-br from-white to-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center">
                                                        <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                {theme === 'system' && (
                                                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                                        <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div className="text-center">
                                                    <div className="text-sm font-semibold text-text-dark dark:text-gray-200">System Default</div>
                                                    <div className="text-xs text-text-gray dark:text-gray-400 mt-0.5">Matches your OS settings</div>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'profile' && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 transition-colors">
                                    <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white text-2xl font-bold flex items-center justify-center">
                                                {profileInitials}
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase font-semibold text-text-gray dark:text-gray-400">Signed in as</p>
                                                <p className="text-2xl font-bold text-text-dark dark:text-white">
                                                    {profileForm.fullName || 'Workspace Member'}
                                                </p>
                                                <p className="text-sm text-text-gray dark:text-gray-400 break-words">
                                                    {profileForm.email || 'No email on file'}
                                                </p>
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-900 text-text-gray dark:text-gray-300 mt-2">
                                                    {roleLabel}
                                                </span>
                                            </div>
                                        </div>
                                        {!isEditing && (
                                            <button
                                                type="button"
                                                onClick={() => setIsEditing(true)}
                                                className="self-start h-10 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-text-dark dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
                                            >
                                                Edit profile
                                            </button>
                                        )}
                                    </div>

                                    {profileMessage && (
                                        <div className="mb-6 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-200">
                                            {profileMessage}
                                        </div>
                                    )}

                                    <form className="space-y-8" onSubmit={handleProfileSubmit}>
                                        <section>
                                            <div className="mb-4 flex items-center justify-between">
                                                <div>
                                                    <h2 className="text-base font-bold text-text-dark dark:text-gray-100">Personal Information</h2>
                                                    <p className="text-xs text-text-gray dark:text-gray-400">View your account details or enable editing to update them.</p>
                                                </div>
                                                <span className="text-xs text-text-gray dark:text-gray-500">Stored locally</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-text-dark dark:text-gray-300 mb-2">Full Name</label>
                                                    <input
                                                        type="text"
                                                        value={profileForm.fullName}
                                                        onChange={handleProfileChange('fullName')}
                                                        disabled={!isEditing}
                                                        className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-text-dark dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-100 dark:disabled:bg-gray-900/50 disabled:text-text-gray dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                                                        placeholder="Your full name"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-text-dark dark:text-gray-300 mb-2">Email Address</label>
                                                    <input
                                                        type="email"
                                                        value={profileForm.email}
                                                        onChange={handleProfileChange('email')}
                                                        disabled={!isEditing}
                                                        className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-text-dark dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-100 dark:disabled:bg-gray-900/50 disabled:text-text-gray dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                                                        placeholder="you@company.com"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-text-dark dark:text-gray-300 mb-2">Role</label>
                                                    <input
                                                        type="text"
                                                        value={roleLabel}
                                                        disabled
                                                        className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 text-sm text-text-dark dark:text-gray-200"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-text-dark dark:text-gray-300 mb-2">Phone Number</label>
                                                    <input
                                                        type="tel"
                                                        value={profileForm.phone}
                                                        onChange={handleProfileChange('phone')}
                                                        disabled={!isEditing}
                                                        className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-text-dark dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-100 dark:disabled:bg-gray-900/50 disabled:text-text-gray dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                                                        placeholder="+20 10 0000 0000"
                                                    />
                                                </div>
                                            </div>
                                        </section>

                                        <section>
                                            <h2 className="text-base font-bold text-text-dark dark:text-gray-100 mb-4">Password & Security</h2>
                                            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-text-dark dark:text-gray-100">Password</p>
                                                    <p className="text-xs text-text-gray dark:text-gray-400">Last changed 3 months ago</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleTogglePasswordEditor}
                                                    className="h-9 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-text-dark dark:text-gray-100 hover:bg-white dark:hover:bg-gray-800"
                                                >
                                                    {isPasswordEditing ? 'Close' : 'Change'}
                                                </button>
                                            </div>

                                            {passwordStatus && (
                                                <div
                                                    className={`mt-4 rounded-lg border px-4 py-3 text-sm ${passwordStatus.type === 'success'
                                                        ? 'border-green-200 bg-green-50 text-green-700'
                                                        : 'border-red-200 bg-red-50 text-red-700'
                                                        }`}
                                                >
                                                    {passwordStatus.message}
                                                </div>
                                            )}

                                            {isPasswordEditing && (
                                                <div className="mt-4 space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm font-medium text-text-dark dark:text-gray-300 mb-2">New Password</label>
                                                            <input
                                                                type="password"
                                                                value={newPassword}
                                                                onChange={(event) => setNewPassword(event.target.value)}
                                                                className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-text-dark dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                                placeholder="Enter new password"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-text-dark dark:text-gray-300 mb-2">Confirm Password</label>
                                                            <input
                                                                type="password"
                                                                value={confirmPassword}
                                                                onChange={(event) => setConfirmPassword(event.target.value)}
                                                                className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-text-dark dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                                placeholder="Repeat new password"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-end gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                resetPasswordForm();
                                                                setIsPasswordEditing(false);
                                                                setPasswordStatus(null);
                                                            }}
                                                            className="h-10 px-6 rounded-lg text-sm font-medium text-text-dark dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handlePasswordSave}
                                                            disabled={savingPassword}
                                                            className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-60"
                                                        >
                                                            {savingPassword ? 'Saving...' : 'Save password'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </section>

                                        {isEditing ? (
                                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                                <button
                                                    type="button"
                                                    onClick={handleProfileReset}
                                                    className="h-10 px-6 rounded-lg text-sm font-medium text-text-dark dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={savingProfile}
                                                    className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-60"
                                                >
                                                    {savingProfile ? 'Saving...' : 'Save changes'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditing(true)}
                                                    className="inline-flex items-center justify-center h-10 px-6 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-text-dark dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
                                                >
                                                    Edit profile
                                                </button>
                                            </div>
                                        )}
                                    </form>
                                </div>
                            )}

                            {activeTab === 'notifications' && (
                                <div className="bg-white rounded-xl border border-gray-200 p-8">
                                    <div className="mb-8">
                                        <h1 className="text-2xl font-bold text-text-dark mb-2">Notification Preferences</h1>
                                        <p className="text-sm text-text-gray">Decide how and when you want to be notified about workspace activity.</p>
                                    </div>

                                    {/* Notification Table */}
                                    <div className="mb-8">
                                        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 rounded-t-lg text-xs font-semibold text-text-gray uppercase">
                                            <div className="col-span-6">Trigger</div>
                                            <div className="col-span-2 text-center">Email</div>
                                            <div className="col-span-2 text-center">Desktop</div>
                                            <div className="col-span-2 text-center">Mobile</div>
                                        </div>

                                        <div className="border border-gray-200 rounded-b-lg divide-y divide-gray-100">
                                            {[
                                                { title: 'New Task Assigned', desc: 'When someone assigns a new task to you', email: true, desktop: true, mobile: true },
                                                { title: 'Mention in Comments', desc: 'When someone @mentions you in a task or project', email: true, desktop: true, mobile: true },
                                                { title: 'Due Date Reminder', desc: 'Get notified before a task is deadline', email: true, desktop: false, mobile: true },
                                                { title: 'Project Updates', desc: 'Changes to status, priority, or milestones', email: false, desktop: true, mobile: false },
                                                { title: 'Weekly Summary', desc: 'A high-level view of tasks, weekly recap of progress', email: true, desktop: false, mobile: false },
                                            ].map((item, index) => (
                                                <div key={index} className="grid grid-cols-12 gap-4 px-4 py-4 hover:bg-gray-50 transition-colors">
                                                    <div className="col-span-6">
                                                        <div className="text-sm font-semibold text-text-dark">{item.title}</div>
                                                        <div className="text-xs text-text-gray mt-0.5">{item.desc}</div>
                                                    </div>
                                                    <div className="col-span-2 flex items-center justify-center">
                                                        <input type="checkbox" defaultChecked={item.email} className="w-4 h-4 border-gray-300 rounded text-primary focus:ring-primary" />
                                                    </div>
                                                    <div className="col-span-2 flex items-center justify-center">
                                                        <input type="checkbox" defaultChecked={item.desktop} className="w-4 h-4 border-gray-300 rounded text-primary focus:ring-primary" />
                                                    </div>
                                                    <div className="col-span-2 flex items-center justify-center">
                                                        <input type="checkbox" defaultChecked={item.mobile} className="w-4 h-4 border-gray-300 rounded text-primary focus:ring-primary" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Quiet Hours */}
                                    <div className="p-5 bg-blue-50 border border-blue-200 rounded-lg">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <svg className="w-5 h-5 text-primary" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                                </svg>
                                                <div>
                                                    <div className="text-sm font-bold text-text-dark">Quiet Hours</div>
                                                    <div className="text-xs text-text-gray mt-0.5">Mute all notifications during specific times of the day to stay focused or rest.</div>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" defaultChecked />
                                                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                            </label>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-text-dark mb-2">Start Time</label>
                                                <input
                                                    type="time"
                                                    defaultValue="22:00"
                                                    className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-text-dark mb-2">End Time</label>
                                                <input
                                                    type="time"
                                                    defaultValue="08:00"
                                                    className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 mt-8">
                                        <button className="h-10 px-6 text-sm font-medium text-text-dark hover:bg-gray-100 rounded-lg transition-colors">
                                            Discard Changes
                                        </button>
                                        <button className="h-10 px-6 bg-primary text-white font-medium text-sm rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                <path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                            </svg>
                                            Save Preferences
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Additional tabs will be rendered here */}
                            {activeTab === 'billing' && (
                                <div className="bg-white rounded-xl border border-gray-200 p-8">
                                    <div className="mb-8">
                                        <h1 className="text-2xl font-bold text-text-dark mb-2">Billing and Subscription</h1>
                                        <p className="text-sm text-text-gray">Manage your plan, payment methods, and billing history.</p>
                                    </div>

                                    {/* Current Plan */}
                                    <div className="mb-8 p-6 border-2 border-primary rounded-xl bg-blue-50">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                                                    <svg className="w-6 h-6 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h2 className="text-lg font-bold text-text-dark">Pro Plan</h2>
                                                        <span className="px-2 py-0.5 bg-success text-white text-xs font-bold rounded uppercase">Active</span>
                                                    </div>
                                                    <p className="text-sm text-text-gray">Our most popular plan for scaling teams. Next renewal: June 15, 2024</p>
                                                </div>
                                            </div>
                                            <button className="h-9 px-4 bg-white border border-gray-300 rounded-lg text-sm font-medium text-text-dark hover:bg-gray-50 transition-colors">
                                                Cancel Subscription
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            <div>
                                                <div className="text-xs text-text-gray uppercase mb-1">Price</div>
                                                <div className="text-lg font-bold text-text-dark">$49/month</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-text-gray uppercase mb-1">Users</div>
                                                <div className="text-lg font-bold text-text-dark">Unlimited</div>
                                            </div>
                                            <div className="ml-auto">
                                                <button className="h-10 px-6 bg-primary text-white font-medium text-sm rounded-lg hover:bg-blue-600 transition-colors">
                                                    Manage Subscription
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Payment Methods */}
                                    <div className="mb-8">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-base font-bold text-text-dark">Payment Methods</h2>
                                            <button className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path d="M12 4v16m8-8H4" />
                                                </svg>
                                                Add New Card
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-4 border-2 border-primary bg-blue-50 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-8 bg-white rounded border border-gray-200 flex items-center justify-center">
                                                        <svg className="w-6 h-4" viewBox="0 0 24 16" fill="none">
                                                            <rect width="24" height="16" rx="2" fill="#1434CB" />
                                                            <path d="M8 8h8M8 11h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-text-dark">Visa ending in 4242</div>
                                                        <div className="text-xs text-text-gray">Expires 12/2025 • Default</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-colors">
                                                        <svg className="w-4 h-4 text-text-gray" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    <button className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-colors">
                                                        <svg className="w-4 h-4 text-text-gray" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-8 bg-white rounded border border-gray-200 flex items-center justify-center">
                                                        <svg className="w-6 h-4" viewBox="0 0 24 16" fill="none">
                                                            <rect width="24" height="16" rx="2" fill="#EB001B" />
                                                            <circle cx="10" cy="8" r="5" fill="#F79E1B" />
                                                            <circle cx="14" cy="8" r="5" fill="#FF5F00" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-text-dark">Mastercard ending in 8888</div>
                                                        <div className="text-xs text-text-gray">Expires 06/2024</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button className="text-xs font-medium text-primary hover:underline">
                                                        Set as default
                                                    </button>
                                                    <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors">
                                                        <svg className="w-4 h-4 text-text-gray" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Billing History */}
                                    <div>
                                        <h2 className="text-base font-bold text-text-dark mb-4">Billing History</h2>
                                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                                            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 text-xs font-semibold text-text-gray uppercase">
                                                <div className="col-span-3">Date</div>
                                                <div className="col-span-4">Description</div>
                                                <div className="col-span-2">Amount</div>
                                                <div className="col-span-2">Status</div>
                                                <div className="col-span-1">Invoice</div>
                                            </div>
                                            <div className="divide-y divide-gray-100">
                                                {[
                                                    { date: 'May 15, 2024', desc: 'Pro Plan Monthly', amount: '$49.00', status: 'Paid' },
                                                    { date: 'Apr 15, 2024', desc: 'Pro Plan Monthly', amount: '$49.00', status: 'Paid' },
                                                    { date: 'Mar 15, 2024', desc: 'Pro Plan Monthly', amount: '$49.00', status: 'Paid' },
                                                ].map((invoice, index) => (
                                                    <div key={index} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                                                        <div className="col-span-3 text-sm text-text-dark">{invoice.date}</div>
                                                        <div className="col-span-4 text-sm text-text-dark">{invoice.desc}</div>
                                                        <div className="col-span-2 text-sm font-semibold text-text-dark">{invoice.amount}</div>
                                                        <div className="col-span-2">
                                                            <span className="px-2.5 py-1 bg-green-100 text-success text-xs font-medium rounded-md">
                                                                {invoice.status}
                                                            </span>
                                                        </div>
                                                        <div className="col-span-1">
                                                            <button className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                                                                <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                </svg>
                                                                PDF
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'integrations' && (
                                <div className="bg-white rounded-xl border border-gray-200 p-8">
                                    <div className="mb-8">
                                        <h1 className="text-2xl font-bold text-text-dark mb-2">Integrations & Apps</h1>
                                        <p className="text-sm text-text-gray">Connect your favorite tools to streamline your workflow.</p>
                                    </div>

                                    {/* Search */}
                                    <div className="mb-6">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search all apps..."
                                                className="w-full h-11 pl-10 pr-4 border border-gray-300 rounded-lg text-sm placeholder:text-text-gray focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                            />
                                            <svg
                                                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-gray"
                                                fill="none"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Integration Cards */}
                                    <div className="grid grid-cols-3 gap-5">
                                        {/* Slack - Connected */}
                                        <div className="p-5 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                                                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
                                                        <path d="M6 15a2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2h2v2zm1 0a2 2 0 012-2 2 2 0 012 2v5a2 2 0 01-2 2 2 2 0 01-2-2v-5z" fill="#E01E5A" />
                                                        <path d="M9 6a2 2 0 01-2-2 2 2 0 012-2 2 2 0 012 2v2H9zm0 1a2 2 0 012 2 2 2 0 01-2 2H4a2 2 0 01-2-2 2 2 0 012-2h5z" fill="#36C5F0" />
                                                        <path d="M18 9a2 2 0 012-2 2 2 0 012 2 2 2 0 01-2 2h-2V9zm-1 0a2 2 0 01-2 2 2 2 0 01-2-2V4a2 2 0 012-2 2 2 0 012 2v5z" fill="#2EB67D" />
                                                        <path d="M15 18a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2v-2h2zm0-1a2 2 0 01-2-2 2 2 0 012-2h5a2 2 0 012 2 2 2 0 01-2 2h-5z" fill="#ECB22E" />
                                                    </svg>
                                                </div>
                                                <span className="px-2 py-0.5 bg-success text-white text-[10px] font-bold rounded uppercase">Connected</span>
                                            </div>
                                            <h3 className="text-base font-bold text-text-dark mb-1">Slack</h3>
                                            <p className="text-xs text-text-gray mb-4">Send task updates, notifications, and reports directly to your team channels.</p>
                                            <button className="w-full h-9 px-4 bg-gray-100 text-text-dark font-medium text-sm rounded-lg hover:bg-gray-200 transition-colors">
                                                Configure
                                            </button>
                                        </div>

                                        {/* Google Drive */}
                                        <div className="p-5 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                                                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
                                                        <path d="M7.71 3.949L1.156 15.099l3.36 5.821L11.07 9.77 7.71 3.949z" fill="#0066DA" />
                                                        <path d="M20.09 21.012l6.555-11.15-3.36-5.821-6.504 11.098 3.31 5.873z" fill="#00AC47" />
                                                        <path d="M7.71 3.949l3.36 5.821h6.62l-3.31-5.821H7.71z" fill="#EA4335" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <h3 className="text-base font-bold text-text-dark mb-1">Google Drive</h3>
                                            <p className="text-xs text-text-gray mb-4">Attach files from Drive to your tasks and sync documents automatically.</p>
                                            <button className="w-full h-9 px-4 bg-primary text-white font-medium text-sm rounded-lg hover:bg-blue-600 transition-colors">
                                                Connect
                                            </button>
                                        </div>

                                        {/* Zoom */}
                                        <div className="p-5 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                                                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="#2D8CFF">
                                                        <path d="M3 12c0-4.97 4.03-9 9-9s9 4.03 9 9-4.03 9-9 9-9-4.03-9-9zm13.5-3.5h-4v7l4-3.5v-3.5z" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <h3 className="text-base font-bold text-text-dark mb-1">Zoom</h3>
                                            <p className="text-xs text-text-gray mb-4">Schedule and start video meetings directly from any project dashboard.</p>
                                            <button className="w-full h-9 px-4 bg-primary text-white font-medium text-sm rounded-lg hover:bg-blue-600 transition-colors">
                                                Connect
                                            </button>
                                        </div>

                                        {/* GitHub */}
                                        <div className="p-5 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="#181717">
                                                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <h3 className="text-base font-bold text-text-dark mb-1">GitHub</h3>
                                            <p className="text-xs text-text-gray mb-4">Link pull requests to tasks and track development progress in real-time.</p>
                                            <button className="w-full h-9 px-4 bg-primary text-white font-medium text-sm rounded-lg hover:bg-blue-600 transition-colors">
                                                Connect
                                            </button>
                                        </div>

                                        {/* Trello */}
                                        <div className="p-5 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                                                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="#0052CC">
                                                        <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.656 1.343 3 3 3h18c1.656 0 3-1.344 3-3V3c0-1.657-1.344-3-3-3zM10.44 18.18c0 .795-.645 1.44-1.44 1.44H6.36c-.795 0-1.44-.646-1.44-1.44V5.82c0-.795.645-1.44 1.44-1.44H9c.795 0 1.44.645 1.44 1.44v12.36zm8.64-6.84c0 .795-.646 1.44-1.44 1.44h-2.64c-.795 0-1.44-.645-1.44-1.44V5.82c0-.795.645-1.44 1.44-1.44h2.64c.794 0 1.44.645 1.44 1.44v5.52z" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <h3 className="text-base font-bold text-text-dark mb-1">Trello</h3>
                                            <p className="text-xs text-text-gray mb-4">Import your boards and cards into ProManage and keep them in sync.</p>
                                            <button className="w-full h-9 px-4 bg-primary text-white font-medium text-sm rounded-lg hover:bg-blue-600 transition-colors">
                                                Connect
                                            </button>
                                        </div>

                                        {/* Microsoft Teams */}
                                        <div className="p-5 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                                                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="#5059C9">
                                                        <path d="M20.625 8.127v7.746a1.126 1.126 0 01-1.127 1.127h-6.746V7h6.746a1.126 1.126 0 011.127 1.127zM11.248 17h-7.5A1.753 1.753 0 012 15.248V8.752A1.753 1.753 0 013.748 7h7.5v10zm9.937-8.691v-.184A2.879 2.879 0 0018.307 5.25h-2.682v4.5h4.5v-.315a2.127 2.127 0 001.06-1.126z" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <h3 className="text-base font-bold text-text-dark mb-1">Microsoft Teams</h3>
                                            <p className="text-xs text-text-gray mb-4">Get automation status updates and collaboration alerts in your Teams workspace.</p>
                                            <button className="w-full h-9 px-4 bg-primary text-white font-medium text-sm rounded-lg hover:bg-blue-600 transition-colors">
                                                Connect
                                            </button>
                                        </div>
                                    </div>

                                    {/* Request Integration */}
                                    <div className="mt-8 p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-center">
                                        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
                                            <svg className="w-6 h-6 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                <path d="M12 4v16m8-8H4" />
                                            </svg>
                                        </div>
                                        <h3 className="text-base font-bold text-text-dark mb-1">Request an Integration</h3>
                                        <p className="text-sm text-text-gray mb-4">Don't see the app you use? Let us know what you'd like to use next, or build your own with our API.</p>
                                        <div className="flex items-center justify-center gap-3">
                                            <button className="h-10 px-6 bg-white border border-gray-300 rounded-lg text-sm font-medium text-text-dark hover:bg-gray-50 transition-colors">
                                                View API Docs
                                            </button>
                                            <button className="h-10 px-6 bg-primary text-white font-medium text-sm rounded-lg hover:bg-blue-600 transition-colors">
                                                Submit Request
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SettingsPage;
