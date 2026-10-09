/** @format */

import * as React from 'react'
import {
  Animated,
  StyleProp,
  TouchableWithoutFeedback,
  StyleSheet,
  GestureResponderHandlers,
} from 'react-native'
import { FunctionComponent } from 'react'

interface BlockProps<DataType = any> {
  style?: StyleProp<any>
  dragStartAnimationStyle: StyleProp<any>
  onPress?: () => void
  onLongPress: () => void
  onPressOut?: () => void
  panHandlers: GestureResponderHandlers
  delayLongPress: number
  children?: React.ReactNode
  item?: DataType
  order?: number
  renderItem?: (item: DataType, order: number) => React.ReactElement<any>
  blockWidth?: number
  blockHeight?: number
}

const Block: FunctionComponent<BlockProps> = ({
  style,
  dragStartAnimationStyle,
  onPress,
  onLongPress,
  onPressOut,
  children,
  panHandlers,
  delayLongPress,
  item,
  order,
  renderItem,
}) => {
  return (
    <Animated.View style={[styles.blockContainer, style, dragStartAnimationStyle]} {...panHandlers}>
      <Animated.View>
        <TouchableWithoutFeedback
          delayLongPress={delayLongPress}
          onPress={onPress}
          onLongPress={onLongPress}
          onPressOut={onPressOut}>
          {renderItem && item !== undefined && order !== undefined
            ? renderItem(item, order)
            : children}
        </TouchableWithoutFeedback>
      </Animated.View>
    </Animated.View>
  )
}

// Memoized so non-dragged blocks do not re-render while another item is dragged.
// The style prop's top/left are Animated.Value references that drive layout on the native
// thread without React re-renders; its plain-number width/height are mirrored by
// blockWidth/blockHeight so we only compare props that affect the React tree.
const MemoizedBlock = React.memo(Block, (prev, next) => {
  if (prev.dragStartAnimationStyle !== next.dragStartAnimationStyle) return false
  if (prev.delayLongPress !== next.delayLongPress) return false
  if (prev.item !== next.item) return false
  if (prev.order !== next.order) return false
  if (prev.renderItem !== next.renderItem) return false
  // width/height in style are plain numbers (not Animated), so size changes must re-render.
  if (prev.blockWidth !== next.blockWidth) return false
  if (prev.blockHeight !== next.blockHeight) return false
  if (!prev.renderItem && !next.renderItem && prev.children !== next.children) return false
  // style/onPress/onLongPress/onPressOut/panHandlers may be new references each parent render
  // but rely on mutable refs/Animated values; skipping them prevents drag cascades.
  return true
})
MemoizedBlock.displayName = 'Block'

export { MemoizedBlock as Block }

const styles = StyleSheet.create({
  blockContainer: {
    alignItems: 'center',
  },
})
