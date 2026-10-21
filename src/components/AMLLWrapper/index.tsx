import { memo } from "react";
import SpicyLyrics from "$/components/SpicyLyrics";

export interface AMLLWrapperProps {
	variant?: "standard" | "toxi";
	isPanel?: boolean;
}

export const AMLLWrapper = memo<AMLLWrapperProps>(({ isPanel }) => {
	return <SpicyLyrics isPanel={isPanel} />;
});

export default AMLLWrapper;
