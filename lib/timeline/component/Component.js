/**
 * Prototype for visual components
 * @param {{dom: Object, domProps: Object, emitter: Emitter, range: Range}} [body]
 * @param {Object} [options]
 */
function Component (body, options) {
  this.options = null;
  this.props = null;
}

/**
 * Set options for the component. The new options will be merged into the
 * current options.
 * @param {Object} options
 */
Component.prototype.setOptions = function(options) {
  if (options) {
    util.extend(this.options, options);
  }
};

/**
 * Repaint the component
 * @return {boolean} Returns true if the component is resized
 */
Component.prototype.redraw = function() {
  // should be implemented by the component
  return false;
};

/**
 * Destroy the component. Cleanup DOM and event listeners
 */
Component.prototype.destroy = function() {
  // should be implemented by the component
};

/**
 * Test whether the component is resized since the last time _isResized() was
 * called.
 * @return {Boolean} Returns true if the component is resized
 * @protected
 */
Component.prototype._isResized = function() {
  const props = this.props;
  const propsWidth = props.width;
  const propsHeight = props.height;
  var resized = (props._previousWidth !== propsWidth ||
      props._previousHeight !== propsHeight);

  props._previousWidth = propsWidth;
  props._previousHeight = propsHeight;

  return resized;
};

module.exports = Component;
