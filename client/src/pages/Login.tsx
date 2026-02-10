import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg || 'Login failed');
            }

            const data = await res.json();
            localStorage.setItem('userId', data._id);
            localStorage.setItem('role', data.role);
            localStorage.setItem('fullName', data.name ?? '');

            if (data.role === 'admin') {
                navigate('/dashboard', { replace: true });
            } else if (data.role === 'sub_admin') {
                navigate('/subadmin', { replace: true });
            } else {
                navigate('/tasks', { replace: true });
            }
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background dark:bg-gray-950 flex flex-col">
            {/* Top Bar */}
            <div className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
                        W
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-text-dark dark:text-gray-100">Workspace</div>
                    </div>
                </div>
                <div className="text-sm text-text-gray dark:text-gray-400">
                    Need Help?{' '}
                    <a href="#" className="text-primary dark:text-blue-400 font-medium hover:underline">
                        Contact Support
                    </a>
                </div>
            </div>

            {/* Form Container */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-[460px] bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-10">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-text-dark dark:text-white mb-2">Welcome back</h1>
                        <p className="text-sm text-text-gray dark:text-gray-400">Login to manage your projects</p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {/* Email Address */}
                        <div>
                            <label className="block text-xs font-medium text-text-dark dark:text-gray-200 mb-1.5">
                                Email Address
                            </label>
                            <input
                                type="email"
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder:text-text-gray dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-text-dark dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                required
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-medium text-text-dark dark:text-gray-200 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-10 px-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder:text-text-gray dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-text-dark dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-gray dark:text-gray-400 hover:text-text-dark dark:hover:text-gray-200"
                                >
                                    <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 bg-primary hover:bg-blue-600 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-60"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>

                        {error && (
                            <div className="text-sm text-red-600 dark:text-red-400 text-center">{error}</div>
                        )}

                        {/* Sign Up Link */}
                        <div className="text-center text-sm text-text-gray dark:text-gray-400 mt-6">
                            Don't have an account?{' '}
                            <Link to="/signup" className="text-primary dark:text-blue-400 font-medium hover:underline">
                                Sign up
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
