import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;
const MAX_CHUNKS = 64;
const META_VERSION = 1;

type ChunkMeta = {
  version: number;
  generation: string;
  count: number;
};

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function metaKey(key: string) {
  return `${key}.chunk-meta`;
}

function chunkKey(key: string, generation: string, index: number) {
  return `${key}.chunk-${generation}-${index}`;
}

function parseMeta(value: string | null): ChunkMeta | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ChunkMeta>;
    if (
      parsed.version !== META_VERSION ||
      typeof parsed.generation !== 'string' ||
      !/^[a-z0-9-]{1,48}$/i.test(parsed.generation) ||
      !Number.isInteger(parsed.count) ||
      Number(parsed.count) < 1 ||
      Number(parsed.count) > MAX_CHUNKS
    ) {
      return null;
    }
    return parsed as ChunkMeta;
  } catch {
    return null;
  }
}

async function removeGeneration(key: string, meta: ChunkMeta | null) {
  if (!meta) return;
  await Promise.all(
    Array.from({ length: meta.count }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, meta.generation, index)),
    ),
  );
}

export const chunkedSecureStore = {
  async getItem(key: string) {
    const meta = parseMeta(await SecureStore.getItemAsync(metaKey(key)));
    if (!meta) return SecureStore.getItemAsync(key);

    const chunks = await Promise.all(
      Array.from({ length: meta.count }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, meta.generation, index)),
      ),
    );
    if (chunks.some((chunk) => chunk === null)) return null;
    return chunks.join('');
  },

  async setItem(key: string, value: string) {
    const oldMeta = parseMeta(await SecureStore.getItemAsync(metaKey(key)));
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gs')) ?? [''];
    if (chunks.length > MAX_CHUNKS) {
      throw new Error('The secure session is too large for device storage.');
    }

    const generation = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, generation, index), chunk, options),
      ),
    );
    await SecureStore.setItemAsync(
      metaKey(key),
      JSON.stringify({ version: META_VERSION, generation, count: chunks.length }),
      options,
    );
    await SecureStore.deleteItemAsync(key);
    await removeGeneration(key, oldMeta);
  },

  async removeItem(key: string) {
    const meta = parseMeta(await SecureStore.getItemAsync(metaKey(key)));
    await SecureStore.deleteItemAsync(metaKey(key));
    await SecureStore.deleteItemAsync(key);
    await removeGeneration(key, meta);
  },
};
