# Level 3 Tutorial: Frontend Client for the Decorator API

This guide shows how to build a React front-end that consumes the Level 3 backend API (users, posts, tags). It keeps HTTP concerns on the client and leaves all data modeling to the backend’s decorators.

## 1) Prereqs

- Node 18+
- A running backend from the Level 3 backend tutorial (default at `http://localhost:3000`)

## 2) Bootstrap a React app

```bash
npm create vite@latest blog-frontend -- --template react-ts
cd blog-frontend
npm install
```

Add environment config:

```
# .env.local
VITE_API_BASE_URL=http://localhost:3000
```

## 3) Install client utilities

```bash
npm install @tanstack/react-query zod
```

`react-query` handles caching/loading states; `zod` is optional for runtime response validation.

## 4) Minimal API client

`src/api/client.ts`:

```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  listPosts: () => request<Post[]>('/posts'),
  createPost: (input: CreatePostInput) =>
    request<Post>('/posts', { method: 'POST', body: JSON.stringify(input) }),
  publishPost: (id: string) =>
    request<Post>(`/posts/${id}/publish`, { method: 'POST' }),
};

// Minimal shapes (keep in sync with backend DTOs)
export interface Post {
  id: string;
  title: string;
  body: string;
  published: boolean;
  author: { id: string; email: string; name: string };
  tags: { id: string; name: string }[];
}

export interface CreatePostInput {
  title: string;
  body: string;
  authorId: string;
  tagIds?: string[];
}
```

## 5) Query hooks with React Query

`src/api/hooks.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, CreatePostInput } from './client';

export const usePosts = () =>
  useQuery({ queryKey: ['posts'], queryFn: api.listPosts });

export const useCreatePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => api.createPost(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts'] }),
  });
};

export const usePublishPost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.publishPost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts'] }),
  });
};
```

## 6) Wire the provider

`src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

const client = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

## 7) Build UI components

`src/App.tsx`:

```tsx
import { useState } from 'react';
import { usePosts, useCreatePost, usePublishPost } from './api/hooks';

export default function App() {
  const { data: posts, isLoading, error } = usePosts();
  const createPost = useCreatePost();
  const publishPost = usePublishPost();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  if (isLoading) return <div>Loading…</div>;
  if (error) return <div>Error: {(error as Error).message}</div>;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem' }}>
      <h1>Blog Posts</h1>

      <form
        onSubmit={e => {
          e.preventDefault();
          createPost.mutate({ title, body, authorId: 'demo-author-id' });
          setTitle('');
          setBody('');
        }}
        style={{ display: 'grid', gap: '0.5rem', marginBottom: '1.5rem' }}
      >
        <input
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
        />
        <textarea
          placeholder="Body"
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={4}
          required
        />
        <button type="submit" disabled={createPost.isPending}>
          {createPost.isPending ? 'Creating…' : 'Create Post'}
        </button>
      </form>

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '1rem' }}>
        {posts?.map(post => (
          <li key={post.id} style={{ border: '1px solid #ddd', padding: '1rem' }}>
            <h3>{post.title}</h3>
            <p>{post.body}</p>
            <p style={{ color: '#666' }}>
              By {post.author.name} · {post.tags.map(t => t.name).join(', ')}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {post.published ? (
                <span style={{ color: 'green' }}>Published</span>
              ) : (
                <button
                  onClick={() => publishPost.mutate(post.id)}
                  disabled={publishPost.isPending}
                >
                  {publishPost.isPending ? 'Publishing…' : 'Publish'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Replace `authorId: 'demo-author-id'` with a real ID from your backend. If you add authentication, inject a token into the fetch headers in `api/client.ts`.

## 8) Run it

```bash
npm run dev
```

Visit `http://localhost:5173` (default Vite dev server) and create/publish posts against your backend. Adjust the base URL in `.env.local` if your API runs elsewhere.
