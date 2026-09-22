import {
	ArrowClockwise24Regular,
	Camera24Regular,
	Cloud24Regular,
	CloudDatabase20Regular,
	Copy16Regular,
	DocumentBulletList24Regular,
	Edit24Regular,
	Globe16Regular,
	Image24Regular,
	Link24Regular,
	MusicNote224Regular,
	Open16Regular,
	Person16Regular,
	Save20Regular,
	ShieldCheckmarkRegular,
	Timer24Regular,
} from "@fluentui/react-icons";
import {
	Avatar,
	Badge,
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	Grid,
	Heading,
	Separator,
	Text,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import { openExternal } from "$/utils/openExternal";
import { useAtomValue, useSetAtom } from "jotai";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	signInWithEmail,
	signOutUser,
	signUpWithEmail,
	updateUserProfileDetails,
	uploadProfilePhoto,
} from "$/modules/cloud/auth";
import {
	getFirebaseAuth,
	isFirebaseConfigured,
} from "$/modules/cloud/firebase";
import {
	authLoadingAtom,
	cloudFileManagerInitialTabAtom,
	cloudFileManagerOpenAtom,
	cloudTTMLListAtom,
	currentUserAtom,
} from "$/modules/cloud/states";
import { fetchUserTTMLList } from "$/modules/cloud/ttmlStorage";
import { groupCloudTTMLs } from "$/modules/cloud/songGrouping";
import { extractArtistTokens } from "$/modules/ttml-checklist/logic";

const MODERATOR_UIDS = new Set(["s41Sey8PJUSYHQUsS6aLLb7lsf02"]);


