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

export const BOLUS = Object.freeze({
  radius: 3,
  stroke: '#212121',
  strokeWidth: 1.5,
  fill: '#ffffff',
  className: 'bolus'
});

export const INFUSION_RATE = Object.freeze({
  className: 'infusionrate'
});

export const PARTOGRAM_HEAD_POSITION_DEGREE = Object.freeze({
  'OP': 0,
  'OEA': 45,
  'OET': 90,
  'OEP': 135,
  'ODP': 225,
  'ODT': 270,
  'ODA': 315,
  'OS': 180,
  'IND': 0
});
