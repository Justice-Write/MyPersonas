import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = path.join(repoRoot, "nooyouniverse.com");
const apex = "https://nooyouniverse.com";
const waitlistOrigin = "https://nwsqyuucwzihruszocge.supabase.co";
const primaryRoutes = new Map([
  ["/", "index.html"],
  ["/log", "log.html"],
  ["/sources", "sources.html"],
  ["/corrections", "corrections.html"],
]);
const expectedMissionIds = Array.from({ length: 11 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
const pageFiles = [...primaryRoutes.values(), "404.html"];

const pages = Object.fromEntries(
  await Promise.all(
    pageFiles.map(async (file) => [file, await readFile(path.join(siteRoot, file), "utf8")]),
  ),
);
const sitemap = await readFile(path.join(siteRoot, "sitemap.xml"), "utf8");
const deployHelper = await readFile(path.join(repoRoot, "_ops", "deploy-nooyouniverse.ps1"), "utf8");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match?.[1] ?? match?.[2] ?? null;
}

function classTokens(tag) {
  return new Set((attribute(tag, "class") || "").trim().split(/\s+/).filter(Boolean));
}

function htmlText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function routeForFile(file) {
  for (const [route, routeFile] of primaryRoutes) {
    if (routeFile === file) return route;
  }
  return "/404";
}

function internalUrl(reference, sourceFile) {
  if (!reference || /^(?:mailto|tel|javascript|data):/i.test(reference)) return null;
  const url = new URL(reference, `${apex}${routeForFile(sourceFile)}`);
  return url.origin === apex ? url : null;
}

function routeFile(pathname) {
  if (primaryRoutes.has(pathname)) return primaryRoutes.get(pathname);
  if (pathname === "/404") return "404.html";
  return null;
}

function assertFragmentExists(file, fragment, label) {
  if (!fragment) return;
  const id = decodeURIComponent(fragment.slice(1));
  assert.match(
    pages[file],
    new RegExp(`\\bid\\s*=\\s*(?:"${escapeRegExp(id)}"|'${escapeRegExp(id)}')`, "i"),
    `${label} points to missing #${id} in ${file}`,
  );
}

async function assertFileExists(relativePath, label) {
  const decoded = decodeURIComponent(relativePath).replace(/^\/+/, "");
  const fullPath = path.resolve(siteRoot, decoded);
  assert.ok(
    fullPath === siteRoot || fullPath.startsWith(`${siteRoot}${path.sep}`),
    `${label} escapes the static site root`,
  );
  const details = await stat(fullPath);
  assert.ok(details.isFile(), `${label} must resolve to a file`);
}

function extractMissionEntries(html) {
  return [...html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)]
    .map((match) => ({ openingTag: match[1], body: match[2] }))
    .filter(({ openingTag }) => classTokens(openingTag).has("entry"));
}

function parseHeaderBlocks(source) {
  const blocks = new Map();
  let currentPath = null;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (!/^\s/.test(rawLine)) {
      currentPath = line;
      if (!blocks.has(currentPath)) blocks.set(currentPath, new Map());
      continue;
    }
    assert.ok(currentPath, `header appears before a path rule: ${line}`);
    const separator = line.indexOf(":");
    assert.ok(separator > 0, `malformed header rule: ${line}`);
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    assert.ok(!blocks.get(currentPath).has(name), `${currentPath} repeats ${name}`);
    blocks.get(currentPath).set(name, value);
  }
  return blocks;
}

function cspDirectives(value) {
  return new Map(
    value.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
      const [name, ...tokens] = part.split(/\s+/);
      return [name.toLowerCase(), tokens];
    }),
  );
}

