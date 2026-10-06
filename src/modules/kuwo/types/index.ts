export interface KuwoSearchTypeItem {
	level?: string;
	bitrate?: string;
	format?: string;
	size?: string;
}

export interface KuwoSearchItem {
	song: string;
	singer: string;
	time: string;
	album: string;
	rid: string;
	picture?: string;
	types?: KuwoSearchTypeItem[];
}

export interface KuwoSongDetail {
	song: string;
	singer: string;
	album: string;
	time: string;
	id: number;
	rid: string;
	picture?: string;
	bitrate?: string;
	format?: string;
	url: string;
	types?: KuwoSearchTypeItem[];
}
