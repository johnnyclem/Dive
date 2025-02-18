import React from 'react'
import * as Portal from '@radix-ui/react-portal'
import { DismissableLayer } from '@radix-ui/react-dismissable-layer'
type TPopupWindowProps = {
  children: React.ReactNode
  zIndex?: number,
  onClickOutside?: () => void,
}
export default function PopupWindow({ children, zIndex = 100, onClickOutside = () => { } }: TPopupWindowProps) {
  const root = document.body
  return (
    <Portal.Root container={root}>
      <div className="container-wrapper" style={{ zIndex }}>
        <DismissableLayer onPointerDownOutside={onClickOutside}>
          {children}
        </DismissableLayer>
      </div>
    </Portal.Root>
  )
}
