import resources from "virtual:i18next-loader";
import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";

type TranslationResource = typeof resources;

declare module "i18next" {
	interface CustomTypeOptions {
		resources: {
			translation: TranslationResource;
		};
		defaultNS: "translation";
		returnNull: false;
		allowedKeys: keyof TranslationResource;
	}
}

const savedLanguage =
	typeof localStorage !== "undefined" ? localStorage.getItem("language") : null;
const initialLanguage = savedLanguage || "en-US";

i18n
	.use(initReactI18next)
	.use(ICU)
	.init({
		resources,
		lng: initialLanguage,
		fallbackLng: "en-US",
		debug: import.meta.env.DEV,
		interpolation: {
			escapeValue: false,
		},
		returnNull: false,
	})
	.then(() => {
		if (typeof document !== "undefined") {
			document.documentElement.lang =
				i18n.resolvedLanguage || i18n.language || "en-US";
		}
	});

export default i18n;
