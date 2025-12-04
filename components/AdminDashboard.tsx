import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { Loader2, Check, X, UserPlus, Shield } from 'lucide-react';

interface Request {
    id: string;
    email: string;
    status: string;
    requested_at: string;
}

export const AdminDashboard: React.FC = () => {
    const { isAdmin, user } = useAuth();
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isAdmin) {
            fetchRequests();
        }
    }, [isAdmin]);

    const fetchRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('beta_requests')
                .select('*')
                .eq('status', 'pending')
                .order('requested_at', { ascending: false });

            if (error) throw error;
            setRequests(data || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const approveRequest = async (request: Request) => {
        try {
            // 1. Add to beta_testers
            const { error: insertError } = await supabase
                .from('beta_testers')
                .insert([{ email: request.email, added_by: user?.id }]);

            if (insertError) throw insertError;

            // 2. Update request status
            const { error: updateError } = await supabase
                .from('beta_requests')
                .update({ status: 'approved' })
                .eq('id', request.id);

            if (updateError) throw updateError;

            // Refresh list
            setRequests(requests.filter(r => r.id !== request.id));
        } catch (error) {
            console.error('Error approving request:', error);
            alert('Failed to approve request');
        }
    };

    const rejectRequest = async (id: string) => {
        try {
            const { error } = await supabase
                .from('beta_requests')
                .update({ status: 'rejected' })
                .eq('id', id);

            if (error) throw error;
            setRequests(requests.filter(r => r.id !== id));
        } catch (error) {
            console.error('Error rejecting request:', error);
        }
    };

    if (!isAdmin) {
        return <div className="text-white p-8">Access Denied</div>;
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-500/10 p-3 rounded-xl">
                            <Shield className="w-8 h-8 text-indigo-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                            <p className="text-gray-400">Manage beta access requests</p>
                        </div>
                    </div>
                    <button onClick={() => window.location.href = '/'} className="text-gray-400 hover:text-white">
                        Back to Studio
                    </button>
                </div>

                <div className="bg-[#111] border border-gray-800 rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                        <h2 className="font-semibold flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-gray-400" />
                            Pending Requests
                        </h2>
                        <span className="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded text-xs font-mono">
                            {requests.length}
                        </span>
                    </div>

                    {loading ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            No pending requests
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-800">
                            {requests.map((request) => (
                                <div key={request.id} className="p-4 flex items-center justify-between hover:bg-gray-900/50 transition-colors">
                                    <div>
                                        <p className="font-medium text-white">{request.email}</p>
                                        <p className="text-sm text-gray-500">
                                            Requested: {new Date(request.requested_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => approveRequest(request)}
                                            className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors"
                                            title="Approve"
                                        >
                                            <Check className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => rejectRequest(request.id)}
                                            className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                                            title="Reject"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
