import { openDataDir, getCourseMaps, getCourses, getCoursesActive, getCourse, setCourseCompletion, setCourseActiveStatus, getOverallProgress, getSettings, setSettings } from "./bindings.ts";

console.log("courseMaps:", getCourseMaps());

console.log("courses:", getCourses());

console.log("activeCourses:", getCoursesActive());

console.log("overallProgress:", getOverallProgress());

console.log("settings:", getSettings());