export interface BackgroundGradient {
	id: string;
	name: string;
	css: string;
}

export const backgroundGradients: BackgroundGradient[] = [
	{
		id: "sunset",
		name: "Sunset",
		css: "linear-gradient(to top right, #ffafbd, #ffc3a0)",
	},
	{
		id: "ocean",
		name: "Ocean",
		css: "linear-gradient(to top right, #2193b0, #6dd5ed)",
	},
	{
		id: "aurora",
		name: "Aurora",
		css: "linear-gradient(60deg, #abecd6 0%, #fbedad 100%)",
	},
	{
		id: "midnight",
		name: "Midnight",
		css: "radial-gradient(circle at top left, #232526, #414345)",
	},
	{
		id: "mystic",
		name: "Mystic",
		css: "linear-gradient(to top right, #7028e4 0%, #e5b2ca 100%)",
	},
	{
		id: "grass",
		name: "Grass",
		css: "linear-gradient(to top right, #11998e, #38ef7d)",
	},
	{
		id: "fire",
		name: "Fire",
		css: "linear-gradient(to top right, #f83600 0%, #f9d423 100%)",
	},
	{
		id: "frost",
		name: "Frost",
		css: "linear-gradient(to top right, #00c6ff, #0072ff)",
	},
];
