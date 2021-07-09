import { CROSS, ARROW, TIMELINE_CHART_PADDINGS } from './Constants';

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
      var circle = exports.getSVGElement('circle', JSONcontainer, svgContainer);
      circle.setAttributeNS(null, "cx", x);
      circle.setAttributeNS(null, "cy", y);
      circle.setAttributeNS(null, "r", 0.5 * groupTemplate.size);
      points.push(circle);
      break;
    case 'square':
      var rect = exports.getSVGElement('rect', JSONcontainer, svgContainer);
      rect.setAttributeNS(null, "x", x - 0.5 * groupTemplate.size);
      rect.setAttributeNS(null, "y", y - 0.5 * groupTemplate.size);
      rect.setAttributeNS(null, "width", groupTemplate.size);
      rect.setAttributeNS(null, "height", groupTemplate.size);
      points.push(rect);
      break;
    case 'triangle-up':
      var polygonUp = exports.getSVGElement('polygon', JSONcontainer, svgContainer);
      polygonUp.setAttributeNS(null, "points", `${v.x - triangleBaseWidth},${v.y + groupTemplate.size} ${v.x + groupTemplate.size + triangleBaseWidth},${v.y + groupTemplate.size} ${v.x + groupTemplate.size * 0.5},${v.y}`);
      points.push(polygonUp);
      break;
    case 'triangle-down':
      var polygonDown = exports.getSVGElement('polygon', JSONcontainer, svgContainer);
      polygonDown.setAttributeNS(null, "points", `${v.x - triangleBaseWidth},${v.y} ${v.x + groupTemplate.size + triangleBaseWidth},${v.y} ${v.x + groupTemplate.size * 0.5},${v.y + groupTemplate.size}`);
      points.push(polygonDown);
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
      
      y = adjustArrowAvgPositionToFitContainer(y, baseY, baseHeight, arrowAvgMinHeight + strokeWidth * 2);

      // AVG ARROW DOWN (top side)
      const downLeftPt = `${x - directionArrow.height},${y - arrowAvgHeight + strokeWidth}`;
      const downRightPt = `${x + directionArrow.height},${y - arrowAvgHeight + strokeWidth}`;
      const downBottomPt = `${x},${y - arrowAvgHeight + directionArrow.height + strokeWidth}`;
      const downLineToCenterPt = `${x},${y - crossHalfSize - CROSS.margin}`;

      const polygonDown = exports.getSVGElement('polygon', JSONcontainer, svgContainer);
      polygonDown.setAttributeNS(null, 'points', `${downLeftPt} ${downRightPt} ${downBottomPt} ${downLineToCenterPt} ${downBottomPt} ${downLeftPt}`);

      // CROSS (middle)
      const crossVerticalLine = `M ${x},${y - crossHalfSize} L ${x},${y + crossHalfSize}`;
      const crossHorizontalLine = `M ${x - crossHalfSize},${y} L ${x + crossHalfSize},${y}`;

      const polygonCross = exports.getSVGElement('path', JSONcontainer, svgContainer);
      polygonCross.setAttributeNS(null, 'd', `${crossVerticalLine} ${crossHorizontalLine}`);

      // AVG ARROW UP (bottom side)
      const upLeftPt = `${x - directionArrow.height},${y + arrowAvgHeight - strokeWidth}`;
      const upRightPt = `${x + directionArrow.height},${y + arrowAvgHeight - strokeWidth}`;
      const upTopPt = `${x},${y + arrowAvgHeight - directionArrow.height - strokeWidth}`;
      const upLineToCenterPt = `${x},${y + crossHalfSize + CROSS.margin}`;

      const polygonUp = exports.getSVGElement('polygon', JSONcontainer, svgContainer);
      polygonUp.setAttributeNS(null, 'points', `${upLeftPt} ${upRightPt} ${upTopPt} ${upLineToCenterPt} ${upTopPt} ${upLeftPt}`);

      points.push(polygonDown);
      points.push(polygonCross);
      points.push(polygonUp);
      break;
    case 'rectangle':
      var rectangle = exports.getSVGElement('rect', JSONcontainer, svgContainer);
      rectangle.setAttributeNS(null, "x", x - 0.5 * groupTemplate.width);
      rectangle.setAttributeNS(null, "y", y - 0.5 * groupTemplate.height);
      rectangle.setAttributeNS(null, "width", groupTemplate.width);
      rectangle.setAttributeNS(null, "height", groupTemplate.height);
      points.push(rectangle);
      break;
  }
  //handle label


  if (labelObj) {
    var label = exports.getSVGElement('text', JSONcontainer, svgContainer);
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
      label.setAttributeNS(null, "class", labelObj.className  + " vis-label");
    }

    label.setAttributeNS(null, "x", x);
    label.setAttributeNS(null, "y", y);
  }

  points.forEach(point => {
    if (groupTemplate.styles !== undefined) {
      point.setAttributeNS(null, "style", groupTemplate.styles);
    }

    point.setAttributeNS(null, "class", groupTemplate.className + " vis-point");
   
    if (labelObj && labelObj.tooltip) {
      point.setAttributeNS(null, "tooltip", labelObj.tooltip);
    }
    point.setAttributeNS(null, 'row-id', groupTemplate.rowId);
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
    rect.setAttributeNS(null, "x", x - 0.5 * width);
    rect.setAttributeNS(null, "y", y);
    rect.setAttributeNS(null, "width", width);
    rect.setAttributeNS(null, "height", height);
    rect.setAttributeNS(null, "class", className);
    if (style) {
      rect.setAttributeNS(null, "style", style);
    }
  }
};
