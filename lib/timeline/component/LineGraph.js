const Bars = require('./graph2d_types/bar');
const Component = require('./Component');
const DOMutil = require('../../DOMutil');
const DataAxis = require('./DataAxis');
const DataSet = require('../../DataSet');
const DataView = require('../../DataView');
const GraphGroup = require('./GraphGroup');
const Legend = require('./Legend');
const Lines = require('./graph2d_types/line');
const Points = require('./graph2d_types/points');
const TimelineChartDataAxis = require('./timeline-chart/TimelineChartDataAxis');
const util = require('../../util');

const UNGROUPED = '__ungrouped__'; // reserved group id for ungrouped items

/**
 * This is the constructor of the LineGraph. It requires a Timeline body and options.
 *
 * @param body
 * @param options
 * @constructor
 */
function LineGraph(body, options) {
  this.id = util.randomUUID();
  this.body = body;

  this.defaultOptions = {
    yAxisOrientation: 'left',
    defaultGroup: 'default',
    sort: true,
    sampling: true,
    stack: false,
    graphHeight: '400px',
    shaded: {
      enabled: false,
      orientation: 'bottom' // top, bottom, zero
    },
    style: 'line', // line, bar
    barChart: {
      width: 50,
      sideBySide: false,
      align: 'center' // left, center, right
    },
    interpolation: {
      enabled: true,
      parametrization: 'centripetal', // uniform (alpha = 0.0), chordal (alpha = 1.0), centripetal (alpha = 0.5)
      alpha: 0.5
    },
    drawPoints: {
      enabled: true,
      size: 6,
      style: 'square' // square, circle
    },
    dataAxis: {}, //Defaults are done on DataAxis level
    legend: {}, //Defaults are done on Legend level
    groups: {
      visibility: {}
    }
  };

  // options is shared by this lineGraph and all its items
  this.options = util.extend({}, this.defaultOptions);
  this.dom = {};
  this.props = {};
  this.hammer = null;
  this.groups = {};
  this.abortedGraphUpdate = false;
  this.updateSVGheight = false;
  this.updateSVGheightOnResize = false;
  this.forceGraphUpdate = true;

  const me = this;
  this.itemsData = null;    // DataSet
  this.groupsData = null;   // DataSet

  // listeners for the DataSet of the items
  this.itemListeners = {
    'add': function (event, params, senderId) {
      me._onAdd(params.items);
    },
    'update': function (event, params, senderId) {
      me._onUpdate(params.items);
    },
    'remove': function (event, params, senderId) {
      me._onRemove(params.items);
    }
  };

  // listeners for the DataSet of the groups
  this.groupListeners = {
    'add': function (event, params, senderId) {
      me._onAddGroups(params.items);
    },
    'update': function (event, params, senderId) {
      me._onUpdateGroups(params.items);
    },
    'remove': function (event, params, senderId) {
      me._onRemoveGroups(params.items);
    }
  };

  this.items = {};      // object with an Item for every data item
  this.selection = [];  // list with the ids of all selected nodes
  this.lastStart = this.body.range.start;
  this.touchParams = {}; // stores properties while dragging

  this.svgElements = {};
  this.setOptions(options);
  this.groupsUsingDefaultStyles = [0];
  this.body.emitter.on('rangechanged', function () {
    me.lastStart = me.body.range.start;

    me.forceGraphUpdate = true;
    //Is this local redraw necessary? (Core also does a change event!)
    if (!me.body.reduceRedraw) { // just execute if all redraws are executed
      me.redraw.call(me);
    }
  });

  // create the HTML DOM
  this._create();
  this.framework = { svg: this.svg, svgElements: this.svgElements, options: this.options, groups: this.groups };
}

LineGraph.prototype = new Component();

/**
 * Create the HTML DOM for the ItemSet
 */
LineGraph.prototype._create = function () {
  const frame = document.createElement('div');
  frame.className = 'vis-line-graph';
  this.dom.frame = frame;

  // create svg element for graph drawing.
  this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  this.svg.style.position = 'relative';
  this.svg.style.height = ('' + this.options.graphHeight).replace('px', '') + 'px';
  this.svg.style.display = 'block';
  frame.appendChild(this.svg);

  // data axis
  this.options.dataAxis.orientation = 'left';
  this.yAxisLeft = [];

  this.options.dataAxis.orientation = 'right';
  this.yAxisRight = new DataAxis(this.body, this.options.dataAxis, this.svg, this.options.groups);
  delete this.options.dataAxis.orientation;

  // legends
  this.legendLeft = new Legend(this.body, this.options.legend, 'left', this.options.groups);
  this.legendRight = new Legend(this.body, this.options.legend, 'right', this.options.groups);

  this.show();
};

/**
 * set the options of the LineGraph. the mergeOptions is used for subObjects that have an enabled element.
 * @param {object} options
 */
