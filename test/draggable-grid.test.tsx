jest.mock('react-native', () => {
  const panResponderConfigs: any[] = []

  class AnimatedValue {
    _value: number
    constructor(value: number) {
      this._value = value
    }
    setValue(value: number) {
      this._value = value
    }
  }

  class AnimatedValueXY {
    x: AnimatedValue
    y: AnimatedValue
    private offset: { x: number; y: number }
    constructor(initial: { x: number; y: number } = { x: 0, y: 0 }) {
      this.x = new AnimatedValue(initial.x)
      this.y = new AnimatedValue(initial.y)
      this.offset = { x: 0, y: 0 }
    }
    setValue(value: { x: number; y: number }) {
      this.x.setValue(value.x)
      this.y.setValue(value.y)
    }
    setOffset(offset: { x: number; y: number }) {
      this.offset = offset
    }
    flattenOffset() {
      this.x.setValue(this.x._value + this.offset.x)
      this.y.setValue(this.y._value + this.offset.y)
      this.offset = { x: 0, y: 0 }
    }
    getLayout() {
      return { left: this.x, top: this.y }
    }
  }

  return {
    // Bypasses PanResponder's real touch-history/native responder plumbing so tests
    // can invoke the grant/move/release handlers directly with fabricated gestureStates.
    PanResponder: {
      create: (config: any) => {
        panResponderConfigs.push(config)
        return { panHandlers: {} }
      },
    },
    Animated: {
      View: 'AnimatedView',
      Value: AnimatedValue,
      ValueXY: AnimatedValueXY,
      timing: (value: any, config: any) => ({
        start: (cb?: (result: { finished: boolean }) => void) => {
          value.setValue(config.toValue)
          cb && cb({ finished: true })
        },
      }),
    },
    StyleSheet: {
      create: (styles: any) => styles,
    },
    Platform: { OS: 'ios' },
    I18nManager: { isRTL: false },
    TouchableWithoutFeedback: 'TouchableWithoutFeedback',
    __panResponderConfigs: panResponderConfigs,
  }
})

import * as React from 'react'
import * as TestRenderer from 'react-test-renderer'
import * as ReactNative from 'react-native'
import { DraggableGrid, IDraggableGridProps } from '../src/draggable-grid'
import { Block } from '../src/block'

interface Item {
  key: string
  label?: string
  disabledDrag?: boolean
  disabledReSorted?: boolean
}

function getPanResponderConfigs(): any[] {
  return (ReactNative as any).__panResponderConfigs
}

function latestPanResponderConfig() {
  const configs = getPanResponderConfigs()
  return configs[configs.length - 1]
}

function renderItem(item: Item) {
  return <>{item.label ?? item.key}</>
}

function renderGrid(props: Partial<IDraggableGridProps<Item>> & { data: Item[] }) {
  let renderer!: TestRenderer.ReactTestRenderer
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <DraggableGrid numColumns={3} renderItem={renderItem} {...props} />,
    )
  })
  return renderer
}

// The grid only mounts Blocks after receiving a layout event, so tests must fire one
// to get a deterministic blockWidth/blockHeight (300 / 3 columns = 100 per block).
function fireLayout(
  renderer: TestRenderer.ReactTestRenderer,
  widthOrLayout: number | { width: number; height: number } = 300,
  height = 300,
) {
  const layout =
    typeof widthOrLayout === 'object'
      ? { x: 0, y: 0, width: widthOrLayout.width, height: widthOrLayout.height }
      : { x: 0, y: 0, width: widthOrLayout, height }
  TestRenderer.act(() => {
    const gridView = renderer.root.findByType(ReactNative.Animated.View as any)
    ;(gridView.props.onLayout as Function)({
      nativeEvent: { layout },
    })
  })
}

function findBlockByKey(renderer: TestRenderer.ReactTestRenderer, key: string) {
  return renderer.root.findAllByType(Block).find(block => block.props.item.key === key)!
}

const gestureState = (overrides: Partial<ReactNative.PanResponderGestureState>) =>
  overrides as ReactNative.PanResponderGestureState

