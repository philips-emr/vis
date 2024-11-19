import { CROSS, ARROW, PARTOGRAM_HEAD_POSITION_DEGREE } from './Constants';

// DOM utility methods

/**
 * this prepares the JSON container for allocating SVG elements
 * @param JSONcontainer
 * @private
 */
exports.prepareElements = function(JSONcontainer) {
  // cleanup the redundant svgElements;
  for (var elementType in JSONcontainer) {
    if (JSONcontainer.hasOwnProperty(elementType)) {
      JSONcontainer[elementType].redundant = JSONcontainer[elementType].used;
      JSONcontainer[elementType].used = [];
    }
  }
};

/**
 * this cleans up all the unused SVG elements. By asking for the parentNode, we only need to supply the JSON container from
 * which to remove the redundant elements.
 *
 * @param JSONcontainer
 * @private
 */
exports.cleanupElements = function(JSONcontainer) {
  // cleanup the redundant svgElements;
  for (var elementType in JSONcontainer) {
    if (JSONcontainer.hasOwnProperty(elementType)) {
      if (JSONcontainer[elementType].redundant) {
        for (var i = 0; i < JSONcontainer[elementType].redundant.length; i++) {
          JSONcontainer[elementType].redundant[i].parentNode.removeChild(JSONcontainer[elementType].redundant[i]);
        }
        JSONcontainer[elementType].redundant = [];
      }
    }
  }
};

/**
 * Ensures that all elements are removed first up so they can be recreated cleanly
 * @param JSONcontainer
 */
exports.resetElements = function(JSONcontainer) {
  exports.prepareElements(JSONcontainer);
  exports.cleanupElements(JSONcontainer);
  exports.prepareElements(JSONcontainer);
}

/**
 * Allocate or generate an SVG element if needed. Store a reference to it in the JSON container and draw it in the svgContainer
 * the JSON container and the SVG container have to be supplied so other svg containers (like the legend) can use this.
 *
 * @param elementType
 * @param JSONcontainer
 * @param svgContainer
 * @returns {*}
 * @private
 */
exports.getSVGElement = function (elementType, JSONcontainer, svgContainer) {
  var element;
  // allocate SVG element, if it doesnt yet exist, create one.
  if (JSONcontainer.hasOwnProperty(elementType)) { // this element has been created before
    // check if there is an redundant element
    if (JSONcontainer[elementType].redundant.length > 0) {
      element = JSONcontainer[elementType].redundant[0];
      JSONcontainer[elementType].redundant.shift();
    }
    else {
      // create a new element and add it to the SVG
      element = document.createElementNS('http://www.w3.org/2000/svg', elementType);
      svgContainer.appendChild(element);
    }
  }
  else {
    // create a new element and add it to the SVG, also create a new object in the svgElements to keep track of it.
    element = document.createElementNS('http://www.w3.org/2000/svg', elementType);
    JSONcontainer[elementType] = {used: [], redundant: []};
    svgContainer.appendChild(element);
  }
  JSONcontainer[elementType].used.push(element);
  return element;
};


/**
 * Allocate or generate an SVG element if needed. Store a reference to it in the JSON container and draw it in the svgContainer
 * the JSON container and the SVG container have to be supplied so other svg containers (like the legend) can use this.
 *
 * @param elementType
 * @param JSONcontainer
 * @param DOMContainer
 * @returns {*}
 * @private
 */
exports.getDOMElement = function (elementType, JSONcontainer, DOMContainer, insertBefore) {
  var element;
  // allocate DOM element, if it doesnt yet exist, create one.
  if (JSONcontainer.hasOwnProperty(elementType)) { // this element has been created before
    // check if there is an redundant element
    if (JSONcontainer[elementType].redundant.length > 0) {
      element = JSONcontainer[elementType].redundant[0];
      JSONcontainer[elementType].redundant.shift();
    }
    else {
      // create a new element and add it to the SVG
      element = document.createElement(elementType);
      if (insertBefore !== undefined) {
        DOMContainer.insertBefore(element, insertBefore);
      }
      else {
        DOMContainer.appendChild(element);
      }
    }
  }
  else {
    // create a new element and add it to the SVG, also create a new object in the svgElements to keep track of it.
    element = document.createElement(elementType);
    JSONcontainer[elementType] = {used: [], redundant: []};
    if (insertBefore !== undefined) {
      DOMContainer.insertBefore(element, insertBefore);
    }
    else {
      DOMContainer.appendChild(element);
    }
  }
  JSONcontainer[elementType].used.push(element);
  return element;
};