LineGraph.prototype.setOptions = function (options) {
  if (options) {
    const fields = ['sampling', 'defaultGroup', 'stack', 'height', 'graphHeight', 'yAxisOrientation', 'style', 'barChart', 'dataAxis', 'sort', 'groups'];
    if (options.graphHeight === undefined && options.height !== undefined) {
      this.updateSVGheight = true;
      this.updateSVGheightOnResize = true;
    } else if (this.body.domProps.centerContainer.height !== undefined
        && options.graphHeight !== undefined
        && parseInt((options.graphHeight + '').replace("px", '')) < this.body.domProps.centerContainer.height
    ) {
      this.updateSVGheight = true;
    }
    util.selectiveDeepExtend(fields, this.options, options);
    util.mergeOptions(this.options, options, 'interpolation');
    util.mergeOptions(this.options, options, 'drawPoints');
    util.mergeOptions(this.options, options, 'shaded');
    util.mergeOptions(this.options, options, 'legend');

    if (options.interpolation && typeof options.interpolation == 'object' && options.interpolation.parametrization) {
      if (options.interpolation.parametrization === 'uniform') {
        this.options.interpolation.alpha = 0;
      } else if (options.interpolation.parametrization === 'chordal') {
        this.options.interpolation.alpha = 1.0;
      } else {
        this.options.interpolation.parametrization = 'centripetal';
        this.options.interpolation.alpha = 0.5;
      }
    }

    if (this.yAxisLeft && options.dataAxis !== undefined) {
      Object.keys(this.yAxisLeft).forEach(i => this.yAxisLeft[i].setOptions(this.options.dataAxis));
      this.yAxisRight.setOptions(this.options.dataAxis);
    }

    if (this.legendLeft && options.legend !== undefined) {
      this.legendLeft.setOptions(this.options.legend);
      this.legendRight.setOptions(this.options.legend);
    }

    if (this.groups.hasOwnProperty(UNGROUPED)) {
      this.groups[UNGROUPED].setOptions(options);
    }
  }

  // this is used to redraw the graph if the visibility of the groups is changed.
  if (this.dom.frame) { //not on initial run?
    this.forceGraphUpdate = true;
    this.body.emitter.emit("_change", { queue: true });
  }
};

/**
 * Hide the component from the DOM
 */
LineGraph.prototype.hide = function () {
  // remove the frame containing the items
  if (this.dom.frame.parentNode) {
    this.dom.frame.parentNode.removeChild(this.dom.frame);
  }
};


/**
 * Show the component in the DOM (when not already visible).
 * @return {Boolean} changed
 */
LineGraph.prototype.show = function () {
  // show frame containing the items
  if (!this.dom.frame.parentNode) {
    this.body.dom.center.appendChild(this.dom.frame);
  }
};


/**
 * Set items
 * @param {vis.DataSet | null} items
 */
LineGraph.prototype.setItems = function (items) {
  const me = this;
  let ids;
  const oldItemsData = this.itemsData;

  // replace the dataset
  if (!items) {
    this.itemsData = null;
  }
  else if (items instanceof DataSet || items instanceof DataView) {
    this.itemsData = items;
  }
  else {
    throw new TypeError('Data must be an instance of DataSet or DataView');
  }

  if (oldItemsData) {
    // unsubscribe from old dataset
    util.forEach(this.itemListeners, function (callback, event) {
      oldItemsData.off(event, callback);
    });

    // remove all drawn items
    ids = oldItemsData.getIds();
    this._onRemove(ids);
  }

  if (this.itemsData) {
    // subscribe to new dataset
    const id = this.id;
    util.forEach(this.itemListeners, function (callback, event) {
      me.itemsData.on(event, callback, id);
    });

    // add all new items
    ids = this.itemsData.getIds();
    this._onAdd(ids);
  }
};


/**
 * Set groups
 * @param {vis.DataSet} groups
 */
LineGraph.prototype.setGroups = function (groups) {
  const me = this;
  let ids;

  // unsubscribe from current dataset
  if (this.groupsData) {
    util.forEach(this.groupListeners, function (callback, event) {
      me.groupsData.off(event, callback);
    });

    // remove all drawn groups
    ids = this.groupsData.getIds();
    this.groupsData = null;
    for (let i = 0; i < ids.length; i++) {
      this._removeGroup(ids[i]);
    }
  }

  // replace the dataset
  if (!groups) {
    this.groupsData = null;
  }
  else if (groups instanceof DataSet || groups instanceof DataView) {
    this.groupsData = groups;
  }
  else {
    throw new TypeError('Data must be an instance of DataSet or DataView');
  }

  if (this.groupsData) {
    // subscribe to new dataset
    const id = this.id;
    util.forEach(this.groupListeners, function (callback, event) {
      me.groupsData.on(event, callback, id);
    });

    // draw all ms
    ids = this.groupsData.getIds();
    this._onAddGroups(ids);
  }
};

LineGraph.prototype._onUpdate = function (ids) {
  this._updateAllGroupData();
};
LineGraph.prototype._onAdd = function (ids) {
  this._onUpdate(ids);
};
LineGraph.prototype._onRemove = function (ids) {
  this._onUpdate(ids);
};
LineGraph.prototype._onUpdateGroups = function (groupIds) {
  this._updateAllGroupData();
};
LineGraph.prototype._onAddGroups = function (groupIds) {
  this._onUpdateGroups(groupIds);
};

/**
 * this cleans the group out off the legends and the dataaxis, updates the ungrouped and updates the graph
 * @param {Array} groupIds
 * @private
 */
LineGraph.prototype._onRemoveGroups = function (groupIds) {
  for (let i = 0; i < groupIds.length; i++) {
    this._removeGroup(groupIds[i]);
  }
  this.forceGraphUpdate = true;
  this.body.emitter.emit("_change", { queue: true });
};

