//#region src/timer-event-types.ts
var CMD_INITIALISE = "init";
var CMD_START = "start";
var CMD_STOP = "stop";
var CMD_UPDATE = "update";
var CMD_ADJUST_DRIFT = "adjust-drift";
var EVENT_READY = "ready";
var EVENT_STARTING = "starting";
var EVENT_STOPPING = "stopping";
var EVENT_TICK = "tick";
//#endregion
//#region \0@oxc-project+runtime@0.130.0/helpers/checkPrivateRedeclaration.js
function _checkPrivateRedeclaration(e, t) {
	if (t.has(e)) throw new TypeError("Cannot initialize the same private elements twice on an object");
}
//#endregion
//#region \0@oxc-project+runtime@0.130.0/helpers/classPrivateFieldInitSpec.js
function _classPrivateFieldInitSpec(e, t, a) {
	_checkPrivateRedeclaration(e, t), t.set(e, a);
}
//#endregion
//#region \0@oxc-project+runtime@0.130.0/helpers/assertClassBrand.js
function _assertClassBrand(e, t, n) {
	if ("function" == typeof e ? e === t : e.has(t)) return arguments.length < 3 ? t : n;
	throw new TypeError("Private element is not present on this object");
}
//#endregion
//#region \0@oxc-project+runtime@0.130.0/helpers/classPrivateFieldGet2.js
function _classPrivateFieldGet2(s, a) {
	return s.get(_assertClassBrand(s, a));
}
//#endregion
//#region \0@oxc-project+runtime@0.130.0/helpers/classPrivateFieldSet2.js
function _classPrivateFieldSet2(s, a, r) {
	return s.set(_assertClassBrand(s, a), r), r;
}
//#endregion
export { _checkPrivateRedeclaration as a, CMD_START as c, EVENT_READY as d, EVENT_STARTING as f, _classPrivateFieldInitSpec as i, CMD_STOP as l, EVENT_TICK as m, _classPrivateFieldGet2 as n, CMD_ADJUST_DRIFT as o, EVENT_STOPPING as p, _assertClassBrand as r, CMD_INITIALISE as s, _classPrivateFieldSet2 as t, CMD_UPDATE as u };

//# sourceMappingURL=classPrivateFieldSet2.js.map