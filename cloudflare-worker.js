/**
 * Cloudflare Worker for AMLL TTML Tool
 *
 * 1. Discord Component Embeds & Open Graph tags:
 *    - /stats or /leaderboard: Community Leaderboard Embed
 *    - /user/:uid or /u/:uid: User Profile Embed
 *    - /song/:id or /track/:id: Song Preview Embed
 *
 * 2. Human browser fallbacks:
 *    - Transparent pass-through / proxy to SPA site origin
 */

const FIRESTORE_BASE =
	"https://firestore.googleapis.com/v1/projects/amll-ttml/databases/(default)/documents";
const SITE_ORIGIN = "https://ttml.bobjoerules.com";
const EDITOR_ORIGIN = "https://ttmleditor.com";
const GITHUB_REPO = "https://github.com/bobjoerules/AMLL-TTML-TOOL";
const DEFAULT_ICON = "https://ttml.bobjoerules.com/apple-touch-icon.png";

export default {
	async fetch(request, _env, _ctx) {
		const url = new URL(request.url);
		const userAgent = request.headers.get("User-Agent") || "";
		const isBot =
			/Discordbot|Twitterbot|facebookexternalhit|Slackbot|LinkedInBot|TelegramBot/i.test(
				userAgent,
			);

		const pathname = url.pathname.replace(/\/+$/, "") || "/";

		// 1. Leaderboard / Stats Route (/stats or /leaderboard)
		if (pathname === "/stats" || pathname === "/leaderboard") {
			if (!isBot) {
				return fetch(new Request(`${SITE_ORIGIN}/`, request));
			}
			return handleStatsEmbed(request);
		}

		// 2. User Profile Route (/user/:uid or /u/:uid)
		const userMatch = pathname.match(/^\/(?:user|u)\/([^/]+)$/);
		if (userMatch) {
			const uid = decodeURIComponent(userMatch[1]);
			if (!isBot) {
				return fetch(new Request(`${SITE_ORIGIN}/`, request));
			}
			return handleUserProfileEmbed(request, uid);
		}

		// 3. Song Preview Route (/song/:id, /track/:id, /s/:id)
		const songMatch = pathname.match(/^\/(?:song|track|s)\/([^/]+)$/);
		if (songMatch) {
			const songId = decodeURIComponent(songMatch[1]);
			if (!isBot) {
				return fetch(new Request(`${SITE_ORIGIN}/finished`, request));
			}
			return handleSongEmbed(request, songId);
		}

		// Default pass-through to origin or static website
		return fetch(request);
	},
};

/* ==========================================================================
   Firestore Helpers
   ========================================================================== */

/**
 * Parses raw Firestore document into a clean Song object
 */
