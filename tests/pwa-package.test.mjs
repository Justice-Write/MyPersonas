import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = path.join(repoRoot, "MyPersonas.Online_v0");
const publicIconSources = new Map([
  ["favicon.ico", "brand/app-icon/favicon.ico"],
  ["icon.svg", "brand/app-icon/icon.svg"],
  ["icon-180.png", "brand/app-icon/icon-180.png"],
  ["icon-192.png", "brand/app-icon/icon-192.png"],
  ["icon-512.png", "brand/app-icon/icon-512.png"],
  ["icon-maskable-512.png", "brand/app-icon/icon-maskable-512.png"]
]);

async function readSiteFile(relativePath) {
  return readFile(path.join(siteRoot, relativePath), "utf8");
}

function assertRelativeSitePath(value, label) {
  assert.match(value, /^\.\//, `${label} must use a GitHub Pages-safe relative URL`);
  assert.doesNotMatch(value, /^(?:\/|https?:|data:)/i, `${label} must not be root-relative or remote`);
}

function pngDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("public icon mirrors are exact, valid copies of the approved brand set", async () => {
  for (const [publicPath, sourcePath] of publicIconSources) {
    const [publicBytes, sourceBytes] = await Promise.all([
      readFile(path.join(siteRoot, publicPath)),
      readFile(path.join(siteRoot, sourcePath))
    ]);
    assert.deepEqual(publicBytes, sourceBytes, `${publicPath} must match ${sourcePath}`);
  }

  assert.deepEqual(
    [...(await readFile(path.join(siteRoot, "favicon.ico"))).subarray(0, 4)],
    [0, 0, 1, 0],
    "favicon.ico must be a Windows icon file"
  );
  const svg = await readSiteFile("icon.svg");
  assert.match(svg, /^<svg\b/);
  assert.doesNotMatch(svg, /<script\b/i);
  assert.doesNotMatch(svg, /(?:href|xlink:href)=["']https?:\/\//i);
});

test("manifest uses scoped relative routes and complete brand icons", async () => {
  const manifest = JSON.parse(await readSiteFile("manifest.webmanifest"));
  assert.equal(manifest.id, "./");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.prefer_related_applications, false);

  const expectedDimensions = new Map([
    ["./icon-192.png", { width: 192, height: 192 }],
    ["./icon-512.png", { width: 512, height: 512 }],
    ["./icon-maskable-512.png", { width: 512, height: 512 }]
  ]);

  for (const icon of manifest.icons) {
    assertRelativeSitePath(icon.src, `manifest icon ${icon.src}`);
    const fullPath = path.join(siteRoot, icon.src.slice(2));
    await access(fullPath);
    assert.deepEqual(pngDimensions(await readFile(fullPath)), expectedDimensions.get(icon.src));
  }

  assert.deepEqual(new Set(manifest.icons.map((icon) => icon.src)), new Set(expectedDimensions.keys()));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
  assert.deepEqual(
    pngDimensions(await readFile(path.join(siteRoot, "icon-180.png"))),
    { width: 180, height: 180 }
  );

  for (const shortcut of manifest.shortcuts) {
    assertRelativeSitePath(shortcut.url, `shortcut ${shortcut.name}`);
    assert.match(shortcut.url, /^\.\/(?:#\/|sites\.html$)/);
    assert.deepEqual(shortcut.icons, [{
      src: "./icon-192.png",
      sizes: "192x192",
      type: "image/png"
    }]);
  }
  assert.ok(
    manifest.shortcuts.some((shortcut) => shortcut.url === "./sites.html"),
    "manifest must expose the public sites/apps checklist"
  );
});

test("service worker precaches only existing public shell files", async () => {
  const source = await readSiteFile("service-worker.js");
  const list = source.match(/const PUBLIC_SHELL_PATHS = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(list, "PUBLIC_SHELL_PATHS allowlist was not found");

  const paths = [...list[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(paths.includes("./offline.html"));
  assert.ok(paths.includes("./sites.html"));
  assert.ok(paths.includes("./manifest.webmanifest"));
  assert.ok(!paths.includes("./index.html"), "signed-in application HTML must not be precached");

  for (const relativePath of paths) {
    assertRelativeSitePath(relativePath, `cached file ${relativePath}`);
    assert.doesNotMatch(relativePath, /(?:supabase|api|auth|persona|upload)/i);
    await access(path.join(siteRoot, relativePath.slice(2)));
  }

  assert.doesNotMatch(source, /skipWaiting\s*\(/, "updates must not replace a live app session");
  assert.doesNotMatch(source, /cache\.put\s*\(/, "runtime responses must not enter Cache Storage");
  assert.match(source, /request\.mode === "navigate"/);
  assert.match(source, /requestUrl\.origin !== SCOPE_URL\.origin/);
});

test("offline fallback is public, relative, and explicitly non-mutating", async () => {
  const html = await readSiteFile("offline.html");
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /href="\.\/manifest\.webmanifest"/);
  assert.match(html, /src="\.\/icon\.svg"/);
  assert.match(html, /does not store authenticated API responses or private persona data/i);
  assert.match(html, /cannot publish, approve, or change anything/i);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test("install helper registers a path-relative worker without synthetic push state", async () => {
  const source = await readSiteFile("pwa.js");
  assert.match(source, /new URL\("\.\/service-worker\.js", document\.baseURI\)/);
  assert.match(source, /updateViaCache: "none"/);
  assert.match(source, /beforeinstallprompt/);
  assert.match(source, /aria-live/);
  assert.match(source, /const isAndroidWebView = \/\(\?:;\\s\*wv\\\)\|\\bwv\\b\)\/i/);
  assert.match(source, /const isAndroidBrowser = \/Android\/i\.test\(navigator\.userAgent\) && !isAndroidWebView/);
  assert.match(source, /Install app or Add to Home screen/);
  assert.match(source, /does not post or request notification permission/);
  assert.doesNotMatch(source, /PushManager|pushManager|Notification\.requestPermission|subscribe\s*\(/);
});

test("Android install help appears in browsers but stays out of the native WebView", async () => {
  const source = await readSiteFile("pwa.js");

  function runInstallHelper(userAgent) {
    const elements = new Map();
    const windowListeners = new Map();
    const mount = {
      insertBefore(node) {
        node.isConnected = true;
        node.parentNode = this;
        elements.set(node.id, node);
      }
    };
    const navigator = {
      userAgent,
      platform: "Linux armv8l",
      maxTouchPoints: 0
    };
    const window = {
      navigator,
      matchMedia: () => ({ matches: false }),
      addEventListener(type, listener) {
        const listeners = windowListeners.get(type) || [];
        listeners.push(listener);
        windowListeners.set(type, listeners);
      },
      clearTimeout() {},
      setTimeout() { return 1; }
    };
    const document = {
      baseURI: "https://example.test/",
      body: mount,
      querySelector(selector) {
        return selector === "header nav" ? mount : null;
      },
      getElementById(id) {
        return elements.get(id) || null;
      },
      createElement(tagName) {
        const listeners = new Map();
        return {
          tagName: tagName.toUpperCase(),
          hidden: false,
          style: {},
          isConnected: false,
          setAttribute(name, value) { this[name] = value; },
          addEventListener(type, listener) { listeners.set(type, listener); },
          listeners
        };
      }
    };

    vm.runInNewContext(source, {
      URL,
      console,
      document,
      location: {
        protocol: "https:",
        hostname: "example.test",
        origin: "https://example.test"
      },
      navigator,
      window
    });

    return { elements, windowListeners };
  }

  const chrome = runInstallHelper(
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36"
  );
  assert.equal(chrome.elements.get("pwaInstallButton")?.textContent, "Install help");
  assert.equal(chrome.elements.get("pwaInstallButton")?.hidden, false);

  const webView = runInstallHelper(
    "Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP4A; wv) AppleWebKit/537.36 Version/4.0 Chrome/141.0 Mobile Safari/537.36"
  );
  assert.equal(webView.elements.has("pwaInstallButton"), false);
  let prevented = false;
  webView.windowListeners.get("beforeinstallprompt")?.[0]?.({
    preventDefault() { prevented = true; }
  });
  assert.equal(prevented, false, "native WebView must ignore browser install prompts");
  assert.equal(webView.elements.has("pwaInstallButton"), false);
});

test("the app head and Pages artifact include the complete PWA shell", async () => {
  const [html, workflow] = await Promise.all([
    readSiteFile("index.html"),
    readFile(path.join(repoRoot, ".github/workflows/pages.yml"), "utf8")
  ]);

  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(html, /<link rel="icon" type="image\/x-icon" href="\.\/favicon\.ico" sizes="any">/);
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\.\/icon\.svg">/);
  assert.match(html, /<meta name="theme-color" content="#1877f2">/);
  assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="\.\/icon-180\.png">/);
  assert.match(html, /<script src="\.\/pwa\.js" defer><\/script>/);

  for (const releasePath of [
    "/assets/",
    "/assets/***",
    "/favicon.ico",
    "/icon.svg",
    "/icon-180.png",
    "/icon-192.png",
    "/icon-512.png",
    "/icon-maskable-512.png",
    "/manifest.webmanifest",
    "/service-worker.js",
    "/pwa.js",
    "/offline.html",
    "/sites.html",
    "/mobile-owner-workflow.js"
  ]) {
    assert.ok(workflow.includes(`--include '${releasePath}'`), `Pages artifact must include ${releasePath}`);
  }

  assert.doesNotMatch(
    workflow,
    /--include '\/brand(?:\/|')/,
    "Pages must publish only the curated root icon mirrors, not brand concepts or previews"
  );
});

test("public sites checklist is packaged, relative, privacy-bounded, and non-mutating", async () => {
  const html = await readSiteFile("sites.html");

  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
  assert.match(html, /href="\.\/manifest\.webmanifest"/);
  assert.match(html, /<script src="\.\/pwa\.js" defer><\/script>/);
  assert.match(html, /href="\.\/#\/owner"/);
  assert.match(html, /href="\.\/#\/studio"/);
  assert.match(html, /https:\/\/nooyouniverse\.com\//);
  assert.match(html, /does not sign in, publish, install software, request notification permission, or change owner data/i);
  assert.match(html, /Source-ready does not mean deployed, installed, store-approved, provider-accepted, or verified on this device/i);
  assert.match(html, /Install app[\s\S]*Add to Home screen/);
  assert.match(html, /provides no download or store-install link/i);
  assert.match(html, /Deployment, installation, provider acceptance, private data migration, and signed-in acceptance require separate evidence/i);

  assert.doesNotMatch(html, /apps\/personas-android|debug WebView|cloud agent/i);
  assert.doesNotMatch(html, /github\.com\/Justice-Write|[A-Z]:\\|\/Users\//i);
  assert.doesNotMatch(html, /Notification\.requestPermission|PushManager/i);

  const localReferences = [...html.matchAll(/(?:href|src)="(\.\/[^"#?]*)[^\"]*"/g)]
    .map((match) => match[1].slice(2))
    .filter(Boolean);
  for (const localReference of localReferences) {
    await access(path.join(siteRoot, localReference));
  }
});
