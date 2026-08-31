import type { TTMLLyric } from "$/types/ttml";
import { toast } from "react-toastify";
import { type SectionIssue, validateSections } from "./section-system";

export function formatSectionIssueMessage(issue: SectionIssue): string {
	const prefix =
		issue.lineIndex !== undefined ? `Line ${issue.lineIndex + 1}: ` : "";
	return `${prefix}${issue.message}`;
}

export function notifySectionIssues(lyrics: TTMLLyric): SectionIssue[] {
	const issues = validateSections(lyrics);
	if (issues.length === 0) return issues;

	const hasErrors = issues.some((i) => i.severity === "error");
	const hasWarnings = issues.some((i) => i.severity === "warning");
	const toastFn = hasErrors
		? toast.error
		: hasWarnings
			? toast.warn
			: toast.info;

	const title = `Section review: ${issues.length} non-blocking issue${issues.length === 1 ? "" : "s"}`;

	console.warn(`[Section Review] ${title}:`, issues);

	toastFn(
		<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
			<div style={{ fontWeight: 600, fontSize: "13px" }}>{title}</div>
			<ul
				style={{
					margin: 0,
					paddingLeft: "16px",
					fontSize: "11.5px",
					lineHeight: "1.45",
					maxHeight: "180px",
					overflowY: "auto",
				}}
			>
				{issues.slice(0, 6).map((issue, idx) => {
					const lineLabel =
						issue.lineIndex !== undefined
							? `Line ${issue.lineIndex + 1}: `
							: "";
					return (
						<li key={idx} style={{ marginBottom: "2px" }}>
							{lineLabel && <strong>{lineLabel}</strong>}
							<span>{issue.message}</span>
						</li>
					);
				})}
				{issues.length > 6 && (
					<li style={{ fontStyle: "italic", opacity: 0.8, marginTop: "2px" }}>
						...and {issues.length - 6} more{" "}
						{issues.length - 6 === 1 ? "issue" : "issues"}
					</li>
				)}
			</ul>
		</div>,
		{ autoClose: 8000 },
	);

	return issues;
}
