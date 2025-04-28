var util = require('../../util');
var Component = require('./Component');
var TimeStep = require('../TimeStep');
var moment = require('../../module/moment');

/**
 * A horizontal time axis
 * @param {{dom: Object, domProps: Object, emitter: Emitter, range: Range}} body
 * @param {Object} [options]        See TimeAxis.setOptions for the available
 *                                  options.
 * @constructor TimeAxis
 * @extends Component
 */
function TimeAxis (body, options) {
  this.dom = {
    foreground: null,
    lines: [],
    majorTexts: [],
    minorTexts: [],
    redundant: {
      lines: [],
      majorTexts: [],
      minorTexts: []
    }
  };
  this.props = {
    range: {
      start: 0,
      end: 0,
      minimumStep: 0
    },
    lineTop: 0
  };

  this.defaultOptions = {
    orientation: {
      axis: 'bottom'
    },  // axis orientation: 'top' or 'bottom'
    showMinorLabels: true,
    showMinorLines: true,
    showMajorLabels: true,
    maxMinorChars: 7,
    format: TimeStep.FORMAT,
    moment: moment,
    timeAxis: null,
    gap: 1,
    itemsFit: []
  };
  this.options = util.extend({}, this.defaultOptions);

  this.body = body;

  // create the HTML DOM
  this._create();

  this.setOptions(options);
}

TimeAxis.prototype = new Component();

/**
 * Set options for the TimeAxis.
 * Parameters will be merged in current options.
 * @param {Object} options  Available options:
 *                          {string} [orientation.axis]
 *                          {boolean} [showMinorLabels]
 *                          {boolean} [showMajorLabels]
 */
TimeAxis.prototype.setOptions = function(options) {
  if (options) {
    // copy all options that we know
    util.selectiveExtend([
      'showMinorLabels',
      'showMinorLines',
      'showMajorLabels',
      'maxMinorChars',
      'hiddenDates',
      'timeAxis',
      'moment',
      'gap',
      'itemsFit'
    ], this.options, options);

    // deep copy the format options
    util.selectiveDeepExtend(['format'], this.options, options);

    if ('orientation' in options) {
      if (typeof options.orientation === 'string') {
        this.options.orientation.axis = options.orientation;
      }
      else if (typeof options.orientation === 'object' && 'axis' in options.orientation) {
        this.options.orientation.axis = options.orientation.axis;
      }
    }

    // apply locale to moment.js
    // TODO: not so nice, this is applied globally to moment.js
    if ('locale' in options) {
      if (typeof moment.locale === 'function') {
        // moment.js 2.8.1+
        moment.locale(options.locale);
      }
      else {
        moment.lang(options.locale);
      }
    }
  }
};

/**
 * Create the HTML DOM for the TimeAxis
 */
TimeAxis.prototype._create = function() {
  this.dom.foreground = document.createElement('div');
  this.dom.background = document.createElement('div');

  this.dom.foreground.className = 'vis-time-axis vis-foreground';
  this.dom.background.className = 'vis-time-axis vis-background';
};

/**
 * Destroy the TimeAxis
 */
TimeAxis.prototype.destroy = function() {
  // remove from DOM
  if (this.dom.foreground.parentNode) {
    this.dom.foreground.parentNode.removeChild(this.dom.foreground);
  }
  if (this.dom.background.parentNode) {
    this.dom.background.parentNode.removeChild(this.dom.background);
  }

  this.body = null;
};

/**
 * Repaint the component
 * @return {boolean} Returns true if the component is resized
 */