/**
 * this cleans the group out off the legends and the dataaxis
 * @param groupId
 * @private
 */
LineGraph.prototype._removeGroup = function (groupId) {
  if (this.groups.hasOwnProperty(groupId)) {
    if (this.groups[groupId].options.yAxisOrientation === 'right') {
      this.yAxisRight.removeGroup(groupId);
      this.legendRight.removeGroup(groupId);
      this.legendRight.redraw();
    } else {
      Object.keys(this.yAxisLeft).forEach(i => this.yAxisLeft[i].removeGroup(groupId));
      this.legendLeft.removeGroup(groupId);
      this.legendLeft.redraw();
    }
    delete this.groups[groupId];
  }
};

/**
 * update a group object with the group dataset entree
 *
 * @param group
 * @param groupId
 * @private
 */
LineGraph.prototype._updateGroup = function (group, groupId) {
  if (!this.groups.hasOwnProperty(groupId)) {
    this.groups[groupId] = new GraphGroup(group, groupId, this.options, this.groupsUsingDefaultStyles);
    if (this.groups[groupId].options.yAxisOrientation === 'right') {
      this.yAxisRight.addGroup(groupId, this.groups[groupId]);
      this.legendRight.addGroup(groupId, this.groups[groupId]);
    } else {
      Object.keys(this.yAxisLeft).forEach(i => this.yAxisLeft[i].addGroup(groupId, this.groups[groupId]));
      this.legendLeft.addGroup(groupId, this.groups[groupId]);
    }
  } else {
    this.groups[groupId].update(group);
    if (this.groups[groupId].options.yAxisOrientation === 'right') {
      this.yAxisRight.updateGroup(groupId, this.groups[groupId]);
      this.legendRight.updateGroup(groupId, this.groups[groupId]);
      //If yAxisOrientation changed, clean out the group from the other axis.
      Object.keys(this.yAxisLeft).forEach(i => this.yAxisLeft[i].removeGroup(groupId));
      this.legendLeft.removeGroup(groupId);
    } else {
      Object.keys(this.yAxisLeft).forEach(i => this.yAxisLeft[i].updateGroup(groupId, this.groups[groupId]));
      this.legendLeft.updateGroup(groupId, this.groups[groupId]);
      //If yAxisOrientation changed, clean out the group from the other axis.
      this.yAxisRight.removeGroup(groupId);
      this.legendRight.removeGroup(groupId);
    }
  }
  this.legendLeft.redraw();
  this.legendRight.redraw();
};

LineGraph.prototype._generateGroupContents = function (itemsData) {
  const groupsContent = {};
  const items = itemsData.get();
  //pre-Determine array sizes, for more efficient memory claim
  const groupCounts = {};
  for (let i = 0; i < items.length; i++) {
    let item = items[i];
    let groupId = item.group;
    if (groupId === null || groupId === undefined) {
      groupId = UNGROUPED;
    }
    groupCounts.hasOwnProperty(groupId) ? groupCounts[groupId]++ : groupCounts[groupId] = 1;
  }
  //Now insert data into the arrays.
  for (let i = 0; i < items.length; i++) {
    let item = items[i];
    let groupId = item.group;
    if (groupId === null || groupId === undefined) {
      groupId = UNGROUPED;
    }
    if (!groupsContent.hasOwnProperty(groupId)) {
      groupsContent[groupId] = new Array(groupCounts[groupId]);
    }
    //Copy data (because of unmodifiable DataView input.
    const extended = util.bridgeObject(item);
    extended.x = util.convert(item.x, 'Date');
    extended.orginalY = item.y; //real Y
    extended.y = Number(item.y);
    extended.index = item.index;
    extended.styleLine = item.styleLine;
    extended.stylePoint = item.stylePoint;
    extended.referenceLine = item.referenceLine;
    extended.alertMin = item.alertMin;
    extended.alertMax = item.alertMax;
    extended.alertMed = item.alertMed;
    extended.alertColor = item.alertColor;

    const index = groupsContent[groupId].length - groupCounts[groupId]--;
    groupsContent[groupId][index] = extended;
  }

  //Make sure all groups are present, to allow removal of old groups
  for (let groupId in this.groups) {
    if (this.groups.hasOwnProperty(groupId)) {
      if (!groupsContent.hasOwnProperty(groupId)) {
        groupsContent[groupId] = new Array(0);
      }
    }
  }

  return groupsContent;
};

/**
 * this updates all groups, it is used when there is an update the the itemset.
 *
 * @private
 */
LineGraph.prototype._updateAllGroupData = function () {
  if (this.itemsData != null) {
    const groupsContent = this._generateGroupContents(this.itemsData);

    //Update legendas, style and axis
    for (let groupId in groupsContent) {
      if (groupsContent.hasOwnProperty(groupId)) {
        if (groupsContent[groupId].length === 0) {
          if (this.groups.hasOwnProperty(groupId)) {
            this._removeGroup(groupId);
          }
        } else {
          this._insertYAxisLeft(groupId);
          let group = undefined;
          if (this.groupsData !== undefined) {
            group = this.groupsData.get(groupId);
          }
          if (_.isEmpty(group)) {
            group = { id: groupId, content: this.options.defaultGroup + groupId };
          }
          this._updateGroup(group, groupId);
          this.groups[groupId].setItems(Object.keys(groupsContent).filter((key) => key.split("_")[1] == group.value).reduce((v, i)=> v.concat(groupsContent[i]), []));
        }
      }
    }
    this.forceGraphUpdate = true;
    this.body.emitter.emit("_change", { queue: true });
  }
};

