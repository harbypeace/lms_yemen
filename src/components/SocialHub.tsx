import React, { useState, useEffect } from 'react';
import { supabase, Post } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  MessageSquare, 
  Heart, 
  Share2, 
  Send, 
  MoreHorizontal, 
  Plus, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Globe, 
  Lock,
  Loader2,
  Trash2,
  User as UserCircle,
  Newspaper,
  BookOpen,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const SocialHub: React.FC = () => {
  const { user, activeTenant } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'resources' | 'news' | 'friends'>('feed');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPost, setNewPost] = useState({ content: '', type: 'social', isPublic: false, linkUrl: '', linkTitle: '' });
  const [posting, setPosting] = useState(false);

  // Friends state
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (user) {
      if (activeTab === 'friends') {
        fetchFriends();
      } else {
        fetchPosts();
      }
    }
  }, [user, activeTenant, activeTab]);

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('*, profiles:friend_id(*)')
        .or(`user_id.eq.${user?.id},friend_id.eq.${user?.id}`);

      if (error) throw error;
      
      const accepted = friendships.filter(f => f.status === 'accepted');
      const pending = friendships.filter(f => f.status === 'pending' && f.friend_id === user?.id);
      
      setFriends(accepted);
      setRequests(pending);
    } catch (err) {
      console.error('Error fetching friends:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', `%${query}%`)
        .neq('id', user?.id)
        .limit(5);
      
      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (friendId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .insert([{ user_id: user?.id, friend_id: friendId, status: 'pending' }]);
      
      if (error) throw error;
      alert('Friend request sent!');
      setUserSearch('');
      setSearchResults([]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const acceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', requestId);
      
      if (error) throw error;
      fetchFriends();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('post_details')
        .select('*')
        .order('created_at', { ascending: false });

      if (activeTab === 'resources') {
        query = query.eq('type', 'resource');
      } else if (activeTab === 'news') {
        query = query.eq('type', 'news');
      }

      // Filter by tenant if not Global
      if (activeTenant && activeTenant.slug !== 'general') {
        query = query.eq('tenant_id', activeTenant.id);
      }

      const { data, error } = await query.limit(30);

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPost.content.trim()) return;

    setPosting(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert([{
          user_id: user.id,
          tenant_id: activeTenant?.id,
          content: newPost.content,
          type: newPost.type,
          is_public: newPost.isPublic,
          metadata: newPost.type === 'resource' && newPost.linkUrl ? {
            link: newPost.linkUrl,
            link_title: newPost.linkTitle || newPost.linkUrl
          } : {}
        }])
        .select();

      if (error) throw error;

      setIsCreateModalOpen(false);
      setNewPost({ content: '', type: 'social', isPublic: false, linkUrl: '', linkTitle: '' });
      fetchPosts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (postId: string, currentlyLiked: boolean) => {
    if (!user) return;
    
    try {
      if (currentlyLiked) {
        await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
      }
      // Optimistic update
      setPosts(posts.map(p => p.id === postId ? { 
        ...p, 
        is_liked: !currentlyLiked, 
        likes_count: (p.likes_count || 0) + (currentlyLiked ? -1 : 1) 
      } : p));
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Community Hub</h2>
          <p className="text-slate-500 font-medium text-sm">Connect, share resources, and stay updated.</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" />
          Share Something
        </button>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 w-fit overflow-x-auto">
        {[
          { id: 'feed', icon: MessageSquare, label: 'Feed' },
          { id: 'resources', icon: BookOpen, label: 'Resources' },
          { id: 'news', icon: Newspaper, label: 'News' },
          { id: 'friends', icon: Users, label: 'Friends' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === tab.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Feed Content */}
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 animate-pulse space-y-4">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-100 rounded w-1/4" />
                    <div className="h-3 bg-slate-50 rounded w-1/6" />
                  </div>
                </div>
                <div className="h-20 bg-slate-50 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : activeTab === 'friends' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Find New Connections
              </h3>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    searchUsers(e.target.value);
                  }}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  {searchResults.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold overflow-hidden">
                          {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : u.full_name?.[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{u.full_name}</p>
                          <p className="text-xs text-slate-500 uppercase font-black tracking-widest">{u.role}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => sendFriendRequest(u.id)}
                        className="bg-indigo-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
                      >
                        Add Friend
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {requests.length > 0 && (
              <div className="bg-amber-50/30 p-6 rounded-3xl border border-amber-200/50">
                <h3 className="font-bold text-amber-900 mb-4 flex items-center gap-2 text-sm italic">
                  Friend Requests ({requests.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {requests.map(r => (
                    <div key={r.id} className="bg-white p-4 rounded-2xl border border-amber-200 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 font-bold">
                          {r.profiles?.full_name?.[0]}
                        </div>
                        <p className="font-bold text-slate-900 text-sm">{r.profiles?.full_name}</p>
                      </div>
                      <button 
                        onClick={() => acceptRequest(r.id)}
                        className="bg-emerald-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all"
                      >
                        Accept
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-3xl border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                My Connections ({friends.length})
              </h3>
              {friends.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-sm italic">No connections yet. Start searching above!</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {friends.map(f => {
                    const friend = f.friend_id === user?.id ? f.user_id : f.friend_id; 
                    // Profiles joined as friend_id in the simple select, might need adjustment for bidirectional
                    return (
                      <div key={f.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center text-center group hover:bg-white hover:shadow-md transition-all">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl mb-3 shadow-inner">
                          {f.profiles?.full_name?.[0]}
                        </div>
                        <h4 className="font-bold text-slate-900 truncate w-full">{f.profiles?.full_name}</h4>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Connection</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center">
            <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900">No posts yet</h3>
            <p className="text-slate-500 mt-2">Beb the first to share something with the community!</p>
          </div>
        ) : (
          posts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Post Header */}
              <div className="p-6 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold overflow-hidden border border-slate-100">
                    {post.author_avatar ? (
                      <img src={post.author_avatar} alt={post.author_name} className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      {post.author_name || 'Anonymous'}
                      {post.type === 'resource' && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] uppercase font-black tracking-widest leading-none">Resource</span>
                      )}
                      {post.type === 'news' && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] uppercase font-black tracking-widest leading-none">News</span>
                      )}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                      <span>{new Date(post.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      {post.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
                <button className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>

              {/* Post Content */}
              <div className="px-6 pb-6">
                <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                {post.metadata?.link && (
                  <a 
                    href={post.metadata.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:bg-slate-100 transition-all"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                      <LinkIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{post.metadata.link_title || post.metadata.link}</p>
                      <p className="text-xs text-slate-500 truncate">{post.metadata.link}</p>
                    </div>
                  </a>
                )}
              </div>

              {/* Post Actions */}
              <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => toggleLike(post.id, post.is_liked || false)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                      post.is_liked ? "text-rose-600 bg-rose-50" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <Heart className={cn("w-4 h-4", post.is_liked && "fill-current")} />
                    {post.likes_count || 0}
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all">
                    <MessageSquare className="w-4 h-4" />
                    {post.comments_count || 0}
                  </button>
                </div>
                <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Post Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 border border-slate-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Create Post</h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <Plus className="w-5 h-5 text-slate-400 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleCreatePost} className="space-y-6">
                <div>
                  <textarea
                    placeholder="What's on your mind?"
                    value={newPost.content}
                    onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none text-slate-800"
                    required
                  />
                </div>

                {newPost.type === 'resource' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 pt-2"
                  >
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="url"
                        placeholder="Resource Link (URL)"
                        value={newPost.linkUrl}
                        onChange={(e) => setNewPost({ ...newPost, linkUrl: e.target.value })}
                        className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Resource Title (optional)"
                      value={newPost.linkTitle}
                      onChange={(e) => setNewPost({ ...newPost, linkTitle: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                    />
                  </motion.div>
                )}

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setNewPost({ ...newPost, type: 'social' })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                        newPost.type === 'social' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Social
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPost({ ...newPost, type: 'resource' })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                        newPost.type === 'resource' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Resource
                    </button>
                    {(user?.role === 'super_admin' || user?.role === 'school_admin') && (
                      <button
                        type="button"
                        onClick={() => setNewPost({ ...newPost, type: 'news' })}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                          newPost.type === 'news' ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        News
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setNewPost({ ...newPost, isPublic: !newPost.isPublic })}
                    className={cn(
                      "flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold border transition-all",
                      newPost.isPublic 
                        ? "bg-slate-900 text-white border-slate-900" 
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {newPost.isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    {newPost.isPublic ? 'Public' : 'Tenant Only'}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button type="button" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    <button type="button" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                      <LinkIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={posting || !newPost.content.trim()}
                    className="bg-indigo-600 text-white px-8 py-2.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                  >
                    {posting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Post
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
