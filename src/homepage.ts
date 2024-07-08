import * as bindings from "./bindings.ts";

console.log("courseMaps:", bindings.getCourseMaps());

console.log("courses:", bindings.getCourses());

console.log("activeCourses:", bindings.getCoursesActive());

console.log("overallProgress:", bindings.getOverallProgress());

console.log("settings:", bindings.getSettings());