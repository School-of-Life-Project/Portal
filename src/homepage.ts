import * as bindings from "./bindings.ts";

console.log("courseMaps:", bindings.getCourseMaps());

console.log("courses:", bindings.getCourses());

console.log("activeCourses:", bindings.getCoursesActive());

console.log("overallProgress:", bindings.getOverallProgress());

console.log("settings:", bindings.getSettings());

/*bindings.getCourse("495da27d107745d5b68d171919bffe9c").then((result) => {
	if (Array.isArray(result)) {
		console.log(result[0].books[0].file);
	}
});*/