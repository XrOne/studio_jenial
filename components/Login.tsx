import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { Loader2, Lock, ArrowRight, CheckCircle } from 'lucide-react';

export const Login: React.FC = () => {
    const { signInWithGoogle, user, isBetaTester, loading } = useAuth();
    const [requestEmail, setRequestEmail] = useState('');
    const [requestStatus, setRequestStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

    const handleRequestAccess = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!requestEmail) return;

        if (!supabase) {
            alert('System not configured correctly. Please contact support.');
            console.error('Supabase client is null. Missing env vars?');
            return;
        }

        setRequestStatus('submitting');
        try {
            const { error } = await supabase
                .from('beta_requests')
                .insert([{ email: requestEmail }]);

            if (error) throw error;
            setRequestStatus('success');
        } catch (error) {
            console.error('Error requesting access:', error);
            setRequestStatus('error');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    // If user is logged in but not a beta tester
    if (user && !isBetaTester) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 text-white">
                <div className="max-w-md w-full bg-[#111] border border-gray-800 rounded-2xl p-8 text-center space-y-6">
                    <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto">
                        <Lock className="w-8 h-8 text-yellow-500" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold mb-2">Beta Access Required</h2>
                        <p className="text-gray-400">
                            You are signed in as <span className="text-white font-mono">{user.email}</span>, but this account is not yet whitelisted for the Studio Jenial Beta.
                        </p>
                    </div>

                    <div className="bg-gray-900/50 p-4 rounded-lg text-sm text-left">
                        <p className="text-gray-300 mb-2">To get access:</p>
                        <ol className="list-decimal list-inside text-gray-400 space-y-1">
                            <li>Contact the administrator to approve your email.</li>
                            <li>Or submit a request below if you haven't already.</li>
                        </ol>
                    </div>

                    <form onSubmit={handleRequestAccess} className="space-y-4">
                        {requestStatus === 'success' ? (
                            <div className="bg-green-500/10 text-green-400 p-3 rounded-lg flex items-center gap-2 justify-center">
                                <CheckCircle className="w-5 h-5" />
                                Request sent! We'll notify you soon.
                            </div>
                        ) : (
                            <button
                                onClick={() => setRequestEmail(user.email || '')}
                                disabled={requestStatus === 'submitting'}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {requestStatus === 'submitting' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Request Access for this Email'}
                            </button>
                        )}
                    </form>

                    <button onClick={() => window.location.reload()} className="text-sm text-gray-500 hover:text-white underline">
                        Check Access Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-md w-full bg-[#111]/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 text-center space-y-8 z-10 shadow-2xl">
                <div className="space-y-2">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        Studio Jenial
                    </h1>
                    <p className="text-gray-400">Next-Gen Video Creation Platform</p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={signInWithGoogle}
                        className="w-full bg-white text-black hover:bg-gray-200 font-medium py-3 px-4 rounded-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="currentColor"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="currentColor"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Sign in with Google
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-800"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-[#111] text-gray-500">Beta Access</span>
                        </div>
                    </div>

                    <form onSubmit={handleRequestAccess} className="space-y-3">
                        <input
                            type="email"
                            placeholder="Enter your email to request access"
                            value={requestEmail}
                            onChange={(e) => setRequestEmail(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        <button
                            type="submit"
                            disabled={requestStatus === 'submitting' || requestStatus === 'success'}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                        >
                            {requestStatus === 'submitting' ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                requestStatus === 'success' ? <span className="text-green-400">Request Sent!</span> : 'Request Access'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