/**
 * Extract the searching style value.
 * @param {*} styleKey The style key that you are looking for.
 * @param {*} stylesStr A full style string.
 * 
 * @returns the value corresponding to its key.
 */
function extractStyleValue(styleKey = '', stylesStr = '') {
  const styleList = stylesStr.split(';');
  const styleEntry = styleList.find(style => style.match(`${styleKey}:`)) || '';
  const valueStart = styleEntry.indexOf(':');
  
  return styleEntry.substr(valueStart + 1).trim();
}

function getDirectionalArrowSize(baseSize) {
  return ARROW.calculateSize(baseSize);
}

function getArrowAvgMinHeight(baseHeight) {
  const arrowsHeight = getDirectionalArrowSize(baseHeight).height * 2;
  const crossHeight = CROSS.size + CROSS.margin * 2;

  return arrowsHeight + crossHeight;
}

/**
 * Adjusts the arrow avg y position to make sure it will be drawn inside the container.
 * 
 * @param {*} currentY - The y position to be recalculated if exceeded.
 * @param {*} baseContainerY - The container y bottom coordinate.
 * @param {*} containerHeight - The container height.
 * @param {*} arrowAvgMinSize - The Arrow Avarage minimum size to fit inside the container.
 * @returns the y coordinate readjusted.
 * Ps.: If the container height is lower than the minimum arrow avg size then it will be centralized.
 */
function adjustArrowAvgPositionToFitContainer(
  currentY,
  baseContainerY,
  containerHeight,
  arrowAvgMinSize,
) {
  if (containerHeight <= arrowAvgMinSize) {
    return currentY - containerHeight / 2;
  }

  const highestPossibleY = baseContainerY - containerHeight + (arrowAvgMinSize / 2);
  const lowestPossibleY = baseContainerY - (arrowAvgMinSize / 2);

  // Positioning is calculated from top to bottom, where 0 is the very top.
  if (currentY < highestPossibleY) {
    return highestPossibleY;
  }
  
  if (currentY > lowestPossibleY) {
    return lowestPossibleY;
  }

  return currentY; // It fits, keep the y
}

/**
 * Draw a point object. This is a separate function because it can also be called by the legend.
 * The reason the JSONcontainer and the target SVG svgContainer have to be supplied is so the legend can use these functions
 * as well.
 *
 * @param x
 * @param y
 * @param groupTemplate: A template containing the necessary information to draw the datapoint e.g., {style: 'circle', size: 5, className: 'className' }
 * @param JSONcontainer
 * @param svgContainer
 * @param labelObj
 * @param props: Be going to considered to draw the points
 * @returns {*}
 */