TimeAxis.prototype.redraw = function () {
  if (!this.body || !this.body.dom) return;

  var props = this.props;
  var foreground = this.dom.foreground;
  var background = this.dom.background;

  // determine the correct parent DOM element (depending on option orientation)
  var parent = (this.options.orientation.axis == 'top') ? this.body.dom.top : this.body.dom.bottom;
  var parentChanged = (foreground.parentNode !== parent);

  // calculate character width and height
  this._calculateCharSize();

  // TODO: recalculate sizes only needed when parent is resized or options is changed
  var showMinorLabels = this.options.showMinorLabels && this.options.orientation.axis !== 'none';
  var showMajorLabels = this.options.showMajorLabels && this.options.orientation.axis !== 'none';

  // determine the width and height of the elemens for the axis
  props.minorLabelHeight = showMinorLabels ? props.minorCharHeight : 0;
  props.majorLabelHeight = showMajorLabels ? props.majorCharHeight : 0;
  props.height = props.minorLabelHeight + props.majorLabelHeight;
  props.width = foreground.offsetWidth;

  props.minorLineHeight = this.body.domProps.root.height - props.majorLabelHeight -
      (this.options.orientation.axis == 'top' ? this.body.domProps.bottom.height : this.body.domProps.top.height);
  props.minorLineWidth = 1; // TODO: really calculate width
  props.majorLineHeight = props.minorLineHeight + props.majorLabelHeight;
  props.majorLineWidth = 1; // TODO: really calculate width

  //  take foreground and background offline while updating (is almost twice as fast)
  var foregroundNextSibling = foreground.nextSibling;
  var backgroundNextSibling = background.nextSibling;
  foreground.parentNode && foreground.parentNode.removeChild(foreground);
  background.parentNode && background.parentNode.removeChild(background);

  foreground.style.height = `${this.props.height}px`;

  this._repaintLabels();

  // put DOM online again (at the same place)
  if (foregroundNextSibling) {
    parent.insertBefore(foreground, foregroundNextSibling);
  }
  else {
    parent.appendChild(foreground)
  }
  if (backgroundNextSibling) {
    this.body.dom.backgroundVertical.insertBefore(background, backgroundNextSibling);
  }
  else {
    this.body.dom.backgroundVertical.appendChild(background)
  }

  return this._isResized() || parentChanged;
};

/**
 * Repaint major and minor text labels and vertical grid lines
 * @private
 */
