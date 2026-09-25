"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock('react-native', function () {
    var panResponderConfigs = [];
    var AnimatedValue = /** @class */ (function () {
        function AnimatedValue(value) {
            this._value = value;
        }
        AnimatedValue.prototype.setValue = function (value) {
            this._value = value;
        };
        return AnimatedValue;
    }());
    var AnimatedValueXY = /** @class */ (function () {
        function AnimatedValueXY(initial) {
            if (initial === void 0) { initial = { x: 0, y: 0 }; }
            this.x = new AnimatedValue(initial.x);
            this.y = new AnimatedValue(initial.y);
            this.offset = { x: 0, y: 0 };
        }
        AnimatedValueXY.prototype.setValue = function (value) {
            this.x.setValue(value.x);
            this.y.setValue(value.y);
        };
        AnimatedValueXY.prototype.setOffset = function (offset) {
            this.offset = offset;
        };
        AnimatedValueXY.prototype.flattenOffset = function () {
            this.x.setValue(this.x._value + this.offset.x);
            this.y.setValue(this.y._value + this.offset.y);
            this.offset = { x: 0, y: 0 };
        };
        AnimatedValueXY.prototype.getLayout = function () {
            return { left: this.x, top: this.y };
        };
        return AnimatedValueXY;
    }());
    return {
        // Bypasses PanResponder's real touch-history/native responder plumbing so tests
        // can invoke the grant/move/release handlers directly with fabricated gestureStates.
        PanResponder: {
            create: function (config) {
                panResponderConfigs.push(config);
                return { panHandlers: {} };
            },
        },
        Animated: {
            View: 'AnimatedView',
            Value: AnimatedValue,
            ValueXY: AnimatedValueXY,
            timing: function (value, config) { return ({
                start: function (cb) {
                    value.setValue(config.toValue);
                    cb && cb({ finished: true });
                },
            }); },
        },
        StyleSheet: {
            create: function (styles) { return styles; },
        },
        Platform: { OS: 'ios' },
        I18nManager: { isRTL: false },
        TouchableWithoutFeedback: 'TouchableWithoutFeedback',
        __panResponderConfigs: panResponderConfigs,
    };
});
var React = require("react");
var TestRenderer = require("react-test-renderer");
var ReactNative = require("react-native");
var draggable_grid_1 = require("../src/draggable-grid");
var block_1 = require("../src/block");
function getPanResponderConfigs() {
    return ReactNative.__panResponderConfigs;
}
function latestPanResponderConfig() {
    var configs = getPanResponderConfigs();
    return configs[configs.length - 1];
}
function renderItem(item) {
    var _a;
    return <>{(_a = item.label) !== null && _a !== void 0 ? _a : item.key}</>;
}
function renderGrid(props) {
    var renderer;
    TestRenderer.act(function () {
        renderer = TestRenderer.create(<draggable_grid_1.DraggableGrid numColumns={3} renderItem={renderItem} {...props}/>);
    });
    return renderer;
}
// The grid only mounts Blocks after receiving a layout event, so tests must fire one
// to get a deterministic blockWidth/blockHeight (300 / 3 columns = 100 per block).
function fireLayout(renderer, widthOrLayout, height) {
    if (widthOrLayout === void 0) { widthOrLayout = 300; }
    if (height === void 0) { height = 300; }
    var layout = typeof widthOrLayout === 'object'
        ? { x: 0, y: 0, width: widthOrLayout.width, height: widthOrLayout.height }
        : { x: 0, y: 0, width: widthOrLayout, height: height };
    TestRenderer.act(function () {
        var gridView = renderer.root.findByType(ReactNative.Animated.View);
        gridView.props.onLayout({
            nativeEvent: { layout: layout },
        });
    });
}
function findBlockByKey(renderer, key) {
    return renderer.root.findAllByType(block_1.Block).find(function (block) { return block.props.item.key === key; });
}
var gestureState = function (overrides) {
    return overrides;
};
describe('DraggableGrid fork fixes (UPOS-8099)', function () {
    var items = [
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
        { key: 'c', label: 'C' },
    ];
    it('dispatches onItemPress with correct data after reorder and delete (fix #1)', function () {
        var onItemPress = jest.fn();
        var renderer = renderGrid({ data: items, onItemPress: onItemPress });
        fireLayout(renderer);
        // Hold onto handlers bound before the reorder/delete, mirroring a Block whose
        // memo comparator skipped a re-render and kept its old bound closures.
        var staleOnPressB = findBlockByKey(renderer, 'b').props.onPress;
        var staleOnPressC = findBlockByKey(renderer, 'c').props.onPress;
        TestRenderer.act(function () {
            renderer.update(<draggable_grid_1.DraggableGrid numColumns={3} renderItem={renderItem} onItemPress={onItemPress} data={[items[1], items[2], items[0]]}/>);
        });
        TestRenderer.act(function () {
            renderer.update(<draggable_grid_1.DraggableGrid numColumns={3} renderItem={renderItem} onItemPress={onItemPress} data={[items[1], items[2]]}/>);
        });
        staleOnPressB();
        expect(onItemPress).toHaveBeenLastCalledWith(items[1]);
        staleOnPressC();
        expect(onItemPress).toHaveBeenLastCalledWith(items[2]);
    });
    it('dispatches the latest onItemPress after the prop changes', function () {
        var onItemPress1 = jest.fn();
        var onItemPress2 = jest.fn();
        var renderer = renderGrid({ data: items, onItemPress: onItemPress1 });
        fireLayout(renderer);
        // Capture the onPress closure held by a memoized Block
        var staleOnPressA = findBlockByKey(renderer, 'a').props.onPress;
        TestRenderer.act(function () {
            renderer.update(<draggable_grid_1.DraggableGrid numColumns={3} renderItem={renderItem} onItemPress={onItemPress2} data={items}/>);
        });
        staleOnPressA();
        expect(onItemPress1).not.toHaveBeenCalled();
        expect(onItemPress2).toHaveBeenCalledWith(items[0]);
    });
    it('dispatches the latest onDragItemActive after the prop changes (fix #2)', function () {
        var onDragItemActive1 = jest.fn();
        var onDragItemActive2 = jest.fn();
        var renderer = renderGrid({ data: items, onDragItemActive: onDragItemActive1 });
        fireLayout(renderer);
        var onLongPress = findBlockByKey(renderer, 'a').props.onLongPress;
        TestRenderer.act(function () {
            renderer.update(<draggable_grid_1.DraggableGrid numColumns={3} renderItem={renderItem} onDragItemActive={onDragItemActive2} data={items}/>);
        });
        TestRenderer.act(function () {
            onLongPress();
        });
        expect(onDragItemActive2).toHaveBeenCalledWith(items[0]);
        expect(onDragItemActive1).not.toHaveBeenCalled();
    });
    it('does not starve the resort when onDragging triggers a mid-drag re-render (fix #3)', function () {
        var onResetSort = jest.fn();
        // A real consumer re-renders on every onDragging tick (e.g. showing live drag
        // feedback) without necessarily updating `data` from onResetSort in between.
        function Wrapper() {
            var _a = React.useState(0), setTick = _a[1];
            return (<draggable_grid_1.DraggableGrid numColumns={3} renderItem={renderItem} data={items} onDragging={function () { return setTick(function (t) { return t + 1; }); }} onResetSort={onResetSort}/>);
        }
        var renderer;
        TestRenderer.act(function () {
            renderer = TestRenderer.create(<Wrapper />);
        });
        fireLayout(renderer);
        TestRenderer.act(function () {
            findBlockByKey(renderer, 'a').props.onLongPress();
        });
        TestRenderer.act(function () {
            latestPanResponderConfig().onPanResponderGrant({}, gestureState({ x0: 0, y0: 0, moveX: 0, moveY: 0 }));
        });
        // Move #1 is throttled out (and triggers a re-render via onDragging). Move #2
        // should still perform the resort - without the fix the re-render resets the
        // throttle counter and the drag never reaches the "process" frame.
        TestRenderer.act(function () {
            latestPanResponderConfig().onPanResponderMove({}, gestureState({ moveX: 100, moveY: 0 }));
        });
        TestRenderer.act(function () {
            latestPanResponderConfig().onPanResponderMove({}, gestureState({ moveX: 100, moveY: 0 }));
        });
        expect(onResetSort).toHaveBeenCalledWith([items[1], items[0], items[2]]);
    });
    it('applies the final drag position even after a single throttled move (fix #4)', function () {
        var onDragRelease = jest.fn();
        var renderer = renderGrid({ data: items, onDragRelease: onDragRelease });
        fireLayout(renderer);
        TestRenderer.act(function () {
            findBlockByKey(renderer, 'a').props.onLongPress();
        });
        TestRenderer.act(function () {
            latestPanResponderConfig().onPanResponderGrant({}, gestureState({ x0: 0, y0: 0, moveX: 0, moveY: 0 }));
        });
        // A single move: gets throttled out and must not be discarded before release.
        TestRenderer.act(function () {
            latestPanResponderConfig().onPanResponderMove({}, gestureState({ moveX: 100, moveY: 0 }));
        });
        TestRenderer.act(function () {
            latestPanResponderConfig().onPanResponderRelease({}, gestureState({ moveX: 100, moveY: 0 }));
        });
        expect(onDragRelease).toHaveBeenCalledWith([items[1], items[0], items[2]]);
    });
    it('recalculates block sizes and repositions items when grid width changes (portrait / resize)', function () {
        var items = [{ key: '1' }, { key: '2' }, { key: '3' }];
        var renderer = renderGrid({ data: items, numColumns: 3 });
        // 1. Initial layout (landscape, width 600 -> blockWidth = 200)
        fireLayout(renderer, { width: 600, height: 400 });
        expect(findBlockByKey(renderer, '2').props.style[1].left._value).toBe(200);
        // 2. Resize event (portrait/multitask, width 300 -> blockWidth = 100)
        fireLayout(renderer, { width: 300, height: 600 });
        expect(findBlockByKey(renderer, '2').props.style[1].left._value).toBe(100);
    });
});
//# sourceMappingURL=draggable-grid.test.js.map