exports.drawPoint = function(x, y, groupTemplate, JSONcontainer, svgContainer, labelObj, props) {
  var points = [];
  var v = {
    x: x - 0.5 * groupTemplate.size,
    y: y - 0.5 * groupTemplate.size,
  };
  const triangleBaseWidth = 2;
  switch (groupTemplate.style) {
    case 'circle':
      if (!isNaN(y) && !isNaN(x)) {
        const circle = exports.getSVGElement('circle', JSONcontainer, svgContainer);
        circle.setAttributeNS(null, 'cx', x);
        circle.setAttributeNS(null, 'cy', y);
        circle.setAttributeNS(null, 'r', 0.5 * groupTemplate.size);
        points.push(circle);
      }
      break;
    case 'square':
      if (!isNaN(y) && !isNaN(x)) {
        const rect = exports.getSVGElement('rect', JSONcontainer, svgContainer);
        rect.setAttributeNS(null, 'x', x - 0.5 * groupTemplate.size);
        rect.setAttributeNS(null, 'y', y - 0.5 * groupTemplate.size);
        rect.setAttributeNS(null, 'width', groupTemplate.size);
        rect.setAttributeNS(null, 'height', groupTemplate.size);
        points.push(rect);
      }
      break;
    case 'triangle-up':
      if (!isNaN(v.y) && !isNaN(v.x)) {
        const polygonUp = exports.getSVGElement('polygon', JSONcontainer, svgContainer);
        polygonUp.setAttributeNS(null, 'points', `${v.x - triangleBaseWidth},${v.y + groupTemplate.size} ${v.x + groupTemplate.size + triangleBaseWidth},${v.y + groupTemplate.size} ${v.x + groupTemplate.size * 0.5},${v.y}`);
        points.push(polygonUp);
      }
      break;
    case 'triangle-down':
      if (!isNaN(v.y) && !isNaN(v.x)) {
        const polygonDown = exports.getSVGElement('polygon', JSONcontainer, svgContainer);
        polygonDown.setAttributeNS(null, 'points', `${v.x - triangleBaseWidth},${v.y} ${v.x + groupTemplate.size + triangleBaseWidth},${v.y} ${v.x + groupTemplate.size * 0.5},${v.y + groupTemplate.size}`);
        points.push(polygonDown);
      }
      break;
    case 'arrow-avg':
      const { baseY, baseHeight, size = 0 } = props;
      const customStyles = groupTemplate.styles;
      const baseArrowSize = groupTemplate.size;

      const directionArrow = getDirectionalArrowSize(baseArrowSize);
      const crossHalfSize = CROSS.size / 2;

      const strokeWidthUnconverted = Number(extractStyleValue('stroke-width', customStyles).replace('px', ''));
      const strokeWidth = strokeWidthUnconverted / 2; // for 20px of stroke, its necessary 10px for y adjustment. Its 2/1.

      const arrowAvgRequestedHeight = size;
      const arrowAvgMinHeight = getArrowAvgMinHeight(baseArrowSize);
      const arrowAvgHeight = (arrowAvgRequestedHeight < arrowAvgMinHeight ? arrowAvgMinHeight : arrowAvgRequestedHeight) / 2; // will be calculated from center
      
      // AVG ARROW DOWN (top side)
      let downLeftPt;
      let downRightPt;
      let downBottomPt;
      let downLineToCenterPt;

      // CROSS (middle)
      let crossVerticalLine;
      let crossHorizontalLine;

      // AVG ARROW UP (bottom side)
      let upLeftPt;
      let upRightPt;
      let upTopPt;
      let upLineToCenterPt;

      if(props.calculateAllPoints){ // if this property is definied, then avgValue was passed
        let y_min = baseY - props.screen_yMin;
        let y_max = baseY - props.screen_yMax;
        let y_avg = baseY - props.screen_yAvg;

        // AVG ARROW DOWN (top side)
        downLeftPt = x - directionArrow.height + ',' + y_max;
        downRightPt = x + directionArrow.height + ',' + y_max ;
        downBottomPt = x + ',' + (y_max + directionArrow.height);
        downLineToCenterPt = x + ',' + (y_avg - crossHalfSize - CROSS.margin);

        // CROSS (middle)
        crossVerticalLine = 'M ' + x + ',' + (y_avg - crossHalfSize) + ' L ' + x + ',' + (y_avg + crossHalfSize);
        crossHorizontalLine = 'M ' + (x - crossHalfSize) + ',' + y_avg + ' L ' + (x + crossHalfSize) + ',' + y_avg;

        // AVG ARROW UP (bottom side)
        upLeftPt = x - directionArrow.height + ',' + y_min;
        upRightPt = x + directionArrow.height + ',' + y_min;
        upTopPt = x + ',' + (y_min - directionArrow.height);
        upLineToCenterPt = x + ',' + (y_avg + crossHalfSize + CROSS.margin);
      } else {
        y = adjustArrowAvgPositionToFitContainer(y, baseY, baseHeight, arrowAvgMinHeight + strokeWidth * 2);

        // AVG ARROW DOWN (top side)
        downLeftPt = `${x - directionArrow.height},${y - arrowAvgHeight + strokeWidth}`;
        downRightPt = `${x + directionArrow.height},${y - arrowAvgHeight + strokeWidth}`;
        downBottomPt = `${x},${y - arrowAvgHeight + directionArrow.height + strokeWidth}`;
        downLineToCenterPt = `${x},${y - crossHalfSize - CROSS.margin}`;

        // CROSS (middle)
        crossVerticalLine = `M ${x},${y - crossHalfSize} L ${x},${y + crossHalfSize}`;
        crossHorizontalLine = `M ${x - crossHalfSize},${y} L ${x + crossHalfSize},${y}`;

        // AVG ARROW UP (bottom side)
        upLeftPt = `${x - directionArrow.height},${y + arrowAvgHeight - strokeWidth}`;
        upRightPt = `${x + directionArrow.height},${y + arrowAvgHeight - strokeWidth}`;
        upTopPt = `${x},${y + arrowAvgHeight - directionArrow.height - strokeWidth}`;
        upLineToCenterPt = `${x},${y + crossHalfSize + CROSS.margin}`;
      }      

      const polygonDown = exports.getSVGElement('polygon', JSONcontainer, svgContainer);
      polygonDown.setAttributeNS(null, 'points', `${downLeftPt} ${downRightPt} ${downBottomPt} ${downLineToCenterPt} ${downBottomPt} ${downLeftPt}`);
      polygonDown.setAttributeNS(null, 'polygon-type', 'down');

      const polygonCross = exports.getSVGElement('path', JSONcontainer, svgContainer);
      polygonCross.setAttributeNS(null, 'd', `${crossVerticalLine} ${crossHorizontalLine}`);
      polygonCross.setAttributeNS(null, 'polygon-type', 'cross');

      const polygonUp = exports.getSVGElement('polygon', JSONcontainer, svgContainer);
      polygonUp.setAttributeNS(null, 'points', `${upLeftPt} ${upRightPt} ${upTopPt} ${upLineToCenterPt} ${upTopPt} ${upLeftPt}`);
      polygonUp.setAttributeNS(null, 'polygon-type', 'up');

      if (groupTemplate.styles !== undefined) {
        polygonDown.setAttributeNS(null, 'style', groupTemplate.styles);
        polygonCross.setAttributeNS(null, 'style', groupTemplate.styles);
        polygonUp.setAttributeNS(null, 'style', groupTemplate.styles);
      }

      if (props.alertMin) {
        polygonUp.style.stroke = props.alertColor;
        polygonUp.style.fill = '#FFFFFF';
      }

      if (props.alertMax) {
        polygonDown.style.stroke = props.alertColor;
        polygonDown.style.fill = '#FFFFFF';
      }

      if (props.alertMed) {
        polygonCross.style.stroke = props.alertColor;
      }

      points.push(polygonDown);
      points.push(polygonCross);
      points.push(polygonUp);
      break;
    case 'rhombus':
      if (!isNaN(y) && !isNaN(x)) {
        const xRect = x - 0.5 * groupTemplate.size;
        const yRect = y - 0.5 * groupTemplate.size;
        const rhombus = exports.getSVGElement('rect', JSONcontainer, svgContainer);
        rhombus.setAttributeNS(null, 'x', xRect + 1);
        rhombus.setAttributeNS(null, 'y', yRect - 0.5 * groupTemplate.size);
        rhombus.setAttributeNS(null, 'width', groupTemplate.size);
        rhombus.setAttributeNS(null, 'height', groupTemplate.size);
        rhombus.setAttributeNS(null, 'transform', `rotate(45, ${xRect}, ${yRect})`);
        points.push(rhombus);
      }
      break;
    case 'rectangle':
      if (!isNaN(y) && !isNaN(x)) {
        const rectangle = exports.getSVGElement('rect', JSONcontainer, svgContainer);
        rectangle.setAttributeNS(null, 'x', x - 0.5 * groupTemplate.width);
        rectangle.setAttributeNS(null, 'y', y - 0.5 * groupTemplate.height);
        rectangle.setAttributeNS(null, 'width', groupTemplate.width);
        rectangle.setAttributeNS(null, 'height', groupTemplate.height);
        points.push(rectangle);
      }
      break;
    case 'partogram':
      if (props.partogramPosition) {
        const partogramPoint = getPartogramPoint({ x, y, JSONcontainer, svgContainer, props, groupTemplate });
        points.push(partogramPoint);
      }
      break;
    case 'partogram-contraction':
      if (props.partogramContraction && !isNaN(y) && !isNaN(x)) { 
        let colorFill = '#3262DB';
        if (props.partogramContraction == 'EMPTY_CIRCLE') {
          colorFill = '#FFFFFF';
        }

        const sizeChart = 0.65 * groupTemplate.size;
        const circle = exports.getSVGElement('circle', JSONcontainer, svgContainer);
        circle.setAttributeNS(null, 'cx', x);
        circle.setAttributeNS(null, 'cy', y);
        circle.setAttributeNS(null, 'r', sizeChart);
        circle.setAttributeNS(null, 'stroke', '#3262DB');
        circle.setAttributeNS(null, 'fill', colorFill);
        circle.setAttributeNS(null, 'stroke-width', 1);
        points.push(circle);

        if (props.partogramContraction == 'SEMI_CIRCLE') {
          const path = exports.getSVGElement('path', JSONcontainer, svgContainer);
          path.setAttributeNS(null, 'd', `M${x - sizeChart},${y} a${sizeChart},${sizeChart} 0 0,1 ${sizeChart * 2},0`);
          path.setAttributeNS(null, 'stroke', '#3262DB');
          path.setAttributeNS(null, 'fill', '#FFFFFF');
          path.setAttributeNS(null, 'stroke-width', 1);
          points.push(path);
        }
      }
      break;
  }
  //handle label


  if (labelObj) {
    const label = exports.getSVGElement('text', JSONcontainer, svgContainer);
    if (labelObj.xOffset) {
      x = x + labelObj.xOffset;
    }

    if (labelObj.yOffset) {
      y = y + labelObj.yOffset;
    }
    if (labelObj.content) {
      label.textContent = labelObj.content;
    }

    if (labelObj.className) {
      label.setAttributeNS(null, 'class', labelObj.className  + ' vis-label');
    }

    if (!isNaN(y) && !isNaN(x)) {
      label.setAttributeNS(null, 'x', x);
      label.setAttributeNS(null, 'y', y);
    }
  }

  points.forEach(point => {
    if (groupTemplate.styles !== undefined && groupTemplate.style !== 'arrow-avg') {
      point.setAttributeNS(null, 'style', groupTemplate.styles);
    }

    point.setAttributeNS(null, 'class', groupTemplate.className + ' vis-point');
   
    if (labelObj && labelObj.tooltip) {
      point.setAttributeNS(null, 'tooltip', labelObj.tooltip);
    }
    point.setAttributeNS(null, 'row-id', groupTemplate.rowId);

    if (props) {
      let id = `${groupTemplate.rowId}-${groupTemplate.style}-${props.index}`;
      const polygonType = point.getAttribute('polygon-type');
      if (polygonType) {
        id = id.concat(`-${polygonType}`); // without this we can't set the ID in the 'use' tag
      }
      if (props.stylePoint) {
        point.removeAttribute('style');
        point.setAttributeNS(null, 'style', props.stylePoint);
      }
      point.setAttributeNS(null, 'id', id);
    }

  });

  return points;
};

