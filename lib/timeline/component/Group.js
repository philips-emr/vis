var util = require('../../util');
var stack = require('../Stack');
import fastdom from "fastdom";

/**
 * @constructor Group
 * @param {Number | String} groupId
 * @param {Object} data
 * @param {ItemSet} itemSet
 */
function Group (groupId, data, itemSet) {
  this.groupId = groupId;
  this.subgroups = {};
  this.subgroupIndex = 0;
  this.subgroupOrderer = data && data.subgroupOrder;
  this.itemSet = itemSet;

  this.dom = {};
  this.props = {
    label: {
      width: 0,
      height: 0
    }
  };
  this.className = null;

  this.items = {};        // items filtered by groupId of this group
  this.visibleItems = []; // items currently visible in window
  this.orderedItems = {
    byStart: [],
    byEnd: []
  };
  this.checkRangedItems = false; // needed to refresh the ranged items if the window is programatically changed with NO overlap.
  var me = this;
  if (this.itemSet.body) {
    this.itemSet.body.emitter.on("checkRangedItems", function () {
      me.checkRangedItems = true;
    })
  }

  this.mouseoverCallback = function(event) {
    me.itemSet.body.emitter.emit('groupmouseover',  { data, event });
  }

  this.mouseoutCallback = function(event) {
    me.itemSet.body.emitter.emit('groupmouseout',  { data, event });
  }

  this._create();

  this.setData(data);
}

/**
 * Create DOM elements for the group
 * @private
 */
Group.prototype._create = function() {
  var label = document.createElement('div');
  if (this.itemSet.options.groupEditable.order) {
	  label.className = 'vis-label draggable';
  } else {
	  label.className = 'vis-label';
  }
  this.dom.label = label;

  var inner = document.createElement('div');
  inner.className = 'vis-inner';
  label.appendChild(inner);
  this.dom.inner = inner;

  var foreground = document.createElement('div');
  foreground.addEventListener("mouseover", this.mouseoverCallback);
  foreground.addEventListener("mouseout", this.mouseoutCallback);
  foreground.className = 'vis-group';
  foreground['timeline-group'] = this;
  this.dom.foreground = foreground;

  this.dom.background = document.createElement('div');
  this.dom.background.className = 'vis-group';

  this.dom.axis = document.createElement('div');
  this.dom.axis.className = 'vis-group';

  // create a hidden marker to detect when the Timelines container is attached
  // to the DOM, or the style of a parent of the Timeline is changed from
  // display:none is changed to visible.
  this.dom.marker = document.createElement('div');
  this.dom.marker.style.visibility = 'hidden';
  this.dom.background.appendChild(this.dom.marker);
};

/**
 * Set the group data for this group
 * @param {Object} data   Group data, can contain properties content and className
 */
Group.prototype.setData = function(data) {
  // update contents
  var content;
  if (this.itemSet.options && this.itemSet.options.groupTemplate) {
    content = this.itemSet.options.groupTemplate(data);
  }
  else {
    content = data && data.content;
  }

  if (content instanceof Element) {
    this.dom.inner.appendChild(content);
    while (this.dom.inner.firstChild) {
      this.dom.inner.removeChild(this.dom.inner.firstChild);
    }
    this.dom.inner.appendChild(content);
  }
  else if (content !== undefined && content !== null) {
    this.dom.inner.innerHTML = content;
  }
  else {
    this.dom.inner.innerHTML = this.groupId || ''; // groupId can be null
  }

  // update title
  this.dom.label.title = data && data.title || '';

  if (!this.dom.inner.firstChild) {
    util.addClassName(this.dom.inner, 'vis-hidden');
  }
  else {
    util.removeClassName(this.dom.inner, 'vis-hidden');
  }

  // update className
  var className = data && data.className || null;
  if (className != this.className) {
    if (this.className) {
      util.removeClassName(this.dom.label, this.className);
      util.removeClassName(this.dom.foreground, this.className);
      util.removeClassName(this.dom.background, this.className);
      util.removeClassName(this.dom.axis, this.className);
    }
    util.addClassName(this.dom.label, className);
    util.addClassName(this.dom.foreground, className);
    util.addClassName(this.dom.background, className);
    util.addClassName(this.dom.axis, className);
    this.className = className;
  }

  // update style
  if (this.style) {
    util.removeCssText(this.dom.label, this.style);
    this.style = null;
  }
  if (data && data.style) {
    util.addCssText(this.dom.label, data.style);
    this.style = data.style;
  }
};

