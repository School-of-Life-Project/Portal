import { displayError, getSettings } from "../bindings";

const settingsPromise = getSettings().catch((error) => {
	displayError(error);
});

const settingsForm = document.getElementById("settingsRoot");
const settings = await settingsPromise;

if (settingsForm && settings) {
	console.log(settingsForm);
	console.log(settings);
}
