// Shared Supabase client + data helpers for index.html and admin.html.
// The publishable/anon key below is meant to be public — Row Level Security
// on the `projects` table is what actually restricts writes to logged-in users.
const SUPABASE_URL = 'https://kprjooqdhyhfynrgwnju.supabase.co';
const SUPABASE_KEY = 'sb_publishable_PhzmiAEfm-Sd4gRgebWD0g_rFfbhHdB';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchProjects() {
  const { data, error } = await sb
    .from('projects')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) {
    console.error('Failed to load projects:', error.message);
    return null;
  }
  return data;
}

function extractYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{6,})/);
  return match ? match[1] : null;
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

async function createProject(project) {
  return sb.from('projects').insert(project).select().single();
}

async function updateProject(id, updates) {
  return sb.from('projects').update(updates).eq('id', id).select().single();
}

async function deleteProject(id) {
  return sb.from('projects').delete().eq('id', id);
}
