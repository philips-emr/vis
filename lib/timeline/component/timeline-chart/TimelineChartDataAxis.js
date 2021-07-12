const DOMutil = require('../../../DOMutil');
const util = require('../../../util');
const DataAxis = require('../DataAxis');
const DataScale = require('../DataScale');
const DrawLabels = require('./DrawLabels');
const DrawLines = require('./DrawLines');
const DrawBackground = require('./DrawBackground');

class TimelineChartDataAxis extends DataAxis {
  constructor(body, options, svg, linegraphOptions) {
    super(body, options, svg, linegraphOptions);
    const dataRegionTimeline = document.querySelector('.data-region.data-container-with-timeline');

    this.defaultOptions = {
      orientation: 'left',  // supported: 'left', 'right'
      showMinorLabels: true,
      showMinorLines: true,
      showMajorLabels: true,
      icons: false,
      majorLinesOffset: 7,
      minorLinesOffset: 4,
      labelOffsetX: 10,
      labelOffsetY: 2,
      iconWidth: 20,
      width: (dataRegionTimeline) ? parseInt(dataRegionTimeline.offsetWidth / 26) + 'px' : '0px',
      visible: true,
      alignZeros: true,
      data: undefined,
      left:{
        range: {min:undefined,max:undefined},
        format: function (value) {return ''+parseFloat(value.toPrecision(3));},
        title: {text:undefined,style:undefined}
      },
      right:{
        range: {min:undefined,max:undefined},
        format: function (value) {return ''+parseFloat(value.toPrecision(3));},
        title: {text:undefined,style:undefined}
      }
    };

    this.DOMelements.backgrounds = {};

    this.dataAxisClassName = 'vis-data-axis vis-timeline-chart-data-axis';
    this.drawLabels = new DrawLabels(this._redrawLabel.bind(this), this.props, this.options);
    this.drawLines = new DrawLines(this._redrawLine.bind(this), this.props);
    this.drawBackground = new DrawBackground(this.props, this.dom, this.DOMelements);
  }

  setOptions(options) {
    if (options) {
      let redraw = false;
      if (this.options.orientation !== options.orientation && options.orientation !== undefined) {
        redraw = true;
      }
      const fields = [
        'chart',
        'orientation',
        'showMinorLabels',
        'showMinorLines',
        'showMajorLabels',
        'linesOffsetY',
        'linesOffsetX',
        'extraLineWidth',
        'majorLinesOffset',
        'minorLinesOffset',
        'labelOffsetX',
        'labelOffsetY',
        'width',
        'visible',
        'data',
        'left',
        'right',
        'fontSize',
      ];
      util.selectiveDeepExtend(fields, this.options, options);

      this.minWidth = Number(('' + this.options.width).replace("px",""));
      if (redraw === true && this.dom.frame) {
        this.hide();
        this.show();
      }
    }
  };

  _redrawLabels() {
    let resized = false;
    this.maxLabelSize = 0;

    const orientation = this.options['orientation'];
    DOMutil.prepareElements(this.DOMelements.lines);
    DOMutil.prepareElements(this.DOMelements.labels);
    DOMutil.prepareElements(this.DOMelements.backgrounds);

    const customRange = this.options[orientation].range !== undefined ? this.options[orientation].range : {};

    //Override range with manual options:
    let autoScaleEnd = true;
    if (customRange.max !== undefined && !Number.isNaN(customRange.max)){
      this.range.end = customRange.max;
      autoScaleEnd = false;
    }
    let autoScaleStart = true;
    if (customRange.min !== undefined && !Number.isNaN(customRange.min)){
      this.range.start = customRange.min;
      autoScaleStart = false;
    }

    this.scale = new DataScale(
      this.range.start,
      this.range.end,
      autoScaleStart,
      autoScaleEnd,
      this.dom.frame.offsetHeight,
      this.props.majorCharHeight,
      this.options.alignZeros,
      this.options[orientation].format
    );

    if (this.master === false && this.masterAxis !== undefined){
      this.scale.followScale(this.masterAxis.scale);
    }

    let offsetY = 1;
    let y = offsetY;
    let summaryGroupBackGround = false;
    for (let keyBg in this.groups) {
      const group = this.groups[keyBg];
      if ((group.summary && !summaryGroupBackGround) || !group.summary) {
        const previousY = y;
        y += group.group.rowHeightId[`tl-groups_${group.id}`];

        this.drawBackground.renderBackground(previousY - offsetY, y - previousY, group.group.value);
        summaryGroupBackGround = true;
      }
    }

    y = offsetY;
    let summaryLine = false;
    for (let key in this.groups) {
      const group = this.groups[key];
      if (group.summary && !summaryLine || !group.summary) {
        const previousY = y;
        const rowHeight = group.group.rowHeightId[`tl-groups_${group.id}`];
        y += rowHeight;

        this.drawLabels.renderLabel(this.height, orientation, group, previousY);
        this.drawLines.renderLine(y, group, previousY, this.height);
        summaryLine = true;
      }
    }

    resized = this.verifyResize(orientation);

    return resized;
  }

  /**
  * Create a label for the axis at position x
  * @override Removed offset in left pixels
  * @private
  * @param y
  * @param text
  * @param orientation
  * @param className
  * @param characterHeight
  */
  _redrawLabel(y, text, orientation, className, characterHeight) {
    // reuse redundant label
    const label = DOMutil.getDOMElement('div', this.DOMelements.labels, this.dom.frame); //this.dom.redundant.labels.shift();
    label.className = className;
    label.innerHTML = text;
    if (orientation === 'left') {
      label.style.textAlign = "right";
    }
    else {
      label.style.textAlign = "left";
    }

    label.style.top = y - 0.5 * characterHeight + this.options.labelOffsetY + 'px';

    text += '';

    const largestWidth = Math.max(this.props.majorCharWidth, this.props.minorCharWidth);
    if (this.maxLabelSize < text.length * largestWidth) {
      this.maxLabelSize = text.length * largestWidth;
    }
  }

  convertValue(y, range, baseY) {
    const factor = range.max - range.min;
    let yToPercent = (y - range.min) * 100 / factor;
    yToPercent = Number.isNaN(yToPercent) ? 0 : yToPercent;
    return (baseY * yToPercent / 100);
  }
}

module.exports = TimelineChartDataAxis;