/**
 * Get the width of the group label
 * @return {number} width
 */
Group.prototype.getLabelWidth = function() {
  return this.props.label.width;
};


/**
 * Repaint this group
 * @param {{start: number, end: number}} range
 * @param {{item: {horizontal: number, vertical: number}, axis: number}} margin
 * @param {boolean} [restack=false]  Force restacking of all items
 * @param {{Timeline} VIS Timeline in order to get custom properties
 * @return {boolean} Returns true if the group is resized
 */
Group.prototype.redraw = function(range, margin, restack, timeline, widthContainerVIS, elementHeaderWidthItem, widthElement) {
  const boxDom = this.dom;
  const _this = this;
  let resized = false;
  
  // recalculate the height of the subgroups
  _this._calculateSubGroupHeights();

  // reposition visible items vertically
  if (typeof _this.itemSet.options.order === 'function') {
    // a custom order function

    if (restack) {
      // brute force restack of all items
      // show all items
      const me = _this;
      var limitSize = false;
      util.forEach(_this.items, function (item) {
        if (!item.displayed) {
          item.redraw();
          me.visibleItems.push(item);
        }
        item.repositionX(limitSize);
      });

      // order all items and force a restacking
      const customOrderedItems = _this.orderedItems.byStart.slice().sort(function (a, b) {
        return me.itemSet.options.order(a.data, b.data);
      });
      stack.stack(customOrderedItems, margin, true /* restack=true */);
    }

    _this.visibleItems = _this._updateVisibleItems(_this.orderedItems, _this.visibleItems, range, widthContainerVIS, elementHeaderWidthItem, widthElement);
  }
  else {
    // no custom order function, lazy stacking
    _this.visibleItems = _this._updateVisibleItems(_this.orderedItems, _this.visibleItems, range, widthContainerVIS, elementHeaderWidthItem, widthElement);

    if (_this.itemSet.options.stack) { // TODO: ugly way to access options...
      stack.stack(_this.visibleItems, margin, restack);
    }
    else { // no stacking
      stack.nostack(this.visibleItems, margin, this.subgroups);
    }
  }

  // apply new height
  // recalculate the height of the group
  const height = _this._calculateHeight(margin, timeline);
  resized = util.updateProperty(_this, 'height', height) || resized;

  boxDom.foreground.style.setProperty('height', `${height}px`);
  boxDom.label.style.setProperty('height', `${height}px`);

  // update vertical position of items after they are re-stacked and the height of the group is calculated
  for (var i = 0, ii = _this.visibleItems.length; i < ii; i++) {
    const item = _this.visibleItems[i];
    item.repositionY(margin);
  }

  return resized;
};

/**
 * recalculate the height of the subgroups
 * @private
 */
Group.prototype._calculateSubGroupHeights = function () {
  if (Object.keys(this.subgroups).length > 0) {
    var me = this;

    this.resetSubgroups();

    util.forEach(this.visibleItems, function (item) {
      if (item.data.subgroup !== undefined) {
        me.subgroups[item.data.subgroup].height = Math.max(me.subgroups[item.data.subgroup].height, item.height);
        me.subgroups[item.data.subgroup].visible = true;
      }
    });
  }
};

/**
 * recalculate the height of the group
 * @param {{item: {horizontal: number, vertical: number}, axis: number}} margin
 * @param {{Timeline} VIS Timeline in order to get custom properties
 * @returns {number} Returns the height
 * @private
 */
Group.prototype._calculateHeight = function (margin, timeline) {
  if (timeline != null && timeline.rowHeights != null && timeline.rowHeights[this.groupId] != null) {
    return timeline.rowHeights[this.groupId];
  };
  // recalculate the height of the group
  var height;
  var visibleItems = this.visibleItems;
  if (visibleItems.length > 0) {
    var min = visibleItems[0].top;
    var max = visibleItems[0].top + visibleItems[0].height;
    util.forEach(visibleItems, function (item) {
      min = Math.min(min, item.top);
      max = Math.max(max, (item.top + item.height));
    });
    if (min > margin.axis) {
      // there is an empty gap between the lowest item and the axis
      var offset = min - margin.axis;
      max -= offset;
      util.forEach(visibleItems, function (item) {
        item.top -= offset;
      });
    }
    height = max + margin.item.vertical / 2;
  }
  else {
    height = 0;
  }
  height = Math.max(height, this.props.label.height);

  return height;
};

/**
 * Show this group: attach to the DOM
 */