function parseFirestoreSongDoc(doc, { includeRaw = false } = {}) {
	const f = doc?.fields || {};
	const id = doc?.name ? doc.name.split("/").pop() : "";
	const rawTTML = f.rawTTML?.stringValue || null;

	let coverArt = f.coverArt?.stringValue || null;
	if (!coverArt && rawTTML) {
		const match =
			rawTTML.match(/key=["']cover(?:_art)?["'][^>]*value=["']([^"']+)["']/i) ||
			rawTTML.match(
				/<amll:meta[^>]*key=["']cover(?:_art)?["'][^>]*>([^<]+)<\/amll:meta>/i,
			) ||
			rawTTML.match(/https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|webp)/i);
		if (match?.[1] || match?.[0]) {
			coverArt = match[1] || match[0];
		}
	}

	let title = f.title?.stringValue || "Untitled";
	let artist = f.artist?.stringValue || "Unknown Artist";
	const album = f.album?.stringValue || "";

	if (title === "Untitled" && rawTTML) {
		const titleMatch = rawTTML.match(/<ttm:title>([^<]+)<\/ttm:title>/i);
		if (titleMatch) title = titleMatch[1];
	}
	if (artist === "Unknown Artist" && rawTTML) {
		const artistMatch = rawTTML.match(
			/<ttm:agent[^>]*type=["']person["'][^>]*>([^<]+)<\/ttm:agent>/i,
		);
		if (artistMatch) artist = artistMatch[1];
	}

	const tags =
		f.tags?.arrayValue?.values?.map((v) => v.stringValue).filter(Boolean) || [];
	const lineCount = parseInt(f.lineCount?.integerValue || "0", 10);
	const durationMs = parseInt(f.durationMs?.integerValue || "0", 10);
	const createdAt =
		parseInt(f.createdAt?.integerValue || "0", 10) ||
		(doc.createTime ? new Date(doc.createTime).getTime() : 0);
	const updatedAt =
		parseInt(f.updatedAt?.integerValue || "0", 10) ||
		(doc.updateTime ? new Date(doc.updateTime).getTime() : createdAt);

	const isPublishedExplicit = f.publishedToCommunity?.booleanValue;
	const publishedToCommunity = isPublishedExplicit !== false;

	const song = {
		id,
		title,
		artist,
		album,
		coverArt,
		lineCount,
		durationMs,
		authorUid: f.authorUid?.stringValue || "community",
		authorName: f.authorName?.stringValue || "Anonymous",
		hasAudio: Boolean(f.hasAudio?.booleanValue),
		audioUrl: f.audioUrl?.stringValue || null,
		audioFileName: f.audioFileName?.stringValue || null,
		audioSize: f.audioSize?.integerValue
			? parseInt(f.audioSize.integerValue, 10)
			: null,
		tags,
		finished: Boolean(f.finished?.booleanValue ?? true),
		publishedToCommunity,
		createdAt,
		updatedAt,
	};

	if (includeRaw) {
		song.rawTTML = rawTTML;
	}

	return song;
}


/**
 * Fetches all public song documents from finished_ttmls and public_ttmls collections
 */
async function fetchAllPublicSongs({ includeRaw = false } = {}) {
	const [finishedRes, publicRes] = await Promise.all([
		fetch(`${FIRESTORE_BASE}/finished_ttmls?pageSize=300`, {
			cf: { cacheTtl: 60, cacheEverything: true },
		})
			.then((r) => (r.ok ? r.json() : null))
			.catch(() => null),
		fetch(`${FIRESTORE_BASE}/public_ttmls?pageSize=300`, {
			cf: { cacheTtl: 60, cacheEverything: true },
		})
			.then((r) => (r.ok ? r.json() : null))
			.catch(() => null),
	]);

	const docsMap = new Map();
	for (const doc of finishedRes?.documents || []) {
		if (doc?.name) docsMap.set(doc.name, doc);
	}
	for (const doc of publicRes?.documents || []) {
		if (doc?.name && !docsMap.has(doc.name)) {
			docsMap.set(doc.name, doc);
		}
	}

	const rawDocs = Array.from(docsMap.values());
	return rawDocs
		.map((d) => parseFirestoreSongDoc(d, { includeRaw }))
		.filter((s) => s.publishedToCommunity);
}

/**
 * Fetches an individual song by ID with complete rawTTML
 */
async function fetchPublicSongById(id) {
	// 1. Try finished_ttmls
	let resp = await fetch(
		`${FIRESTORE_BASE}/finished_ttmls/${encodeURIComponent(id)}`,
		{
			cf: { cacheTtl: 60, cacheEverything: true },
		},
	);

	if (!resp.ok && resp.status === 404) {
		// 2. Try public_ttmls
		resp = await fetch(
			`${FIRESTORE_BASE}/public_ttmls/${encodeURIComponent(id)}`,
			{
				cf: { cacheTtl: 60, cacheEverything: true },
			},
		);
	}

	if (!resp.ok) return null;
	const doc = await resp.json();
	const song = parseFirestoreSongDoc(doc, { includeRaw: true });

	// Ensure song is publicly opted-in
	if (!song || !song.publishedToCommunity) return null;

	// If rawTTML is missing, attempt to fetch from user subcollection payload
	if (!song.rawTTML && song.authorUid && song.id) {
		try {
			const payloadResp = await fetch(
				`${FIRESTORE_BASE}/users/${encodeURIComponent(song.authorUid)}/ttmls/${encodeURIComponent(song.id)}/payload/content`,
				{ cf: { cacheTtl: 60, cacheEverything: true } },
			);
			if (payloadResp.ok) {
				const payloadDoc = await payloadResp.json();
				const payloadTTML = payloadDoc.fields?.rawTTML?.stringValue;
				if (payloadTTML) {
					song.rawTTML = payloadTTML;
				}
			}
		} catch {
			// ignore
		}
	}

	return song;
}


/* ==========================================================================
   Discord Component Embed Handlers
   ========================================================================== */

/**
 * Handles generating dynamic Discord Component Embed for a specific public song
 */
async function handleSongEmbed(_request, songId) {
	try {
		const song = await fetchPublicSongById(songId);
		if (!song) {
			return fallbackResponse("Public TTML Song", `${SITE_ORIGIN}/finished`);
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
								content: `-# COMMUNITY TTML LYRICS\n## **${escapeDiscordText(song.title)}**\n**${escapeDiscordText(song.artist)}**${song.album ? ` · *${escapeDiscordText(song.album)}*` : ""}\n**${song.lineCount}** timed lines · Synchronized by **${escapeDiscordText(song.authorName)}**`,
							},
						],
						accessory: {
							type: 11,
							media: { url: song.coverArt || DEFAULT_ICON },
						},
					},
					{ type: 14 },
					{
						type: 1,
						components: [
							{
								type: 2,
								style: 5,
								label: "Download TTML",
								url: `${SITE_ORIGIN}/api/songs/${encodeURIComponent(song.id)}/ttml`,
							},
							{
								type: 2,
								style: 5,
								label: "View in Library",
								url: `${SITE_ORIGIN}/finished`,
							},
							{
								type: 2,
								style: 5,
								label: "Web Editor",
								url: `${EDITOR_ORIGIN}/`,
							},
						],
					},
					{
						type: 10,
						content: `-# ${SITE_ORIGIN.replace("https://", "")} · Syllable-synced Apple Music TTML`,
					},
				],
			},
		};

		return renderHtmlResponse({
			title: `${song.title} — ${song.artist} | AMLL TTML Lyrics`,
			description: `${song.title} by ${song.artist} — ${song.lineCount} timed lyric lines synchronized by ${song.authorName} on AMLL TTML Tool.`,
			url: `${SITE_ORIGIN}/song/${encodeURIComponent(song.id)}`,
			themeColor: "#FA2D48",
			payload,
		});
	} catch (err) {
		console.error("Song embed error:", err);
		return fallbackResponse("Public TTML Song", `${SITE_ORIGIN}/finished`);
	}
}