/**
 * Redraw the component, mandatory function
 * @return {boolean} Returns true if the component is resized
 */
LineGraph.prototype.redraw = function () {
  let resized = false;

  // calculate actual size and position
  this.props.width = this.dom.frame.offsetWidth;
  this.props.height = this.body.domProps.centerContainer.height
    - this.body.domProps.border.top
    - this.body.domProps.border.bottom;

  // check if this component is resized
  resized = this._isResized() || resized;

  // check whether zoomed (in that case we need to re-stack everything)
  const visibleInterval = this.body.range.end - this.body.range.start;
  const zoomed = (visibleInterval !== this.lastVisibleInterval);
  this.lastVisibleInterval = visibleInterval;

  if (resized === true) {
    this.svg.style.width = util.option.asSize(this.props.width);

    // if the height of the graph is set as proportional, change the height of the svg
    if ((this.options.height + '').indexOf("%") !== -1 || this.updateSVGheightOnResize === true) {
      this.updateSVGheight = true;
    }
  }

  // update the height of the graph on each redraw of the graph.
  if (this.updateSVGheight === true) {
    if (this.options.graphHeight !== this.props.height + 'px') {
      this.options.graphHeight = this.props.height + 'px';
      this.svg.style.height = this.props.height + 'px';
    }
    this.updateSVGheight = false;
  }
  else {
    this.svg.style.height = ('' + this.options.graphHeight).replace('px', '') + 'px';
  }

  // zoomed is here to ensure that animations are shown correctly.
  if (resized === true || zoomed === true || this.abortedGraphUpdate === true || this.forceGraphUpdate === true) {
    resized = this._updateGraph() || resized;
    this.forceGraphUpdate = false;
  }

  if(this.body.reduceRedraw && !resized){
    if (this.body.eventOnDrawn) {
      this.body.eventOnDrawn();
    }
  }

  this.legendLeft.redraw();
  this.legendRight.redraw();
  return resized;
};


LineGraph.prototype._getSortedGroupIds = function () {
  // getting group Ids
  const grouplist = [];
  for (let groupId in this.groups) {
    if (this.groups.hasOwnProperty(groupId)) {
      const group = this.groups[groupId];
      if (group.visible === true && (this.options.groups.visibility[groupId] === undefined || this.options.groups.visibility[groupId] === true)) {
        grouplist.push({ id: groupId, zIndex: group.options.zIndex });
      }
    }
  }
  util.insertSort(grouplist, function (a, b) {
    let az = a.zIndex;
    let bz = b.zIndex;
    if (az === undefined) az = 0;
    if (bz === undefined) bz = 0;
    return az === bz ? 0 : (az < bz ? -1 : 1);
  });
  const groupIds = new Array(grouplist.length);
  for (let i = 0; i < grouplist.length; i++) {
    groupIds[i] = grouplist[i].id;
  }
  return groupIds;
};

/**
 * Update and redraw the graph.
 *
 */
