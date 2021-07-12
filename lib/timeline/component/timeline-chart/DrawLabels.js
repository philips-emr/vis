import { TIMELINE_CHART_PADDINGS as TimelineChartPaddings } from '../../../Constants';

class DrawLabels {
  constructor(redrawLabel, props, options) {
    this._redrawLabel = redrawLabel;
    this.props = props;
    this.options = options;
  }

  renderLabel(y, orientation, group, previousY) {
    let labelClass = 'vis-y-axis vis-timeline-chart-y-axis';

    switch(group.group.type) {
      case 'arrow-avg':
        this._renderArrowAvgLabel(y, previousY, orientation, labelClass, group);
        break;
      default:
        this._renderLineLabel(y, previousY, orientation, labelClass, group);
        break;
    }
  }

  _renderArrowAvgLabel(lineHeight, previousY, orientation, labelClass, group) {
    if (!group.itemsData || group.itemsData.length === 0) {
      return; // exit
    }
    const maxValue = Math.max.apply(Math, group.itemsData.map(item => item.referenceLine ? item.y : item.maxValue));
    const minValue = Math.min.apply(Math, group.itemsData.map(item => item.referenceLine ? item.y : item.minValue));

    if (group.summary && group.group && group.group.intervalScale) {
      this._renderLineLabelWithScale({ lineHeight, orientation, labelClass, group, maxValue, minValue });
      return; // exit
    }

    const avgValue = group.itemsData[0] && group.itemsData[0].avgValue ? group.itemsData[0].avgValue : undefined;

    const { topLabelY, middleLabelY, bottomLabelY } = this._getSupportLabels(lineHeight, previousY);

    this._redrawLabel(lineHeight - topLabelY, maxValue, orientation, labelClass, this.props.minorCharHeight);
    this._redrawLabel(lineHeight - middleLabelY, avgValue, orientation, labelClass, this.props.minorCharHeight);
    this._redrawLabel(lineHeight - bottomLabelY, minValue, orientation, labelClass, this.props.minorCharHeight);
  }

  _renderLineLabel(lineHeight, previousY, orientation, labelClass, group) {
    let values = group.itemsData.map(item => item.y);
    if (values.length === 0) {
      return; // exit
    }
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);

    if (group.summary && group.group && group.group.intervalScale) {
      this._renderLineLabelWithScale({ lineHeight, orientation, labelClass, group, maxValue, minValue });
      return; // exit
    }

    const avgValue = group.itemsData[0] && group.itemsData[0].avgValue ? group.itemsData[0].avgValue : undefined;
    const { topLabelY, middleLabelY, bottomLabelY } = this._getSupportLabels(lineHeight, previousY, this.options.fontSize);

    if (maxValue === minValue || avgValue) {
      const label = avgValue !== undefined ? avgValue : maxValue;
      this._redrawLabel(lineHeight - middleLabelY, label, orientation, labelClass, this.props.minorCharHeight);
    } else {
      this._redrawLabel(lineHeight - topLabelY, maxValue, orientation, labelClass, this.props.minorCharHeight);
      this._redrawLabel(lineHeight - bottomLabelY, minValue, orientation, labelClass, this.props.minorCharHeight);
    }
  }

  _getSupportLabels(y, previousY) {
    const size = y - previousY;
    const labelOffsetY = this.options.labelOffsetY * -1;
    const topLabelY = (size - (size * TimelineChartPaddings.top)) + labelOffsetY;
    const middleLabelY = (size * 50 / 100) + labelOffsetY;
    const bottomLabelY = (size * TimelineChartPaddings.bottom) + labelOffsetY;

    return {topLabelY, middleLabelY, bottomLabelY};
  }

  _renderLineLabelWithScale({ lineHeight, orientation, labelClass, group, maxValue, minValue }) {
    const labelHeight = 10;
    const internHeight = lineHeight - (labelHeight * 2);
    const offset = labelHeight / 2;
    const amountLabelsToFit = Math.floor(internHeight / labelHeight);
    let intervalScale = group.group.intervalScale;
    let amountLabels =  Math.floor((maxValue - minValue) / intervalScale) - 1; // Remove one that is max label
    let position = lineHeight - offset;
    let label = minValue;

    // Divides the number of labels to fit the available height
    while (amountLabels > amountLabelsToFit) {
      amountLabels = Math.floor((amountLabels - 1) / 2);
      intervalScale += intervalScale;
    }

    // Displays a max label aligned on the top
    this._redrawLabel(offset, maxValue, orientation, labelClass, this.props.minorCharHeight);

    // Displays a min label aligned in the footer
    this._redrawLabel(position, minValue, orientation, labelClass, this.props.minorCharHeight);

    // Calc internal height for number of occurrences
    const averageHeightAvailable = (internHeight - (amountLabels * labelHeight)) / (amountLabels + 1);

    for (let i = 0; i < amountLabels && amountLabelsToFit > 0; i++) {
      label += intervalScale;
      position -= averageHeightAvailable + labelHeight;
      this._redrawLabel(position, label, orientation, labelClass, this.props.minorCharHeight);
    }
  }
}

module.exports = DrawLabels;