var Hammer = require('../../../module/hammer');
var Item = require('./Item');
var Emitter = require('emitter-component');

/**
 * @constructor RangeItem
 * @extends Item
 * @param {Object} data             Object containing parameters start, end
 *                                  content, className.
 * @param {{toScreen: function, toTime: function}} conversion
 *                                  Conversion functions from time to screen and vice versa
 * @param {Object} [options]        Configuration options
 *                                  // TODO: describe options
 */
function RangeItem (data, conversion, options) {
  this.props = {
    content: {
      width: 0
    }
  };
  this.overflow = false; // if contents can overflow (css styling), this flag is set to true

  // validate data
  if (data) {
    if (data.start == undefined) {
      throw new Error('Property "start" missing in item ' + data.id);
    }
    if (data.end == undefined) {
      throw new Error('Property "end" missing in item ' + data.id);
    }
  }

  var me = this;

  //mouseover callback method
  this.mouseoverCallback = function(event){
    me.emit('mouseover',  data);
  }

  //mouseover callback method
  this.mouseoutCallback = function(event){
    me.emit('mouseout',  data);
  }

  Item.call(this, data, conversion, options);
}

RangeItem.prototype = new Item (null, null, null);

// Extend RangeItem with an Emitter mixin
Emitter(RangeItem.prototype);

RangeItem.prototype.baseClassName = 'vis-item vis-range';

/**
 * Check whether this item is visible inside given range
 * @returns {{start: Number, end: Number}} range with a timestamp for start and end
 * @returns {boolean} True if visible
 */
RangeItem.prototype.isVisible = function(range) {
  // determine visibility
  //TEST PERFORMANCE
  // return (this.data.start < range.end) && (this.data.end > range.start);
  return true;
};

/**
 * Repaint the item
 */
RangeItem.prototype.redraw = function() {
  var dom = this.dom;
  if (!dom) {
    // create DOM
    this.dom = {};
    dom = this.dom;
    const editable = (this.options.editable.updateTime ||
      this.options.editable.updateGroup ||
      this.editable === true) &&
     this.editable !== false;

    // background box
    dom.box = document.createElement('div');
    // update class
    var className = (this.data.className ? (' ' + this.data.className) : '') +
    (this.selected ? ' vis-selected' : '') +
    (editable ? ' vis-editable' : ' vis-readonly');
    dom.box.className = this.baseClassName + className;
    // className is updated in redraw()

    // frame box (to prevent the item contents from overflowing
    dom.frame = document.createElement('div');
    dom.frame.className = 'vis-item-overflow';
    dom.box.appendChild(dom.frame);

    // contents box
    dom.content = document.createElement('div');
    dom.content.className = 'vis-item-content';
    dom.frame.appendChild(dom.content);
    dom.frame.addEventListener("mouseover", this.mouseoverCallback);
    dom.frame.addEventListener("mouseout", this.mouseoutCallback);

    // attach this item as attribute
    dom.box['timeline-item'] = this;

    this.dirty = true;
  }

  // append DOM to parent DOM
  if (!this.parent) {
    throw new Error('Cannot redraw item: no parent attached');
  }
  if (!dom.box.parentNode) {
    var foreground = this.parent.dom.foreground;
    if (!foreground) {
      throw new Error('Cannot redraw item: parent has no foreground container element');
    }
    foreground.appendChild(dom.box);
  }
  this.displayed = true;

  // Update DOM when item is marked dirty. An item is marked dirty when:
  // - the item is not yet rendered
  // - the item's data is changed
  // - the item is selected/deselected
  if (this.dirty) {
    this._updateContents(this.dom.content);
    this._updateTitle(this.dom.box);
    this._updateDataAttributes(this.dom.box);
    this._updateStyle(this.dom.box);

    //TEST PERFORMANCE
    // determine from css whether this box has overflow
    // this.overflow = window.getComputedStyle(dom.frame).overflow !== 'hidden';

    //TEST PERFORMANCE
    // recalculate size
    // turn off max-width to be able to calculate the real width
    // this causes an extra browser repaint/reflow, but so be it
    // this.dom.content.style.maxWidth = 'none';
    // this.props.content.width = this.dom.content.offsetWidth;
    // this.height = this.dom.box.offsetHeight;
    // this.dom.content.style.maxWidth = '';

    this.dirty = false;
  }

  this._repaintDeleteButton(dom.box);
  this._repaintDragLeft();
  this._repaintDragRight();
};

