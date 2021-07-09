export const TIMELINE_CHART_PADDINGS = Object.freeze({
  top: 0.15,
  bottom: 0.15,
  calculatePadding: function (baseHeight) {
    return {
      top: baseHeight * this.top,
      bottom: baseHeight * this.bottom,
    };
  },
  calculateAvailableHeight: function (baseHeight) {
    return baseHeight * (1 - this.top - this.bottom);
  }
});

export const CROSS = Object.freeze({
  size: 6,
  margin: 1,
});

export const ARROW = Object.freeze({
  padding: {
    right: 1,
    left: 1,
  },
  calculateSize: function (baseSize) {
    const width = baseSize + this.padding.left + this.padding.right;

    return {
      width,
      height: width / 2,
    };
  }
});
