# Examples

## Complete Blog Example

```typescript
// Define tables with relations
const usersTable = defineTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull(),
  email: varchar('email').unique(),
  posts: hasMany(postsTable, 'user_id', 'id', 'all'),
  profile: hasOne(profilesTable, 'user_id', 'id', 'persist')
});

const postsTable = defineTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title').notNull(),
  content: text('content'),
  published: boolean('published').default(false),
  user_id: integer('user_id').notNull(),
  author: belongsTo(usersTable, 'user_id'),
  comments: hasMany(commentsTable, 'post_id', 'id', 'all'),
  tags: belongsToMany(tagsTable, postsTagsTable, {
    pivotForeignKeyToRoot: 'post_id',
    pivotForeignKeyToTarget: 'tag_id'
  })
});

const profilesTable = defineTable('profiles', {
  id: serial('id').primaryKey(),
  bio: text('bio'),
  avatar_url: varchar('avatar_url'),
  user_id: integer('user_id').unique(),
  user: belongsTo(usersTable, 'user_id')
});

const commentsTable = defineTable('comments', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  post_id: integer('post_id').notNull(),
  author: belongsTo(usersTable, 'user_id'),
  post: belongsTo(postsTable, 'post_id')
});

const tagsTable = defineTable('tags', {
  id: serial('id').primaryKey(),
  name: varchar('name').unique(),
  posts: belongsToMany(postsTable, postsTagsTable, {
    pivotForeignKeyToRoot: 'tag_id',
    pivotForeignKeyToTarget: 'post_id'
  })
});

const postsTagsTable = defineTable('posts_tags', {
  post_id: integer('post_id').notNull(),
  tag_id: integer('tag_id').notNull(),
  created_at: timestamp('created_at').defaultNow()
});

// Query examples
const getUserWithPosts = async (userId: number) => {
  return await orm
    .select(usersTable)
    .include('posts', {
      include: ['comments', 'tags']
    })
    .where({ id: userId })
    .execute();
};

const getPublishedPostsWithAuthors = async () => {
  return await orm
    .select(postsTable)
    .include('author', {
      columns: ['id', 'name', 'email']
    })
    .include('tags')
    .where({ published: true })
    .orderBy('created_at', 'DESC')
    .execute();
};

const createUserWithProfile = async (userData: any) => {
  return await orm.transaction(async (trx) => {
    const user = await trx.create(usersTable, {
      name: userData.name,
      email: userData.email
    });
    
    await user.profile.set({
      bio: userData.bio,
      avatar_url: userData.avatarUrl
    });
    
    return user;
  });
};

// Entity manipulation examples
const addCommentToPost = async (postId: number, userId: number, content: string) => {
  const post = await orm.findOne(postsTable, postId);
  if (!post) throw new Error('Post not found');
  
  const user = await orm.findOne(usersTable, userId);
  if (!user) throw new Error('User not found');
  
  const comment = post.comments.add({
    content,
    author: user
  });
  
  await orm.flush();
  return comment;
};

const updateUserRoles = async (userId: number, roleIds: number[]) => {
  const user = await orm.findOne(usersTable, userId);
  if (!user) throw new Error('User not found');
  
  await user.roles.syncByIds(roleIds);
  await orm.flush();
};
```

## Social Media Example

```typescript
// User relationships and activities
const usersTable = defineTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username').unique(),
  followers: belongsToMany(usersTable, followersTable, {
    pivotForeignKeyToRoot: 'following_id',
    pivotForeignKeyToTarget: 'follower_id'
  }),
  following: belongsToMany(usersTable, followersTable, {
    pivotForeignKeyToRoot: 'follower_id',
    pivotForeignKeyToTarget: 'following_id'
  }),
  posts: hasMany(postsTable, 'user_id', 'id', 'all'),
  likedPosts: belongsToMany(postsTable, postLikesTable, {
    pivotForeignKeyToRoot: 'user_id',
    pivotForeignKeyToTarget: 'post_id'
  })
});

const followersTable = defineTable('followers', {
  follower_id: integer('follower_id').notNull(),
  following_id: integer('following_id').notNull(),
  created_at: timestamp('created_at').defaultNow()
});

const postsTable = defineTable('posts', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  user_id: integer('user_id').notNull(),
  author: belongsTo(usersTable, 'user_id'),
  likes: hasMany(postLikesTable, 'post_id', 'id', 'all'),
  likedBy: belongsToMany(usersTable, postLikesTable, {
    pivotForeignKeyToRoot: 'post_id',
    pivotForeignKeyToTarget: 'user_id'
  })
});

const postLikesTable = defineTable('post_likes', {
  post_id: integer('post_id').notNull(),
  user_id: integer('user_id').notNull(),
  created_at: timestamp('created_at').defaultNow()
});

// Complex queries
const getUserFeed = async (userId: number) => {
  return await orm
    .select(postsTable)
    .where(in(
      'user_id',
      orm.select(followersTable)
        .select('following_id')
        .where({ follower_id: userId })
    ))
    .include('author', {
      columns: ['id', 'username']
    })
    .include('likedBy', {
      columns: ['id', 'username']
    })
    .orderBy('created_at', 'DESC')
    .execute();
};

const followUser = async (followerId: number, followingId: number) => {
  const follower = await orm.findOne(usersTable, followerId);
  await follower.following.attach(followingId);
  await orm.flush();
};

const likePost = async (userId: number, postId: number) => {
  const post = await orm.findOne(postsTable, postId);
  await post.likedBy.attach(userId);
  await orm.flush();
};