exports.attachEvents = function(element, name, data, callback) {
  if (element && Array.isArray(element)) {
    element.forEach((ele, index) => {
      if (Array.isArray(ele)) {
        ele.forEach(e => e.addEventListener(name, (eve) => callback(eve, e, data[index])));
      } else {
        ele.addEventListener(name, (eve) => callback(eve, ele, data[index]));
      }
    });
  } else {
    element.addEventListener(name, (eve) => callback(eve, element, data));
  }
}

/**
 * draw a bar SVG element centered on the X coordinate
 *
 * @param x
 * @param y
 * @param className
 */
exports.drawBar = function (x, y, width, height, className, JSONcontainer, svgContainer, style) {
  if (height != 0) {
    if (height < 0) {
      height *= -1;
      y -= height;
    }
    var rect = exports.getSVGElement('rect',JSONcontainer, svgContainer);
    rect.setAttributeNS(null, 'x', x - 0.5 * width);
    rect.setAttributeNS(null, 'y', y);
    rect.setAttributeNS(null, 'width', width);
    rect.setAttributeNS(null, 'height', height);
    rect.setAttributeNS(null, 'class', className);
    if (style) {
      rect.setAttributeNS(null, 'style', style);
    }
  }
};

/**
 * Create a SVG element
 * @param {number} x
 * @param {number} y
 * @param {Object} JSONcontainer
 * @param {Object} svgContainer
 * @param {Object} props
 * @param {Object} groupTemplate
 * @returns {Object} g DOM Element
 */
