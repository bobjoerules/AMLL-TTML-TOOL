import { Button, Card, Grid } from "@radix-ui/themes";
import { useStore } from "jotai";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import {
	keyMoveNextWordAtom,
	keyMovePrevWordAtom,
	keySyncEndAtom,
	keySyncNextAtom,
	keySyncStartAtom,
} from "$/states/keybindings.ts";
import { forceInvokeKeyBindingAtom } from "$/utils/keybindings.ts";
import styles from "./index.module.css";

export const TouchSyncPanel: FC = () => {
	const store = useStore();
	const { t } = useTranslation();
	return (
		<Card m="2" mt="0" style={{ flexShrink: "0" }}>
			<Grid rows="2" columns="6" gap="2" className={styles.syncButtons}>
				<Button
					variant="soft"
					size="4"
					style={{ gridColumn: "span 3" }}
					onMouseDown={(evt) =>
						forceInvokeKeyBindingAtom(
							store,
							keyMovePrevWordAtom,
							evt.nativeEvent,
						)
					}
					onTouchStart={(evt) =>
						forceInvokeKeyBindingAtom(
							store,
							keyMovePrevWordAtom,
							evt.nativeEvent,
						)
					}
				>
					{t("touchSyncPanel.prevWord", "Previous Word")}
				</Button>

				<Button
					variant="soft"
					size="4"
					style={{ gridColumn: "span 3" }}
					onMouseDown={(evt) =>
						forceInvokeKeyBindingAtom(
							store,
							keyMoveNextWordAtom,
							evt.nativeEvent,
						)
					}
					onTouchStart={(evt) =>
						forceInvokeKeyBindingAtom(
							store,
							keyMoveNextWordAtom,
							evt.nativeEvent,
						)
					}
				>
					{t("touchSyncPanel.nextWord", "Next Word")}
				</Button>
				<Button
					variant="soft"
					size="4"
					style={{ gridColumn: "span 2" }}
					onMouseDown={(evt) =>
						forceInvokeKeyBindingAtom(store, keySyncStartAtom, evt.nativeEvent)
					}
					onTouchStart={(evt) =>
						forceInvokeKeyBindingAtom(store, keySyncStartAtom, evt.nativeEvent)
					}
				>
					{t("ribbonBar.syncMode.startSync", "Start Sync")}
				</Button>
				<Button
					variant="soft"
					size="4"
					style={{ gridColumn: "span 2" }}
					onMouseDown={(evt) =>
						forceInvokeKeyBindingAtom(store, keySyncNextAtom, evt.nativeEvent)
					}
					onTouchStart={(evt) =>
						forceInvokeKeyBindingAtom(store, keySyncNextAtom, evt.nativeEvent)
					}
				>
					{t("ribbonBar.syncMode.continuousSync", "Continuous Sync")}
				</Button>
				<Button
					variant="soft"
					size="4"
					style={{ gridColumn: "span 2" }}
					onMouseDown={(evt) =>
						forceInvokeKeyBindingAtom(store, keySyncEndAtom, evt.nativeEvent)
					}
					onTouchStart={(evt) =>
						forceInvokeKeyBindingAtom(store, keySyncEndAtom, evt.nativeEvent)
					}
				>
					{t("ribbonBar.syncMode.endSync", "End Sync")}
				</Button>
			</Grid>
		</Card>
	);
};
