export const join = (...args: string[]) => {
	return args
		.join("/")
		.replace(/\/+/g, "/")
		.replace(/^https?:\//, (match) => match + "/");
};

export const sep = "/";

export default { join, sep };
