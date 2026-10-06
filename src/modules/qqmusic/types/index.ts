export interface QqMusicSearchItem {
	song_title: string;
	singer_name: string;
	song_mid: string;
	pay?: string;
}

export interface QqMusicSongDetail {
	song_name: string;
	song_title: string;
	album_name: string;
	album_title: string;
	song_id: number;
	song_mid: string;
	song_play_time?: number;
	duration?: string;
	singer_name: string;
	singer_id?: number;
	singer_mid?: string;
	singer_pic?: string;
	album_pic?: string;
	song_play_url?: string;
	song_play_url_sq?: string; // FLAC
	song_play_url_hq?: string; // M4A high
	song_play_url_standard?: string;
	song_filename_sq?: string;
	song_filename_hq?: string;
	song_lyric?: string;
	lyric?: string;
}
