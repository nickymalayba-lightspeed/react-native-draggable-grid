"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findKey = findKey;
exports.findIndex = findIndex;
exports.differenceBy = differenceBy;
function findKey(map, fn) {
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
        if (fn(map[keys[i]])) {
            return keys[i];
        }
    }
    return undefined;
}
function findIndex(arr, fn) {
    for (var i = 0; i < arr.length; i++) {
        if (fn(arr[i])) {
            return i;
        }
    }
    return -1;
}
function differenceBy(arr1, arr2, key) {
    var result = [];
    arr1.forEach(function (item1) {
        var keyValue = item1[key];
        if (!arr2.some(function (item2) { return item2[key] === keyValue; })) {
            result.push(item1);
        }
    });
    return result;
}
//# sourceMappingURL=utils.js.map