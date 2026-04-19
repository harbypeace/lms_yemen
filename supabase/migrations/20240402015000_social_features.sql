-- Social and Community Features

-- Posts table for News, Resources, and Social updates
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'social' CHECK (type IN ('social', 'resource', 'news')),
  metadata JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Comments on posts
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Likes on posts
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Policies for Posts
CREATE POLICY "Posts visibility" ON public.posts
  FOR SELECT USING (
    is_public = true OR 
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.memberships 
      WHERE user_id = auth.uid() AND tenant_id = public.posts.tenant_id
    )
  );

CREATE POLICY "Anyone in tenant can create posts" ON public.posts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      tenant_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.memberships 
        WHERE user_id = auth.uid() AND tenant_id = public.posts.tenant_id
      )
    )
  );

CREATE POLICY "Owners can update posts" ON public.posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete posts" ON public.posts
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for Comments
CREATE POLICY "Comments visibility" ON public.comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.posts WHERE id = post_id)
  );

CREATE POLICY "Auth users can comment" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for Likes
CREATE POLICY "Likes visibility" ON public.likes
  FOR SELECT USING (true);

CREATE POLICY "Auth users can like" ON public.likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth users can unlike" ON public.likes
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for Friendships
CREATE POLICY "Friendships visibility" ON public.friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Friendships insert" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Friendships update" ON public.friendships
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Create views for easier querying
CREATE OR REPLACE VIEW public.post_details AS
SELECT 
  p.*,
  pr.full_name as author_name,
  pr.avatar_url as author_avatar,
  (SELECT count(*) FROM public.comments c WHERE c.post_id = p.id) as comments_count,
  (SELECT count(*) FROM public.likes l WHERE l.post_id = p.id) as likes_count,
  EXISTS (SELECT 1 FROM public.likes l WHERE l.post_id = p.id AND l.user_id = auth.uid()) as is_liked
FROM public.posts p
LEFT JOIN public.profiles pr ON p.user_id = pr.id;