/**
 * Show the item in the DOM (when not already visible). The items DOM will
 * be created when needed.
 */
RangeItem.prototype.show = function() {
  if (!this.displayed) {
    this.redraw();
  }
};

/**
 * Hide the item from the DOM (when visible)
 * @return {Boolean} changed
 */
RangeItem.prototype.hide = function() {
  if (this.displayed) {
    var box = this.dom.box;

    if (box.parentNode) {
      box.parentNode.removeChild(box);
    }

    this.displayed = false;
  }
};

/**
 * Reposition the item horizontally
 * @param {boolean} [limitSize=true] If true (default), the width of the range
 *                                   item will be limited, as the browser cannot
 *                                   display very wide divs. This means though
 *                                   that the applied left and width may
 *                                   not correspond to the ranges start and end
 * @Override
 */
RangeItem.prototype.repositionX = function(limitSize, group) {
  var parentWidth = this.parent.width;
  var start = this.conversion.toScreen(this.data.start);
  var end = this.conversion.toScreen(this.data.end);
  var contentLeft;
  var contentWidth;

  // calculate when gap === 0 (fit)
  if (group.options.gap == 0) {
    let dateStart = new Date(group.start);
    let dateElement = new Date(this.data.start);
    let dateElementEnd = new Date(this.data.end);
    let index = 0;
    let indexEnd = 0;
    let itemHours = null;
    // if the hours difference comes negative it calculates with one more day
    const diffNegative = function (dateStart, dateEnd) {
      let diffFunction = dateStart.diff(dateEnd);
      if (diffFunction < 1) diffNegative(dateStart.add(1, 'day'), dateEnd);
      return diffFunction;
    }
    // scrolls through the items in the settingbar
    const elementHeaderWidth = document.querySelector('.tl-setting-bar');
    Object.values(elementHeaderWidth.children).forEach((item) => {
      const itemCurrentSplit = item.querySelector('.item-label').innerText.split(':');
      const hours = itemCurrentSplit[0];
      const minutes = itemCurrentSplit[1];
      const dateNow = moment();
      let diff = 0
      if (itemHours) {
        //calculete difference de hours,
        diff = dateNow.hours(hours).minutes(minutes).diff(itemHours);
        //if diferrence negative, add one more day
        if (diff < 1) {
          diff = diffNegative(dateNow.add(1, 'day').hours(hours).minutes(minutes), itemHours);
        }
      }
      //checks for shorter start times and adds the corresponding index
      if (dateStart < dateElement || dateStart < dateElementEnd) {
        dateStart = new Date(dateStart.getTime() + diff);
        if (dateStart < dateElement) index++;
        if (dateStart < dateElementEnd) indexEnd++;
      }
      itemHours = dateNow.hours(hours).minutes(minutes);
    });

    //multiplies the index with the width of the settingbar item and adds half more width to align correctly
    const widthElement = parseFloat(group.options.widthElement);
    start = (widthElement * index + (widthElement / 2));
    end = (widthElement * indexEnd + (widthElement / 2));   

  // Take element width 'tl-setting-bar__item' of the handler timeline and calculate width
  } else if (group && group.options.widthElement && ['tablemode', 'tablemode_multiple_values'].indexOf(this.data.prop.type) > -1) {
    const widthElement = parseFloat(group.options.widthElement);
    const columnGrid = parseInt(this.data.id.split('_')[1]);
    const calcPositionStart = (columnGrid * widthElement);
    const calcPositionEnd = ((columnGrid + 1) * widthElement);
    start = calcPositionStart;
    end = (start == 0) ? widthElement : calcPositionEnd;
  } else if (group && group.options.widthElement) {
    const widthElement = parseFloat(group.options.widthElement);
    var dateStart = new Date(group.start);
    const gap = 1 / group.options.gap;
    var dateElement = new Date(this.data.start);
    var timeDiffElement = Math.abs(dateElement.getTime() - dateStart.getTime());
    var diffHoursElement = parseFloat(timeDiffElement / (1000 * 60 * 60)).toFixed(2);
    const calcPositionStart = (gap * diffHoursElement * widthElement);
    start = calcPositionStart;
    if (new Date(this.data.end) != new Date(this.data.start)) {
      var dateElementEnd = new Date(this.data.end);
      var timeDiffElementBackground = Math.abs(dateElementEnd.getTime() - dateElement.getTime());
      end = ((timeDiffElementBackground / (1000 * 60 * 60)) * widthElement * gap) + start;
    }
  }
  
  // limit the width of the range, as browsers cannot draw very wide divs
  if (limitSize === undefined || limitSize === true) {
    if (start < -parentWidth) {
      start = -parentWidth;
    }
    if (end > 2 * parentWidth) {
      end = 2 * parentWidth;
    }
  }
  var boxWidth = Math.max(end - start, 1);

  if (this.overflow) {
    this.left = start;
    this.width = boxWidth + this.props.content.width;
    contentWidth = this.props.content.width;

    // Note: The calculation of width is an optimistic calculation, giving
    //       a width which will not change when moving the Timeline
    //       So no re-stacking needed, which is nicer for the eye;
  }
  else {
    this.left = start;
    this.width = boxWidth;
    contentWidth = Math.min(end - start, this.props.content.width);
  }

  this.dom.box.style.left = this.left + 'px';
  this.dom.box.style.width = boxWidth + 'px';

  switch (this.options.align) {
    case 'left':
      this.dom.content.style.left = '0';
      break;

    case 'right':
      this.dom.content.style.left = Math.max((boxWidth - contentWidth), 0) + 'px';
      break;

    case 'center':
      this.dom.content.style.left = Math.max((boxWidth - contentWidth) / 2, 0) + 'px';
      break;

    default: // 'auto'
      // when range exceeds left of the window, position the contents at the left of the visible area
      if (this.overflow) {
        if (end > 0) {
          contentLeft = Math.max(-start, 0);
        }
        else {
          contentLeft = -contentWidth; // ensure it's not visible anymore
        }
      }
      else {
        if (start < 0) {
          contentLeft = -start;
        }
        else {
          contentLeft = 0;
        }
      }
      this.dom.content.style.left = contentLeft + 'px';
  }
};