LineGraph.prototype._updateGraph = function () {
  // reset the svg elements
  DOMutil.prepareElements(this.svgElements);
  if (this.props.width !== 0 && this.itemsData != null) {
    let group, i;
    const groupRanges = {};
    let changeCalled = false;
    // this is the range of the SVG canvas
    const minDate = this.body.util.toGlobalTime(-this.body.domProps.root.width);
    const maxDate = this.body.util.toGlobalTime(2 * this.body.domProps.root.width);

    // getting group Ids
    const groupIds = this._getSortedGroupIds();
    if (groupIds.length > 0) {
      const groupsData = {};

      // fill groups data, this only loads the data we require based on the timewindow
      this._getRelevantData(groupIds, groupsData, minDate, maxDate);

      // apply sampling, if disabled, it will pass through this function.
      this._applySampling(groupIds, groupsData);

      // we transform the X coordinates to detect collisions
      for (i = 0; i < groupIds.length; i++) {
        this._convertXcoordinates(groupsData[groupIds[i]]);
      }

      // now all needed data has been collected we start the processing.
      this._getYRanges(groupIds, groupsData, groupRanges);

      // update the Y axis first, we use this data to draw at the correct Y points
      changeCalled = this._updateYAxis(groupIds, groupRanges);

      //  at changeCalled, abort this update cycle as the graph needs another update with new Width input from the Redraw container.
      //  Cleanup SVG elements on abort.
      if (changeCalled === true) {
        DOMutil.cleanupElements(this.svgElements);
        this.abortedGraphUpdate = true;
        return true;
      }
      this.abortedGraphUpdate = false;

      // With the yAxis scaled correctly, use this to get the Y values of the points.
      let below = undefined;
      for (i = 0; i < groupIds.length; i++) {
        group = this.groups[groupIds[i]];
        if (this.options.stack === true && this.options.style === 'line') {
          if (group.options.excludeFromStacking === undefined || !group.options.excludeFromStacking) {
            if (below !== undefined) {
              this._stack(groupsData[group.id], groupsData[below.id]);
              if (group.options.shaded.enabled === true && group.options.shaded.orientation !== "group") {
                if (group.options.shaded.orientation === "top" && below.options.shaded.orientation !== "group") {
                  below.options.shaded.orientation = "group";
                  below.options.shaded.groupId = group.id;
                } else {
                  group.options.shaded.orientation = "group";
                  group.options.shaded.groupId = below.id;
                }
              }
            }
            below = group;
          }
        }
        this._convertYcoordinates(groupsData[groupIds[i]], group);
      }

      //Precalculate paths and draw shading if appropriate. This will make sure the shading is always behind any lines.
      const paths = {};
      for (i = 0; i < groupIds.length; i++) {
        group = this.groups[groupIds[i]];
        if (group.options.style === 'line' && group.options.shaded.enabled === true) {
          const dataset = groupsData[groupIds[i]];
          if (dataset == null || dataset.length === 0) {
            continue;
          }
          if (!paths.hasOwnProperty(groupIds[i])) {
            paths[groupIds[i]] = Lines.calcPath(dataset, group);
          }
          if (group.options.shaded.orientation === "group") {
            const subGroupId = group.options.shaded.groupId;
            if (groupIds.indexOf(subGroupId) === -1) {
              console.log(group.id + ": Unknown shading group target given:" + subGroupId);
              continue;
            }
            if (!paths.hasOwnProperty(subGroupId)) {
              paths[subGroupId] = Lines.calcPath(groupsData[subGroupId], this.groups[subGroupId]);
            }
            Lines.drawShading(paths[groupIds[i]], group, paths[subGroupId], this.framework);
          }
          else {
            Lines.drawShading(paths[groupIds[i]], group, undefined, this.framework);
          }
        }
      }

      // draw the groups, calculating paths if still necessary.
      Bars.draw(groupIds, groupsData, this.framework);
      for (i = 0; i < groupIds.length; i++) {
        group = this.groups[groupIds[i]];
        if (groupsData[groupIds[i]].length > 0) {
          switch (group.options.style) {
            case "line":
              if (!paths.hasOwnProperty(groupIds[i])) {
                paths[groupIds[i]] = Lines.calcPath(groupsData[groupIds[i]], group);
              }
              Lines.draw(paths[groupIds[i]], group, this.framework);
            //explicit no break;
            case "point":
            //explicit no break;
            case "points":
              if (group.options.style === "point" || group.options.style === "points" || group.options.drawPoints.enabled === true) {
                Points.draw(groupsData[groupIds[i]], group, this.framework);
              }
              break;
            case "bar":
            // bar needs to be drawn enmasse
            //explicit no break
            default:
            //do nothing...
          }
        }

      }
    }
  }

  // cleanup unused svg elements
  DOMutil.cleanupElements(this.svgElements);
  return false;
};

LineGraph.prototype._stack = function (data, subData) {
  let index, dx, dy, subPrevPoint, subNextPoint;
  index = 0;
  // for each data point we look for a matching on in the set below
  for (let j = 0; j < data.length; j++) {
    subPrevPoint = undefined;
    subNextPoint = undefined;
    // we look for time matches or a before-after point
    for (let k = index; k < subData.length; k++) {
      // if times match exactly
      if (subData[k].x === data[j].x) {
        subPrevPoint = subData[k];
        subNextPoint = subData[k];
        index = k;
        break;
      }
      else if (subData[k].x > data[j].x) { // overshoot
        subNextPoint = subData[k];
        if (k === 0) {
          subPrevPoint = subNextPoint;
        }
        else {
          subPrevPoint = subData[k - 1];
        }
        index = k;
        break;
      }
    }
    // in case the last data point has been used, we assume it stays like this.
    if (subNextPoint === undefined) {
      subPrevPoint = subData[subData.length - 1];
      subNextPoint = subData[subData.length - 1];
    }
    // linear interpolation
    dx = subNextPoint.x - subPrevPoint.x;
    dy = subNextPoint.y - subPrevPoint.y;
    if (dx === 0) {
      data[j].y = data[j].orginalY + subNextPoint.y;
    }
    else {
      data[j].y = data[j].orginalY + (dy / dx) * (data[j].x - subPrevPoint.x) + subPrevPoint.y; // ax + b where b is data[j].y
    }
  }
};


/**
 * first select and preprocess the data from the datasets.
 * the groups have their preselection of data, we now loop over this data to see
 * what data we need to draw. Sorted data is much faster.
 * more optimization is possible by doing the sampling before and using the binary search
 * to find the end date to determine the increment.
 *
 * @param {array}  groupIds
 * @param {object} groupsData
 * @param {date}   minDate
 * @param {date}   maxDate
 * @private
 */
LineGraph.prototype._getRelevantData = function (groupIds, groupsData, minDate, maxDate) {
  let group, i, j, item;
  if (groupIds.length > 0) {
    for (i = 0; i < groupIds.length; i++) {
      group = this.groups[groupIds[i]];
      const itemsData = group.getItems();
      // optimization for sorted data
      if (group.options.sort === true) {
        const dateComparator = function (a, b) {
          return a.getTime() === b.getTime() ? 0 : a < b ? -1 : 1
        };
        const first = Math.max(0, util.binarySearchValue(itemsData, minDate, 'x', 'before', dateComparator));
        let last = Math.min(itemsData.length, util.binarySearchValue(itemsData, maxDate, 'x', 'after', dateComparator) + 1);
        if (last <= 0) {
          last = itemsData.length;
        }
        const dataContainer = new Array(last - first);
        for (j = first; j < last; j++) {
          item = group.itemsData[j];
          dataContainer[j - first] = item;
        }
        groupsData[groupIds[i]] = dataContainer;
      }
      else {
        // If unsorted data, all data is relevant, just returning entire structure
        groupsData[groupIds[i]] = group.itemsData;
      }
    }
  }
};


