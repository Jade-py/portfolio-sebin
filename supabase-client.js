// Shared Supabase client + data helpers for index.html and admin.html.
// The publishable/anon key below is meant to be public — Row Level Security
// on each table is what actually restricts writes to logged-in users.
const SUPABASE_URL = 'https://kprjooqdhyhfynrgwnju.supabase.co';
const SUPABASE_KEY = 'sb_publishable_PhzmiAEfm-Sd4gRgebWD0g_rFfbhHdB';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function makeTable(name) {
  return {
    async fetchAll() {
      const { data, error } = await sb
        .from(name)
        .select('*')
        .order('display_order', { ascending: true });
      if (error) {
        console.error(`Failed to load ${name}:`, error.message);
        return null;
      }
      return data;
    },
    async create(row) {
      return sb.from(name).insert(row).select().single();
    },
    async update(id, updates) {
      return sb.from(name).update(updates).eq('id', id).select().single();
    },
    async remove(id) {
      return sb.from(name).delete().eq('id', id);
    },
  };
}

// Instagram reels, rendered as "Selected work" cards. Cover image is a
// manually supplied URL — Instagram has no public, unauthenticated
// thumbnail endpoint the way YouTube does.
const instagram = makeTable('instagram');

// YouTube videos, rendered in the "Stories in brief" timeline, with the
// thumbnail derived automatically from the video URL.
const youtube = makeTable('youtube');

function extractYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{6,})/);
  return match ? match[1] : null;
}

// Best-effort: pull a cover image + year for an Instagram URL via a public
// link-unfurling API, then re-host the image in Supabase Storage (Instagram's
// own CDN links are signed and expire after a few days, so we can't just
// store those directly). Returns { thumbnailUrl, year } on success, or
// { error } with a message to show the admin if any step fails.
async function fetchInstagramCover(instagramUrl) {
  let res;
  try {
    res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(instagramUrl)}`);
  } catch (err) {
    return { error: 'Could not reach the preview service.' };
  }
  if (res.status === 429) {
    return { error: "Hit today's auto-fetch limit (5/day) — try again tomorrow." };
  }
  const meta = await res.json();
  if (!res.ok || meta.status !== 'success' || !meta.data || !meta.data.image || !meta.data.image.url) {
    return { error: 'No cover image found for this link.' };
  }
  const year = meta.data.date ? String(new Date(meta.data.date).getFullYear()) : null;

  let blob;
  try {
    const imgRes = await fetch(meta.data.image.url);
    blob = await imgRes.blob();
  } catch (err) {
    return { error: 'Found the cover but could not download it.' };
  }

  const path = `${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await sb.storage
    .from('covers')
    .upload(path, blob, { contentType: blob.type || 'image/jpeg' });
  if (uploadError) {
    return { error: 'Found the cover but could not save it: ' + uploadError.message };
  }

  const { data: publicUrlData } = sb.storage.from('covers').getPublicUrl(path);
  return { thumbnailUrl: publicUrlData.publicUrl, year };
}

// YouTube's oEmbed endpoint is official, public, and needs no API key —
// but unlike the full Data API, it has no publish date, so only the title
// can be pulled this way. Returns { title } on success, or { error }.
async function fetchYouTubeTitle(youtubeUrl) {
  let res;
  try {
    res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`);
  } catch (err) {
    return { error: 'Could not reach YouTube.' };
  }
  if (!res.ok) {
    return { error: "Couldn't find that video — check the URL." };
  }
  const data = await res.json();
  return { title: data.title };
}

async function login(email, password) {
  return sb.auth.signInWithPassword({ email, password });
}

async function logout() {
  return sb.auth.signOut();
}

async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}
