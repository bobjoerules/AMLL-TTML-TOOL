/**
 * Cloudflare Worker for AMLL TTML Tool
 * Dynamically serves live, auto-updating Discord Component Embeds & Open Graph tags
 * for the Leaderboard (/stats) and individual User Profiles (/user/:uid).
 *
 * For human browsers: redirects directly to the SPA hash routes (#stats, #user=:uid).
 * For Discordbot & social crawlers: generates real-time Discord Component Embed payloads from Firestore.
 */

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/amll-ttml/databases/(default)/documents';
const SITE_ORIGIN = 'https://ttml.bobjoerules.com';
const EDITOR_ORIGIN = 'https://ttmleditor.com';
const GITHUB_REPO = 'https://github.com/bobjoerules/AMLL-TTML-TOOL';
const DEFAULT_ICON = 'https://ttml.bobjoerules.com/apple-touch-icon.png';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('User-Agent') || '';
    const isBot = /Discordbot|Twitterbot|facebookexternalhit|Slackbot|LinkedInBot|TelegramBot/i.test(userAgent);

    const pathname = url.pathname.replace(/\/+$/, '');

    // 1. Leaderboard / Stats Route (/stats or /leaderboard)
    if (pathname === '/stats' || pathname === '/leaderboard') {
      if (!isBot) {
        return fetch(new Request(`${SITE_ORIGIN}/`, request));
      }
      return handleStatsEmbed(request);
    }

    // 2. User Profile Route (/user/:uid or /u/:uid)
    const userMatch = pathname.match(/^\/(?:user|u)\/([^/]+)/);
    if (userMatch) {
      const uid = decodeURIComponent(userMatch[1]);
      if (!isBot) {
        return fetch(new Request(`${SITE_ORIGIN}/`, request));
      }
      return handleUserProfileEmbed(request, uid);
    }

    // Default pass-through to origin or static website
    return fetch(request);
  },
};

/**
 * Handles generating dynamic Discord Component Embed for the Community Leaderboard
 */
async function handleStatsEmbed(request) {
  try {
    const resp = await fetch(`${FIRESTORE_BASE}/finished_ttmls?pageSize=100`, {
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    
    if (!resp.ok) throw new Error(`Firestore finished_ttmls HTTP ${resp.status}`);
    const data = await resp.json();
    const docs = data.documents || [];

    const creatorMap = new Map();
    let totalLines = 0;
    let totalDurationMs = 0;
    let totalWordSync = 0;

    for (const doc of docs) {
      const f = doc.fields || {};
      const authorUid = f.authorUid?.stringValue || 'community';
      const authorName = f.authorName?.stringValue || 'Anonymous';
      const lines = parseInt(f.lineCount?.integerValue || '0', 10);
      const duration = parseInt(f.durationMs?.integerValue || '0', 10);

      totalLines += lines;
      totalDurationMs += duration;

      const raw = f.rawTTML?.stringValue || '';
      if (/itunes:timing=["']Word["']/i.test(raw) || /<span\b[^>]*\bbegin=/i.test(raw)) {
        totalWordSync++;
      }

      if (!creatorMap.has(authorUid)) {
        creatorMap.set(authorUid, {
          uid: authorUid,
          name: authorName,
          songs: 0,
          lines: 0,
        });
      }
      const creator = creatorMap.get(authorUid);
      creator.songs += 1;
      creator.lines += lines;
      if (f.authorName?.stringValue) creator.name = f.authorName.stringValue;
    }

    const creators = Array.from(creatorMap.values()).sort((a, b) => b.songs - a.songs);
    const topCreators = creators.slice(0, 3);

    const medals = ['🥇', '🥈', '🥉'];
    let leaderboardText = topCreators
      .map((c, i) => `${medals[i]} **${escapeDiscordText(c.name)}** — ${c.songs} songs (${c.lines.toLocaleString()} lines)`)
      .join('\n');

    if (!leaderboardText) {
      leaderboardText = 'Community contributions are growing! Be the first to appear on the leaderboard.';
    }

    const payload = {
      component: {
        type: 17,
        accent_color: 16395592, // #FA2D48
        spoiler: false,
        components: [
          {
            type: 9,
            components: [
              {
                type: 10,
                content: `-# COMMUNITY LEADERBOARD\n## **AMLL TTML Lyric Contributors**\n**${docs.length}** finished songs · **${totalLines.toLocaleString()}** timed lines · **${creators.length}** creators`,
              },
            ],
            accessory: {
              type: 11,
              media: { url: DEFAULT_ICON },
            },
          },
          { type: 14 },
          {
            type: 9,
            components: [
              {
                type: 10,
                content: `**Top Lyric Contributors**\n${leaderboardText}`,
              },
            ],
            accessory: {
              type: 2,
              style: 5,
              label: 'Leaderboard',
              url: `${SITE_ORIGIN}/stats`,
            },
          },
          { type: 14 },
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: 'View Full Rankings',
                url: `${SITE_ORIGIN}/stats`,
              },
              {
                type: 2,
                style: 5,
                label: 'Open Editor',
                url: `${EDITOR_ORIGIN}/`,
              },
              {
                type: 2,
                style: 5,
                label: 'GitHub',
                url: GITHUB_REPO,
              },
            ],
          },
          {
            type: 10,
            content: `-# ${SITE_ORIGIN.replace('https://', '')}/stats · Live community metrics`,
          },
        ],
      },
    };

    return renderHtmlResponse({
      title: 'Community Leaderboard — AMLL TTML Tool',
      description: `${docs.length} songs synced across ${creators.length} contributors. View top lyric timing creators.`,
      url: `${SITE_ORIGIN}/stats`,
      themeColor: '#FA2D48',
      payload,
    });
  } catch (err) {
    console.error('Stats embed error:', err);
    return fallbackResponse('Community Leaderboard', `${SITE_ORIGIN}/stats`);
  }
}