/**
 *
 * @param groupIds
 * @param groupsData
 * @private
 */
LineGraph.prototype._applySampling = function (groupIds, groupsData) {
  let group;
  if (groupIds.length > 0) {
    for (let i = 0; i < groupIds.length; i++) {
      group = this.groups[groupIds[i]];
      if (group.options.sampling === true) {
        const dataContainer = groupsData[groupIds[i]];
        if (dataContainer.length > 0) {
          let increment = 1;
          const amountOfPoints = dataContainer.length;

          // the global screen is used because changing the width of the yAxis may affect the increment, resulting in an endless loop
          // of width changing of the yAxis.
          const xDistance = this.body.util.toGlobalScreen(dataContainer[dataContainer.length - 1].x) - this.body.util.toGlobalScreen(dataContainer[0].x);
          const pointsPerPixel = amountOfPoints / xDistance;
          increment = Math.min(Math.ceil(0.2 * amountOfPoints), Math.max(1, Math.round(pointsPerPixel)));

          const sampledData = new Array(amountOfPoints);
          for (let j = 0; j < amountOfPoints; j += increment) {
            const idx = Math.round(j / increment);
            sampledData[idx] = dataContainer[j];
          }
          groupsData[groupIds[i]] = sampledData.splice(0, Math.round(amountOfPoints / increment));
        }
      }
    }
  }
};


/**
 *
 *
 * @param {array}  groupIds
 * @param {object} groupsData
 * @param {object} groupRanges  | this is being filled here
 * @private
 */
LineGraph.prototype._getYRanges = function (groupIds, groupsData, groupRanges) {
  let groupData, group, i;
  let combinedDataLeft = [];
  let combinedDataRight = [];
  let options;
  if (groupIds.length > 0) {
    for (i = 0; i < groupIds.length; i++) {
      groupData = groupsData[groupIds[i]];
      options = this.groups[groupIds[i]].options;
      if (groupData.length > 0) {
        group = this.groups[groupIds[i]];
        // if bar graphs are stacked, their range need to be handled differently and accumulated over all groups.
        if (options.stack === true && options.style === 'bar') {
          if (options.yAxisOrientation === 'left') {
            combinedDataLeft = combinedDataLeft.concat(group.getItems());
          }
          else {
            combinedDataRight = combinedDataRight.concat(group.getItems());
          }
        }
        else {
          groupRanges[groupIds[i]] = group.getYRange(groupData, groupIds[i]);
        }
      }
    }

    // if bar graphs are stacked, their range need to be handled differently and accumulated over all groups.
    Bars.getStackedYRange(combinedDataLeft, groupRanges, groupIds, '__barStackLeft', 'left');
    Bars.getStackedYRange(combinedDataRight, groupRanges, groupIds, '__barStackRight', 'right');
  }
};


/**
 * this sets the Y ranges for the Y axis. It also determines which of the axis should be shown or hidden.
 * @param {Array} groupIds
 * @param {Object} groupRanges
 * @private
 */
LineGraph.prototype._updateYAxis = function (groupIds, groupRanges) {
  let resized = false;
  let yAxisLeftUsed = false;
  let yAxisRightUsed = false;
  let minLeft = 1e9, minRight = 1e9, maxLeft = -1e9, maxRight = -1e9, minVal, maxVal;
  // if groups are present
  if (groupIds.length > 0) {
    // this is here to make sure that if there are no items in the axis but there are groups, that there is no infinite draw/redraw loop.
    for (let i = 0; i < groupIds.length; i++) {
      const group = this.groups[groupIds[i]];
      if (group && group.options.yAxisOrientation !== 'right') {
        yAxisLeftUsed = true;
        minLeft = 1e9;
        maxLeft = -1e9;
      }
      else if (group && group.options.yAxisOrientation) {
        yAxisRightUsed = true;
        minRight = 1e9;
        maxRight = -1e9;
      }
    }

    // if there are items:
    for (let i = 0; i < groupIds.length; i++) {
      if (groupRanges.hasOwnProperty(groupIds[i])) {
        if (groupRanges[groupIds[i]].ignore !== true) {
          minVal = groupRanges[groupIds[i]].min;
          maxVal = groupRanges[groupIds[i]].max;

          if (groupRanges[groupIds[i]].yAxisOrientation !== 'right') {
            yAxisLeftUsed = true;
            minLeft = minLeft > minVal ? minVal : minLeft;
            maxLeft = maxLeft < maxVal ? maxVal : maxLeft;
          }
          else {
            yAxisRightUsed = true;
            minRight = minRight > minVal ? minVal : minRight;
            maxRight = maxRight < maxVal ? maxVal : maxRight;
          }

          const yAxisLeft = this._getAxisLeft(groupIds[i]);
          if (yAxisLeft) {
            if (yAxisLeftUsed === true) {
              yAxisLeft.setRange(minLeft, maxLeft);
            }
          }
        }
      }
    }

    Object.keys(this.yAxisLeft).forEach(groupName => {
      resized = this._toggleAxisVisiblity(yAxisLeftUsed, this.yAxisLeft[groupName]) || resized;
    });

    if (yAxisRightUsed === true) {
      this.yAxisRight.setRange(minRight, maxRight);
    }
  }
  resized = this._toggleAxisVisiblity(yAxisRightUsed, this.yAxisRight) || resized;

  if (yAxisRightUsed === true && yAxisLeftUsed === true) {
    Object.keys(this.yAxisLeft).forEach(i => this.yAxisLeft[i].drawIcons = true);
    this.yAxisRight.drawIcons = true;
  }
  else {
    Object.keys(this.yAxisLeft).forEach(i => this.yAxisLeft[i].drawIcons = false);
    this.yAxisRight.drawIcons = false;
  }
  this.yAxisRight.master = !yAxisLeftUsed;
  if (Object.keys(this.yAxisLeft).length && !this.yAxisRight.masterAxis) {
    const lastYAxisLeft = Object.keys(this.yAxisLeft).pop();
    this.yAxisRight.masterAxis = this.yAxisLeft[lastYAxisLeft];
  }

  if (this.yAxisRight.master === false) {
    if (yAxisRightUsed === true) {
      Object.keys(this.yAxisLeft).forEach(i => this.yAxisLeft[i].lineOffset = this.yAxisRight.width);
    } else {
      Object.keys(this.yAxisLeft).forEach(i => this.yAxisLeft[i].lineOffset = 0);
    }

    Object.keys(this.yAxisLeft).forEach((groupName, index) => {
      resized = this.yAxisLeft[groupName].redraw(index, groupName) || resized;
    });
    resized = this.yAxisRight.redraw() || resized;
  } else {
    resized = this.yAxisRight.redraw() || resized;
  }

  // clean the accumulated lists
  const tempGroups = ['__barStackLeft', '__barStackRight', '__lineStackLeft', '__lineStackRight'];
  for (let i = 0; i < tempGroups.length; i++) {
    if (groupIds.indexOf(tempGroups[i]) !== -1) {
      groupIds.splice(groupIds.indexOf(tempGroups[i]), 1);
    }
  }

  return resized;
};


