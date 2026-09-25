"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraggableGrid = void 0;
var React = require("react");
var react_1 = require("react");
var react_native_1 = require("react-native");
var block_1 = require("./block");
var utils_1 = require("./utils");
var activeBlockOffset = { x: 0, y: 0 };
exports.DraggableGrid = function (props) {
    var blockPositions = react_1.useState([])[0];
    var orderMap = react_1.useState({})[0];
    var itemMap = react_1.useState({})[0];
    var items = react_1.useState([])[0];
    var _a = react_1.useState(0), blockHeight = _a[0], setBlockHeight = _a[1];
    var _b = react_1.useState(0), blockWidth = _b[0], setBlockWidth = _b[1];
    var gridHeight = react_1.useState(new react_native_1.Animated.Value(0))[0];
    var _c = react_1.useState(false), hadInitBlockSize = _c[0], setHadInitBlockSize = _c[1];
    var dragStartAnimatedValue = react_1.useState(new react_native_1.Animated.Value(1))[0];
    var _d = react_1.useState({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    }), gridLayout = _d[0], setGridLayout = _d[1];
    var _e = react_1.useState(), activeItemIndex = _e[0], setActiveItemIndex = _e[1];
    var isDraggingRef = react_1.useRef(false);
    // Always dispatches the latest props, since Block's memo comparator ignores handler-prop changes
    // and keeps whatever bound closure it received on its last actual render.
    var onDragItemActiveRef = react_1.useRef(props.onDragItemActive);
    onDragItemActiveRef.current = props.onDragItemActive;
    var onItemPressRef = react_1.useRef(props.onItemPress);
    onItemPressRef.current = props.onItemPress;
    var onDragStartRef = react_1.useRef(props.onDragStart);
    onDragStartRef.current = props.onDragStart;
    var onDraggingRef = react_1.useRef(props.onDragging);
    onDraggingRef.current = props.onDragging;
    var onResetSortRef = react_1.useRef(props.onResetSort);
    onResetSortRef.current = props.onResetSort;
    var onDragReleaseRef = react_1.useRef(props.onDragRelease);
    onDragReleaseRef.current = props.onDragRelease;
    var moveThrottleFrameRef = react_1.useRef(0);
    var pendingDragPositionRef = react_1.useRef(null);
    var assessGridSize = function (event) {
        var newBlockWidth = event.nativeEvent.layout.width / props.numColumns;
        var newBlockHeight = props.itemHeight || newBlockWidth;
        if (!hadInitBlockSize) {
            setBlockWidth(newBlockWidth);
            setBlockHeight(newBlockHeight);
            setGridLayout(event.nativeEvent.layout);
            setHadInitBlockSize(true);
        }
        else if (activeItemIndex === undefined &&
            (newBlockWidth !== blockWidth || newBlockHeight !== blockHeight)) {
            setBlockWidth(newBlockWidth);
            setBlockHeight(newBlockHeight);
            setGridLayout(event.nativeEvent.layout);
        }
    };
    var _f = react_1.useState(false), panResponderCapture = _f[0], setPanResponderCapture = _f[1];
    var panResponder = react_native_1.PanResponder.create({
        onStartShouldSetPanResponder: function () { return true; },
        onStartShouldSetPanResponderCapture: function () { return false; },
        onMoveShouldSetPanResponder: function () { return panResponderCapture; },
        onMoveShouldSetPanResponderCapture: function () { return panResponderCapture; },
        onShouldBlockNativeResponder: function () { return false; },
        onPanResponderTerminationRequest: function () { return false; },
        onPanResponderGrant: onStartDrag,
        onPanResponderMove: onHandMove,
        onPanResponderRelease: onHandRelease,
        onPanResponderTerminate: onHandRelease,
    });
    function initBlockPositions() {
        items.forEach(function (_, index) {
            var columnOnRow = index % props.numColumns;
            var y = blockHeight * Math.floor(index / props.numColumns);
            var x = columnOnRow * blockWidth;
            blockPositions[index] = { x: x, y: y };
        });
    }
    function getBlockPositionByOrder(order) {
        if (blockPositions[order]) {
            return blockPositions[order];
        }
        var columnOnRow = order % props.numColumns;
        var y = blockHeight * Math.floor(order / props.numColumns);
        var x = columnOnRow * blockWidth;
        return {
            x: x,
            y: y,
        };
    }
    function resetGridHeight() {
        var rowCount = Math.ceil(props.data.length / props.numColumns);
        gridHeight.setValue(rowCount * blockHeight);
    }
    // Bound handlers are keyed by the stable item key, not by index, so reordering/removing
    // items can't leave a Block invoking a handler for the wrong (or a stale) slot.
    // Uses ref to guarantee invocation of the latest onItemPress prop even if Block memoization
    // retained a previous closure.
    function onBlockPress(key) {
        var itemIndex = utils_1.findIndex(items, function (item) { return item.key === key; });
        if (itemIndex === -1)
            return;
        onItemPressRef.current && onItemPressRef.current(items[itemIndex].itemData);
    }
    var onLongPressBlock = react_1.useCallback(function (key) {
        var itemIndex = utils_1.findIndex(items, function (item) { return item.key === key; });
        if (itemIndex === -1)
            return;
        setActiveBlock(itemIndex, items[itemIndex].itemData);
    }, []);
    function onStartDrag(_, gestureState) {
        var activeItem = getActiveItem();
        if (!activeItem)
            return false;
        isDraggingRef.current = true;
        onDragStartRef.current && onDragStartRef.current(activeItem.itemData);
        var x0 = gestureState.x0, y0 = gestureState.y0, moveX = gestureState.moveX, moveY = gestureState.moveY;
        var activeOrigin = blockPositions[orderMap[activeItem.key].order];
        var x = activeOrigin.x + (react_native_1.I18nManager.isRTL ? x0 : -x0);
        var y = activeOrigin.y - y0;
        activeItem.currentPosition.setOffset({
            x: x,
            y: y,
        });
        activeBlockOffset = {
            x: x,
            y: y,
        };
        activeItem.currentPosition.setValue({
            x: react_native_1.I18nManager.isRTL ? -moveX : moveX,
            y: moveY,
        });
        return true;
    }
    function resortFromPosition(activeItem, dragPosition, dragPositionToActivePositionDistance) {
        var closetItemIndex = activeItemIndex;
        var closetDistance = dragPositionToActivePositionDistance;
        items.forEach(function (item, index) {
            if (item.itemData.disabledReSorted)
                return;
            if (index != activeItemIndex) {
                var dragPositionToItemPositionDistance = getDistance(dragPosition, blockPositions[orderMap[item.key].order]);
                if (dragPositionToItemPositionDistance < closetDistance &&
                    dragPositionToItemPositionDistance < blockWidth) {
                    closetItemIndex = index;
                    closetDistance = dragPositionToItemPositionDistance;
                }
            }
        });
        if (activeItemIndex != closetItemIndex) {
            var closetOrder = orderMap[items[closetItemIndex].key].order;
            resetBlockPositionByOrder(orderMap[activeItem.key].order, closetOrder);
            orderMap[activeItem.key].order = closetOrder;
            onResetSortRef.current && onResetSortRef.current(getSortData());
        }
    }
    function onHandMove(_, gestureState) {
        var activeItem = getActiveItem();
        if (!activeItem)
            return false;
        var moveXOriginal = gestureState.moveX, moveY = gestureState.moveY;
        var moveX = react_native_1.I18nManager.isRTL ? -moveXOriginal : moveXOriginal;
        onDraggingRef.current && onDraggingRef.current(gestureState);
        var xChokeAmount = Math.max(0, activeBlockOffset.x + moveX - (gridLayout.width - blockWidth));
        var xMinChokeAmount = Math.min(0, activeBlockOffset.x + moveX);
        var dragPosition = {
            x: moveX - xChokeAmount - xMinChokeAmount,
            y: moveY,
        };
        var originPosition = blockPositions[orderMap[activeItem.key].order];
        var dragPositionToActivePositionDistance = getDistance(dragPosition, originPosition);
        activeItem.currentPosition.setValue(dragPosition);
        pendingDragPositionRef.current = dragPosition;
        // Throttle expensive resorting/animation work to every other frame
        moveThrottleFrameRef.current = (moveThrottleFrameRef.current + 1) % 2;
        if (moveThrottleFrameRef.current !== 0)
            return;
        resortFromPosition(activeItem, dragPosition, dragPositionToActivePositionDistance);
        pendingDragPositionRef.current = null;
        return true;
    }
    function onHandRelease() {
        var activeItem = getActiveItem();
        if (!activeItem)
            return false;
        // A throttled-out move may not have been resorted yet; apply it so the released
        // order always reflects the final visual position.
        if (pendingDragPositionRef.current) {
            var originPosition = blockPositions[orderMap[activeItem.key].order];
            var distance = getDistance(pendingDragPositionRef.current, originPosition);
            resortFromPosition(activeItem, pendingDragPositionRef.current, distance);
            pendingDragPositionRef.current = null;
        }
        isDraggingRef.current = false;
        moveThrottleFrameRef.current = 0;
        onDragReleaseRef.current && onDragReleaseRef.current(getSortData());
        setPanResponderCapture(false);
        activeItem.currentPosition.flattenOffset();
        moveBlockToBlockOrderPosition(activeItem.key);
        setActiveItemIndex(undefined);
        return true;
    }
    function onBlockPressOut(key) {
        var itemIndex = utils_1.findIndex(items, function (item) { return item.key === key; });
        if (itemIndex !== -1 && activeItemIndex === itemIndex && !isDraggingRef.current) {
            onHandRelease();
        }
    }
    function resetBlockPositionByOrder(activeItemOrder, insertedPositionOrder) {
        var disabledReSortedItemCount = 0;
        if (activeItemOrder > insertedPositionOrder) {
            for (var i = activeItemOrder - 1; i >= insertedPositionOrder; i--) {
                var key = getKeyByOrder(i);
                var item = itemMap[key];
                if (item && item.disabledReSorted) {
                    disabledReSortedItemCount++;
                }
                else {
                    orderMap[key].order += disabledReSortedItemCount + 1;
                    disabledReSortedItemCount = 0;
                    moveBlockToBlockOrderPosition(key);
                }
            }
        }
        else {
            for (var i = activeItemOrder + 1; i <= insertedPositionOrder; i++) {
                var key = getKeyByOrder(i);
                var item = itemMap[key];
                if (item && item.disabledReSorted) {
                    disabledReSortedItemCount++;
                }
                else {
                    orderMap[key].order -= disabledReSortedItemCount + 1;
                    disabledReSortedItemCount = 0;
                    moveBlockToBlockOrderPosition(key);
                }
            }
        }
    }
    function moveBlockToBlockOrderPosition(itemKey) {
        var itemIndex = utils_1.findIndex(items, function (item) { return "" + item.key === "" + itemKey; });
        items[itemIndex].currentPosition.flattenOffset();
        react_native_1.Animated.timing(items[itemIndex].currentPosition, {
            toValue: blockPositions[orderMap[itemKey].order],
            duration: 200,
            useNativeDriver: false,
        }).start();
    }
    function getKeyByOrder(order) {
        return utils_1.findKey(orderMap, function (item) { return item.order === order; });
    }
    function getSortData() {
        var sortData = [];
        items.forEach(function (item) {
            sortData[orderMap[item.key].order] = item.itemData;
        });
        return sortData;
    }
    function getDistance(startOffset, endOffset) {
        var xDistance = startOffset.x + activeBlockOffset.x - endOffset.x;
        var yDistance = startOffset.y + activeBlockOffset.y - endOffset.y;
        return Math.sqrt(Math.pow(xDistance, 2) + Math.pow(yDistance, 2));
    }
    function setActiveBlock(itemIndex, item) {
        if (item.disabledDrag)
            return;
        onDragItemActiveRef.current && onDragItemActiveRef.current(item);
        setPanResponderCapture(true);
        setActiveItemIndex(itemIndex);
    }
    function startDragStartAnimation() {
        if (!props.dragStartAnimation) {
            dragStartAnimatedValue.setValue(1);
            react_native_1.Animated.timing(dragStartAnimatedValue, {
                toValue: 1.1,
                duration: 100,
                useNativeDriver: false,
            }).start();
        }
    }
    function getBlockStyle(itemIndex) {
        return [
            {
                justifyContent: 'center',
                alignItems: 'center',
            },
            hadInitBlockSize && {
                width: blockWidth,
                height: blockHeight,
                position: 'absolute',
                top: items[itemIndex].currentPosition.getLayout().top,
                left: react_native_1.I18nManager.isRTL && react_native_1.Platform.OS === 'web' ? undefined : items[itemIndex].currentPosition.getLayout().left,
                right: react_native_1.I18nManager.isRTL && react_native_1.Platform.OS === 'web' ? items[itemIndex].currentPosition.getLayout().left : undefined,
            },
        ];
    }
    function getDragStartAnimation(itemIndex) {
        if (activeItemIndex != itemIndex) {
            return;
        }
        var dragStartAnimation = props.dragStartAnimation || getDefaultDragStartAnimation();
        return __assign({ zIndex: 3 }, dragStartAnimation);
    }
    function getActiveItem() {
        if (activeItemIndex === undefined)
            return false;
        return items[activeItemIndex];
    }
    function getDefaultDragStartAnimation() {
        return {
            transform: [
                {
                    scale: dragStartAnimatedValue,
                },
            ],
            shadowColor: '#000000',
            shadowOpacity: 0.2,
            shadowRadius: 6,
            shadowOffset: {
                width: 1,
                height: 1,
            },
        };
    }
    function addItem(item, index) {
        blockPositions.push(getBlockPositionByOrder(items.length));
        orderMap[item.key] = {
            order: index,
        };
        itemMap[item.key] = item;
        items.push({
            key: item.key,
            itemData: item,
            currentPosition: new react_native_1.Animated.ValueXY(getBlockPositionByOrder(index)),
        });
    }
    function removeItem(item) {
        var itemIndex = utils_1.findIndex(items, function (curItem) { return curItem.key === item.key; });
        items.splice(itemIndex, 1);
        blockPositions.pop();
        delete orderMap[item.key];
    }
    function diffData() {
        props.data.forEach(function (item, index) {
            if (orderMap[item.key]) {
                if (orderMap[item.key].order != index) {
                    orderMap[item.key].order = index;
                    moveBlockToBlockOrderPosition(item.key);
                }
                var currentItem = items.find(function (i) { return i.key === item.key; });
                if (currentItem) {
                    currentItem.itemData = item;
                }
                itemMap[item.key] = item;
            }
            else {
                addItem(item, index);
            }
        });
        var deleteItems = utils_1.differenceBy(items, props.data, 'key');
        deleteItems.forEach(function (item) {
            removeItem(item);
        });
    }
    react_1.useEffect(function () {
        startDragStartAnimation();
    }, [activeItemIndex]);
    react_1.useEffect(function () {
        if (!hadInitBlockSize || activeItemIndex !== undefined)
            return;
        var expectedBlockWidth = gridLayout.width / props.numColumns;
        var expectedBlockHeight = props.itemHeight || expectedBlockWidth;
        if (expectedBlockWidth !== blockWidth || expectedBlockHeight !== blockHeight) {
            setBlockWidth(expectedBlockWidth);
            setBlockHeight(expectedBlockHeight);
            setGridLayout(function (prev) { return (__assign({}, prev)); });
        }
    }, [props.itemHeight, props.numColumns, hadInitBlockSize, activeItemIndex, blockHeight, blockWidth, gridLayout.width]);
    react_1.useEffect(function () {
        if (hadInitBlockSize) {
            initBlockPositions();
            items.forEach(function (item) {
                item.currentPosition.setValue(blockPositions[orderMap[item.key].order]);
            });
        }
    }, [gridLayout, blockWidth, blockHeight, props.numColumns]);
    react_1.useEffect(function () {
        resetGridHeight();
    });
    if (hadInitBlockSize) {
        diffData();
    }
    var itemList = items.map(function (item, itemIndex) {
        return (<block_1.Block onPress={onBlockPress.bind(null, item.key)} onLongPress={onLongPressBlock.bind(null, item.key)} onPressOut={onBlockPressOut.bind(null, item.key)} panHandlers={panResponder.panHandlers} style={getBlockStyle(itemIndex)} dragStartAnimationStyle={getDragStartAnimation(itemIndex)} delayLongPress={props.delayLongPress || 300} key={item.key} item={item.itemData} order={orderMap[item.key].order} renderItem={props.renderItem}/>);
    });
    return (<react_native_1.Animated.View style={[
        styles.draggableGrid,
        props.style,
        {
            height: gridHeight,
        },
    ]} onLayout={assessGridSize}>
      {hadInitBlockSize && itemList}
    </react_native_1.Animated.View>);
};
var styles = react_native_1.StyleSheet.create({
    draggableGrid: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
});
//# sourceMappingURL=draggable-grid.js.map