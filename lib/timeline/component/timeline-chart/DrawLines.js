import { TIMELINE_CHART_PADDINGS as TimelineChartPaddings } from '../../../Constants';

class DrawLines {
  constructor(redrawLine, props) {
    this._redrawLine = redrawLine;
    this.props = props;
  }

  renderLine(y, group, previousY, heightSummary = 0) {
    let lineClass = 'vis-grid vis-horizontal vis-timeline-chart-horizontal-line';

    if (group.summary && heightSummary > 0) y = heightSummary;
    this._redrawLine(y, 'left', lineClass, this.props.width, this.props.majorLineWidth + this.props.width);
    
    switch(group.group.type) {
      case 'arrow-avg':
        this._renderArrowAvgLine(y, previousY, lineClass, group);
        break;
      default:
        this._renderDefaultLine(y, previousY, lineClass, group);
        break;
    }
  }

  _renderArrowAvgLine(y, previousY, lineClass, group) {
    if (group.itemsData && group.itemsData.length > 0) {
      const lineClassAvgType = 'vis-timeline-chart-guideline vis-timeline-chart-avg-type';
      const lineClassMaxValue = `${lineClass} ${lineClassAvgType} vis-timeline-chart-max-value`;
      const lineClassAverage = `${lineClass} ${lineClassAvgType} vis-timeline-chart-average`;
      const lineClassMinValue = `${lineClass} ${lineClassAvgType} vis-timeline-chart-min-value`;
      const { topLineY, middleLineY, bottomLineY } = this._getSupportLines(y, previousY);

      this._redrawLine(y - topLineY, 'left', lineClassMaxValue, 0, this.props.majorLineWidth);
      this._redrawLine(y - middleLineY, 'left', lineClassAverage, 0, this.props.majorLineWidth);
      this._redrawLine(y - bottomLineY, 'left', lineClassMinValue, 0, this.props.majorLineWidth);
    }
  }

  _renderDefaultLine(y, previousY, lineClass, group) {
    lineClass += ' vis-timeline-chart-guideline vis-timeline-chart-default-type';
    let values = group.itemsData.map(item => item.y);
    const avgValue = group.itemsData[0] && group.itemsData[0].avgValue ? group.itemsData[0].avgValue : undefined;

    if (values.length > 0) {
      const { topLineY, middleLineY, bottomLineY } = this._getSupportLines(y, previousY);
      const max = Math.max(...values);
      const min = Math.min(...values);

      if (max === min || avgValue) {
        this._redrawLine(y - middleLineY, 'left', lineClass, 0, this.props.majorLineWidth);
      } else {
        this._redrawLine(y - topLineY, 'left', lineClass, 0, this.props.majorLineWidth);
        this._redrawLine(y - bottomLineY, 'left', lineClass, 0, this.props.majorLineWidth);
      }
    }
  }

  _getSupportLines(y, previousY) {
    const size = y - previousY;
    
    const topLineY = (size - (size * TimelineChartPaddings.top));
    const middleLineY = (size * 50 / 100);
    const bottomLineY = (size * TimelineChartPaddings.bottom);

    return {topLineY, middleLineY, bottomLineY};
  }
}

module.exports = DrawLines;