Group.prototype.show = function() {
  if (!this.dom.label.parentNode) {
    this.itemSet.dom.labelSet.appendChild(this.dom.label);
  }

  if (!this.dom.foreground.parentNode) {
    this.itemSet.dom.foreground.appendChild(this.dom.foreground);
  }

  if (!this.dom.background.parentNode) {
    this.itemSet.dom.background.appendChild(this.dom.background);
  }

  if (!this.dom.axis.parentNode) {
    this.itemSet.dom.axis.appendChild(this.dom.axis);
  }
};

/**
 * Hide this group: remove from the DOM
 */
Group.prototype.hide = function() {
  var label = this.dom.label;
  if (label.parentNode) {
    label.parentNode.removeChild(label);
  }

  var foreground = this.dom.foreground;
  if (foreground.parentNode) {
    foreground.parentNode.removeChild(foreground);
  }

  var background = this.dom.background;
  if (background.parentNode) {
    background.parentNode.removeChild(background);
  }

  var axis = this.dom.axis;
  if (axis.parentNode) {
    axis.parentNode.removeChild(axis);
  }
};

/**
 * Add an item to the group
 * @param {Item} item
 */
Group.prototype.add = function(item, widthContainerVIS, elementHeaderWidthItem, widthElement) {
  this.items[item.id] = item;
  item.setParent(this);
  this.stackDirty = true;

  // add to
  if (item.data.subgroup !== undefined) {
    if (this.subgroups[item.data.subgroup] === undefined) {
      this.subgroups[item.data.subgroup] = {height:0, visible: false, index:this.subgroupIndex, items: []};
      this.subgroupIndex++;
    }
    this.subgroups[item.data.subgroup].items.push(item);
  }
  this.orderSubgroups();

  if (this.visibleItems.indexOf(item) == -1) {
    if (this.itemSet.body) {
      var range = this.itemSet.body.range; // TODO: not nice accessing the range like this
      this._checkIfVisible(item, this.visibleItems, range, widthContainerVIS, elementHeaderWidthItem, widthElement);
    }
  }
};

Group.prototype.orderSubgroups = function() {
  if (this.subgroupOrderer !== undefined) {
    var sortArray = [];
    if (typeof this.subgroupOrderer == 'string') {
      for (var subgroup in this.subgroups) {
        sortArray.push({subgroup: subgroup, sortField: this.subgroups[subgroup].items[0].data[this.subgroupOrderer]})
      }
      sortArray.sort(function (a, b) {
        return a.sortField - b.sortField;
      })
    }
    else if (typeof this.subgroupOrderer == 'function') {
      for (var subgroup in this.subgroups) {
        sortArray.push(this.subgroups[subgroup].items[0].data);
      }
      sortArray.sort(this.subgroupOrderer);
    }

    if (sortArray.length > 0) {
      for (var i = 0; i < sortArray.length; i++) {
        this.subgroups[sortArray[i].subgroup].index = i;
      }
    }
  }
};

Group.prototype.resetSubgroups = function() {
  for (var subgroup in this.subgroups) {
    if (this.subgroups.hasOwnProperty(subgroup)) {
      this.subgroups[subgroup].visible = false;
    }
  }
};

/**
 * Remove an item from the group
 * @param {Item} item
 */
Group.prototype.remove = function(item) {
  delete this.items[item.id];
  item.setParent(null);
  this.stackDirty = true;

  // remove from visible items
  var index = this.visibleItems.indexOf(item);
  if (index != -1) this.visibleItems.splice(index, 1);

  if(item.data.subgroup !== undefined){
    var subgroup = this.subgroups[item.data.subgroup];
    if (subgroup){
      var itemIndex = subgroup.items.indexOf(item);
      subgroup.items.splice(itemIndex,1);
      if (!subgroup.items.length){
        delete this.subgroups[item.data.subgroup];
        this.subgroupIndex--;
      }
      this.orderSubgroups();
    }
  }
};


/**
 * Remove an item from the corresponding DataSet
 * @param {Item} item
 */
Group.prototype.removeFromDataSet = function(item) {
  this.itemSet.removeItem(item.id);
};


/**
 * Reorder the items
 */
Group.prototype.order = function() {
  var array = util.toArray(this.items);
  var startArray = [];
  var endArray = [];

  for (var i = 0; i < array.length; i++) {
    if (array[i].data.end !== undefined) {
      endArray.push(array[i]);
    }
    startArray.push(array[i]);
  }
  this.orderedItems = {
    byStart: startArray,
    byEnd: endArray
  };

  stack.orderByStart(this.orderedItems.byStart);
  stack.orderByEnd(this.orderedItems.byEnd);
};


