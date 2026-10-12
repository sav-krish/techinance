// @ts-check

const POST_COLUMNS = "id, slug, title, author_name, author_role, excerpt, body, published_at, updated_at";

/**
 * The database client is injected to keep this module independently testable.
 * RLS remains the authority: these client filters help the public page avoid
 * needless future rows but never grant access to a visitor.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient | null} db
 * @param {Date} [now]
 */
export async function fetchPublishedBlogPosts(db, now = new Date()) {
  if (!db) {
    return { ok: false, posts: [], error: "The blog service is temporarily unavailable." };
  }
  try {
    const { data, error } = await db
      .from("blog_posts")
      .select(POST_COLUMNS)
      .lte("published_at", now.toISOString())
      .order("published_at", { ascending: false });
    return error
      ? { ok: false, posts: [], error: "We couldn't load newer blog posts right now." }
      : { ok: true, posts: data ?? [], error: "" };
  } catch {
    return { ok: false, posts: [], error: "We couldn't load newer blog posts right now." };
  }
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient | null} db
 */
export async function fetchEditableBlogPosts(db) {
  if (!db) {
    return { ok: false, posts: [], error: "The editor service is temporarily unavailable." };
  }
  try {
    const { data, error } = await db
      .from("blog_posts")
      .select(POST_COLUMNS)
      .order("updated_at", { ascending: false });
    return error
      ? { ok: false, posts: [], error: "We couldn't load the editor posts right now." }
      : { ok: true, posts: data ?? [], error: "" };
  } catch {
    return { ok: false, posts: [], error: "We couldn't load the editor posts right now." };
  }
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient | null} db
 */
export async function checkBlogEditor(db) {
  if (!db) {
    return { ok: false, isEditor: false, error: "The editor service is temporarily unavailable." };
  }
  try {
    const { data, error } = await db.rpc("is_blog_editor");
    return error
      ? { ok: false, isEditor: false, error: "We couldn't verify editing access." }
      : { ok: true, isEditor: data === true, error: "" };
  } catch {
    return { ok: false, isEditor: false, error: "We couldn't verify editing access." };
  }
}

/**
 * @param {{ title: string, slug: string, authorName: string, authorRole: string, excerpt: string, body: string, publishedAt: string }} draft
 * @param {boolean} publish
 */
function toWritablePost(draft, publish) {
  return {
    title: draft.title,
    slug: draft.slug,
    author_name: draft.authorName,
    author_role: draft.authorRole,
    excerpt: draft.excerpt,
    body: draft.body,
    published_at: publish ? draft.publishedAt : null,
  };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient | null} db
 * @param {{ title: string, slug: string, authorName: string, authorRole: string, excerpt: string, body: string, publishedAt: string }} draft
 * @param {{ id?: string, publish?: boolean }} [options]
 */
export async function saveBlogPost(db, draft, options = {}) {
  if (!db) {
    return { ok: false, post: null, error: "The editor service is temporarily unavailable." };
  }
  const row = toWritablePost(draft, options.publish !== false);
  try {
    const table = db.from("blog_posts");
    const query = options.id ? table.update(row).eq("id", options.id) : table.insert(row);
    const { data, error } = await query.select(POST_COLUMNS).single();
    return error
      ? { ok: false, post: null, error: "We couldn't save this post. Its title may already be in use." }
      : { ok: true, post: data, error: "" };
  } catch {
    return { ok: false, post: null, error: "We couldn't save this post. Please try again." };
  }
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient | null} db
 * @param {string} id
 */
export async function deleteBlogPost(db, id) {
  if (!db || !id) {
    return { ok: false, error: "The editor service is temporarily unavailable." };
  }
  try {
    const { error } = await db.from("blog_posts").delete().eq("id", id);
    return error
      ? { ok: false, error: "We couldn't delete this post." }
      : { ok: true, error: "" };
  } catch {
    return { ok: false, error: "We couldn't delete this post." };
  }
}