/**
 * Handles generating dynamic Discord Component Embed for the Community Leaderboard
 */
async function handleStatsEmbed(_request) {
	try {
		const [songs, userMap] = await Promise.all([
			fetchAllPublicSongs({
				includeRaw: true,
				dedupe: true,
			}),
			fetchUserMap(),
		]);

		const creatorMap = new Map();
		let totalLines = 0;
		let totalWordSync = 0;

		for (const s of songs) {
			const authorUid =
				s.authorUid ||
				(s.authorName ? `author:${s.authorName.toLowerCase()}` : "community");
			const lines = s.lineCount || 0;

			totalLines += lines;

			if (
				s.rawTTML &&
				(/itunes:timing=["']Word["']/i.test(s.rawTTML) ||
					/<span\b[^>]*\bbegin=/i.test(s.rawTTML))
			) {
				totalWordSync++;
			}

			const userDoc = s.authorUid ? userMap.get(s.authorUid) : null;
			const displayName =
				userDoc?.displayName ||
				s.authorName ||
				(s.authorUid
					? `Creator (${s.authorUid.slice(0, 6)})`
					: "Community Creator");

			if (!creatorMap.has(authorUid)) {
				creatorMap.set(authorUid, {
					uid: s.authorUid || authorUid,
					name: displayName,
					songs: 0,
					lines: 0,
				});
			}
			const creator = creatorMap.get(authorUid);
			creator.songs += 1;
			creator.lines += lines;
			if (userDoc?.displayName) creator.name = userDoc.displayName;
			else if (s.authorName && creator.name === "Community Creator")
				creator.name = s.authorName;
		}

		const creators = Array.from(creatorMap.values()).sort(
			(a, b) => b.songs - a.songs || b.lines - a.lines,
		);
		const topCreators = creators.slice(0, 3);

		let leaderboardText = topCreators
			.map(
				(c, i) =>
					`**#${i + 1}** **${escapeDiscordText(c.name)}** — ${c.songs} songs (${c.lines.toLocaleString()} lines)`,
			)
			.join("\n");

		if (!leaderboardText) {
			leaderboardText =
				"Community contributions are growing! Be the first to appear on the leaderboard.";
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
								content: `-# COMMUNITY LEADERBOARD\n## **AMLL TTML Lyric Contributors**\n**${songs.length}** finished songs · **${totalLines.toLocaleString()}** timed lines · **${totalWordSync}** word-synced · **${creators.length}** creators`,
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
							label: "Leaderboard",
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
								label: "View Full Rankings",
								url: `${SITE_ORIGIN}/stats`,
							},
							{
								type: 2,
								style: 5,
								label: "Open Editor",
								url: `${EDITOR_ORIGIN}/`,
							},
							{
								type: 2,
								style: 5,
								label: "GitHub",
								url: GITHUB_REPO,
							},
						],
					},
					{
						type: 10,
						content: `-# ${SITE_ORIGIN.replace("https://", "")}/stats · Live community metrics`,
					},
				],
			},
		};

		return renderHtmlResponse({
			title: "Community Leaderboard — AMLL TTML Tool",
			description: `${songs.length} songs synced across ${creators.length} contributors. View top lyric timing creators.`,
			url: `${SITE_ORIGIN}/stats`,
			themeColor: "#FA2D48",
			payload,
		});
	} catch (err) {
		console.error("Stats embed error:", err);
		return fallbackResponse("Community Leaderboard", `${SITE_ORIGIN}/stats`);
	}
}

