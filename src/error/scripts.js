const params = new URLSearchParams(window.location.search);
const message = params.get("message");
const cause = params.get("cause");

if (message) {
	document.getElementById("message").innerText = message;
}

if (cause) {
	document.getElementById("cause").innerText = cause;
}