TimeAxis.prototype._repaintLabels = function () {
  var orientation = this.options.orientation.axis;

  // calculate range and step (step such that we have space for 7 characters per label)
  var start = util.convert(this.body.range.start, 'Number');
  var end = util.convert(this.body.range.end, 'Number');
  const gap = this.body.range.options.gap;
  const totalizersToAdd = this.body.totalizer && this.body.totalizer.periods ? this.body.totalizer.periods.length : 0;
  const diffInHours = (end - start) / (1000 * 60 * 60);
  const rangeColumnCount = this.body.range.props && this.body.range.props.columnCount ? this.body.range.props.columnCount : 0;
  let columnCount = rangeColumnCount ? rangeColumnCount : diffInHours / (gap ? gap : 1) + totalizersToAdd;
  const itemsFit = this.body.range.options.itemsFit || [];
  if (itemsFit && columnCount < itemsFit.length) {
    columnCount = itemsFit.length;
  }

  var step = new TimeStep(new Date(start), new Date(end));
  step.setMoment(this.options.moment);
  if (this.options.format) {
    step.setFormat(this.options.format);
  }
  if (this.options.timeAxis) {
    step.setScale(this.options.timeAxis);
  }
  this.step = step;

  // Move all DOM elements to a "redundant" list, where they
  // can be picked for re-use, and clear the lists with lines and texts.
  // At the end of the function _repaintLabels, left over elements will be cleaned up
  var dom = this.dom;
  dom.redundant.lines = dom.lines;
  dom.redundant.majorTexts = dom.majorTexts;
  dom.redundant.minorTexts = dom.minorTexts;
  dom.lines = [];
  dom.majorTexts = [];
  dom.minorTexts = [];

  var current;
  var x;
  var xNext;
  var isMajor;
  var width = 0;
  var line;
  var labelMinor;
  var xFirstMajorLabel = undefined;
  var count = 0;
  const MAX = 1000;
  var className;
  let widthDefault = 0;

  
  // Calculation of the possibility of the vertical line taking into account the size of the header
  const containerMainTopArea = this.body.dom.container.closest('.main-area');
  const elementHeaderWidth = containerMainTopArea.querySelector('.tl-setting-bar');
  const elementHeaderWidthItem = containerMainTopArea.querySelectorAll('.tl-setting-bar__item');
  if (elementHeaderWidthItem && elementHeaderWidth) { // && elementHeaderWidth.offsetWidth
    widthDefault = parseFloat(elementHeaderWidth.offsetWidth / elementHeaderWidthItem.length).toFixed(2);
  }
  current = start;
  xNext = this.body.util.toScreen(current);
  for (let next = 0; next < columnCount; next++){
    isMajor = step.isMajor();
    className = step.getClassName();
    labelMinor = step.getLabelMinor();

    x = xNext;
    current = start + (next * 60 * 60 * 1000);
    xNext = this.body.util.toScreen(current);
    width = xNext - x;

    if (widthDefault > 0) {
      width = widthDefault;
      if (width < 44) width = 44;
    }

    if (isMajor && this.options.showMajorLabels) {
      line = this._repaintMajorLine(x, width, orientation, className);
    } else if (this.options['showMinorLines']) {
      line = this._repaintMinorLine(x, width, orientation, className, next);
    }

    if (!elementHeaderWidthItem.length && !elementHeaderWidth && !step.next()) {
      next = columnCount;
    }
  }

  if (count === MAX && !warnedForOverflow) {
      console.warn(`Something is wrong with the Timeline scale. Limited drawing of grid lines to ${MAX} lines.`);
      warnedForOverflow = true;
  }

  // Cleanup leftover DOM elements from the redundant list
  util.forEach(this.dom.redundant, function (arr) {
    while (arr.length) {
      var elem = arr.pop();
      if (elem && elem.parentNode) {
        elem.parentNode.removeChild(elem);
      }
    }
  });
};

/**
   * Create a minor line for the axis at position x
   * sets xy
   * @param {string} label
   * @param {number} x
   * @param {number} y
   * @private
   */
TimeAxis.prototype._setXY = function (label, x, y) {
  label.style.setProperty('transform', `translate(${x}px, ${y}px)`);
}


/**
 * Create a minor label for the axis at position x
 * @param {Number} x
 * @param {String} text
 * @param {String} orientation   "top" or "bottom" (default)
 * @param {String} className
 * @return {Element} Returns the HTML element of the created label
 * @private
 */
TimeAxis.prototype._repaintMinorText = function (x, text, orientation, className) {
  // reuse redundant label
  var label = this.dom.redundant.minorTexts.shift();

  if (!label) {
    // create new label
    var content = document.createTextNode('');
    label = document.createElement('div');
    label.appendChild(content);
    this.dom.foreground.appendChild(label);
  }
  this.dom.minorTexts.push(label);

  label.childNodes[0].nodeValue = text;

  const y = (orientation == 'top') ? this.props.majorLabelHeight : '0';
  this._setXY(label, x, y);

  // label.className = `vis-text vis-minor ${className}`;
  //label.title = title;  // TODO: this is a heavy operation

  return label;
};

/**
 * Create a Major label for the axis at position x
 * @param {Number} x
 * @param {String} text
 * @param {String} orientation   "top" or "bottom" (default)
 * @param {String} className
 * @return {Element} Returns the HTML element of the created label
 * @private
 */
TimeAxis.prototype._repaintMajorText = function (x, text, orientation, className) {
  // reuse redundant label
  var label = this.dom.redundant.majorTexts.shift();

  if (!label) {
    // create label
    var content = document.createTextNode(text);
    label = document.createElement('div');
    label.appendChild(content);
    this.dom.foreground.appendChild(label);
  }
  this.dom.majorTexts.push(label);

  label.childNodes[0].nodeValue = text;
  // label.className = `vis-text vis-major ${className}`;
  //label.title = title; // TODO: this is a heavy operation

  const y = (orientation == 'top') ? '0' : (`${this.props.minorLabelHeight}px`);
  this._setXY(label, x, y);

  return label;
};