/**
 * Handles generating dynamic Discord Component Embed for a specific User Profile
 */
async function handleUserProfileEmbed(request, uid) {
  try {
    // 1. Fetch user document
    const userPromise = fetch(`${FIRESTORE_BASE}/users/${encodeURIComponent(uid)}`, {
      cf: { cacheTtl: 60, cacheEverything: true },
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

    // 2. Fetch finished songs
    const songsPromise = fetch(`${FIRESTORE_BASE}/finished_ttmls?pageSize=100`, {
      cf: { cacheTtl: 60, cacheEverything: true },
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

    const [userDoc, songsData] = await Promise.all([userPromise, songsPromise]);

    const docs = songsData?.documents || [];
    const userFields = userDoc?.fields || {};

    // Calculate user's songs, lines, and global rank
    const creatorMap = new Map();
    const userSongs = [];

    for (const doc of docs) {
      const f = doc.fields || {};
      const authorUid = f.authorUid?.stringValue || 'community';
      const lines = parseInt(f.lineCount?.integerValue || '0', 10);
      const authorName = f.authorName?.stringValue || 'Anonymous';

      if (!creatorMap.has(authorUid)) {
        creatorMap.set(authorUid, { uid: authorUid, songs: 0, lines: 0, name: authorName });
      }
      const c = creatorMap.get(authorUid);
      c.songs += 1;
      c.lines += lines;

      if (authorUid === uid) {
        userSongs.push({
          title: f.title?.stringValue || 'Untitled',
          artist: f.artist?.stringValue || 'Unknown Artist',
          lines,
          coverArt: f.coverArt?.stringValue,
          updatedAt: parseInt(f.updatedAt?.integerValue || f.createdAt?.integerValue || '0', 10),
        });
      }
    }

    const creatorsSorted = Array.from(creatorMap.values()).sort((a, b) => b.songs - a.songs);
    const rankIndex = creatorsSorted.findIndex((c) => c.uid === uid);
    const rankStr = rankIndex >= 0 ? `#${rankIndex + 1}` : 'Contributor';

    const displayName =
      userFields.displayName?.stringValue ||
      userSongs[0]?.artist ||
      `Creator (${uid.slice(0, 6)})`;
    const photoURL = userFields.photoURL?.stringValue || DEFAULT_ICON;

    const totalUserSongs = userSongs.length;
    const totalUserLines = userSongs.reduce((acc, s) => acc + s.lines, 0);

    // Sort songs by newest first
    userSongs.sort((a, b) => b.updatedAt - a.updatedAt);
    const latestSong = userSongs[0];

    const components = [
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `-# CREATOR PROFILE · RANK ${rankStr}\n## **${escapeDiscordText(displayName)}**\nTimed **${totalUserSongs}** songs with **${totalUserLines.toLocaleString()}** lines of syllable-synced lyrics.`,
          },
        ],
        accessory: {
          type: 11,
          media: { url: photoURL },
        },
      },
    ];

    if (latestSong) {
      components.push(
        { type: 14 },
        {
          type: 9,
          components: [
            {
              type: 10,
              content: `**Latest Contribution**\n🎶 **${escapeDiscordText(latestSong.title)}** — ${escapeDiscordText(latestSong.artist)}\n*${latestSong.lines} lines synchronized*`,
            },
          ],
          accessory: {
            type: 2,
            style: 5,
            label: 'View Song',
            url: `${SITE_ORIGIN}/user/${encodeURIComponent(uid)}`,
          },
        }
      );
    }

    components.push(
      { type: 14 },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: `View Profile (${totalUserSongs})`,
            url: `${SITE_ORIGIN}/user/${encodeURIComponent(uid)}`,
          },
          {
            type: 2,
            style: 5,
            label: 'Leaderboard',
            url: `${SITE_ORIGIN}/stats`,
          },
          {
            type: 2,
            style: 5,
            label: 'Web Editor',
            url: `${EDITOR_ORIGIN}/`,
          },
        ],
      },
      {
        type: 10,
        content: `-# ${SITE_ORIGIN.replace('https://', '')} · Verified Lyric Creator`,
      }
    );

    const payload = {
      component: {
        type: 17,
        accent_color: 1613912, // #18A058
        spoiler: false,
        components,
      },
    };

    return renderHtmlResponse({
      title: `${displayName} — Creator Profile`,
      description: `${displayName} has synchronized ${totalUserSongs} songs and ${totalUserLines.toLocaleString()} lines on AMLL TTML Tool.`,
      url: `${SITE_ORIGIN}/user/${encodeURIComponent(uid)}`,
      themeColor: '#18A058',
      payload,
    });
  } catch (err) {
    console.error('User embed error:', err);
    return fallbackResponse('Creator Profile', `${SITE_ORIGIN}/user/${encodeURIComponent(uid)}`);
  }
}

/**
 * Renders HTML containing Open Graph fallback meta tags and the Discord Component Embed JSON script
 */
function renderHtmlResponse({ title, description, url, themeColor, payload }) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  
  <!-- Open Graph Fallback (Required by Discord) -->
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta name="theme-color" content="${themeColor || '#000000'}" />

  <!-- Discord Component Embed Payload -->
  <script id="discord:component-embed" type="application/json">
${JSON.stringify(payload, null, 2)}
  </script>
</head>
<body>
  <p>${escapeHtml(description)}</p>
  <a href="${escapeHtml(url)}">Click here to continue</a>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  });
}

function fallbackResponse(title, url) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta name="theme-color" content="#000000" />
</head>
<body>Redirecting...</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeDiscordText(str) {
  return String(str || '')
    .replace(/([*_`~|\\])/g, '\\$1');
}
