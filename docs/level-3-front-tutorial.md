# Level 3 Tutorial: Frontend Client for the Decorator API

This guide shows how to build a React front-end that consumes the Level 3 backend API (users, posts, tags) and that covers full CRUD: list posts, create new content, update existing posts, delete posts, and publish them when ready. The client keeps HTTP concerns confined to the browser while the Level 3 decorators handle authoritative data modeling on the backend.

## 1) Prereqs

- Node 18+
- A running backend from the Level 3 backend tutorial (default at `http://localhost:3000`)
- The backend exposes `GET /posts`, `POST /posts`, `PATCH /posts/:id`, `DELETE /posts/:id`, and `POST /posts/:id/publish`. Extend `blog-service.ts` and your Express wiring with `updatePost`/`deletePost` helpers before wiring the client if you skipped those routes earlier.

## 2) Bootstrap a React app

```bash
npm create vite@latest blog-frontend -- --template react-ts
cd blog-frontend
npm install
```

## 3) Configure the API base URL

Create `.env.local` and point the client at your backend URL:

```
# .env.local
VITE_API_BASE_URL=http://localhost:3000
```

Vite exposes environment variables that start with `VITE_`, so you can swap the value without changing source code when the API runs elsewhere.

## 4) Install client utilities

```bash
npm install @tanstack/react-query zod
```

`@tanstack/react-query` provides caching, loading/pending state, and invalidation helpers. `zod` is optional but handy if you want runtime validation for responses before the UI sees them.

## 5) Minimal API client

`src/api/client.ts` should expose every CRUD operation via the same helper you use for publishing:

```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
  getPost: (id: string) => request<Post>(`/posts/${id}`),
  createPost: (input: CreatePostInput) =>
    request<Post>('/posts', { method: 'POST', body: JSON.stringify(input) }),
  updatePost: (id: string, input: UpdatePostInput) =>
    request<Post>(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deletePost: (id: string) => request<void>(`/posts/${id}`, { method: 'DELETE' }),
  publishPost: (id: string) =>
    request<Post>(`/posts/${id}/publish`, { method: 'POST' }),
};

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

export interface UpdatePostInput {
  title?: string;
  body?: string;
  tagIds?: string[];
}
```

The client expects the backend to honor `PATCH /posts/:id` and `DELETE /posts/:id`, so add those routes in `server.ts` and the supporting service functions if they are not yet there.

## 6) Query hooks with React Query

`src/api/hooks.ts` wires each endpoint to a hook that stays in sync with React Query's cache:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, CreatePostInput, UpdatePostInput } from './client';

const POSTS_QUERY_KEY = ['posts'];

export const usePosts = () =>
  useQuery({ queryKey: POSTS_QUERY_KEY, queryFn: api.listPosts });

export const useCreatePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => api.createPost(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTS_QUERY_KEY }),
  });
};

export const useUpdatePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePostInput }) =>
      api.updatePost(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTS_QUERY_KEY }),
  });
};

export const useDeletePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTS_QUERY_KEY }),
  });
};

export const usePublishPost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.publishPost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTS_QUERY_KEY }),
  });
};
```

Invalidating `['posts']` after every mutation keeps the list view fresh after creates, updates, deletes, or publishes.

## 7) Wire the provider

Wrap the app with `QueryClientProvider` so that every hook can access the shared cache:

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

## 8) Build CRUD UI

Use a single page to list posts, create a new post, edit inline, delete, and publish. `usePosts` drives the list while the mutation hooks attach to each action:

`src/App.tsx`:

```tsx
import { useState } from 'react';
import type { Post } from './api/client';
import {
  usePosts,
  useCreatePost,
  useUpdatePost,
  useDeletePost,
  usePublishPost,
} from './api/hooks';

const blankForm = { title: '', body: '', authorId: 'demo-author-id' };

export default function App() {
  const { data: posts, isLoading, error } = usePosts();
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();
  const publishPost = usePublishPost();
  const [form, setForm] = useState(blankForm);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPayload, setEditingPayload] = useState({ title: '', body: '' });

  const startEditing = (post: Post) => {
    setEditingPostId(post.id);
    setEditingPayload({ title: post.title, body: post.body });
  };

  const cancelEditing = () => setEditingPostId(null);

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    createPost.mutate(form);
    setForm(blankForm);
  };

  const handleUpdate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingPostId) return;
    updatePost.mutate({
      id: editingPostId,
      input: { title: editingPayload.title, body: editingPayload.body },
    });
    setEditingPostId(null);
  };

  if (isLoading) return <div>Loading posts...</div>;
  if (error) return <div>Error: {(error as Error).message}</div>;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '2rem' }}>
      <h1>Blog Posts</h1>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Create a post</h2>
        <form
          onSubmit={handleCreate}
          style={{ display: 'grid', gap: '0.5rem', maxWidth: 540 }}
        >
          <input
            placeholder="Title"
            value={form.title}
            onChange={event => setForm({ ...form, title: event.target.value })}
            required
          />
          <textarea
            placeholder="Body"
            value={form.body}
            onChange={event => setForm({ ...form, body: event.target.value })}
            rows={4}
            required
          />
          <button type="submit" disabled={createPost.isPending}>
            {createPost.isPending ? 'Creating...' : 'Create post'}
          </button>
        </form>
        <p style={{ marginTop: '0.75rem', color: '#666' }}>
          Replace the demo author ID when you hook authentication into the backend.
        </p>
      </section>

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '1rem' }}>
        {posts?.map(post => (
          <li
            key={post.id}
            style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: 6 }}
          >
            <header style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>{post.title}</h3>
              <span style={{ color: post.published ? 'green' : '#444' }}>
                {post.published ? 'Published' : 'Draft'}
              </span>
            </header>
            <p style={{ color: '#444' }}>{post.body}</p>
            <p style={{ color: '#666', marginBottom: '0.5rem' }}>
              By {post.author.name} | Tags: {post.tags.map(tag => tag.name).join(', ')}
            </p>

            {editingPostId === post.id ? (
              <form
                onSubmit={handleUpdate}
                style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.75rem' }}
              >
                <input
                  value={editingPayload.title}
                  onChange={event =>
                    setEditingPayload({ ...editingPayload, title: event.target.value })
                  }
                  required
                />
                <textarea
                  rows={3}
                  value={editingPayload.body}
                  onChange={event =>
                    setEditingPayload({ ...editingPayload, body: event.target.value })
                  }
                  required
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" disabled={updatePost.isPending}>
                    Save changes
                  </button>
                  <button type="button" onClick={cancelEditing}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => startEditing(post)}>Edit</button>
                <button
                  onClick={() => deletePost.mutate(post.id)}
                  disabled={deletePost.isPending}
                >
                  Delete
                </button>
                {!post.published && (
                  <button
                    onClick={() => publishPost.mutate(post.id)}
                    disabled={publishPost.isPending}
                  >
                    {publishPost.isPending ? 'Publishing...' : 'Publish'}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

The example keeps editing local to the list card, so you can toggle an inline form, save changes via `useUpdatePost`, cancel edits, or delete a post directly. Every mutation invalidates `['posts']` so the list refreshes automatically.

## 9) Run it

```bash
npm run dev
```

Visit `http://localhost:5173` (Vite's default) and exercise every CRUD action against your Level 3 backend. Adjust `.env.local` if the API runs on a different host or port.
