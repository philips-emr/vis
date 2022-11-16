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
    const { maxValue, minValue, avgValue } = this._getGroupScaleValues(group, true);
    if ((!group.itemsData || group.itemsData.length === 0) && (!maxValue || !minValue)) {
      return; // exit
    }

    if (group.summary && group.group && group.group.intervalScale) {
      this._renderLabelWithScale({ lineHeight, orientation, labelClass, group, maxValue, minValue, avgValue });
      return; // exit
    }

    const { topLabelY, middleLabelY, bottomLabelY } = this._getSupportLabels(lineHeight, previousY);

    this._redrawLabel(lineHeight - topLabelY, maxValue, orientation, labelClass, this.props.minorCharHeight);
    this._redrawLabel(lineHeight - middleLabelY, avgValue, orientation, labelClass, this.props.minorCharHeight);
    this._redrawLabel(lineHeight - bottomLabelY, minValue, orientation, labelClass, this.props.minorCharHeight);
  }

  _renderLineLabel(lineHeight, previousY, orientation, labelClass, group) {
    const { maxValue, minValue, avgValue, referenceLine } = this._getGroupScaleValues(group);
    let values = group.itemsData.map(item => item.y);
    if (values.length === 0 && (!maxValue || !minValue)) {
      return; // exit
    }

    if (group.group.axisCustomLabel) {
      this._renderCustomLabel({ lineHeight, orientation, labelClass, group });
      return; // exit
    }

    if (group.summary && group.group && group.group.intervalScale) {
      this._renderLabelWithScale({ lineHeight, orientation, labelClass, group, maxValue, minValue, avgValue, referenceLine });
      return; // exit
    }

    const { topLabelY, middleLabelY, bottomLabelY } = this._getSupportLabels(lineHeight, previousY, this.options.fontSize);

    if (maxValue === minValue || avgValue) {
      const label = _.isNumber(avgValue) || _.isString(avgValue) && !_.isEmpty(avgValue) ? avgValue : maxValue;
      this._redrawLabel(lineHeight - middleLabelY, label, orientation, labelClass, this.props.minorCharHeight);
    } else {
      this._redrawLabel(lineHeight - topLabelY, maxValue, orientation, labelClass, this.props.minorCharHeight);
      this._redrawLabel(lineHeight - bottomLabelY, minValue, orientation, labelClass, this.props.minorCharHeight);
    }
  }

  _getSupportLabels(y, previousY) {
    const size = y - previousY;

    return {
      topLabelY: size,
      middleLabelY: size / 2 + this.props.minorCharHeight / 2,
      bottomLabelY: this.props.minorCharHeight
    };
  }

  _renderLabelWithScale({ lineHeight, orientation, labelClass, group, maxValue, minValue, avgValue, referenceLine }) {
    const internHeight = lineHeight - this.props.minorCharHeight * 2;
    const offset = 0;
    const amountLabelsToFit = Math.floor(internHeight / this.props.minorCharHeight);
    let intervalScale = group.group.intervalScale;
    let amountLabels =  Math.floor((maxValue - minValue) / intervalScale) - 1; // Remove one that is max label
    let position = lineHeight - this.props.minorCharHeight;
    let label = minValue;

    // Divides the number of labels to fit the available height
    while (amountLabels > amountLabelsToFit) {
      amountLabels = Math.floor((amountLabels - 1) / 2);
      intervalScale += intervalScale;
    }

    if (minValue !== undefined && maxValue !== undefined) {
      if (minValue !== maxValue) {
        this._redrawLabel(offset, maxValue, orientation, labelClass, this.props.minorCharHeight);
        this._redrawLabel(position, minValue, orientation, labelClass, this.props.minorCharHeight);
      } else if (referenceLine !== undefined) {
        const referenceLineY = lineHeight * 0.5;
        this._redrawLabel(referenceLineY, referenceLine || avgValue, orientation, labelClass, this.props.minorCharHeight);
      }
    }

    if (amountLabels && amountLabelsToFit > 0) {
      const scaleDistance = Math.abs(maxValue - minValue);
      const intervalHeight = intervalScale / scaleDistance * (internHeight - amountLabels * this.props.minorCharHeight);

      for (let i = 0; i < amountLabels && amountLabelsToFit > 0; i++) {
        label = label + intervalScale;
        position = position - intervalHeight - this.props.minorCharHeight;

        this._redrawLabel(position, label, orientation, labelClass, this.props.minorCharHeight);
      }
    }
  }

  _getGroupScaleValues(group, avgLabel = false) {
    let maxValue, minValue;

    if (group.itemsData && group.itemsData.length > 0) {
      if (avgLabel) {
        maxValue = Math.max.apply(Math, group.itemsData.map(item => item.referenceLine ? item.y : item.maxValue));
        minValue = Math.min.apply(Math, group.itemsData.map(item => item.referenceLine ? item.y : item.minValue));
      } else {
        let itemsData = group.itemsData.map(item => item.y);
        maxValue = Math.max(...itemsData);
        minValue = Math.min(...itemsData);
      }
    }

    if (group && group.group) {
      if (Number.isInteger(group.group.maxValue)) {
        maxValue = group.group.maxValue;
      }
      if (Number.isInteger(group.group.minValue)) {
        minValue = group.group.minValue;
      }
    }

    const groupAvgValue = group.itemsData[0] && group.itemsData[0].avgValue;
    const avgValue = _.isNumber(groupAvgValue) || _.isString(groupAvgValue) ? groupAvgValue : '';

    const referenceLine = group.itemsData.map(item => item.referenceLine && item.y)[0];

    return {
      maxValue,
      minValue,
      avgValue,
      referenceLine,
    };
  }

  /**
   * Redraw axisCustomLabel list
   * @param lineHeight
   * @param orientation
   * @param labelClass
   * @param group
   * @private
   */
  _renderCustomLabel({ lineHeight, orientation, labelClass, group }) {
    const amountLabels = group.group.axisCustomLabel.length;
    const intervalHeight = Math.floor(lineHeight / amountLabels);
    let position = lineHeight - this.props.minorCharHeight;
    group.group.axisCustomLabel.slice().reverse().forEach(axisCustomLabel => {
      const customLabel = axisCustomLabel.alternativeLabel ? axisCustomLabel.alternativeLabel : axisCustomLabel.y;
      this._redrawLabel(position, customLabel, orientation, labelClass, this.props.minorCharHeight);
      position = position - intervalHeight;
    })
  }
}

module.exports = DrawLabels;
