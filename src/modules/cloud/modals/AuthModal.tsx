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
	IconButton,
	Separator,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { type FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	signInWithEmail,
	signOutUser,
	signUpWithEmail,
} from "../auth";
import { getFirebaseAuth, isFirebaseConfigured } from "../firebase";
import {
	authLoadingAtom,
	authModalOpenAtom,
	cloudFileManagerOpenAtom,
	cloudTTMLListAtom,
	currentUserAtom,
} from "../states";
import { fetchUserTTMLList } from "../ttmlStorage";

export const AuthModal: FC = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(authModalOpenAtom);
	const user = useAtomValue(currentUserAtom);
	const authLoading = useAtomValue(authLoadingAtom);
	const cloudTTMLList = useAtomValue(cloudTTMLListAtom);
	const setFileManagerOpen = useSetAtom(cloudFileManagerOpenAtom);

	const [isSignUp, setIsSignUp] = useState<boolean>(false);
	const [email, setEmail] = useState<string>("");
	const [password, setPassword] = useState<string>("");
	const [displayName, setDisplayName] = useState<string>("");

	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

	const isConfigured = isFirebaseConfigured();

	// Fetch cloud lyrics count when signed in and modal opens
	useEffect(() => {
		if (open && user) {
			fetchUserTTMLList().catch(console.error);
		}
	}, [open, user]);

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
					month: "short",
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
			return new Date(authUser.metadata.lastSignInTime).toLocaleDateString(
				undefined,
				{
					year: "numeric",
					month: "short",
					day: "numeric",
				},
			);
		} catch {
			return authUser.metadata.lastSignInTime;
		}
	}, [authUser]);

	const { uniqueSongCount, totalLinesCount } = useMemo(() => {
		const uniqueSongs = new Map<string, number>();
		for (const item of cloudTTMLList) {
			const nameKey = (item.title || "").trim().toLowerCase() || item.id;
			const lines = item.lineCount || 0;
			const existing = uniqueSongs.get(nameKey);
			if (existing === undefined || lines > existing) {
				uniqueSongs.set(nameKey, lines);
			}
		}
		let total = 0;
		for (const lines of uniqueSongs.values()) {
			total += lines;
		}
		return {
			uniqueSongCount: uniqueSongs.size,
			totalLinesCount: total,
		};
	}, [cloudTTMLList]);

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
			setOpen(false);
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
				toast.error("An account with this email already exists. Please sign in.");
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

	const handleOpenLibrary = () => {
		setOpen(false);
		setFileManagerOpen(true);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content style={{ maxWidth: 480 }}>
				<Dialog.Title>
					<Flex justify="between" align="center">
						<Heading size="4">
							{user
								? t("cloud.accountTitle", "Cloud Account & Statistics")
								: isSignUp
									? t("cloud.createAccount", "Create Cloud Account")
									: t("cloud.signInTitle", "Sign in to TTML Cloud")}
						</Heading>
						<Dialog.Close>
							<IconButton variant="ghost" color="gray" size="1">
								✕
							</IconButton>
						</Dialog.Close>
					</Flex>
				</Dialog.Title>

				{user ? (
					<Flex direction="column" gap="4" mt="3">
						{/* User Header Profile */}
						<Card variant="classic" style={{ background: "var(--gray-a2)", padding: 16 }}>
							<Flex justify="between" align="center">
								<Flex align="center" gap="3">
									<Avatar
										size="4"
										src={user.photoURL || undefined}
										fallback={
											user.displayName?.[0]?.toUpperCase() ||
											user.email?.[0]?.toUpperCase() ||
											"U"
										}
										radius="full"
									/>
									<Flex direction="column" gap="1" style={{ overflow: "hidden" }}>
										<Text weight="bold" size="3" truncate>
											{user.displayName || user.email?.split("@")[0]}
										</Text>
										{user.email && (
											<Text size="2" color="gray" truncate>
												{user.email}
											</Text>
										)}
									</Flex>
								</Flex>
								<Badge color="green" size="2" variant="surface">
									● Synced
								</Badge>
							</Flex>
						</Card>

						{/* Account Stats Grid */}
						<Grid columns="2" gap="3">
							<Card variant="surface" style={{ padding: 12 }}>
								<Flex direction="column" gap="1">
									<Text size="1" color="gray">
										🎵 Saved Lyrics
									</Text>
									<Text size="4" weight="bold">
										{uniqueSongCount}{" "}
										<Text size="1" color="gray" weight="normal">
											{uniqueSongCount === 1 ? "song" : "songs"}
										</Text>
									</Text>
								</Flex>
							</Card>

							<Card variant="surface" style={{ padding: 12 }}>
								<Flex direction="column" gap="1">
									<Text size="1" color="gray">
										📝 Synced Lines
									</Text>
									<Text size="4" weight="bold">
										{totalLinesCount}{" "}
										<Text size="1" color="gray" weight="normal">
											lines
										</Text>
									</Text>
								</Flex>
							</Card>

							<Card variant="surface" style={{ padding: 12 }}>
								<Flex direction="column" gap="1">
									<Text size="1" color="gray">
										📅 Member Since
									</Text>
									<Text size="2" weight="bold">
										{creationDateFormatted}
									</Text>
								</Flex>
							</Card>

							<Card variant="surface" style={{ padding: 12 }}>
								<Flex direction="column" gap="1">
									<Text size="1" color="gray">
										🕒 Last Sign-In
									</Text>
									<Text size="2" weight="bold">
										{lastLoginFormatted}
									</Text>
								</Flex>
							</Card>
						</Grid>

						<Card variant="surface" style={{ background: "var(--accent-a2)", padding: 10 }}>
							<Flex justify="between" align="center">
								<Flex direction="column">
									<Text size="1" color="gray">
										User ID
									</Text>
									<Text size="1" weight="medium" style={{ fontFamily: "monospace" }}>
										{user.uid.slice(0, 16)}...
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

						<Separator size="4" />

						{/* Action Buttons */}
						<Flex justify="between" align="center" mt="1">
							<Button variant="soft" color="red" onClick={handleSignOut}>
								{t("cloud.signOut", "Sign Out")}
							</Button>

							<Flex gap="2">
								<Button variant="solid" color="indigo" onClick={handleOpenLibrary}>
									📂 Open Cloud Library
								</Button>
								<Dialog.Close>
									<Button variant="soft">{t("common.done", "Done")}</Button>
								</Dialog.Close>
							</Flex>
						</Flex>
					</Flex>
				) : (
					<form onSubmit={handleEmailAuth}>
						<Flex direction="column" gap="3" mt="3">
							<Text size="2" color="gray">
								{isSignUp
									? "Create an account to save and sync your TTML lyrics across all your devices."
									: "Sign in with your email and password to access your cloud-saved TTML lyrics."}
							</Text>

							{isSignUp && (
								<Flex direction="column" gap="1">
									<Text size="1" weight="medium">
										{t("cloud.displayName", "Display Name / Nickname")}
									</Text>
									<TextField.Root
										placeholder="e.g. lyricMaster"
										value={displayName}
										onChange={(e) => setDisplayName(e.target.value)}
									/>
								</Flex>
							)}

							<Flex direction="column" gap="1">
								<Text size="1" weight="medium">
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
								<Text size="1" weight="medium">
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
								style={{ cursor: "pointer", marginTop: 6 }}
							>
								{isSubmitting
									? t("cloud.signingIn", "Please wait...")
									: isSignUp
										? t("cloud.createAccount", "Create Account")
										: t("cloud.signIn", "Sign In")}
							</Button>

							<Separator size="4" my="1" />

							<Flex justify="center">
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
							</Flex>
						</Flex>
					</form>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
};