function getPartogramPoint({ x, y, JSONcontainer, svgContainer, props, groupTemplate }) {
  const group = exports.getSVGElement('g', JSONcontainer, svgContainer);
  group.setAttribute('transform', `translate(${x - groupTemplate.size}, ${y - groupTemplate.size})`
    + ` rotate(${PARTOGRAM_HEAD_POSITION_DEGREE[props.partogramPosition]}, ${groupTemplate.size}, ${groupTemplate.size})`);
  if (groupTemplate.styles) {
    group.setAttribute('style', groupTemplate.styles);
  }

  const circle = exports.getSVGElement('circle', JSONcontainer, svgContainer);
  circle.setAttribute('cx', groupTemplate.size);
  circle.setAttribute('cy', groupTemplate.size);
  circle.setAttribute('r', groupTemplate.size * 0.9);
  group.append(circle);

  if (props.partogramPosition !== 'IND') {
    const lineCenter = exports.getSVGElement('line', JSONcontainer, svgContainer);
    setAttributeElement(lineCenter, groupTemplate, {
      y1: 0.716764966,
      y2: 1.9,
    });

    const lineLeft = exports.getSVGElement('line', JSONcontainer, svgContainer);
    setAttributeElement(lineLeft, groupTemplate, {
      x1: 1.6,
      y1: 0.758382483,
      y2: 0.3,
      transform: `translate(${groupTemplate.size * 1.3}, ${groupTemplate.size * 0.5083825})`
        + ` scale(-1, 1)`
        + ` translate(${groupTemplate.size * -1.3}, ${groupTemplate.size * -0.5083825})`
    });

    const lineRight = exports.getSVGElement('line', JSONcontainer, svgContainer);
    setAttributeElement(lineRight, groupTemplate, {
      y1: 0.779191242,
      x2: 0.4,
      y2: 0.3,
    });

    group.append(lineCenter);
    group.append(lineLeft);
    group.append(lineRight);
  }
  return group;
}

/**
 * Set basic attributes to SVG element
 * @param {Object} line                   svg element
 * @param {Object} groupTemplate
 * @param {Object} attributes             element attributes
 * @param {number} [attributes.x1]        Optional: scale default is 1 (100%)
 * @param {number} [attributes.y1]        Optional: scale default is 1 (100%)
 * @param {number} [attributes.x2]        Optional: scale default is 1 (100%)
 * @param {number} [attributes.y2]        Optional: scale default is 1 (100%)
 * @param {string} [attributes.transform] Optional: transform attribute of DOM element
 */
function setAttributeElement(line, groupTemplate, { x1 = 1, y1 = 1, x2 = 1, y2 = 1, transform }) {
  line.setAttribute('x1', groupTemplate.size * x1);
  line.setAttribute('y1', groupTemplate.size * y1);
  line.setAttribute('x2', groupTemplate.size * x2);
  line.setAttribute('y2', groupTemplate.size * y2);
  if (transform) {
    line.setAttribute('transform', transform);
  }
}
