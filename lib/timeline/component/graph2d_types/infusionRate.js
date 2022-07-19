const DOMUtil = require('../../../DOMutil');

function InfusionRate(groupId, options) {
}

InfusionRate.drawBackground = function(group, framework) {
    const zeroPosition = group.zeroPosition;
    let subGroups = this.createSubGroups(group);
    subGroups = this.sortBasedOnTimeForSubGroup(subGroups);
    const yElementArray = this.sortDataAndDefineOpacity(subGroups);
    const yMaximum = Math.max(...yElementArray);
    const yMinimum = Math.min(...yElementArray);
    Object.values(subGroups).forEach(subGroup => {
        this.createSVGElement(subGroup, zeroPosition, group.style, yMaximum, yMinimum ,framework);
    });
}

InfusionRate.createSVGElement = function (subGroup, zeroPosition, style, yMaximum, yMinimum ,framework) {
    const rectElement = DOMUtil.getSVGElement('rect', framework.svgElements, framework.svg);
    const length = subGroup.length;
    let opacity = 0.1;
    const mainColorPostion = style.search('#');
    const mainColor = style.substring(mainColorPostion, mainColorPostion + 7);
    if (subGroup[0].y == yMinimum) {
        opacity = 0.1;
    } else {
        opacity = (0.9 * (subGroup[0].y - yMinimum)) / (yMaximum - yMinimum);
        opacity = opacity + 0.1;
    }
    rectElement.setAttribute('id', subGroup[0].index);
    rectElement.setAttribute('x', subGroup[0].screen_x);
    rectElement.setAttribute('y', subGroup[0].screen_y);
    rectElement.setAttribute('width', subGroup[length - 1].screen_x - subGroup[0].screen_x);
    rectElement.setAttribute('height', zeroPosition - subGroup[0].screen_y);
    rectElement.setAttribute('style', `fill: ${mainColor}; fill-opacity: ${opacity}`);
}

InfusionRate.sortBasedOnTimeForSubGroup = function (subGroups) {
    const subGroupsToSort = subGroups;
    for (const subGroupIndex of Object.keys(subGroups)) {
        let sortedArray = subGroupsToSort[subGroupIndex].sort((a, b) => a.screen_x - b.screen_x);
        subGroupsToSort[subGroupIndex] = sortedArray;
    }
    return subGroupsToSort;
}

InfusionRate.sortDataAndDefineOpacity = function (subGroups) {
    const ySetElements = new Set();
    Object.values(subGroups).forEach(subGroup => {
        if (subGroup[0].y && subGroup.length >= 2) {
            ySetElements.add(subGroup[0].y);
        }
    });
    const yElementArray = Array.from(ySetElements);
    return yElementArray;
}

InfusionRate.createSubGroups = function(group) {
    const subGroups = {};
    group.itemsData.forEach(groupItem => {
        if (subGroups.hasOwnProperty(groupItem.index)) {
            subGroups[groupItem.index].push(groupItem);
        } else {
            subGroups[groupItem.index] = [];
            subGroups[groupItem.index].push(groupItem);
        }
    });
    return subGroups;
}

module.exports = InfusionRate;