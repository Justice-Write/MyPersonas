import path from 'node:path';
import {realpath} from 'node:fs/promises';

export function insideRoot(root, target, paths = path) {
  const relative = paths.relative(paths.resolve(root), paths.resolve(target));
  return relative !== '' && !paths.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + paths.sep);
}

export async function fixturePath(root, pathname) {
  try {
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
    if (!insideRoot(root, target)) return null;
    const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(target)]);
    return insideRoot(realRoot, realTarget) ? realTarget : null;
  } catch { return null; }
}