/**
 * Update the visible items
 * @param {{byStart: Item[], byEnd: Item[]}} orderedItems   All items ordered by start date and by end date
 * @param {Item[]} visibleItems                             The previously visible items.
 * @param {{start: number, end: number}} range              Visible range
 * @return {Item[]} visibleItems                            The new visible items.
 * @private
 */
Group.prototype._updateVisibleItems = function(orderedItems, oldVisibleItems, range, widthContainerVIS, elementHeaderWidthItem, widthElement) {
  var visibleItems = [];
  var visibleItemsLookup = {}; // we keep this to quickly look up if an item already exists in the list without using indexOf on visibleItems
  var item, i;

  // first check if the items that were in view previously are still in view.
  // IMPORTANT: this handles the case for the items with startdate before the window and enddate after the window!
  // also cleans up invisible items.
  if (oldVisibleItems.length > 0) {
    for (i = 0; i < oldVisibleItems.length; i++) {
      this._checkIfVisibleWithReference(oldVisibleItems[i], visibleItems, visibleItemsLookup, range);
    }
  }

  // if the window has changed programmatically without overlapping the old window, the ranged items with start < lowerBound and end > upperbound are not shown.
  // We therefore have to brute force check all items in the byEnd list
  if (this.checkRangedItems == true) {
    this.checkRangedItems = false;
    for (i = 0; i < orderedItems.byEnd.length; i++) {
      this._checkIfVisibleWithReference(orderedItems.byEnd[i], visibleItems, visibleItemsLookup, range);
    }
  }

  // finally, we reposition all the visible items.
  for (i = 0; i < visibleItems.length; i++) {
    item = visibleItems[i];
      if (!item.displayed) item.show();
      // reposition item horizontally
      item.repositionX(true, range, widthContainerVIS, elementHeaderWidthItem, widthElement);
  }
  return visibleItems;
};

Group.prototype._traceVisible = function (initialPos, items, visibleItems, visibleItemsLookup, breakCondition) {
  var item;
  var i;

  if (initialPos != -1) {
    for (i = initialPos; i >= 0; i--) {
      item = items[i];
      if (breakCondition(item)) {
        break;
      }
      else {
        let visibleItemsLookupItem = visibleItemsLookup[item.id];
        if (visibleItemsLookupItem === undefined) {
          visibleItemsLookupItem = true;
          visibleItems.push(item);
        }
      }
    }

    for (i = initialPos + 1; i < items.length; i++) {
      item = items[i];
      if (breakCondition(item)) {
        break;
      }
      else {
        let visibleItemsLookupItem = visibleItemsLookup[item.id];
        if (visibleItemsLookupItem === undefined) {
          visibleItemsLookupItem = true;
          visibleItems.push(item);
        }
      }
    }
  }
}


/**
 * this function is very similar to the _checkIfInvisible() but it does not
 * return booleans, hides the item if it should not be seen and always adds to
 * the visibleItems.
 * this one is for brute forcing and hiding.
 *
 * @param {Item} item
 * @param {Array} visibleItems
 * @param {{start:number, end:number}} range
 * @private
 */
Group.prototype._checkIfVisible = function(item, visibleItems, range, widthContainerVIS, elementHeaderWidthItem, widthElement) {
    if (item.isVisible(range)) {
      if (!item.displayed) item.show();
      // reposition item horizontally
      item.repositionX(true, range, widthContainerVIS, elementHeaderWidthItem, widthElement);
      visibleItems.push(item);
    }
    else {
      if (item.displayed) item.hide();
    }
};


/**
 * this function is very similar to the _checkIfInvisible() but it does not
 * return booleans, hides the item if it should not be seen and always adds to
 * the visibleItems.
 * this one is for brute forcing and hiding.
 *
 * @param {Item} item
 * @param {Array} visibleItems
 * @param {{start:number, end:number}} range
 * @private
 */
Group.prototype._checkIfVisibleWithReference = function(item, visibleItems, visibleItemsLookup, range) {
  if (item.isVisible(range)) {
    let visibleItemsLookupItem = visibleItemsLookup[item.id];
    if (visibleItemsLookupItem === undefined) {
      visibleItemsLookupItem = true;
      visibleItems.push(item);
    }
  }
  else {
    if (item.displayed) item.hide();
  }
};

module.exports = Group;
