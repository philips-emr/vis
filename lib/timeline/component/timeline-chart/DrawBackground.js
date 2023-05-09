var DOMutil = require('../../../DOMutil');
import fastdom from "fastdom";

class DrawBackground {
  constructor(props, dom, DOMelements) {
    this.props = props;
    this.dom = dom;
    this.DOMelements = DOMelements;
  }

  renderBackground(y, height, groupId) {
    this._drawBackgroundDiv(y + this.props.majorLineHeight, this.props.majorLineWidth + this.props.width, height, groupId);
  }

  _drawBackgroundDiv(y, width, height, groupId) {
    const _this = this;
    fastdom.mutate(function () {
      const background = DOMutil.getDOMElement('div', _this.DOMelements.backgrounds, _this.dom.lineContainer);
      background.className = `vis-timeline-chart-background tl-group__${groupId}`;
      background.setAttribute('row-id', groupId);

      background.style.setProperty('width', `${width}px`);
      background.style.setProperty('height', `${height}px`);
      background.style.setProperty('top', `${y}px`);
    });
  }
}

module.exports = DrawBackground;