/**
 * Handles generating dynamic Discord Component Embed for a specific User Profile
 */
async function handleUserProfileEmbed(_request, uid) {
	try {
		// 1. Fetch user document
		const userPromise = fetch(
			`${FIRESTORE_BASE}/users/${encodeURIComponent(uid)}`,
			{
				cf: { cacheTtl: 60, cacheEverything: true },
			},
		)
			.then((r) => (r.ok ? r.json() : null))
			.catch(() => null);

		// 2. Fetch public songs
		const songsPromise = fetchAllPublicSongs({
			includeRaw: true,
			dedupe: true,
		});

		const [userDoc, allPublicSongs] = await Promise.all([
			userPromise,
			songsPromise,
		]);

		const userFields = userDoc?.fields || {};

		// Calculate user's songs, lines, and global rank
		const creatorMap = new Map();
		const userSongs = [];

		for (const s of allPublicSongs || []) {
			const authorUid = s.authorUid || "community";
			const lines = s.lineCount || 0;
			const authorName = s.authorName || "Anonymous";

			if (!creatorMap.has(authorUid)) {
				creatorMap.set(authorUid, {
					uid: authorUid,
					songs: 0,
					lines: 0,
					name: authorName,
				});
			}
			const c = creatorMap.get(authorUid);
			c.songs += 1;
			c.lines += lines;
			if (s.authorName && s.authorName !== "Anonymous") c.name = s.authorName;

			if (authorUid === uid) {
				userSongs.push({
					title: s.title || "Untitled",
					artist: s.artist || "Unknown Artist",
					lines,
					coverArt: s.coverArt,
					updatedAt: s.updatedAt || s.createdAt || 0,
				});
			}
		}

		const creatorsSorted = Array.from(creatorMap.values()).sort(
			(a, b) => b.songs - a.songs || b.lines - a.lines,
		);
		const rankIndex = creatorsSorted.findIndex((c) => c.uid === uid);
		const rankStr = rankIndex >= 0 ? `#${rankIndex + 1}` : "Contributor";

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
							content: `**Latest Contribution**\n**${escapeDiscordText(latestSong.title)}** — ${escapeDiscordText(latestSong.artist)}\n*${latestSong.lines} lines synchronized*`,
						},
					],
					accessory: {
						type: 2,
						style: 5,
						label: "View Song",
						url: `${SITE_ORIGIN}/user/${encodeURIComponent(uid)}`,
					},
				},
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
						label: "View Profile",
						url: `${SITE_ORIGIN}/user/${encodeURIComponent(uid)}`,
					},
					{
						type: 2,
						style: 5,
						label: "Leaderboard",
						url: `${SITE_ORIGIN}/stats`,
					},
					{
						type: 2,
						style: 5,
						label: "Web Editor",
						url: `${EDITOR_ORIGIN}/`,
					},
				],
			},
			{
				type: 10,
				content: `-# ${SITE_ORIGIN.replace("https://", "")} · Verified Lyric Creator`,
			},
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
			themeColor: "#18A058",
			payload,
		});
	} catch (err) {
		console.error("User embed error:", err);
		return fallbackResponse(
			"Creator Profile",
			`${SITE_ORIGIN}/user/${encodeURIComponent(uid)}`,
		);
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
  <meta name="theme-color" content="${themeColor || "#000000"}" />

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
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "public, max-age=60, s-maxage=60",
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
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}

function escapeHtml(str) {
	return String(str || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function escapeDiscordText(str) {
	return String(str || "").replace(/([*_`~|\\])/g, "\\$1");
}