/**
 * Reposition the item vertically
 * @Override
 */
RangeItem.prototype.repositionY = function() {
  var orientation = this.options.orientation.item;
  var box = this.dom.box;

  if (orientation == 'top') {
    box.style.top = this.top + 'px';
  }
  else {
    box.style.top = (this.parent.height - this.top - this.height) + 'px';
  }
};

/**
 * Repaint a drag area on the left side of the range when the range is selected
 * @protected
 */
RangeItem.prototype._repaintDragLeft = function () {
  if (this.selected && this.options.editable.updateTime && !this.dom.dragLeft) {
    // create and show drag area
    var dragLeft = document.createElement('div');
    dragLeft.className = 'vis-drag-left';
    dragLeft.dragLeftItem = this;

    this.dom.box.appendChild(dragLeft);
    this.dom.dragLeft = dragLeft;
  }
  else if (!this.selected && this.dom.dragLeft) {
    // delete drag area
    if (this.dom.dragLeft.parentNode) {
      this.dom.dragLeft.parentNode.removeChild(this.dom.dragLeft);
    }
    this.dom.dragLeft = null;
  }
};

/**
 * Repaint a drag area on the right side of the range when the range is selected
 * @protected
 */
RangeItem.prototype._repaintDragRight = function () {
  if (this.selected && this.options.editable.updateTime && !this.dom.dragRight) {
    // create and show drag area
    var dragRight = document.createElement('div');
    dragRight.className = 'vis-drag-right';
    dragRight.dragRightItem = this;

    this.dom.box.appendChild(dragRight);
    this.dom.dragRight = dragRight;
  }
  else if (!this.selected && this.dom.dragRight) {
    // delete drag area
    if (this.dom.dragRight.parentNode) {
      this.dom.dragRight.parentNode.removeChild(this.dom.dragRight);
    }
    this.dom.dragRight = null;
  }
};

module.exports = RangeItem;
