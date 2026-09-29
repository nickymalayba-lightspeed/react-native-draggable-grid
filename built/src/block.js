"use strict";
/** @format */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Block = void 0;
var React = require("react");
var react_native_1 = require("react-native");
var Block = function (_a) {
    var style = _a.style, dragStartAnimationStyle = _a.dragStartAnimationStyle, onPress = _a.onPress, onLongPress = _a.onLongPress, onPressOut = _a.onPressOut, children = _a.children, panHandlers = _a.panHandlers, delayLongPress = _a.delayLongPress, item = _a.item, order = _a.order, renderItem = _a.renderItem;
    return (<react_native_1.Animated.View style={[styles.blockContainer, style, dragStartAnimationStyle]} {...panHandlers}>
      <react_native_1.Animated.View>
        <react_native_1.TouchableWithoutFeedback delayLongPress={delayLongPress} onPress={onPress} onLongPress={onLongPress} onPressOut={onPressOut}>
          {renderItem && item !== undefined && order !== undefined
        ? renderItem(item, order)
        : children}
        </react_native_1.TouchableWithoutFeedback>
      </react_native_1.Animated.View>
    </react_native_1.Animated.View>);
};
// Memoized so non-dragged blocks do not re-render while another item is dragged.
// The style prop contains Animated.Value references that drive layout on the native
// thread without React re-renders, so we only compare props that affect the React tree.
var MemoizedBlock = React.memo(Block, function (prev, next) {
    if (prev.dragStartAnimationStyle !== next.dragStartAnimationStyle)
        return false;
    if (prev.delayLongPress !== next.delayLongPress)
        return false;
    if (prev.item !== next.item)
        return false;
    if (prev.order !== next.order)
        return false;
    if (prev.renderItem !== next.renderItem)
        return false;
    if (!prev.renderItem && !next.renderItem && prev.children !== next.children)
        return false;
    // style/onPress/onLongPress/onPressOut/panHandlers may be new references each parent render
    // but rely on mutable refs/Animated values; skipping them prevents drag cascades.
    return true;
});
exports.Block = MemoizedBlock;
MemoizedBlock.displayName = 'Block';
var styles = react_native_1.StyleSheet.create({
    blockContainer: {
        alignItems: 'center',
    },
});
//# sourceMappingURL=block.js.map