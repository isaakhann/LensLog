import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, 
  UserPlus, 
  UserMinus,
  Users, 
  Clock, 
  Loader2, 
  Check, 
  X,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

interface UserBasic {
  id: string;
  username: string;
  profile_picture_url: string | null;
}

interface UserSearch {
  id: string;
  username: string;
  email: string;
  profile_picture_url: string | null;
  friendship_status: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
}

interface PendingRequests {
  incoming: Array<{
    user_id: string;
    friend_id: string;
    status: string;
    created_at: string;
    user: UserBasic;
    friend: UserBasic;
  }>;
  outgoing: Array<{
    user_id: string;
    friend_id: string;
    status: string;
    created_at: string;
    user: UserBasic;
    friend: UserBasic;
  }>;
}

export const Social: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'friends' | 'pending'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [triggerSearch, setTriggerSearch] = useState('');

  // Fetch active friends list
  const { data: friends = [], isLoading: loadingFriends } = useQuery<UserBasic[]>({
    queryKey: ['friends'],
    queryFn: () => api.get<UserBasic[]>('/social/friends')
  });

  // Fetch pending requests list
  const { data: pendingData, isLoading: loadingPending } = useQuery<PendingRequests>({
    queryKey: ['friends', 'pending'],
    queryFn: () => api.get<PendingRequests>('/social/friends/pending')
  });

  // User search query (only queries when search string is set)
  const { data: searchResults = [], isFetching: searching } = useQuery<UserSearch[]>({
    queryKey: ['users', 'search', triggerSearch],
    queryFn: () => api.get<UserSearch[]>(`/social/users/search?query=${encodeURIComponent(triggerSearch)}`),
    enabled: triggerSearch.length > 0
  });

  // Friend Request mutations
  const sendRequestMutation = useMutation({
    mutationFn: (friendId: string) => api.post(`/social/friends/request/${friendId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'search'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    }
  });

  const acceptRequestMutation = useMutation({
    mutationFn: (senderId: string) => api.post(`/social/friends/accept/${senderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'search'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['photos'] }); // Public feed might receive friend photos
    }
  });

  const declineMutation = useMutation({
    // declining, canceling, or unfriending all route to social/friends/decline
    mutationFn: (userId: string) => api.post(`/social/friends/decline/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'search'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    }
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTriggerSearch(searchQuery.trim());
  };

  const renderFriendshipButton = (user: UserSearch) => {
    const isPendingSend = sendRequestMutation.isPending && sendRequestMutation.variables === user.id;
    const isPendingAccept = acceptRequestMutation.isPending && acceptRequestMutation.variables === user.id;
    const isPendingDecline = declineMutation.isPending && declineMutation.variables === user.id;

    if (user.friendship_status === 'accepted') {
      return (
        <button
          onClick={() => declineMutation.mutate(user.id)}
          disabled={isPendingDecline}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-red-950/30 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-900/50 text-xs font-semibold rounded-xl transition-all duration-300"
        >
          {isPendingDecline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
          Remove Friend
        </button>
      );
    }

    if (user.friendship_status === 'pending_sent') {
      return (
        <button
          onClick={() => declineMutation.mutate(user.id)}
          disabled={isPendingDecline}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-900/50 hover:bg-red-950/20 text-xs font-semibold rounded-xl transition-all duration-300"
        >
          {isPendingDecline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
          Cancel Request
        </button>
      );
    }

    if (user.friendship_status === 'pending_received') {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => acceptRequestMutation.mutate(user.id)}
            disabled={isPendingAccept}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold rounded-xl transition-all duration-300"
          >
            {isPendingAccept ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Accept
          </button>
          <button
            onClick={() => declineMutation.mutate(user.id)}
            disabled={isPendingDecline}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-all duration-300"
          >
            {isPendingDecline ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
            Decline
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={() => sendRequestMutation.mutate(user.id)}
        disabled={isPendingSend}
        className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-950/40 border border-cyan-800/40 hover:bg-cyan-900/40 text-cyan-300 text-xs font-semibold rounded-xl transition-all duration-300"
      >
        {isPendingSend ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
        Add Friend
      </button>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header section */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent text-left">
          LensLog Social
        </h1>
        <p className="text-slate-400 text-sm mt-1 text-left">
          Connect with other photographers, share your journal collections, and see shared moments.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Search & Discovery */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-850 pb-3 text-left">
              <Search className="w-5 h-5 text-cyan-500" />
              Discover Photographers
            </h2>

            {/* Search Input Form */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by username or email..."
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-slate-700/80 transition-colors"
              >
                Search
              </button>
            </form>

            {/* Search Results Display */}
            {searching ? (
              <div className="py-12 flex justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
              </div>
            ) : triggerSearch && searchResults.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm italic">
                No photographers found matching "{triggerSearch}"
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-4">
                {searchResults.map(user => (
                  <div 
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-850 rounded-2xl hover:border-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {user.profile_picture_url ? (
                        <img 
                          src={user.profile_picture_url} 
                          alt={user.username} 
                          className="w-10 h-10 rounded-full object-cover border border-slate-800"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-sm font-bold font-mono">
                          {user.username.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="text-left">
                        <h4 className="text-sm font-bold text-slate-200">{user.username}</h4>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    {renderFriendshipButton(user)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs leading-relaxed max-w-sm mx-auto">
                <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                Find fellow photographers by typing their username or email above.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Friends & Pending Tabs */}
        <div className="space-y-6">
          {/* Segment Toggles */}
          <div className="flex gap-2 p-1 bg-slate-950 border border-slate-900 rounded-2xl w-full">
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 ${
                activeTab === 'friends'
                  ? 'bg-slate-900 border border-slate-800 text-cyan-400 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Friends ({friends.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-slate-900 border border-slate-800 text-cyan-400 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Pending {pendingData && (pendingData.incoming.length + pendingData.outgoing.length > 0) && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-cyan-600 rounded-full">
                  {pendingData.incoming.length + pendingData.outgoing.length}
                </span>
              )}
            </button>
          </div>

          {/* Friends List Tab */}
          {activeTab === 'friends' && (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-850 pb-2 text-left">
                <Users className="w-4 h-4 text-cyan-500" />
                Active Friends
              </h3>

              {loadingFriends ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                </div>
              ) : friends.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-6 text-center">You haven't added any friends yet.</p>
              ) : (
                <div className="divide-y divide-slate-900">
                  {friends.map(friend => (
                    <div key={friend.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2.5">
                        {friend.profile_picture_url ? (
                          <img 
                            src={friend.profile_picture_url} 
                            alt={friend.username} 
                            className="w-8 h-8 rounded-full object-cover border border-slate-800"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-xs font-bold font-mono">
                            {friend.username.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-semibold text-slate-200">{friend.username}</span>
                      </div>
                      <button
                        onClick={() => declineMutation.mutate(friend.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-950 border border-transparent hover:border-slate-850 rounded-xl transition-all"
                        title="Unfriend"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pending Requests Tab */}
          {activeTab === 'pending' && (
            <div className="space-y-6">
              {/* Incoming Requests */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-850 pb-2 text-left">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Incoming Requests
                </h3>

                {loadingPending ? (
                  <div className="py-6 flex justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
                  </div>
                ) : !pendingData || pendingData.incoming.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">No incoming requests.</p>
                ) : (
                  <div className="space-y-3.5">
                    {pendingData.incoming.map(request => (
                      <div key={request.user_id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {request.user.profile_picture_url ? (
                            <img 
                              src={request.user.profile_picture_url} 
                              alt={request.user.username} 
                              className="w-7 h-7 rounded-full object-cover border border-slate-850"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-900 border border-slate-850 flex items-center justify-center text-slate-600 text-[10px] font-bold">
                              {request.user.username.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs font-semibold text-slate-200">{request.user.username}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => acceptRequestMutation.mutate(request.user.id)}
                            className="p-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 rounded-lg transition-all"
                            title="Accept"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => declineMutation.mutate(request.user.id)}
                            className="p-1 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/25 rounded-lg transition-all"
                            title="Decline"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outgoing Requests */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-850 pb-2 text-left">
                  <Clock className="w-4 h-4 text-cyan-500" />
                  Outgoing Requests
                </h3>

                {loadingPending ? (
                  <div className="py-6 flex justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
                  </div>
                ) : !pendingData || pendingData.outgoing.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">No outgoing requests.</p>
                ) : (
                  <div className="space-y-3.5">
                    {pendingData.outgoing.map(request => (
                      <div key={request.friend_id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {request.friend.profile_picture_url ? (
                            <img 
                              src={request.friend.profile_picture_url} 
                              alt={request.friend.username} 
                              className="w-7 h-7 rounded-full object-cover border border-slate-855"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-900 border border-slate-855 flex items-center justify-center text-slate-600 text-[10px] font-bold">
                              {request.friend.username.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs font-semibold text-slate-350">{request.friend.username}</span>
                        </div>
                        <button
                          onClick={() => declineMutation.mutate(request.friend.id)}
                          className="p-1 hover:bg-slate-900 text-slate-500 hover:text-red-400 border border-transparent hover:border-slate-800 rounded-lg transition-all"
                          title="Cancel Request"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
