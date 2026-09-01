import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobile = (...parts) => path.join(root, 'apps', 'mobile', ...parts);
const read = (...parts) => readFile(mobile(...parts), 'utf8');

test('native companion is an Expo 57 app with the branded deep-link boundary', async () => {
  const [pkg, app] = await Promise.all([
    read('package.json').then(JSON.parse),
    read('app.json').then(JSON.parse),
  ]);
  assert.match(pkg.dependencies.expo, /^~57\./);
  assert.match(pkg.dependencies['expo-router'], /^~57\./);
  assert.equal(app.expo.name, 'AliaSpaces');
  assert.equal(app.expo.scheme, 'aliaspaces');
  assert.ok(app.expo.plugins.some((plugin) => plugin === 'expo-secure-store'));
  assert.ok(app.expo.plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-web-browser'));
});

test('mobile configuration accepts only public client values and commits no secret', async () => {
  const [example, config, nativeClient, readme, ignore] = await Promise.all([
    read('.env.example'),
    read('src', 'lib', 'config.ts'),
    read('src', 'lib', 'supabase.ts'),
    read('README.md'),
    read('.gitignore'),
  ]);
  assert.match(example, /^EXPO_PUBLIC_SUPABASE_URL=\s*$/m);
  assert.match(example, /^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\s*$/m);
  assert.doesNotMatch(example, /service[_-]?role|secret\s*=/i);
  assert.match(config, /EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(nativeClient, /chunkedSecureStore/);
  assert.doesNotMatch(nativeClient, /service[_-]?role/i);
  assert.match(readme, /never contains a service-role key/i);
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^!\.env\.example$/m);
});

test('native session storage chunks large values inside SecureStore', async () => {
  const storage = await read('src', 'lib', 'secure-store.ts');
  assert.match(storage, /const CHUNK_SIZE = 1800/);
  assert.match(storage, /SecureStore\.setItemAsync\(chunkKey/);
  assert.match(storage, /SecureStore\.WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
  assert.doesNotMatch(storage, /AsyncStorage/);
});

test('native chat uses owner workspaces and the guarded AI contract', async () => {
  const chat = await read('src', 'app', '(tabs)', 'chat.tsx');
  assert.match(chat, /rpc\('my_personas'\)/);
  assert.match(chat, /from\('chat_workspaces'\)/);
  assert.match(chat, /rpc\('append_agent_messages'/);
  assert.match(chat, /functions\/v1\/ai-proxy/);
  assert.match(chat, /mode: 'owner_chat'/);
  assert.match(chat, /may use billing on the AI model/i);
  assert.match(chat, /personaIdRef\.current/);
  assert.match(chat, /workspaceIdRef\.current/);
  assert.doesNotMatch(chat, /service[_-]?role/i);
});

test('every native web handoff validates the scheme and reports open failures', async () => {
  const [links, ui, welcome, approvals, feed] = await Promise.all([
    read('src', 'lib', 'external-links.ts'),
    read('src', 'components', 'ui.tsx'),
    read('src', 'app', 'index.tsx'),
    read('src', 'app', '(tabs)', 'approvals.tsx'),
    read('src', 'app', '(tabs)', 'feed.tsx'),
  ]);
  assert.match(links, /parsed\.protocol !== 'https:'/);
  assert.match(links, /Linking\.canOpenURL/);
  assert.match(links, /Alert\.alert\('Could not open link'/);
  for (const consumer of [ui, welcome, approvals, feed]) {
    assert.match(consumer, /openExternalUrl/);
    assert.doesNotMatch(consumer, /Linking\.openURL/);
  }
});

test('native approval inventory cannot schedule, send, or publish', async () => {
  const approvals = await read('src', 'app', '(tabs)', 'approvals.tsx');
  assert.match(approvals, /from\('post_drafts'\)/);
  assert.match(approvals, /No Approve, Schedule, Send, or Publish control is exposed/);
  assert.match(approvals, /Open exact web review/);
  assert.doesNotMatch(approvals, /approve-post-draft|prepare-schedule|commit-schedule|run-post-queue/);
  assert.doesNotMatch(approvals, /\.from\('post_drafts'\)[\s\S]{0,400}\.(?:insert|update|upsert|delete)\(/);
});

test('native feed exposes stored brief evidence without inventing feed items', async () => {
  const feed = await read('src', 'app', '(tabs)', 'feed.tsx');
  assert.match(feed, /from\('persona_research_briefs'\)/);
  assert.match(feed, /url\.protocol === 'https:' \|\| url\.protocol === 'http:'/);
  assert.match(feed, /dedicated ranked feed pipeline remains a later backend release/i);
  assert.doesNotMatch(feed, /from\('feed_items'\)/);
});
