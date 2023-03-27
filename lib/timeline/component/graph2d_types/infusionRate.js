const DOMUtil = require('../../../DOMutil');
const { BOLUS, INFUSION_RATE } = require('../../../Constants');
function InfusionRate(groupId, options) {
}

InfusionRate.drawBackground = function (group, framework, body) {
    const zeroPosition = group.zeroPosition;
    const infusionRateGroupData = group.itemsData.filter((groupElement) => groupElement.prop.data.element == 'INFUSIONRATE');
    let subGroups = this.createSubGroups(infusionRateGroupData);
    subGroups = this.sortBasedOnTimeForSubGroup(subGroups);
    const yElementArray = this.sortDataAndDefineOpacity(subGroups);
    const yMaximum = Math.max(...yElementArray);
    const yMinimum = Math.min(...yElementArray);
    Object.values(subGroups).forEach(subGroup => {
        this.createSVGElement(subGroup, zeroPosition, group.style, yMaximum, yMinimum, framework, body);
    });
}

InfusionRate.drawBolus = function (group, framework, body) {
    const bolusGroupData = group.filter((groupElement) => groupElement.prop.data.element == 'BOLUS');
    bolusGroupData.forEach((bolusElement) => {
        this.createBolusElement(bolusElement, framework, body);
    });
}

InfusionRate.createSVGElement = function (subGroup, zeroPosition, style, yMaximum, yMinimum, framework, body) {
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
    rectElement.setAttribute('class', INFUSION_RATE.className);
    DOMUtil.attachEvents(rectElement, 'mouseenter', subGroup, (event, element, data) => body.emitter.emit('itemmouseenter', { data, event, element }));
    DOMUtil.attachEvents(rectElement, 'mouseout', subGroup, (event, element, data) => body.emitter.emit('itemmouseout', { data, event, element }));

}


InfusionRate.createBolusElement = function (element, framework, body) {
    const bolusElement = DOMUtil.getSVGElement('circle', framework.svgElements, framework.svg);
    bolusElement.setAttribute('id', element.index);
    bolusElement.setAttribute('cx', element.screen_x);
    bolusElement.setAttribute('cy', element.screen_y);
    bolusElement.setAttribute('r', BOLUS.radius);
    bolusElement.setAttribute('stroke', BOLUS.stroke);
    bolusElement.setAttribute('stroke-width', BOLUS.strokeWidth);
    bolusElement.setAttribute('fill', BOLUS.fill);
    bolusElement.setAttribute('class', BOLUS.className);
    DOMUtil.attachEvents(bolusElement, 'mouseenter', element, (event, element, data) => body.emitter.emit('itemmouseenter', { data, event, element }));
    DOMUtil.attachEvents(bolusElement, 'mouseout', element, (event, element, data) => body.emitter.emit('itemmouseout', { data, event, element }));
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

InfusionRate.createSubGroups = function (itemsData) {
    const subGroups = {};
    itemsData.forEach(groupItem => {
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