export const SettingsAccountTab = memo(() => {
	const { t } = useTranslation();
	const user = useAtomValue(currentUserAtom);
	const authLoading = useAtomValue(authLoadingAtom);
	const cloudTTMLList = useAtomValue(cloudTTMLListAtom);
	const setFileManagerOpen = useSetAtom(cloudFileManagerOpenAtom);
	const setFileManagerTab = useSetAtom(cloudFileManagerInitialTabAtom);

	const [isSignUp, setIsSignUp] = useState<boolean>(false);
	const [email, setEmail] = useState<string>("");
	const [password, setPassword] = useState<string>("");
	const [displayName, setDisplayName] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

	const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
	const [customPhotoUrl, setCustomPhotoUrl] = useState<string>("");
	const [editDisplayName, setEditDisplayName] = useState<string>("");
	const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const isConfigured = isFirebaseConfigured();

	useEffect(() => {
		if (user) {
			fetchUserTTMLList().catch(console.error);
		}
	}, [user]);

	const authUser = useMemo(() => {
		if (!user) return null;
		try {
			const auth = getFirebaseAuth();
			return auth.currentUser;
		} catch {
			return null;
		}
	}, [user]);

	const creationDateFormatted = useMemo(() => {
		if (!authUser?.metadata?.creationTime) return "N/A";
		try {
			return new Date(authUser.metadata.creationTime).toLocaleDateString(
				undefined,
				{
					year: "numeric",
					month: "long",
					day: "numeric",
				},
			);
		} catch {
			return authUser.metadata.creationTime;
		}
	}, [authUser]);

	const lastLoginFormatted = useMemo(() => {
		if (!authUser?.metadata?.lastSignInTime) return "Just now";
		try {
			return new Date(authUser.metadata.lastSignInTime).toLocaleString(
				undefined,
				{
					year: "numeric",
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
				},
			);
		} catch {
			return authUser.metadata.lastSignInTime;
		}
	}, [authUser]);

	const isMod = Boolean(user?.uid && MODERATOR_UIDS.has(user.uid));

	const {
		uniqueSongCount,
		totalLinesCount,
		totalDurationMs,
		uniqueArtistCount,
	} = useMemo(() => {
		const groups = groupCloudTTMLs(cloudTTMLList);
		const artists = new Set<string>();
		let totalLines = 0;
		let totalDuration = 0;

		for (const g of groups) {
			totalLines += g.maxLines;
			totalDuration += g.durationMs;
			const primary =
				extractArtistTokens(g.artist).primary ||
				(g.artist || "").trim().toLowerCase();
			if (primary) {
				artists.add(primary);
			}
		}

		return {
			uniqueSongCount: groups.length,
			totalLinesCount: totalLines,
			totalDurationMs: totalDuration,
			uniqueArtistCount: artists.size,
		};
	}, [cloudTTMLList]);

	const formatDuration = (ms: number): string => {
		const totalSeconds = Math.floor(ms / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}
		if (minutes > 0) {
			return `${minutes} min`;
		}
		return totalSeconds > 0 ? `${totalSeconds}s` : "0 min";
	};

	const handleRefresh = async () => {
		try {
			setIsRefreshing(true);
			await fetchUserTTMLList();
			toast.success(t("cloud.refreshed", "Account data refreshed"));
		} catch (err: unknown) {
			toast.error((err as Error)?.message || "Failed to refresh cloud data");
		} finally {
			setIsRefreshing(false);
		}
	};

	const handleEmailAuth = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();

		if (!email || !password) {
			toast.error("Please enter both email and password.");
			return;
		}

		if (password.length < 6) {
			toast.error("Password must be at least 6 characters.");
			return;
		}

		try {
			setIsSubmitting(true);
			if (isSignUp) {
				await signUpWithEmail(email, password, displayName);
				toast.success(
					t("cloud.signUpSuccess", "Account created and signed in!"),
				);
			} else {
				await signInWithEmail(email, password);
				toast.success(t("cloud.loginSuccess", "Successfully signed in!"));
			}
		} catch (err: unknown) {
			console.error(err);
			const msg = (err as Error)?.message || "Authentication failed";
			if (
				msg.includes("user-not-found") ||
				msg.includes("invalid-credential")
			) {
				toast.error(
					"Invalid email or password. If you don't have an account, click 'Sign Up'.",
				);
			} else if (msg.includes("email-already-in-use")) {
				toast.error(
					"An account with this email already exists. Please sign in.",
				);
				setIsSignUp(false);
			} else {
				toast.error(msg);
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSignOut = async () => {
		try {
			await signOutUser();
			toast.info(t("cloud.signedOut", "Signed out successfully."));
		} catch (err: unknown) {
			toast.error((err as Error)?.message || "Failed to sign out");
		}
	};

	const handleOpenManager = (tab: "open" | "save") => {
		setFileManagerTab(tab);
		setFileManagerOpen(true);
	};

	if (!user) {
		return (
			<Flex direction="column" gap="4">
				<Card variant="surface" style={{ padding: 20 }}>
					<Flex direction="column" gap="3">
						<Flex align="center" gap="3">
							<Cloud24Regular
								style={{ width: 28, height: 28, color: "var(--accent-9)" }}
							/>
							<Flex direction="column">
								<Heading size="3">
									{isSignUp
										? t("cloud.createAccount", "Create Cloud Account")
										: t("cloud.signInTitle", "Sign in to TTML Cloud")}
								</Heading>
								<Text size="2" color="gray">
									{isSignUp
										? t(
												"cloud.signUpDesc",
												"Sync and manage your TTML lyrics anywhere with your cloud account.",
											)
										: t(
												"cloud.signInDesc",
												"Access your saved songs and synchronized lyrics across all devices.",
											)}
								</Text>
							</Flex>
						</Flex>

						<Separator size="4" my="2" />

						<form onSubmit={handleEmailAuth}>
							<Flex direction="column" gap="3">
								{isSignUp && (
									<Flex direction="column" gap="1">
										<Text size="2" weight="medium">
											{t("cloud.displayName", "Display Name / Nickname")}
										</Text>
										<TextField.Root
											placeholder="e.g. LyricPro"
											value={displayName}
											onChange={(e) => setDisplayName(e.target.value)}
										/>
									</Flex>
								)}

								<Flex direction="column" gap="1">
									<Text size="2" weight="medium">
										{t("cloud.email", "Email Address")}
									</Text>
									<TextField.Root
										type="email"
										placeholder="you@example.com"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										required
									/>
								</Flex>

								<Flex direction="column" gap="1">
									<Text size="2" weight="medium">
										{t("cloud.password", "Password")}
									</Text>
									<TextField.Root
										type="password"
										placeholder="Min 6 characters"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
									/>
								</Flex>

								<Button
									size="3"
									variant="solid"
									disabled={!isConfigured || isSubmitting || authLoading}
									type="submit"
									style={{ cursor: "pointer", marginTop: 8 }}
								>
									{isSubmitting
										? t("cloud.signingIn", "Please wait...")
										: isSignUp
											? t("cloud.createAccount", "Create Account")
											: t("cloud.signIn", "Sign In")}
								</Button>

								<Flex
									justify="center"
									align="center"
									direction="column"
									gap="2"
									mt="2"
								>
									<Button
										size="2"
										variant="ghost"
										color="gray"
										type="button"
										onClick={() => setIsSignUp(!isSignUp)}
									>
										{isSignUp
											? t(
													"cloud.alreadyHaveAccount",
													"Already have an account? Sign In",
												)
											: t(
													"cloud.dontHaveAccount",
													"Don't have an account? Sign Up",
												)}
									</Button>
									<Button
										size="1"
										variant="ghost"
										color="purple"
										type="button"
										style={{ cursor: "pointer" }}
										onClick={() =>
											openExternal("https://ttml.bobjoerules.com/#stats")
										}
									>
										<Globe16Regular style={{ width: 14, height: 14 }} />
										{t(
											"cloud.browseOnlineStats",
											"Explore Community Stats & Leaderboard",
										)}
									</Button>
								</Flex>
							</Flex>
						</form>
					</Flex>
				</Card>
			</Flex>
		);
	}

	const handleOpenEditProfile = () => {
		setEditDisplayName(user?.displayName || "");
		setCustomPhotoUrl(user?.photoURL || "");
		setIsEditProfileOpen(true);
	};

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;
		const file = files[0];
		if (!file.type.startsWith("image/")) {
			toast.error("Please select a valid image file (PNG, JPG, GIF, WebP).");
			return;
		}

		try {
			setIsUploadingPhoto(true);
			const url = await uploadProfilePhoto(file);
			setCustomPhotoUrl(url);
			toast.success("Profile photo uploaded successfully!");
		} catch (err: unknown) {
			toast.error((err as Error)?.message || "Failed to upload photo");
		} finally {
			setIsUploadingPhoto(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const handleSaveProfile = async () => {
		try {
			setIsUploadingPhoto(true);
			await updateUserProfileDetails({
				displayName: editDisplayName.trim() || undefined,
				photoURL: customPhotoUrl.trim() || undefined,
			});
			toast.success("Profile updated successfully!");
			setIsEditProfileOpen(false);
		} catch (err: unknown) {
			toast.error((err as Error)?.message || "Failed to update profile");
		} finally {
			setIsUploadingPhoto(false);
		}
	};

	return (
		<Flex direction="column" gap="4">
			{/* Hidden file input for avatar uploading */}
			<input
				type="file"
				ref={fileInputRef}
				accept="image/*"
				style={{ display: "none" }}
				onChange={handleFileSelect}
			/>

			{/* Profile Info Header */}
			<Card
				variant="classic"
				style={{ background: "var(--gray-a2)", padding: 20 }}
			>
				<Flex justify="between" align="center" wrap="wrap" gap="3">
					<Flex align="center" gap="4">
						<Box
							style={{ position: "relative", cursor: "pointer" }}
							onClick={handleOpenEditProfile}
							title="Click to edit profile & avatar"
						>
							<Avatar
								size="5"
								src={user.photoURL || undefined}
								fallback={
									user.displayName?.[0]?.toUpperCase() ||
									user.email?.[0]?.toUpperCase() ||
									"U"
								}
								radius="full"
								style={{
									border: "2px solid var(--accent-9)",
									boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
								}}
							/>
							<Box
								style={{
									position: "absolute",
									bottom: -2,
									right: -2,
									background: "var(--accent-9)",
									color: "white",
									borderRadius: "50%",
									width: 20,
									height: 20,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
								}}
							>
								<Camera24Regular style={{ width: 12, height: 12 }} />
							</Box>
						</Box>

						<Flex direction="column" gap="1">
							<Flex align="center" gap="2">
								<Heading size="4">
									{user.displayName || user.email?.split("@")[0]}
								</Heading>
								<Badge
									color="green"
									size="1"
									variant="soft"
									radius="full"
									style={{
										display: "inline-flex",
										alignItems: "center",
										gap: "5px",
										padding: "2px 8px",
										fontWeight: 500,
									}}
								>
									<span
										style={{
											width: 6,
											height: 6,
											borderRadius: "50%",
											backgroundColor: "var(--green-9)",
											display: "inline-block",
											flexShrink: 0,
										}}
									/>
									{t("cloud.synced", "Synced")}
								</Badge>
								{isMod && (
									<Badge
										color="amber"
										size="1"
										variant="surface"
										radius="full"
										style={{
											display: "inline-flex",
											alignItems: "center",
											gap: "4px",
											padding: "2px 8px",
											fontWeight: 600,
										}}
									>
										<ShieldCheckmarkRegular style={{ width: 13, height: 13 }} />
										<span>MODERATOR</span>
									</Badge>
								)}
							</Flex>
							{user.email && (
								<Text size="2" color="gray">
									{user.email}
								</Text>
							)}
						</Flex>
					</Flex>

					<Flex gap="2">
						<Button variant="soft" size="2" onClick={handleOpenEditProfile}>
							<Edit24Regular style={{ width: 16, height: 16 }} />
							{t("cloud.editProfile", "Edit Profile & Avatar")}
						</Button>
						<Button
							variant="soft"
							color="gray"
							size="2"
							loading={isRefreshing}
							onClick={handleRefresh}
						>
							<ArrowClockwise24Regular style={{ width: 16, height: 16 }} />
							{t("cloud.refresh", "Refresh")}
						</Button>
						<Button variant="soft" color="red" size="2" onClick={handleSignOut}>
							{t("cloud.signOut", "Sign Out")}
						</Button>
					</Flex>
				</Flex>
			</Card>

			{/* Edit Profile & Avatar Dialog */}
			<Dialog.Root open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
				<Dialog.Content style={{ maxWidth: 450 }}>
					<Dialog.Title>
						{t("cloud.editProfileTitle", "Edit User Profile")}
					</Dialog.Title>
					<Dialog.Description size="2" color="gray" mb="4">
						{t(
							"cloud.editProfileDesc",
							"Update your avatar image and display name. Your avatar can also be displayed on Discord Rich Presence.",
						)}
					</Dialog.Description>

					<Flex direction="column" gap="4">
						{/* Avatar Preview & Upload Action */}
						<Flex align="center" gap="4">
							<Avatar
								size="6"
								src={customPhotoUrl || user.photoURL || undefined}
								fallback={
									editDisplayName?.[0]?.toUpperCase() ||
									user.displayName?.[0]?.toUpperCase() ||
									"U"
								}
								radius="full"
								style={{
									border: "2px solid var(--accent-9)",
									flexShrink: 0,
								}}
							/>
							<Flex direction="column" gap="2" style={{ flexGrow: 1 }}>
								<Button
									variant="surface"
									size="2"
									loading={isUploadingPhoto}
									onClick={() => fileInputRef.current?.click()}
									style={{ cursor: "pointer" }}
								>
									<Image24Regular style={{ width: 16, height: 16 }} />
									{t("cloud.uploadNewPhoto", "Upload Image File")}
								</Button>
								<Text size="1" color="gray">
									Supports PNG, JPG, GIF, WebP. Automatically hosted for Discord
									RPC.
								</Text>
							</Flex>
						</Flex>

						<Separator size="4" />

						{/* Photo URL Input */}
						<Flex direction="column" gap="1">
							<Text size="2" weight="medium">
								{t("cloud.photoUrl", "Or Direct Image URL")}
							</Text>
							<TextField.Root
								placeholder="https://i.imgur.com/... or https://..."
								value={customPhotoUrl}
								onChange={(e) => setCustomPhotoUrl(e.target.value)}
							>
								<TextField.Slot>
									<Link24Regular style={{ width: 16, height: 16 }} />
								</TextField.Slot>
							</TextField.Root>
						</Flex>

						{/* Display Name Input */}
						<Flex direction="column" gap="1">
							<Text size="2" weight="medium">
								{t("cloud.displayName", "Display Name / Nickname")}
							</Text>
							<TextField.Root
								placeholder="e.g. LyricPro"
								value={editDisplayName}
								onChange={(e) => setEditDisplayName(e.target.value)}
							/>
						</Flex>

						<Flex gap="3" justify="end" mt="2">
							<Dialog.Close>
								<Button variant="soft" color="gray">
									{t("common.cancel", "Cancel")}
								</Button>
							</Dialog.Close>
							<Button
								variant="solid"
								loading={isUploadingPhoto}
								onClick={handleSaveProfile}
							>
								{t("common.save", "Save Changes")}
							</Button>
						</Flex>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>

			{/* Online Profile & Community Link Card */}
			<Card
				variant="surface"
				style={{
					padding: 16,
					borderRadius: 12,
					border: "1px solid var(--accent-a5)",
					background:
						"linear-gradient(135deg, var(--accent-a3) 0%, var(--purple-a2) 100%)",
				}}
			>
				<Flex justify="between" align="center" wrap="wrap" gap="3">
					<Flex direction="column" gap="1" style={{ flex: 1, minWidth: 220 }}>
						<Flex align="center" gap="2">
							<Globe16Regular style={{ color: "var(--accent-9)" }} />
							<Heading size="3">
								{t(
									"cloud.onlineProfileTitle",
									"Online Creator Profile & Community Hub",
								)}
							</Heading>
						</Flex>
						<Text size="2" color="gray">
							{t(
								"cloud.onlineProfileDesc",
								"View your public profile, synced songs catalog, and community leaderboard stats on the web.",
							)}
						</Text>
					</Flex>

					<Flex align="center" gap="2" wrap="wrap">
						<Button
							variant="solid"
							size="2"
							style={{ cursor: "pointer" }}
							onClick={() =>
								openExternal(
									`https://ttml.bobjoerules.com/#user=${encodeURIComponent(user.uid)}`,
								)
							}
						>
							<Open16Regular style={{ width: 15, height: 15 }} />
							{t("cloud.viewOnlineProfile", "View Public Profile")}
						</Button>
						<Button
							variant="soft"
							color="purple"
							size="2"
							style={{ cursor: "pointer" }}
							onClick={() => openExternal("https://ttml.bobjoerules.com/#stats")}
						>
							{t("cloud.viewCommunityStats", "Community Leaderboard")}
						</Button>
						<Tooltip
							content={t("cloud.copyProfileLink", "Copy online profile URL")}
						>
							<Button
								variant="soft"
								color="gray"
								size="2"
								style={{ cursor: "pointer" }}
								onClick={() => {
									navigator.clipboard.writeText(
										`https://ttml.bobjoerules.com/#user=${encodeURIComponent(user.uid)}`,
									);
									toast.success(
										t(
											"cloud.profileLinkCopied",
											"Profile link copied to clipboard!",
										),
									);
								}}
							>
								<Copy16Regular style={{ width: 15, height: 15 }} />
								{t("cloud.copyLink", "Copy Link")}
							</Button>
						</Tooltip>
					</Flex>
				</Flex>
			</Card>

			{/* User Statistics Grid */}
			<Grid columns="2" gap="3">
				<Card variant="surface" style={{ padding: 16 }}>
					<Flex justify="between" align="start">
						<Flex direction="column" gap="1">
							<Text size="2" color="gray" weight="medium">
								{t("cloud.stats.savedSongs", "Saved TTML Lyrics")}
							</Text>
							<Heading size="6">
								{uniqueSongCount}{" "}
								<Text size="2" color="gray" weight="regular">
									{uniqueSongCount === 1
										? t("cloud.stats.song", "song")
										: t("cloud.stats.songs", "songs")}
								</Text>
							</Heading>
						</Flex>
						<MusicNote224Regular
							style={{ width: 24, height: 24, color: "var(--accent-9)" }}
						/>
					</Flex>
				</Card>

				<Card variant="surface" style={{ padding: 16 }}>
					<Flex justify="between" align="start">
						<Flex direction="column" gap="1">
							<Text size="2" color="gray" weight="medium">
								{t("cloud.stats.totalLines", "Total Synced Lines")}
							</Text>
							<Heading size="6">
								{totalLinesCount.toLocaleString()}{" "}
								<Text size="2" color="gray" weight="regular">
									{t("cloud.stats.lines", "lines")}
								</Text>
							</Heading>
						</Flex>
						<DocumentBulletList24Regular
							style={{ width: 24, height: 24, color: "var(--accent-9)" }}
						/>
					</Flex>
				</Card>

				<Card variant="surface" style={{ padding: 16 }}>
					<Flex justify="between" align="start">
						<Flex direction="column" gap="1">
							<Text size="2" color="gray" weight="medium">
								{t("cloud.stats.playtime", "Synced Music Playtime")}
							</Text>
							<Heading size="6">{formatDuration(totalDurationMs)}</Heading>
						</Flex>
						<Timer24Regular
							style={{ width: 24, height: 24, color: "var(--accent-9)" }}
						/>
					</Flex>
				</Card>

				<Card variant="surface" style={{ padding: 16 }}>
					<Flex justify="between" align="start">
						<Flex direction="column" gap="1">
							<Text size="2" color="gray" weight="medium">
								{t("cloud.stats.uniqueArtists", "Artists Covered")}
							</Text>
							<Heading size="6">
								{uniqueArtistCount}{" "}
								<Text size="2" color="gray" weight="regular">
									{uniqueArtistCount === 1
										? t("cloud.stats.artist", "artist")
										: t("cloud.stats.artists", "artists")}
								</Text>
							</Heading>
						</Flex>
						<Person16Regular
							style={{ width: 24, height: 24, color: "var(--accent-9)" }}
						/>
					</Flex>
				</Card>

				<Card variant="surface" style={{ padding: 16 }}>
					<Flex direction="column" gap="1">
						<Text size="1" color="gray" weight="medium">
							{t("cloud.stats.accountCreated", "Account Created")}
						</Text>
						<Text size="2" weight="bold">
							{creationDateFormatted}
						</Text>
					</Flex>
				</Card>

				<Card variant="surface" style={{ padding: 16 }}>
					<Flex direction="column" gap="1">
						<Text size="1" color="gray" weight="medium">
							{t("cloud.stats.lastSignIn", "Last Active Sign-In")}
						</Text>
						<Text size="2" weight="bold">
							{lastLoginFormatted}
						</Text>
					</Flex>
				</Card>
			</Grid>

			{/* User ID & Technical Info */}
			<Card
				variant="surface"
				style={{ padding: 14, background: "var(--accent-a2)" }}
			>
				<Flex justify="between" align="center">
					<Flex direction="column" gap="1">
						<Text size="1" color="gray" weight="medium">
							Unique Account UID
						</Text>
						<Text size="2" weight="medium" style={{ fontFamily: "monospace" }}>
							{user.uid}
						</Text>
					</Flex>
					<Button
						size="1"
						variant="ghost"
						color="gray"
						onClick={() => {
							navigator.clipboard.writeText(user.uid);
							toast.info("User ID copied to clipboard!");
						}}
					>
						📋 Copy UID
					</Button>
				</Flex>
			</Card>

			{/* Cloud Actions */}
			<Card variant="surface" style={{ padding: 16 }}>
				<Flex direction="column" gap="3">
					<Heading size="3">Cloud Storage Management</Heading>
					<Text size="2" color="gray">
						Manage your online lyric backups, download existing projects, or
						sync your current lyric document to your account.
					</Text>
					<Flex gap="3" mt="1" wrap="wrap">
						<Button variant="solid" onClick={() => handleOpenManager("open")}>
							<Flex align="center" gap="2">
								<CloudDatabase20Regular style={{ width: 16, height: 16 }} />
								Open Cloud Library
							</Flex>
						</Button>
						<Button variant="soft" onClick={() => handleOpenManager("save")}>
							<Flex align="center" gap="2">
								<Save20Regular style={{ width: 16, height: 16 }} />
								Save Current Lyric to Cloud
							</Flex>
						</Button>
					</Flex>
				</Flex>
			</Card>
		</Flex>
	);
});