test("mission log is the reconciled, sequential 11-mission record", () => {
  const entries = extractMissionEntries(pages["log.html"]);
  const ids = entries.map(({ openingTag }) => {
    const id = attribute(openingTag, "id");
    assert.match(id || "", /^mission-(\d{2})$/, "every mission article needs a two-digit mission id");
    return id.slice(-2);
  });

  assert.equal(new Set(ids).size, ids.length, "mission ids must be unique");
  assert.deepEqual(ids, expectedMissionIds, "mission ids must be sequential from 01 through 11");

  const toc = pages["log.html"].match(/<div\b[^>]*class=["'][^"']*\btoc\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  assert.ok(toc, "mission log needs its table of contents");
  const tocIds = [...toc[1].matchAll(/href=["']#mission-(\d{2})["']/gi)].map((match) => match[1]);
  assert.deepEqual(tocIds, ids, "the mission table of contents must match the articles in order");

  const combinedCopy = `${pages["index.html"]}\n${pages["log.html"]}`;
  assert.doesNotMatch(
    htmlText(combinedCopy),
    /\bten (?:evidence-literacy )?flight notes\b/i,
    "fixed ten-mission copy is stale now that Mission 11 exists",
  );
  assert.match(
    pages["index.html"],
    /<a\b[^>]*href=["']\/log#mission-11["'][^>]*>[\s\S]*?Sleep before stack[\s\S]*?<\/a>/i,
    "the home-page Sleep before stack card must link to Mission 11",
  );
});

test("every mission has an image, basis badge, matching number, and full transparency line", async () => {
  for (const { openingTag, body } of extractMissionEntries(pages["log.html"])) {
    const missionId = attribute(openingTag, "id").slice(-2);
    const image = body.match(/<img\b[^>]*>/i)?.[0];
    assert.ok(image, `Mission ${missionId} needs an image`);
    const imageSource = attribute(image, "src");
    assert.match(
      imageSource || "",
      new RegExp(`^/?assets/log/${missionId}-[^/]+\\.(?:jpe?g|png|webp)$`, "i"),
      `Mission ${missionId} image must use its numbered local asset`,
    );
    assert.match(attribute(image, "alt") || "", /AI-assisted/i, `Mission ${missionId} image alt must disclose AI assistance`);
    await assertFileExists(imageSource, `Mission ${missionId} image`);

    assert.match(body, new RegExp(`<span\\b[^>]*class=["'][^"']*\\bnum\\b[^"']*["'][^>]*>\\s*MISSION ${missionId}\\s*</span>`, "i"));
    assert.match(body, /<span\b[^>]*class=["'][^"']*\bbasis\b[^"']*["'][^>]*>[^<]+<\/span>/i, `Mission ${missionId} needs a non-empty basis badge`);

    const disclosure = body.match(/<p\b[^>]*class=["'][^"']*\bdisc\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    assert.ok(disclosure, `Mission ${missionId} needs a transparency line`);
    const disclosureText = htmlText(disclosure[1]);
    assert.match(disclosureText, /^Transparency:/i, `Mission ${missionId} transparency line needs an explicit label`);
    assert.match(disclosureText, /fictional/i, `Mission ${missionId} must preserve the fictional disclosure`);
    assert.match(disclosureText, /AI-assisted/i, `Mission ${missionId} must preserve the AI disclosure`);
    assert.match(disclosureText, /human-reviewed/i, `Mission ${missionId} must preserve human review disclosure`);
    assert.match(disclosureText, /Educational/i, `Mission ${missionId} must preserve the educational-only disclosure`);
  }
});

test("the sources ledger covers every mission exactly once and identifies its basis", () => {
  const ledger = pages["sources.html"].match(/<section\b[^>]*id=["']ledger["'][^>]*>([\s\S]*?)<\/section>/i);
  assert.ok(ledger, "sources page needs a source ledger");
  const rows = [...ledger[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => match[1])
    .filter((row) => /<td\b/i.test(row));
  const ids = rows.map((row) => row.match(/<td\b[^>]*class=["'][^"']*\bm\b[^"']*["'][^>]*>\s*(\d{2})\s*<\/td>/i)?.[1]);

  assert.ok(ids.every(Boolean), "every ledger row needs a two-digit mission number");
  assert.equal(new Set(ids).size, ids.length, "sources ledger mission numbers must be unique");
  assert.deepEqual(ids, expectedMissionIds, "sources ledger must cover Missions 01 through 11 in order");
  for (const [index, row] of rows.entries()) {
    assert.match(row, /<span\b[^>]*class=["'][^"']*\bbasis\b[^"']*["'][^>]*>[^<]+<\/span>/i, `Mission ${ids[index]} ledger row needs a basis`);
    assert.ok(htmlText(row).length > ids[index].length, `Mission ${ids[index]} ledger row needs source or no-claim rationale`);
  }
});

test("primary canonicals and sitemap use only clean apex routes", () => {
  const canonicalUrls = [];
  for (const [route, file] of primaryRoutes) {
    const canonicalTags = [...pages[file].matchAll(/<link\b[^>]*>/gi)]
      .map((match) => match[0])
      .filter((tag) => (attribute(tag, "rel") || "").toLowerCase().split(/\s+/).includes("canonical"));
    assert.equal(canonicalTags.length, 1, `${file} needs exactly one canonical link`);
    const canonical = attribute(canonicalTags[0], "href");
    const expected = `${apex}${route}`;
    assert.equal(canonical, expected, `${file} canonical must be its clean apex route`);
    assert.doesNotMatch(canonical, /\.html(?:$|[?#])/i);
    canonicalUrls.push(canonical);
  }

  const sitemapUrls = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1]);
  assert.deepEqual(sitemapUrls, canonicalUrls, "sitemap routes must exactly match the primary canonicals");
  for (const value of sitemapUrls) {
    const url = new URL(value);
    assert.equal(url.origin, apex);
    assert.doesNotMatch(url.pathname, /\.html$/i);
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
  }
});

test("all local assets referenced by static pages exist", async () => {
  for (const file of pageFiles) {
    const html = pages[file];
    const references = [
      ...[...html.matchAll(/<[^>]+\b(?:src|href|content)\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/gi)].map((match) => match[1] ?? match[2]),
      ...[...html.matchAll(/\burl\(\s*(?:"([^"]+)"|'([^']+)'|([^)'"\s]+))\s*\)/gi)].map((match) => match[1] ?? match[2] ?? match[3]),
    ];

    for (const reference of references) {
      const url = internalUrl(reference, file);
      if (!url || !/\.(?:avif|gif|ico|jpe?g|js|png|svg|webp)$/i.test(url.pathname)) continue;
      await assertFileExists(url.pathname, `${file} reference ${reference}`);
    }
  }
});

test("every internal link resolves, including navigation and footer fragments", () => {
  for (const file of pageFiles) {
    const html = pages[file];
    const regions = [html];
    regions.push(...[...html.matchAll(/<(?:nav|footer)\b[^>]*>([\s\S]*?)<\/(?:nav|footer)>/gi)].map((match) => match[1]));

    for (const [regionIndex, region] of regions.entries()) {
      for (const anchor of region.matchAll(/<a\b[^>]*>/gi)) {
        const reference = attribute(anchor[0], "href");
        const url = internalUrl(reference, file);
        if (!url) continue;
        const label = `${file}${regionIndex ? " nav/footer" : ""} link ${reference}`;
        assert.doesNotMatch(url.pathname, /\.html$/i, `${label} must use a clean route`);

        const targetFile = routeFile(url.pathname);
        assert.ok(targetFile, `${label} points to an unknown internal route`);
        assertFragmentExists(targetFile, url.hash, label);
      }
    }
  }
});

test("fictional, AI-assisted, human-reviewed, educational-only boundaries remain visible", () => {
  for (const file of primaryRoutes.values()) {
    const text = htmlText(pages[file]);
    assert.match(text, /fictional/i, `${file} must identify Cillian as fictional`);
    assert.match(text, /AI-assisted/i, `${file} must disclose AI assistance`);
    assert.match(text, /human-reviewed/i, `${file} must disclose human review`);
    assert.match(text, /Educational(?: content)? only/i, `${file} must mark content as educational only`);
    assert.match(text, /not medical advice|Nothing here is medical advice/i, `${file} must preserve the medical-advice boundary`);
  }
});

test("Cloudflare static headers fail closed without pre-deciding domain-wide HSTS", async () => {
  const source = await readFile(path.join(siteRoot, "_headers"), "utf8");
  const blocks = parseHeaderBlocks(source);
  const headers = blocks.get("/*");
  assert.ok(headers, "_headers needs a /* rule covering every static route");

  assert.equal(headers.get("x-content-type-options")?.toLowerCase(), "nosniff");
  assert.equal(headers.get("x-frame-options")?.toUpperCase(), "DENY");
  assert.equal(headers.get("referrer-policy")?.toLowerCase(), "no-referrer");
  assert.deepEqual(
    [...headers.keys()].sort(),
    [
      "content-security-policy",
      "permissions-policy",
      "referrer-policy",
      "x-content-type-options",
      "x-frame-options",
    ],
    "_headers must not grow an unreviewed response-header surface",
  );

  const permissions = headers.get("permissions-policy") || "";
  assert.equal(
    permissions.replace(/\s+/g, "").toLowerCase(),
    "camera=(),geolocation=(),microphone=(),payment=(),usb=()",
    "Permissions-Policy must disable only the reviewed unused capabilities",
  );

  const csp = cspDirectives(headers.get("content-security-policy") || "");
  const expectedCsp = new Map([
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["object-src", ["'none'"]],
    ["img-src", ["'self'", "data:"]],
    ["script-src", ["'self'", "'unsafe-inline'"]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["connect-src", ["'self'", waitlistOrigin]],
    ["font-src", ["'self'"]],
    ["upgrade-insecure-requests", []],
  ]);
  assert.deepEqual([...csp.keys()].sort(), [...expectedCsp.keys()].sort(), "CSP directives must match the reviewed allowlist");
  for (const [directive, tokens] of expectedCsp) {
    assert.deepEqual(csp.get(directive), tokens, "CSP " + directive + " must match the reviewed token set");
  }
  assert.doesNotMatch(headers.get("content-security-policy") || "", /(?:^|\s)\*(?:\s|;|$)|'unsafe-eval'/i);

  assert.doesNotMatch(
    source,
    /^\s*Strict-Transport-Security\s*:/im,
    "HSTS is a domain-wide owner decision and must not be enabled by this static-site change",
  );
});

test("the release helper is preview-first and syncs the complete public manifest", () => {
  assert.match(deployHelper, /\[switch\]\$Publish/);
  assert.match(deployHelper, /\[string\]\$DeployRepo/);
  assert.match(deployHelper, /\$Preview\s*=\s*-not\s+\$Publish/);
  assert.match(
    deployHelper,
    /Preview complete\. No files copied, removed, staged, committed, pushed, or deployed\./,
    "the default path must state its non-mutating boundary",
  );
  for (const file of [
    "index.html",
    "log.html",
    "sources.html",
    "corrections.html",
    "404.html",
    "robots.txt",
    "sitemap.xml",
    "CNAME",
    "_headers",
  ]) {
    assert.match(
      deployHelper,
      new RegExp("[\"']" + escapeRegExp(file) + "[\"']"),
      "deploy manifest must include " + file,
    );
  }
  assert.doesNotMatch(
    deployHelper,
    /[\"'](?:SITE-ROADMAP|REVENUE-MODEL|MISSION-LOG-RELEASE-QUEUE|README)\.md[\"']/i,
  );
  assert.match(
    deployHelper,
    /throw\s+\"Required public file is missing from source:/,
    "publish must fail closed instead of retaining a stale required page",
  );
  assert.match(deployHelper, /Assert-ExpectedOrigin\s+\$root\s+\"castleism\/MyPersonas\"/);
  assert.match(deployHelper, /Assert-ExpectedOrigin\s+\$deploy\s+\"castleism\/nooyouniverse\"/);
  assert.match(deployHelper, /\"https:\/\/github\.com\/\$ExpectedSlug\"/);
  assert.doesNotMatch(deployHelper, /\.EndsWith\(\$ExpectedSuffix/);
  assert.match(deployHelper, /Assert-CleanMainAtOrigin\s+\$root/);
  assert.match(deployHelper, /Assert-CleanMainAtOrigin\s+\$deploy/);
  assert.match(deployHelper, /Publish must run from the canonical MyPersonas checkout, not a worktree/);
  assert.match(deployHelper, /Publish must use the canonical Noo YouNiverse deploy checkout, not a worktree/);
  assert.match(deployHelper, /Publish requires the primary MyPersonas checkout with its own Git directory/);
  assert.match(deployHelper, /Publish requires the primary Noo YouNiverse deploy checkout with its own Git directory/);
  assert.match(deployHelper, /Get-ChildItem\s+-LiteralPath\s+\$Root\s+-Force\s+-Recurse\s+-File/);
  assert.match(deployHelper, /\$allowedTopLevel\s+-cnotcontains\s+\$_\.Name/);
  assert.match(deployHelper, /\$sourceAssetFiles\s+-cnotcontains\s+\$_/);
  assert.match(deployHelper, /Compare-Object[^\r\n]+-CaseSensitive/);
  assert.match(deployHelper, /hash-object\",\s*\"--path=\$RepositoryPath\"/);
  assert.ok(
    deployHelper.indexOf("# Remove stale names before copying.") < deployHelper.indexOf("# Re-read every published byte and file set before staging."),
    "case-only stale names must be removed before post-sync verification",
  );
  assert.match(deployHelper, /\[would remove deploy-only\]/);
  assert.match(deployHelper, /Remove-Item\s+-LiteralPath\s+\$item\.FullName\s+-Recurse\s+-Force/);
  assert.match(deployHelper, /Post-sync parity failed for required file/);
  assert.match(deployHelper, /Post-sync asset file set does not exactly match canonical source/);
  assert.match(deployHelper, /Post-sync deploy-only public artifacts remain/);
  assert.match(deployHelper, /Staged deploy blob does not match merged source/);
  assert.match(deployHelper, /Staged deploy asset blob does not match merged source/);
  assert.match(deployHelper, /Invoke-Git\s+\$deploy\s+@\(\"push\",\s*\"origin\",\s*\"main\"\)/);
  assert.doesNotMatch(deployHelper, /Invoke-Git\s+\$root\s+@\(\"push\"/);
  assert.doesNotMatch(deployHelper, /Clear-StaleLocks|Push-Repo\s+\$root/);
});

test(
  "the release preview detects hidden files and case-only path drift without mutating either tree",
  { skip: process.platform !== "win32" ? "the release helper targets Windows PowerShell" : false },
  async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), "noo-release-helper-"));
    const sourceRoot = path.join(fixtureRoot, "source");
    const sourceSite = path.join(sourceRoot, "nooyouniverse.com");
    const sourceAssets = path.join(sourceSite, "assets");
    const sourceOps = path.join(sourceRoot, "_ops");
    const deployRoot = path.join(fixtureRoot, "deploy");
    const deployPublic = path.join(deployRoot, "public");
    const deployAssets = path.join(deployPublic, "assets");
    const helperPath = path.join(sourceOps, "deploy-nooyouniverse.ps1");
    const manifest = [
      "index.html",
      "log.html",
      "sources.html",
      "corrections.html",
      "404.html",
      "robots.txt",
      "sitemap.xml",
      "CNAME",
      "_headers",
    ];

    try {
      await Promise.all([
        mkdir(sourceAssets, { recursive: true }),
        mkdir(sourceOps, { recursive: true }),
        mkdir(deployAssets, { recursive: true }),
      ]);
      await copyFile(path.join(repoRoot, "_ops", "deploy-nooyouniverse.ps1"), helperPath);

      for (const repo of [sourceRoot, deployRoot]) {
        const initialized = spawnSync("git", ["init", "-q"], { cwd: repo, encoding: "utf8" });
        assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
      }

      for (const file of manifest) {
        await writeFile(path.join(sourceSite, file), `source ${file}\n`, "utf8");
        if (file !== "_headers") {
          await writeFile(path.join(deployPublic, file), `source ${file}\n`, "utf8");
        }
      }
      await Promise.all([
        writeFile(path.join(deployPublic, "_Headers"), "source _headers\n", "utf8"),
        writeFile(path.join(deployPublic, ".deploy-poke"), "must remain during preview\n", "utf8"),
        writeFile(path.join(sourceAssets, "Case.png"), "same bytes\n", "utf8"),
        writeFile(path.join(deployAssets, "case.png"), "same bytes\n", "utf8"),
        writeFile(path.join(sourceAssets, ".source-hidden"), "source hidden\n", "utf8"),
        writeFile(path.join(deployAssets, ".stale-hidden"), "stale hidden\n", "utf8"),
      ]);

      const preview = spawnSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          helperPath,
          "-DeployRepo",
          deployRoot,
          "-DryRun",
        ],
        { encoding: "utf8" },
      );
      const output = `${preview.stdout || ""}\n${preview.stderr || ""}`;
      assert.equal(preview.status, 0, output);
      assert.match(output, /2 new\/changed, 2 stale/);
      assert.match(output, /\[would sync asset\] assets\\Case\.png/);
      assert.match(output, /\[would sync asset\] assets\\\.source-hidden/);
      assert.match(output, /\[would remove stale asset\] assets\\case\.png/);
      assert.match(output, /\[would remove stale asset\] assets\\\.stale-hidden/);
      assert.match(output, /\[would remove deploy-only\] _Headers/);
      assert.match(output, /\[would remove deploy-only\] \.deploy-poke/);
      assert.match(output, /Preview complete\. No files copied, removed, staged, committed, pushed, or deployed\./);
      await stat(path.join(deployPublic, ".deploy-poke"));
      await stat(path.join(deployAssets, "case.png"));
      await stat(path.join(deployAssets, ".stale-hidden"));
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  },
);

test("public assets and rendered copy exclude legacy Package A candidates", async () => {
  const logAssetNames = await readdir(path.join(siteRoot, "assets", "log"));
  const joinedAssets = logAssetNames.join("\n");
  assert.doesNotMatch(
    joinedAssets,
    /candidate|p-value|claim-constellation|flight-plan|observation-blueprint/i,
    "review-only Package A visuals must not enter the public asset tree",
  );

  const rendered = Object.values(pages).join("\n");
  for (const title of [
    "The P-Value Is Not the Payload",
    "The Claim Is the Whole Constellation",
    "Read the Flight Plan Before the Landing",
    "A Field Is Not Yet a Measurement",
  ]) {
    assert.doesNotMatch(rendered, new RegExp(escapeRegExp(title), "i"), title + " is still review-only");
  }
});