/**
 * This shows or hides the Y axis if needed. If there is a change, the changed event is emitted by the updateYAxis function
 *
 * @param {boolean} axisUsed
 * @returns {boolean}
 * @private
 * @param axis
 */
LineGraph.prototype._toggleAxisVisiblity = function (axisUsed, axis) {
  let changed = false;
  if (axisUsed === false) {
    if (axis.dom.frame.parentNode && axis.hidden === false) {
      axis.hide();
      changed = true;
    }
  }
  else {
    if (!axis.dom.frame.parentNode && axis.hidden === true) {
      axis.show();
      changed = true;
    }
  }
  return changed;
};


/**
 * This uses the DataAxis object to generate the correct X coordinate on the SVG window. It uses the
 * util function toScreen to get the x coordinate from the timestamp. It also pre-filters the data and get the minMax ranges for
 * the yAxis.
 *
 * @param datapoints
 * @returns {Array}
 * @private
 */
LineGraph.prototype._convertXcoordinates = function (datapoints) {
  for (let i = 0; i < datapoints.length; i++) {
    if (this.body.range.options.gap === 0) {
      datapoints[i].screen_x = this.props.width + this._calculateGapPositionVIS(datapoints[i].x);
    } else {
      let factor = this.body.range.end - this.body.range.start;
      let xToPercent = (datapoints[i].x.getTime() - this.body.range.start) * 100 / factor;
      xToPercent = Number.isNaN(xToPercent) ? 0 : xToPercent;
      if (this.body.totalizer && this.body.totalizer.periods && this.body.totalizer.periods.length > 0) {
        var totalizers = this.body.totalizer.periods.filter(x => { return x.end.valueOf() > this.body.range.start && x.end.valueOf() < this.body.range.end });
        var filteredTotalizers = totalizers.filter(x => { return x.end.valueOf() < datapoints[i].x.getTime() });
        var columnWidth = this.props.width / (factor / (3600000 * this.body.range.options.gap) + totalizers.length);
        datapoints[i].screen_x = ((this.props.width - totalizers.length * columnWidth) * xToPercent / 100) + filteredTotalizers.length * columnWidth;
      } else {
        datapoints[i].screen_x = this.props.width * xToPercent / 100;
      }
    }

    datapoints[i].screen_y = datapoints[i].y; //starting point for range calculations
  }
};

