const util = require('../../../util');
const DOMutil = require('../../../DOMutil');
const Bars = require('../graph2d_types/bar');
const Lines = require('../graph2d_types/line');
const Points = require('../graph2d_types/points');
const InfusionRate = require('../graph2d_types/infusionRate');
const Legend = require('../Legend');
const LineGraph = require('../LineGraph');
const TimelineChartDataAxis = require('./TimelineChartDataAxis');


const UNGROUPED = '__ungrouped__'; // reserved group id for ungrouped items
class TimelineChartLineGraph extends LineGraph {
  constructor(body, options) {
    super(body, options);

    this.options = util.extend({}, this.defaultOptions);
  }

  _create() {
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
    this.yAxisRight = new TimelineChartDataAxis(this.body, this.options.dataAxis, this.svg, this.options.groups);
    delete this.options.dataAxis.orientation;

    // legends
    this.legendLeft = new Legend(this.body, this.options.legend, 'left', this.options.groups);
    this.legendRight = new Legend(this.body, this.options.legend, 'right', this.options.groups);

    this.show();
  }

  _updateGraph() {
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
        if (changeCalled == true) {
          DOMutil.cleanupElements(this.svgElements);
          this.abortedGraphUpdate = true;
          return true;
        }
        this.abortedGraphUpdate = false;

        // With the yAxis scaled correctly, use this to get the Y values of the points.
        let below = undefined;
        let previousY = 0;
        let actualY = 0;
        for (i = 0; i < groupIds.length; i++) {
          group = this.groups[groupIds[i]];
          if (this.options.stack === true && (this.options.style === 'line' || this.options.style === 'trend')) {
            if (group.options.excludeFromStacking == undefined || !group.options.excludeFromStacking) {
              if (below != undefined) {
                this._stack(groupsData[group.id], groupsData[below.id]);
                if (group.options.shaded.enabled == true && group.options.shaded.orientation !== "group") {
                  if (group.options.shaded.orientation == "top" && below.options.shaded.orientation !== "group") {
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
          previousY = actualY;
          actualY += group.group.rowHeightId[`tl-groups_${group.id}`];
          if (group.summary) {
            let ySummary = 0
            for (let s = 0; s < groupIds.length; s++) {
              const grupoSummary = this.groups[groupIds[s]];
              const rowHeightSummary = grupoSummary.group.rowHeightId[`tl-groups_${grupoSummary.id}`];
              ySummary += (rowHeightSummary) ? rowHeightSummary : 0;
            }

            this._convertYcoordinates(groupsData[groupIds[i]], group, ySummary, 0);
          } else {
            this._convertYcoordinates(groupsData[groupIds[i]], group, actualY, previousY);
          }
        }

        //take the max value index of the group
        const maxIndexGroup = (objectArray) => {
          return objectArray.reduce(function (accumulator, currentValue) {
            return (accumulator > currentValue ? accumulator : currentValue);
          });
        }

        //Precalculate paths and draw shading if appropriate. This will make sure the shading is always behind any lines.
        const paths = {};
        for (i = 0; i < groupIds.length; i++) {
          group = this.groups[groupIds[i]];
          if (group.group.type == 'infusionrate' || group.group.type == 'bolus') {
            InfusionRate.drawBackground(group, this.framework);
          }
          if ((group.options.style === 'line' || group.options.style === 'trend') && group.options.shaded.enabled == true) {
            const dataset = groupsData[groupIds[i]];
            if (dataset == null || dataset.length == 0) {
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
              if (group.options.style === 'line' && dataset.filter(x => x.index !== undefined && x.index !== 0).length > 0) {
                const maxIndex = maxIndexGroup(dataset.map(x => x.index));
                for (let j = 1; j <= maxIndex; j++) {
                  const groupData = dataset.filter(x => x.index == j);
                  if (groupData.length > 0) {
                    delete paths[groupIds[i]];

                    if (!paths.hasOwnProperty(groupIds[i])) {
                      paths[groupIds[i]] = Lines.calcPath(groupData, group);
                    }
                    Lines.drawShading(paths[groupIds[i]], group, undefined, this.framework);
                  }
                }
              } else {
                Lines.drawShading(paths[groupIds[i]], group, undefined, this.framework);
              }
            }
          }
        }

        // draw the groups, calculating paths if still necessary.
        Bars.draw(groupIds, groupsData, this.framework);
        const callbackFunction = (visEventName, event, element, data) => {
          this.body.emitter.emit(visEventName, { data, event, element });
        }
        const groupsDataFunction = (groupData, groupId) => {
          if (!paths.hasOwnProperty(groupId)) {
            paths[groupId] = Lines.calcPath(groupData, group);
          }

          const itemData = groupData[0];
          if (itemData && itemData.styleLine) group.style = itemData.styleLine;

          const line = Lines.draw(paths[groupId], group, this.framework);

          if (group.group.type === 'line' || group.group.type === 'trend') {
            DOMutil.attachEvents(line, 'mouseenter', groupsData[groupId], (event, element, data) => callbackFunction('itemmouseenter', event, element, data));
            DOMutil.attachEvents(line, 'mouseout', groupsData[groupId], (event, element, data) => callbackFunction('itemmouseout', event, element, data));
            DOMutil.attachEvents(line, 'click', groupsData[groupId], (event, element, data) => callbackFunction('itemclick', event, element, data));
          }

          if (group.group.type === 'infusionrate') {
            DOMutil.attachEvents(line, 'mouseenter', groupData, (event, element, data) => callbackFunction('itemmouseenter', event, element, data));
            DOMutil.attachEvents(line, 'mouseout', groupData, (event, element, data) => callbackFunction('itemmouseout', event, element, data));
            DOMutil.attachEvents(line, 'click', groupData, (event, element, data) => callbackFunction('itemclick', event, element, data));
          }

        }
        for (i = 0; i < groupIds.length; i++) {
          group = this.groups[groupIds[i]];
          if (groupsData[groupIds[i]].length > 0) {
            switch (group.options.style) {
              case "line":
              case "trend": {
                if (groupsData[groupIds[i]].filter(x => x.index !== undefined && x.index !== 0).length > 0) {
                  const maxIndex = maxIndexGroup(groupsData[groupIds[i]].map(x => x.index));
                  for (let j = 1; j <= maxIndex; j++) {
                    const groupData = groupsData[groupIds[i]].filter(x => x.index == j);
                    if (groupData.length > 0) {
                      delete paths[groupIds[i]];
                      groupsDataFunction(groupData, groupIds[i]);
                    }
                  }
                } else {
                  groupsDataFunction(groupsData[groupIds[i]], groupIds[i])
                }
              }
              //explicit no break;
              case "point":
              //explicit no break;
              case "points":
                if (group.options.style == "point" || group.options.style == "points" || group.options.drawPoints.enabled == true) {
                  const points = Points.draw(groupsData[groupIds[i]], group, this.framework);

                  if (group.withTrend) {
                    const dataLineUp = [];
                    const dataLineDown = [];
                    const dataLineMiddle = [];
                    points.forEach((point) => {
                      const pointUp = point[0];
                      const pointDown = point[2];
                      const pointMiddle = point[1];
                      if (pointUp && pointUp.points && pointUp.points.length > 3) {
                        dataLineUp.push({
                          screen_x: pointUp.points[3].x,
                          screen_y: pointUp.points[0].y,
                        });
                      }

                      if (pointDown && pointDown.points && pointDown.points.length > 3) {
                        dataLineDown.push({
                          screen_x: pointDown.points[3].x,
                          screen_y: pointDown.points[0].y,
                        });
                      }
                   
                      if (pointMiddle) {
                        dataLineMiddle.push({
                          screen_x: pointMiddle.normalizedPathSegList._list[0].x,
                          screen_y: (pointMiddle.normalizedPathSegList._list[0].y + 2),
                        });
                      }
                    })

                    if (dataLineUp && dataLineDown && dataLineMiddle) {
                      const itemData = groupsData[groupIds[i]].find(x => x.referenceLine == false);
                      if (itemData && itemData.styleLine) group.style = itemData.styleLine;

                      const linePathUp = Lines.calcPath(dataLineUp, group);
                      Lines.draw(linePathUp, group, this.framework);

                      const linePathDown = Lines.calcPath(dataLineDown, group);
                      Lines.draw(linePathDown, group, this.framework);

                      const linePathMiddle = Lines.calcPath(dataLineMiddle, group);
                      Lines.draw(linePathMiddle, group, this.framework);
                    }
                  }

                  DOMutil.attachEvents(points, 'mouseenter', groupsData[groupIds[i]].filter(point => !point.referenceLine), (event, element, data) => callbackFunction('itemmouseenter', event, element, data));
                  DOMutil.attachEvents(points, 'mouseout', groupsData[groupIds[i]].filter(point => !point.referenceLine), (event, element, data) => callbackFunction('itemmouseout', event, element, data));
                  DOMutil.attachEvents(points, 'click', groupsData[groupIds[i]].filter(point => !point.referenceLine), (event, element, data) => callbackFunction('itemclick', event, element, data));
                }
                break;
              case "bar":
              // bar needs to be drawn enmasse
              //explicit no break
              default:
              //do nothing...
            }
          }
          if (group.group.type == 'infusionrate' || group.group.type == 'bolus') {
            InfusionRate.drawBolus(groupsData[groupIds[i]], this.framework, this.body);
          }
        }
      }
    }

    // cleanup unused svg elements
    DOMutil.cleanupElements(this.svgElements);
    return false;
  }

  setOptions(options) {
    if (options) {
      const fields = ['events', 'height', 'graphHeight', 'style', 'dataAxis', 'groups'];
      if (options.graphHeight === undefined && options.height !== undefined) {
        this.updateSVGheight = true;
        this.updateSVGheightOnResize = true;
      }
      else if (this.body.domProps.centerContainer.height !== undefined && options.graphHeight !== undefined) {
        if (parseInt((options.graphHeight + '').replace("px", '')) < this.body.domProps.centerContainer.height) {
          this.updateSVGheight = true;
        }
      }
      util.selectiveDeepExtend(fields, this.options, options);
      util.mergeOptions(this.options, options, 'interpolation');
      util.mergeOptions(this.options, options, 'drawPoints');
      util.mergeOptions(this.options, options, 'shaded');
      util.mergeOptions(this.options, options, 'legend');

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
  }

  _updateGroups(groupsContent) {
    this.yAxisLeft = []; // Clear Axis Left Array
    this.groupsData.forEach(group => {
      this._insertYAxisLeft(group.id, group.summary, true);
      this._updateGroup(group, group.id);
      this.groups[group.id].setItems(Object.keys(groupsContent).filter((key) => key.split("_")[1] == group.value).reduce((v, i)=> v.concat(groupsContent[i]), []));
    });
  }

  _convertYcoordinates(datapoints, group, actualY, previousY) {

    if (group.group.type === 'arrow-avg') {
      this._convertAvgYcoordinates(datapoints, group, actualY, previousY)
    } else {
      this._convertPointsYcoordinates(datapoints, group, actualY, previousY)
    }
  }

  _convertPointsYcoordinates(datapoints, group, actualY, previousY) {
    let axis = this._getAxisLeft(group.id);
    if (group.options.yAxisOrientation == 'right') {
      axis = this.yAxisRight;
    }

    const offset = 10;
    const baseScreenY = (actualY - previousY) - offset;
    const listOfValues = datapoints.map(d => d.y)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort();

    if (group.summary && group.group.intervalScale && group.group.minValue !== group.group.maxValue) {
      if(group.group.maxValue != undefined && !listOfValues.includes(group.group.maxValue)){
        listOfValues.push(group.group.maxValue);
      }
      if(group.group.minValue != undefined && !listOfValues.includes(group.group.minValue)){
        listOfValues.push(group.group.minValue);
      }
    }
    const range = {
      max: Math.max(...listOfValues),
      min: Math.min(...listOfValues)
    };

    for (let i = 0; i < datapoints.length; i++) {
      let convertedValue = 0;
      if (range.min === range.max) {
        convertedValue = Math.round(baseScreenY * 50 / 100);
      } else {
        convertedValue = Math.round(axis.convertValue(datapoints[i].y, range, baseScreenY));
        convertedValue = this._convertNegativeScale({ group, range, convertedValue });
      }
      datapoints[i].screen_y = (actualY - (offset / 2)) - convertedValue;
    }
    if (range.min === range.max) {
      group.zeroPosition = (actualY - (offset / 2)) - Math.round(baseScreenY * 50 / 100);
    } else {
      group.zeroPosition = (actualY - (offset / 2)) - Math.round(axis.convertValue(range.min, range, baseScreenY));
    }
  }

  _convertAvgYcoordinates(datapoints, group, actualY, previousY) {
    let axis = this._getAxisLeft(group.id);
    if (group.options.yAxisOrientation == 'right') {
      axis = this.yAxisRight;
    }
    const offset = 10;
    const baseScreenY = (actualY - previousY) - offset;
    const listOfMaxValues = datapoints.map(d => d.referenceLine ? d.y : d.maxValue);
    const listOfMinValues = datapoints.map(d => d.referenceLine ? d.y : d.minValue);
    const baseGraphHeight = (actualY - previousY);
    const range = {
      max: group.summary && group.group.maxValue != undefined ? group.group.maxValue : Math.max(...listOfMaxValues),
      min: group.summary && group.group.minValue != undefined ? group.group.minValue : Math.min(...listOfMinValues)
    };

    for (var i = 0; i < datapoints.length; i++) {
      if (datapoints[i].referenceLine) {
        let convertedValue = 0;
        const maxValue = datapoints[i].y;
        const minValue = datapoints[i].y;
        const difference = maxValue - minValue;
        convertedValue = Math.round(baseScreenY * 50 / 100);
        convertedValue = this._convertNegativeScale({ group, range, convertedValue });
        if(datapoints[i].referenceLine){
          convertedValue = Math.round(axis.convertValue(datapoints[i].y, range, baseScreenY));
        }
        datapoints[i].screen_y = (actualY - (offset / 2)) - convertedValue;

        const diffPercent = difference * 100 / (range.max - range.min);
        const proportionalSize = (diffPercent * baseScreenY / 100) - offset;
        datapoints[i].prop.size = proportionalSize <= 0 ? 0 : proportionalSize;
      } else {
        const maxValue = datapoints[i].maxValue;
        const minValue = datapoints[i].minValue;
        const avgValue = datapoints[i].avgValue;

        const distance = maxValue - minValue;
        const graphScale = range.max - range.min;

        const availableGraphHeight = baseGraphHeight;
        if(avgValue){
          datapoints[i].calculateAllPoints = true;
          datapoints[i].screen_yAvg = baseScreenY * ((avgValue - range.min) * 100 / graphScale) / 100;
          datapoints[i].screen_yMin = baseScreenY * ((minValue - range.min) * 100 / graphScale) / 100;
          datapoints[i].screen_yMax = baseScreenY * ((maxValue - range.min) * 100 / graphScale) / 100;
        } else { // if avgValue is not defined, it calculates de avg between min and max
          datapoints[i].calculateAllPoints = false;
          const middleValueInGraphScale = distance / 2 + minValue - range.min;
          const middleValueInScreenPosition = middleValueInGraphScale / graphScale * availableGraphHeight;
          datapoints[i].screen_y = actualY - middleValueInScreenPosition; // y positioning is calculated from the bottom (1600 - 280 - 60)
        }
        const arrowAvgSizeScale = distance / graphScale;
        const arrowAvgSize = availableGraphHeight * arrowAvgSizeScale;
        datapoints[i].prop.size = arrowAvgSize <= 0 ? 0 : arrowAvgSize;
        datapoints[i].prop.baseY = actualY;
        datapoints[i].prop.baseHeight = availableGraphHeight;
      }
    }
  }

  _updateAllGroupData() {
    if (this.itemsData != null) {
      //Update legendas, style and axis
      const groupsContent = this._generateGroupContents(this.itemsData);
      this._updateGroups(groupsContent);
      this._calculateHeights();
      this.forceGraphUpdate = true;
      this.body.emitter.emit("_change", { queue: true });
    }
  }

  _calculateHeights() {
    let totalHeight = 0;

    this.groupsData.forEach(d => {
      if (d.rowHeightId) {
        totalHeight += d.rowHeightId[d.className];
      }
    });

    this.options.height = totalHeight + 1;
    this.options.graphHeight = totalHeight + 1;
    this.options.legend = { enabled: false }
  }

  /**
   * IF max is less than min so the scale is inverted
   * e.g -4 on top until 4 on bottom
   * @param group
   * @param range
   * @param convertedValue
   * @returns {number}
   * @private
   */
  _convertNegativeScale({ group, range, convertedValue }) {
    let first = range.max;
    let last = range.min;
    if (group?.group?.axisCustomLabel) {
      const listOfYLabels = group.group.axisCustomLabel.map(d => d.y);
      first = listOfYLabels[0];
      last = listOfYLabels[listOfYLabels.length - 1];
      range.max = Math.max(...listOfYLabels);
      range.min = Math.min(...listOfYLabels);
    }
    if (first < last) {
      convertedValue = baseScreenY - convertedValue;
    }
    return convertedValue;
  }
}

module.exports = TimelineChartLineGraph;
