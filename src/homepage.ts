import * as bindings from "./bindings.ts";
//import { LongTermProgressGraph } from "./graphing/main.ts";
import { graphCourse, graphProgress } from "./homepage/shared.ts";

//console.log("courseMaps:", bindings.getCourseMaps());

//console.log("courses:", bindings.getCourses());

console.log("activeCourses:", bindings.getCoursesActive());

/*bindings.getCourse("495da27d107745d5b68d171919bffe9c").then((result) => {
	if (Array.isArray(result)) {
		console.log(result[0].books[0].file);
	}
});*/

const settings = await bindings.getSettings();

const container = document.getElementById("activeCourses");

if (container) {
	const courses = await bindings.getCourses();

	courses.sort((a, b) => {
		if (a.Ok && b.Ok) {
			const newA = a.Ok[0].title;
			const newB = b.Ok[0].title;

			if (newA < newB) {
				return -1;
			} else if (newA > newB) {
				return 1;
			}
		}
		return 0;
	});

	for (const course of courses) {
		if (course.Ok) {
			container.appendChild(graphCourse(settings, course.Ok[0], course.Ok[1]));
		}
	}
}

const graphContainer = document.getElementById("progressGraphs");

if (graphContainer) {
	const progress = await bindings.getOverallProgress();

	const [timeGraph, sectionGraph] = graphProgress(settings, progress);

	graphContainer.appendChild(timeGraph);
	graphContainer.appendChild(sectionGraph);
}

/*const container1 = document.createElement("section");

const longTerm1 = new LongTermProgressGraph(
	"time",
	undefined,
	undefined,
	undefined,
);
//longTerm1.update([0, 60, 120, 180, 240, 300, 301], 0);

container1.appendChild(longTerm1.element);

const container2 = document.createElement("section");

const longTerm2 = new LongTermProgressGraph(
	"chapter",
	undefined,
	undefined,
	undefined,
);
longTerm2.update(
	[NaN, NaN, 0, 0.5, 1, 1.5, 1.6, 0, 0, 1, 0.6, 0.3, 1.1, 1.4, 1.5, 1.6, 1, 0],
	2,
);

container2.appendChild(longTerm2.element);

document.body.appendChild(container1);
document.body.appendChild(container2);*/