/**
 * Create a minor line for the axis at position x
 * @param {Number} left
 * @param {Number} width
 * @param {String} orientation   "top" or "bottom" (default)
 * @param {String} className
 * @return {Element} Returns the created line
 * @private
 */
TimeAxis.prototype._repaintMinorLine = function (left, width, orientation, className, indexColumn) {
  const thisDom = this.dom;
  const _this = this;
  if (!_this.body || !_this.body.domProps) return;

  // reuse redundant line
  let line = thisDom.redundant.lines.shift();
  if (!line) {
    // create vertical line
    line = document.createElement('div');
    thisDom.background.appendChild(line);
  }
  thisDom.lines.push(line);

  const props = _this.props;
  line.style.setProperty('width', `${width}px`);
  line.style.setProperty('height', `${props.minorLineHeight}px`);

  const y = orientation == 'top' ? props.majorLabelHeight : _this.body.domProps.top.height;
  const x = (indexColumn * width) - width;
  _this._setXY(line, x, y);

  line.className = `vis-grid vis-vertical vis-minor ${className}`;

  return line;
};

/**
 * Create a Major line for the axis at position x
 * @param {Number} left
 * @param {Number} width
 * @param {String} orientation   "top" or "bottom" (default)
 * @param {String} className
 * @return {Element} Returns the created line
 * @private
 */
TimeAxis.prototype._repaintMajorLine = function (left, width, orientation, className) {
  // reuse redundant line
  var line = this.dom.redundant.lines.shift();
  if (!line) {
    // create vertical line
    line = document.createElement('div');
    this.dom.background.appendChild(line);
  }
  this.dom.lines.push(line);

  var props = this.props;

  line.style.width = width  + 'px';
  line.style.height = props.majorLineHeight + 'px';

  const y = (orientation == 'top') ? '0' : this.body.domProps.top.height;
  const x = left - props.majorLineWidth / 2;
  this._setXY(line, x, y);

  line.className = 'vis-grid vis-vertical vis-major ' + className;

  return line;
};

/**
 * Determine the size of text on the axis (both major and minor axis).
 * The size is calculated only once and then cached in this.props.
 * @private
 */
TimeAxis.prototype._calculateCharSize = function () {
  // Note: We calculate char size with every redraw. Size may change, for
  // example when any of the timelines parents had display:none for example.

  // determine the char width and height on the minor axis
  let measureCharMinor = this.dom.measureCharMinor;
  if (!measureCharMinor) {
    measureCharMinor = document.createElement('DIV');
    measureCharMinor.className = 'vis-text vis-minor vis-measure';
    measureCharMinor.style.position = 'absolute';

    measureCharMinor.appendChild(document.createTextNode('0'));
    this.dom.foreground.appendChild(measureCharMinor);

    this.props.minorCharHeight = measureCharMinor.clientHeight;
    this.props.minorCharWidth = measureCharMinor.clientWidth;
  }
  
  // determine the char width and height on the major axis
  let measureCharMajor = this.dom.measureCharMajor;
  if (!measureCharMajor) {
    measureCharMajor = document.createElement('DIV');
    measureCharMajor.className = 'vis-text vis-major vis-measure';
    measureCharMajor.style.position = 'absolute';

    measureCharMajor.appendChild(document.createTextNode('0'));
    this.dom.foreground.appendChild(measureCharMajor);

    this.props.majorCharHeight = measureCharMajor.clientHeight;
    this.props.majorCharWidth = measureCharMajor.clientWidth;
  }
};


var warnedForOverflow = false;

module.exports = TimeAxis;
