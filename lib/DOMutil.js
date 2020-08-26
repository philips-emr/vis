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
 * @returns {*}
 */
exports.drawPoint = function(x, y, groupTemplate, JSONcontainer, svgContainer, labelObj, props) {
  var points = [];
  var v = {x: x - 0.5 * groupTemplate.size, y: y - 0.5 * groupTemplate.size};
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
      var polygonup = exports.getSVGElement('polygon', JSONcontainer, svgContainer);
      polygonup.setAttributeNS(null, "points", `${v.x},${v.y + groupTemplate.size} ${v.x + groupTemplate.size},${v.y + groupTemplate.size} ${v.x + groupTemplate.size * 0.5},${v.y}`);
      points.push(polygonup);
      break;
    case 'triangle-down':
      var polygondown = exports.getSVGElement('polygon', JSONcontainer, svgContainer);
      polygondown.setAttributeNS(null, "points", `${v.x},${v.y} ${v.x + groupTemplate.size},${v.y} ${v.x + groupTemplate.size * 0.5},${v.y + groupTemplate.size}`);
      points.push(polygondown);
      break;
    case 'arrow-avg':

      let average = 0;

      if (props) {
        average = (props.max - props.min);
      }
      
      const minLineHeight = 0;
      const minOffset = 5;
      const lineHeight = minLineHeight + average;
      const xOffset = 1; // This make the arrow more large.
      const yOffset = (minLineHeight * 2) + average + minOffset;

      const tLeftPoint = `${v.x - xOffset},${v.y - yOffset}`;
      const tRightPoint = `${v.x + groupTemplate.size + xOffset},${v.y - yOffset}`;
      const tBottomPoint = `${v.x + groupTemplate.size * 0.5},${v.y - (2 + yOffset) + groupTemplate.size}`;
      const tLinePoint = `${v.x + groupTemplate.size * 0.5},${v.y - (2 + yOffset) + lineHeight + groupTemplate.size}`;

      const bLeftPoint = `${v.x - xOffset},${v.y + yOffset + groupTemplate.size}`;
      const bRightPoint = `${v.x + groupTemplate.size + xOffset},${v.y + yOffset + groupTemplate.size}`;
      const bTopPoint = `${v.x + groupTemplate.size * 0.5},${v.y + (2 + yOffset)}`;
      const bLinePoint = `${v.x + groupTemplate.size * 0.5},${v.y + (2 + yOffset) - lineHeight}`;

      var polygonavg1 = exports.getSVGElement('polygon', JSONcontainer, svgContainer);
      polygonavg1.setAttributeNS(null, 'points', `${tLeftPoint} ${tBottomPoint} ${tLinePoint} ${tBottomPoint} ${tRightPoint}`);
      const crossSize = 6;
      const initialX = v.x;
      const initialY = v.y;
      const verticalX = initialX + (crossSize / 2);
      const verticalY = initialY + crossSize;
      const horizontalY = initialY + (crossSize / 2);
      const horizontalX = initialX + crossSize;

      const verticalLine = `M ${verticalX},${initialY} L ${verticalX},${verticalY}`;
      const horizontalLine = `M ${initialX},${horizontalY} L ${horizontalX},${horizontalY}`;

      var cross = exports.getSVGElement('path', JSONcontainer, svgContainer);
      cross.setAttributeNS(null, 'd', `${verticalLine} ${horizontalLine}`);

      var polygonavg2 = exports.getSVGElement('polygon', JSONcontainer, svgContainer);
      polygonavg2.setAttributeNS(null, 'points', `${bLeftPoint} ${bTopPoint} ${bLinePoint} ${bTopPoint} ${bRightPoint}`);

      points.push(polygonavg1);
      points.push(cross);
      points.push(polygonavg2);
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
  });

  return points;
};

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