describe('DraggableGrid fork fixes (UPOS-8099)', () => {
  const items: Item[] = [
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B' },
    { key: 'c', label: 'C' },
  ]

  it('dispatches onItemPress with correct data after reorder and delete (fix #1)', () => {
    const onItemPress = jest.fn()
    const renderer = renderGrid({ data: items, onItemPress })
    fireLayout(renderer)

    // Hold onto handlers bound before the reorder/delete, mirroring a Block whose
    // memo comparator skipped a re-render and kept its old bound closures.
    const staleOnPressB = findBlockByKey(renderer, 'b').props.onPress
    const staleOnPressC = findBlockByKey(renderer, 'c').props.onPress

    TestRenderer.act(() => {
      renderer.update(
        <DraggableGrid
          numColumns={3}
          renderItem={renderItem}
          onItemPress={onItemPress}
          data={[items[1], items[2], items[0]]}
        />,
      )
    })
    TestRenderer.act(() => {
      renderer.update(
        <DraggableGrid
          numColumns={3}
          renderItem={renderItem}
          onItemPress={onItemPress}
          data={[items[1], items[2]]}
        />,
      )
    })

    staleOnPressB()
    expect(onItemPress).toHaveBeenLastCalledWith(items[1])

    staleOnPressC()
    expect(onItemPress).toHaveBeenLastCalledWith(items[2])
  })

  it('dispatches the latest onItemPress after the prop changes', () => {
    const onItemPress1 = jest.fn()
    const onItemPress2 = jest.fn()
    const renderer = renderGrid({ data: items, onItemPress: onItemPress1 })
    fireLayout(renderer)

    // Capture the onPress closure held by a memoized Block
    const staleOnPressA = findBlockByKey(renderer, 'a').props.onPress

    TestRenderer.act(() => {
      renderer.update(
        <DraggableGrid
          numColumns={3}
          renderItem={renderItem}
          onItemPress={onItemPress2}
          data={items}
        />,
      )
    })

    staleOnPressA()
    expect(onItemPress1).not.toHaveBeenCalled()
    expect(onItemPress2).toHaveBeenCalledWith(items[0])
  })

  it('dispatches the latest onDragItemActive after the prop changes (fix #2)', () => {
    const onDragItemActive1 = jest.fn()
    const onDragItemActive2 = jest.fn()
    const renderer = renderGrid({ data: items, onDragItemActive: onDragItemActive1 })
    fireLayout(renderer)

    const onLongPress = findBlockByKey(renderer, 'a').props.onLongPress

    TestRenderer.act(() => {
      renderer.update(
        <DraggableGrid
          numColumns={3}
          renderItem={renderItem}
          onDragItemActive={onDragItemActive2}
          data={items}
        />,
      )
    })

    TestRenderer.act(() => {
      onLongPress()
    })
    expect(onDragItemActive2).toHaveBeenCalledWith(items[0])
    expect(onDragItemActive1).not.toHaveBeenCalled()
  })

  it('does not starve the resort when onDragging triggers a mid-drag re-render (fix #3)', () => {
    const onResetSort = jest.fn()

    // A real consumer re-renders on every onDragging tick (e.g. showing live drag
    // feedback) without necessarily updating `data` from onResetSort in between.
    function Wrapper() {
      const [, setTick] = React.useState(0)
      return (
        <DraggableGrid
          numColumns={3}
          renderItem={renderItem}
          data={items}
          onDragging={() => setTick(t => t + 1)}
          onResetSort={onResetSort}
        />
      )
    }

    let renderer!: TestRenderer.ReactTestRenderer
    TestRenderer.act(() => {
      renderer = TestRenderer.create(<Wrapper />)
    })
    fireLayout(renderer)

    TestRenderer.act(() => {
      findBlockByKey(renderer, 'a').props.onLongPress()
    })
    TestRenderer.act(() => {
      latestPanResponderConfig().onPanResponderGrant({}, gestureState({ x0: 0, y0: 0, moveX: 0, moveY: 0 }))
    })
    // Move #1 is throttled out (and triggers a re-render via onDragging). Move #2
    // should still perform the resort - without the fix the re-render resets the
    // throttle counter and the drag never reaches the "process" frame.
    TestRenderer.act(() => {
      latestPanResponderConfig().onPanResponderMove({}, gestureState({ moveX: 100, moveY: 0 }))
    })
    TestRenderer.act(() => {
      latestPanResponderConfig().onPanResponderMove({}, gestureState({ moveX: 100, moveY: 0 }))
    })

    expect(onResetSort).toHaveBeenCalledWith([items[1], items[0], items[2]])
  })

  it('applies the final drag position even after a single throttled move (fix #4)', () => {
    const onDragRelease = jest.fn()
    const renderer = renderGrid({ data: items, onDragRelease })
    fireLayout(renderer)

    TestRenderer.act(() => {
      findBlockByKey(renderer, 'a').props.onLongPress()
    })
    TestRenderer.act(() => {
      latestPanResponderConfig().onPanResponderGrant({}, gestureState({ x0: 0, y0: 0, moveX: 0, moveY: 0 }))
    })
    // A single move: gets throttled out and must not be discarded before release.
    TestRenderer.act(() => {
      latestPanResponderConfig().onPanResponderMove({}, gestureState({ moveX: 100, moveY: 0 }))
    })
    TestRenderer.act(() => {
      latestPanResponderConfig().onPanResponderRelease({}, gestureState({ moveX: 100, moveY: 0 }))
    })

    expect(onDragRelease).toHaveBeenCalledWith([items[1], items[0], items[2]])
  })

  it('recalculates block sizes and repositions items when grid width changes (portrait / resize)', () => {
    const items = [{ key: '1' }, { key: '2' }, { key: '3' }]
    const renderer = renderGrid({ data: items, numColumns: 3 })

    // 1. Initial layout (landscape, width 600 -> blockWidth = 200)
    fireLayout(renderer, { width: 600, height: 400 })
    expect(findBlockByKey(renderer, '2').props.style[1].left._value).toBe(200)

    // 2. Resize event (portrait/multitask, width 300 -> blockWidth = 100)
    fireLayout(renderer, { width: 300, height: 600 })
    expect(findBlockByKey(renderer, '2').props.style[1].left._value).toBe(100)
  })

  it('recalculates block heights and repositions items when itemHeight prop changes without onLayout', () => {
    const items = [{ key: '1' }, { key: '2' }, { key: '3' }, { key: '4' }]
    const renderer = renderGrid({ data: items, numColumns: 2, itemHeight: 100 })

    // 1. Initial layout (width 400, 2 columns -> blockWidth = 200, itemHeight = 100)
    fireLayout(renderer, { width: 400, height: 200 })
    // Item '3' is in row 1, col 0 -> top = 100, height = 100
    expect(findBlockByKey(renderer, '3').props.style[1].height).toBe(100)
    expect(findBlockByKey(renderer, '3').props.style[1].top._value).toBe(100)

    // 2. Update itemHeight prop from 100 to 160 (simulating orientation change row height recalculation)
    TestRenderer.act(() => {
      renderer.update(
        <DraggableGrid
          numColumns={2}
          itemHeight={160}
          renderItem={renderItem}
          data={items}
        />,
      )
    })

    // Height and top position should now be updated to 160
    expect(findBlockByKey(renderer, '3').props.style[1].height).toBe(160)
    expect(findBlockByKey(renderer, '3').props.style[1].top._value).toBe(160)
  })

  it('recalculates block positions when numColumns prop changes without onLayout', () => {
    const items = [{ key: '1' }, { key: '2' }, { key: '3' }]
    const renderer = renderGrid({ data: items, numColumns: 3 })

    fireLayout(renderer, { width: 300, height: 300 })
    // With 3 columns (width 300 -> blockWidth = 100):
    // item 3 (index 2) is at col 2, row 0 -> left = 200, top = 0
    expect(findBlockByKey(renderer, '3').props.style[1].left._value).toBe(200)
    expect(findBlockByKey(renderer, '3').props.style[1].top._value).toBe(0)

    // Update numColumns to 1
    TestRenderer.act(() => {
      renderer.update(
        <DraggableGrid
          numColumns={1}
          renderItem={renderItem}
          data={items}
        />,
      )
    })

    // With 1 column (width 300 -> blockWidth = 300, blockHeight = 300):
    // item 3 (index 2) is now at col 0, row 2 -> left = 0, top = 600
    expect(findBlockByKey(renderer, '3').props.style[1].left._value).toBe(0)
    expect(findBlockByKey(renderer, '3').props.style[1].top._value).toBe(600)
  })

  it('does not mispositon tiles when itemHeight updates before the native onLayout for a concurrent width resize arrives (orientation race)', () => {
    const items = [{ key: '1' }, { key: '2' }, { key: '3' }, { key: '4' }]
    const renderer = renderGrid({ data: items, numColumns: 2, itemHeight: 100 })

    // 1. Initial layout (landscape, width 600 -> blockWidth = 300, itemHeight = 100)
    fireLayout(renderer, { width: 600, height: 200 })
    expect(findBlockByKey(renderer, '3').props.style[1].top._value).toBe(100)

    // 2. Orientation change begins: the JS-driven itemHeight prop updates first,
    // BEFORE the native onLayout for the new (narrower) width is delivered -
    // simulating the real device rotation race.
    TestRenderer.act(() => {
      renderer.update(
        <DraggableGrid
          numColumns={2}
          itemHeight={160}
          renderItem={renderItem}
          data={items}
        />,
      )
    })

    // Height must already reflect the new itemHeight, and width must remain
    // untouched by the stale gridLayout.width (still 600 at this point).
    expect(findBlockByKey(renderer, '3').props.style[1].height).toBe(160)
    expect(findBlockByKey(renderer, '3').props.style[1].width).toBe(300)
    expect(findBlockByKey(renderer, '3').props.style[1].top._value).toBe(160)

    // 3. The native onLayout for the rotated (narrower) width finally arrives.
    fireLayout(renderer, { width: 300, height: 400 })

    // Final state must reflect both the new width and height correctly.
    expect(findBlockByKey(renderer, '3').props.style[1].width).toBe(150)
    expect(findBlockByKey(renderer, '3').props.style[1].height).toBe(160)
    expect(findBlockByKey(renderer, '3').props.style[1].top._value).toBe(160)
    expect(findBlockByKey(renderer, '3').props.style[1].left._value).toBe(0)
  })

  it('honors an explicit itemWidth prop and repositions immediately without waiting for onLayout (avoids assumed-vs-measured width mismatches)', () => {
    const items = [{ key: '1' }, { key: '2' }, { key: '3' }, { key: '4' }]
    const renderer = renderGrid({
      data: items,
      numColumns: 2,
      itemWidth: 200,
      itemHeight: 100,
    })

    // The native container is wider than itemWidth*numColumns (e.g. it includes
    // extra padding the consumer already accounted for in its own itemWidth calc).
    fireLayout(renderer, { width: 500, height: 200 })
    expect(findBlockByKey(renderer, '3').props.style[1].width).toBe(200)
    expect(findBlockByKey(renderer, '3').props.style[1].left._value).toBe(0)

    // Orientation change: consumer recomputes both itemWidth and itemHeight itself,
    // independent of any native re-measurement.
    TestRenderer.act(() => {
      renderer.update(
        <DraggableGrid
          numColumns={2}
          itemWidth={120}
          itemHeight={160}
          renderItem={renderItem}
          data={items}
        />,
      )
    })

    // Should update immediately from the props, without any onLayout event.
    expect(findBlockByKey(renderer, '3').props.style[1].width).toBe(120)
    expect(findBlockByKey(renderer, '3').props.style[1].height).toBe(160)
    expect(findBlockByKey(renderer, '3').props.style[1].top._value).toBe(160)
    expect(findBlockByKey(renderer, '4').props.style[1].left._value).toBe(120)
  })
})
