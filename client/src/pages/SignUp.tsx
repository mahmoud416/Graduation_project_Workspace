import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const SignUp = () => {
    const navigate = useNavigate();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    full_name: fullName,
                    phone: phone || null,
                }),
            });

            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg || 'Registration failed');
            }

            setSuccess(true);
            setTimeout(() => {
                navigate('/login', { replace: true });
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Registration failed');
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
                    Already have an account?{' '}
                    <Link to="/login" className="text-primary dark:text-blue-400 font-medium hover:underline">
                        Log in
                    </Link>
                </div>
            </div>

            {/* Form Container */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-[460px] bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-10">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-text-dark dark:text-white mb-2">Create your account</h1>
                        <p className="text-sm text-text-gray dark:text-gray-400">Start collaborating with your team today</p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {/* Full Name */}
                        <div>
                            <label className="block text-xs font-medium text-text-dark dark:text-gray-200 mb-1.5">
                                Full Name
                            </label>
                            <input
                                type="text"
                                placeholder="John Doe"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder:text-text-gray dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-text-dark dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                required
                            />
                        </div>

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

                        {/* Phone Number (Optional) */}
                        <div>
                            <label className="block text-xs font-medium text-text-dark dark:text-gray-200 mb-1.5">
                                Phone Number <span className="text-text-gray dark:text-gray-400">(Optional)</span>
                            </label>
                            <input
                                type="tel"
                                placeholder="+1 (555) 000-0000"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder:text-text-gray dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-text-dark dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-medium text-text-dark dark:text-gray-200 mb-1.5">
                                Password
                            </label>
                            <input
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder:text-text-gray dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-text-dark dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                required
                                minLength={3}
                            />
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-xs font-medium text-text-dark dark:text-gray-200 mb-1.5">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                placeholder="Confirm your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder:text-text-gray dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-text-dark dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                required
                                minLength={3}
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 bg-primary hover:bg-blue-600 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-60"
                        >
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>

                        {error && (
                            <div className="text-sm text-red-600 dark:text-red-400 text-center">{error}</div>
                        )}

                        {success && (
                            <div className="text-sm text-green-600 dark:text-green-400 text-center">
                                Account created successfully! Redirecting to login...
                            </div>
                        )}

                        {/* Sign In Link */}
                        <div className="text-center text-sm text-text-gray dark:text-gray-400 mt-6">
                            Already have an account?{' '}
                            <Link to="/login" className="text-primary dark:text-blue-400 font-medium hover:underline">
                                Sign in
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SignUp;