LineGraph.prototype._calculateGapPositionVIS = function (x) {
  let dateStart = new Date(this.body.range.start);
  const widthTimeline = document.querySelector('.data-region-timeline') ? document.querySelector('.data-region-timeline').offsetWidth : 0;
  const elementHeaderWidthItem = document.querySelectorAll('.tl-setting-bar__item');
  const elementHeaderWidth = document.querySelector('.tl-setting-bar');

  // where widthTimeline 0 return 0
  if (widthTimeline === 0) return 0;

  // calculate when gap === 0 (fit)
  if (this.body.range.options.gap === 0) {
    let dateElement = new Date(x);
    let index = 0;
    let itemHours = null;
    // if the hours difference comes negative it calculates with one more day
    const diffNegative = function (dateStart, dateEnd) {
      let diffFunction = dateStart.diff(dateEnd);
      if (diffFunction < 1) diffNegative(dateStart.add(1, 'day'), dateEnd);
      return diffFunction;
    };
    // scrolls through the items in the settingbar
    Object.values(elementHeaderWidth.children).forEach((item) => {
      const itemCurrentSplit = item.querySelector('.item-label').innerText.split(':');
      const hours = itemCurrentSplit[0];
      const minutes = itemCurrentSplit[1];
      let diff = 0;
      if (itemHours) {
        //calculete difference de hours,
        diff = moment().hours(hours).minutes(minutes).diff(itemHours);
        //if diferrence negative, add one more day
        if (diff < 1) {
          diff = diffNegative(moment().add(1, 'day').hours(hours).minutes(minutes), itemHours);
        }
      }
      //checks for shorter start times and adds the corresponding index
      if (dateStart < dateElement) {
        dateStart = new Date(dateStart.getTime() + diff);
        if (dateStart < dateElement) index++;
      }
      itemHours = moment().hours(hours).minutes(minutes);
    });

    //multiplies the index with the width of the settingbar item and adds half more width to align correctly
    const widthElement = parseFloat(elementHeaderWidth.offsetWidth / elementHeaderWidthItem.length).toFixed(2);
    return ((widthElement * index) + ((widthElement / 2) + 1.5));
  } else {
    let gap = 0;
    if (this.body.range.options.gap < .05) gap = (1 / this.body.range.options.gap) * .028;
    else if (this.body.range.options.gap < .1) gap = (1 / this.body.range.options.gap) * .15;
    else if (this.body.range.options.gap < .5) gap = (1 / this.body.range.options.gap) * .5;
    else if (this.body.range.options.gap < 1) gap = (1 / this.body.range.options.gap) * 1.15;
    else if (this.body.range.options.gap === 1) gap = (this.body.range.options.gap * 2.45);
    else if (this.body.range.options.gap === 2) gap = (this.body.range.options.gap * .85);
    else if (this.body.range.options.gap < 5) gap = (this.body.range.options.gap * .95);
    else gap = (this.body.range.options.gap * 1.05);

    //width timeline > 1000
    if (widthTimeline > 1000) {
      gap = gap + .75;
      if (gap > 5) gap = gap + 1.75;
      if (this.body.range.options.gap === 1) gap = 0;
      gap = Math.round(gap);
    }

    //width timeline < 800
    if (widthTimeline < 800) {
      if (this.body.range.options.gap < .05) gap = (gap * .0125);
      else if (this.body.range.options.gap < 1) gap = (gap * .45);
      if (this.body.range.options.gap > 1) gap = gap + .75;
      if (gap > 8) gap = gap * .75;
      if (this.body.range.options.gap === 1) gap = gap * .6
    }

    const dateItem = new Date(x);
    const timeDiff = Math.abs(dateItem.getTime() - dateStart.getTime());
    const diffHours = parseFloat(timeDiff / (1000 * 60 * 60));
    let valueDiffWidth = (this.props.width / widthTimeline);

    let valueScreenSmall = (valueDiffWidth > 1 || widthTimeline < 800) ? 0 : (2.5 * diffHours);
    valueDiffWidth = (this.body.range.options.gap < 1 && widthTimeline < 800) ? ((valueDiffWidth / gap) + (this.body.range.options.gap * 2.25)) : valueDiffWidth;

    return parseInt(valueDiffWidth * gap * diffHours) + valueScreenSmall;
  }
};


/**
 * This uses the DataAxis object to generate the correct X coordinate on the SVG window. It uses the
 * util function toScreen to get the x coordinate from the timestamp. It also pre-filters the data and get the minMax ranges for
 * the yAxis.
 *
 * @param datapoints
 * @param group
 * @returns {Array}
 * @private
 */
LineGraph.prototype._convertYcoordinates = function (datapoints, group) {
  let axis = this._getAxisLeft(group.id);
  let svgHeight = Number(this.svg.style.height.replace('px', ''));
  if (group.options.yAxisOrientation === 'right') {
    axis = this.yAxisRight;
  }
  for (let i = 0; i < datapoints.length; i++) {
    datapoints[i].screen_y = Math.round(axis.convertValue(datapoints[i].y));
  }
  group.setZeroPosition(Math.min(svgHeight, axis.convertValue(0)));
};

/**
 * Find axis object by id or return the first when graph has single axis
 *
 * @param {String} groupId
 * @returns {TimelineChartDataAxis}
 * @private
 */
LineGraph.prototype._getAxisLeft = function (groupId = null) {
  if (groupId && groupId in this.yAxisLeft) {
    return this.yAxisLeft[groupId];
  }
  return this.yAxisLeft[Object.keys(this.yAxisLeft)[0]];
};

/**
 * Update Axis Left according Group Data.
 * In case of group not summary, must be just one axis.
 *
 * @param {String} groupId
 * @param {Boolean} groupSummary
 * @param {Boolean} timeline
 * @private
 */
LineGraph.prototype._insertYAxisLeft = function (groupId, groupSummary = false, timeline = false) {
  if (groupSummary || Object.keys(this.yAxisLeft).length === 0) {
    const axisArguments = [this.body, this.options.dataAxis, this.svg, this.options.groups];
    let axis = new DataAxis(...axisArguments);
    if (timeline) {
      axis = new TimelineChartDataAxis(...axisArguments);
    }
    this.yAxisLeft[groupId] = axis;
  }
};

module.exports = LineGraph;