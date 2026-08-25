import {
	Avatar,
	Badge,
	Button,
	Card,
	Container,
	Flex,
	Heading,
	Separator,
	Text,
} from "@radix-ui/themes";
import {
	GithubAuthProvider,
	GoogleAuthProvider,
	OAuthProvider,
	type User,
	onAuthStateChanged,
	signInWithPopup,
	signInWithRedirect,
	signOut,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { type FC, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { getFirebaseAuth, getFirebaseFirestore, initFirebase } from "../firebase";

export interface BridgeTokenPayload {
	type: "amll-ttml-auth-token";
	providerId: string;
	idToken?: string;
	accessToken?: string;
	email?: string | null;
	displayName?: string | null;
	photoURL?: string | null;
	uid: string;
	timestamp: number;
}

export const AuthBridge: FC = () => {
	const [user, setUser] = useState<User | null>(null);
	const [copied, setCopied] = useState<boolean>(false);
	const [isLoggingIn, setIsLoggingIn] = useState<string | null>(null);
	const [autoSynced, setAutoSynced] = useState<boolean>(false);

	const sessionId = new URLSearchParams(
		typeof window !== "undefined" ? window.location.search : "",
	).get("session");

	useEffect(() => {
		const { auth } = initFirebase();
		if (auth) {
			import("firebase/auth").then(({ getRedirectResult }) => {
				getRedirectResult(auth).then(async (res) => {
					if (res?.user) {
						setUser(res.user);
						if (sessionId) {
							await syncSessionToFirestore(
								res.user,
								res.user.providerData[0]?.providerId || "google.com",
							);
						}
					}
				}).catch(console.error);
			});

			return onAuthStateChanged(auth, async (currentUser) => {
				setUser(currentUser);
				if (currentUser && sessionId) {
					await syncSessionToFirestore(
						currentUser,
						currentUser.providerData[0]?.providerId || "google.com",
					);
				}
			});
		}
	}, [sessionId]);

	const syncSessionToFirestore = async (
		currentUser: User,
		providerId: string,
		idToken?: string,
		accessToken?: string,
	) => {
		try {
			const token = await currentUser.getIdToken(true);
			const payload: BridgeTokenPayload = {
				type: "amll-ttml-auth-token",
				providerId,
				idToken: idToken || token,
				accessToken,
				email: currentUser.email,
				displayName: currentUser.displayName,
				photoURL: currentUser.photoURL,
				uid: currentUser.uid,
				timestamp: Date.now(),
			};

			const serialized = btoa(
				unescape(encodeURIComponent(JSON.stringify(payload))),
			);

			if (sessionId) {
				const db = getFirebaseFirestore();
				await setDoc(doc(db, "auth_sessions", sessionId), {
					status: "completed",
					payload: serialized,
					updatedAt: Date.now(),
				});
				setAutoSynced(true);
				toast.success("Desktop app automatically synced!");
			}

			try {
				await navigator.clipboard.writeText(serialized);
				setCopied(true);
			} catch {}
		} catch (e) {
			console.error("Failed to sync session to firestore", e);
		}
	};

	const handleGoogleLogin = async () => {
		try {
			setIsLoggingIn("google");
			const auth = getFirebaseAuth();
			const provider = new GoogleAuthProvider();
			provider.addScope("profile");
			provider.addScope("email");
			provider.setCustomParameters({ prompt: "select_account" });
			try {
				const result = await signInWithPopup(auth, provider);
				const credential = GoogleAuthProvider.credentialFromResult(result);
				await syncSessionToFirestore(
					result.user,
					"google.com",
					credential?.idToken,
					credential?.accessToken,
				);
			} catch (popupErr: unknown) {
				console.warn("Popup blocked or closed, falling back to redirect...", popupErr);
				await signInWithRedirect(auth, provider);
			}
		} catch (err: unknown) {
			console.error(err);
			toast.error((err as Error)?.message || "Google sign-in failed");
		} finally {
			setIsLoggingIn(null);
		}
	};

	const handleGitHubLogin = async () => {
		try {
			setIsLoggingIn("github");
			const auth = getFirebaseAuth();
			const provider = new GithubAuthProvider();
			provider.addScope("read:user");
			provider.addScope("user:email");
			try {
				const result = await signInWithPopup(auth, provider);
				const credential = GithubAuthProvider.credentialFromResult(result);
				await syncSessionToFirestore(
					result.user,
					"github.com",
					undefined,
					credential?.accessToken,
				);
			} catch (popupErr: unknown) {
				console.warn("Popup blocked or closed, falling back to redirect...", popupErr);
				await signInWithRedirect(auth, provider);
			}
		} catch (err: unknown) {
			console.error(err);
			toast.error((err as Error)?.message || "GitHub sign-in failed");
		} finally {
			setIsLoggingIn(null);
		}
	};

	const handleAppleLogin = async () => {
		try {
			setIsLoggingIn("apple");
			const auth = getFirebaseAuth();
			const provider = new OAuthProvider("apple.com");
			provider.addScope("email");
			provider.addScope("name");
			try {
				const result = await signInWithPopup(auth, provider);
				const credential = provider.credentialFromResult(result);
				await syncSessionToFirestore(
					result.user,
					"apple.com",
					credential?.idToken,
					credential?.accessToken,
				);
			} catch (popupErr: unknown) {
				console.warn("Popup blocked or closed, falling back to redirect...", popupErr);
				await signInWithRedirect(auth, provider);
			}
		} catch (err: unknown) {
			console.error(err);
			toast.error((err as Error)?.message || "Apple sign-in failed");
		} finally {
			setIsLoggingIn(null);
		}
	};

	const handleCopyExisting = async () => {
		if (!user) return;
		await syncSessionToFirestore(
			user,
			user.providerData[0]?.providerId || "google.com",
		);
		toast.success("Token copied to clipboard!");
	};

	const handleSignOut = async () => {
		const auth = getFirebaseAuth();
		await signOut(auth);
		setAutoSynced(false);
		setCopied(false);
	};

	return (
		<Container size="2" py="6" px="4">
			<Flex direction="column" align="center" gap="4">
				<Card style={{ width: "100%", maxWidth: 480, padding: 24 }}>
					<Flex direction="column" gap="4">
						<Flex direction="column" align="center" gap="2">
							<Heading size="5">🔗 TTML Tool Desktop Login</Heading>
							<Text size="2" color="gray" align="center">
								Sign in below in your web browser to securely sync your account with the Desktop App.
							</Text>
						</Flex>

						<Separator size="4" />

						{user ? (
							<Flex direction="column" gap="3">
								<Card
									variant="classic"
									style={{
										background: autoSynced ? "var(--green-a3)" : "var(--gray-a2)",
										borderColor: autoSynced ? "var(--green-7)" : undefined,
									}}
								>
									<Flex align="center" gap="3">
										<Avatar
											size="4"
											src={user.photoURL || undefined}
											fallback={user.displayName?.[0]?.toUpperCase() || "U"}
											radius="full"
										/>
										<Flex direction="column" gap="1" style={{ overflow: "hidden" }}>
											<Text weight="bold" size="3" truncate>
												{user.displayName}
											</Text>
											{user.email && (
												<Text size="2" color="gray" truncate>
													{user.email}
												</Text>
											)}
											<Badge color="green" size="1" style={{ width: "fit-content" }}>
												{autoSynced ? "✓ Auto-Synced to Desktop" : "Signed In"}
											</Badge>
										</Flex>
									</Flex>
								</Card>

								{autoSynced ? (
									<Card variant="surface" style={{ background: "var(--green-a2)" }}>
										<Text size="2" color="green" weight="bold" align="center">
											🎉 Login Successful! Your Desktop App is already signed in. You can close this tab!
										</Text>
									</Card>
								) : (
									<Button
										size="3"
										variant="solid"
										color="green"
										onClick={handleCopyExisting}
										style={{ cursor: "pointer" }}
									>
										{copied ? "✓ Copied to Clipboard!" : "📋 Copy Login Token to Desktop"}
									</Button>
								)}

								<Flex justify="end" mt="2">
									<Button size="1" variant="ghost" color="red" onClick={handleSignOut}>
										Sign Out / Switch Account
									</Button>
								</Flex>
							</Flex>
						) : (
							<Flex direction="column" gap="3">
								<Button
									size="3"
									variant="surface"
									color="gray"
									disabled={isLoggingIn !== null}
									onClick={handleGoogleLogin}
									style={{
										cursor: "pointer",
										display: "flex",
										justifyContent: "center",
										gap: 10,
									}}
								>
									<svg width="18" height="18" viewBox="0 0 24 24">
										<path
											fill="#EA4335"
											d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
										/>
										<path
											fill="#4285F4"
											d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
										/>
										<path
											fill="#FBBC05"
											d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1c0 2.8.7 5.4 1.9 7.8l3.7-2.9z"
										/>
										<path
											fill="#34A853"
											d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
										/>
									</svg>
									<Text weight="medium">
										{isLoggingIn === "google"
											? "Signing in..."
											: "Sign in with Google"}
									</Text>
								</Button>

								<Button
									size="3"
									variant="surface"
									color="gray"
									disabled={isLoggingIn !== null}
									onClick={handleAppleLogin}
									style={{
										cursor: "pointer",
										display: "flex",
										justifyContent: "center",
										gap: 10,
									}}
								>
									<svg
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="currentColor"
									>
										<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.07 1.72-.94 2.74 1.01.08 2.03-.49 2.65-1.24z" />
									</svg>
									<Text weight="medium">
										{isLoggingIn === "apple"
											? "Signing in..."
											: "Sign in with Apple"}
									</Text>
								</Button>

								<Button
									size="3"
									variant="surface"
									color="gray"
									disabled={isLoggingIn !== null}
									onClick={handleGitHubLogin}
									style={{
										cursor: "pointer",
										display: "flex",
										justifyContent: "center",
										gap: 10,
									}}
								>
									<svg
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="currentColor"
									>
										<path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
									</svg>
									<Text weight="medium">
										{isLoggingIn === "github"
											? "Signing in..."
											: "Sign in with GitHub"}
									</Text>
								</Button>
							</Flex>
						)}
					</Flex>
				</Card>
			</Flex>
		</Container>
	);
};
